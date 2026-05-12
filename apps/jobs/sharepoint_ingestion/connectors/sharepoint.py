"""
SharePoint connector using MSAL + Microsoft Graph API.

This module is the ONLY place in the platform that talks to SharePoint.
Runtime agents and API gateway must never import from here.
"""

import os
from typing import Optional

import msal
import requests

from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".csv",
    ".docx",
    ".pptx",
    ".doc",
    ".xlsx",
}


class SharePointConnector:
    """
    Handles authentication and file listing/download
    from SharePoint via Graph API.
    """

    def __init__(self):
        self._access_token: Optional[str] = None

    # ──────────────────────────────────────────────────────────────────────
    # Authentication
    # ──────────────────────────────────────────────────────────────────────

    def _acquire_token(self) -> str:

        app = msal.ConfidentialClientApplication(
            client_id=settings.CLIENT_ID,
            client_credential=settings.CLIENT_SECRET,
            authority=settings.authority,
        )

        token_resp = app.acquire_token_silent(
            scopes=settings.graph_scopes,
            account=None,
        )

        if not token_resp:
            token_resp = app.acquire_token_for_client(
                scopes=settings.graph_scopes
            )

        if "access_token" not in token_resp:
            raise RuntimeError(
                f"Could not acquire access token: {token_resp}"
            )

        logger.info("Access token acquired successfully")

        return token_resp["access_token"]

    @property
    def access_token(self) -> str:

        if not self._access_token:
            self._access_token = self._acquire_token()

        return self._access_token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}"
        }

    def refresh_token(self):
        """
        Force token refresh.
        """

        self._access_token = None
        _ = self.access_token

    # ──────────────────────────────────────────────────────────────────────
    # Site / Drive Resolution
    # ──────────────────────────────────────────────────────────────────────

    def _resolve_site_id(self, site_path: str) -> str:
        """
        Resolve SharePoint site ID from site path.
        """

        url = (
            f"https://graph.microsoft.com/v1.0/sites/"
            f"{settings.TENANT_NAME}:/{site_path}"
        )

        r = requests.get(
            url,
            headers=self._headers(),
            timeout=30,
        )

        r.raise_for_status()

        site_id = r.json()["id"]

        logger.info(
            f"Resolved site path '{site_path}' "
            f"to site id '{site_id}'"
        )

        return site_id

    def get_site_id(self) -> str:

        site_id = self._resolve_site_id(
            settings.SHAREPOINT_SITE_PATH
        )

        logger.info(
            f"Resolved primary site id: {site_id}"
        )

        return site_id

    def get_drive_id(self, site_id: str) -> str:
        """
        Resolve document library (drive) for a site.

        Priority:
        1. Configured library name
        2. First available drive fallback
        """

        url = (
            f"https://graph.microsoft.com/v1.0/"
            f"sites/{site_id}/drives"
        )

        r = requests.get(
            url,
            headers=self._headers(),
            timeout=30,
        )

        r.raise_for_status()

        drives = r.json().get("value", [])

        if not drives:
            raise RuntimeError(
                f"No document libraries found in site {site_id}"
            )

        logger.info(
            f"Available drives for site {site_id}: "
            f"{[d.get('name') for d in drives]}"
        )

        # Preferred drive first
        for drive in drives:

            if (
                drive["name"].lower()
                == settings.DOCUMENT_LIBRARY_NAME.lower()
            ):

                logger.info(
                    f"Using preferred drive "
                    f"'{drive['name']}' "
                    f"for site {site_id}"
                )

                return drive["id"]

        # Fallback
        fallback_drive = drives[0]

        logger.warning(
            f"Preferred library "
            f"'{settings.DOCUMENT_LIBRARY_NAME}' "
            f"not found in site {site_id}. "
            f"Using fallback drive "
            f"'{fallback_drive['name']}'"
        )

        return fallback_drive["id"]

    # ──────────────────────────────────────────────────────────────────────
    # Subsite Discovery
    # ──────────────────────────────────────────────────────────────────────

    def _collect_all_subsites(
        self,
        site_id: str,
        collected: list,
        seen: set,
    ):
        """
        Recursively collect all nested subsites.
        Handles pagination automatically.
        """

        url = (
            f"https://graph.microsoft.com/v1.0/"
            f"sites/{site_id}/sites"
        )

        while url:

            try:

                logger.info(
                    f"Fetching subsites from: {url}"
                )

                r = requests.get(
                    url,
                    headers=self._headers(),
                    timeout=30,
                )

                r.raise_for_status()

                data = r.json()

            except Exception as exc:

                logger.warning(
                    f"Could not list subsites "
                    f"for site {site_id}: {exc}"
                )

                break

            for sub in data.get("value", []):

                sub_id = sub["id"]

                if sub_id in seen:
                    continue

                seen.add(sub_id)

                name = (
                    sub.get("displayName")
                    or sub.get("name")
                    or sub_id
                )

                logger.info(
                    f"Discovered subsite: {name}"
                )

                collected.append((sub_id, name))

                # Recursive discovery
                self._collect_all_subsites(
                    sub_id,
                    collected,
                    seen,
                )

            url = data.get("@odata.nextLink")

    # ──────────────────────────────────────────────────────────────────────
    # File Listing
    # ──────────────────────────────────────────────────────────────────────

    def list_all_files(self, site_id: str) -> list:
        """
        List all eligible files from root site
        and all nested subsites.
        """

        sites_to_scan = [(site_id, "parent")]

        seen = {site_id}

        self._collect_all_subsites(
            site_id,
            sites_to_scan,
            seen,
        )

        logger.info(
            f"Total sites discovered: "
            f"{len(sites_to_scan)}"
        )

        for _, site_name in sites_to_scan:
            logger.info(
                f"Discovered site: {site_name}"
            )

        all_files = []

        for sid, name in sites_to_scan:

            logger.info(
                f"========== "
                f"SCANNING SITE: {name} "
                f"=========="
            )

            try:

                drive_id = self.get_drive_id(sid)

                logger.info(
                    f"Resolved drive id '{drive_id}' "
                    f"for site '{name}'"
                )

                files = self.list_folder(drive_id)

                logger.info(
                    f"Site '{name}' returned "
                    f"{len(files)} eligible file(s)"
                )

                all_files.extend(files)

            except Exception as exc:

                logger.warning(
                    f"Site '{name}' skipped "
                    f"due to error: {exc}"
                )

        logger.info(
            f"TOTAL FILES COLLECTED: "
            f"{len(all_files)}"
        )

        return all_files

    def list_folder(
        self,
        drive_id: str,
        folder_path: str = "",
    ) -> list:
        """
        Recursively list all files from drive/folder.
        Handles pagination automatically.
        """

        if folder_path:

            url = (
                f"https://graph.microsoft.com/v1.0/"
                f"drives/{drive_id}"
                f"/root:/{folder_path}:/children"
            )

        else:

            url = (
                f"https://graph.microsoft.com/v1.0/"
                f"drives/{drive_id}/root/children"
            )

        files = []

        while url:

            logger.info(
                f"Scanning URL: {url}"
            )

            r = requests.get(
                url,
                headers=self._headers(),
                timeout=30,
            )

            r.raise_for_status()

            data = r.json()

            items = data.get("value", [])

            logger.info(
                f"Found {len(items)} item(s) "
                f"in folder "
                f"'{folder_path or 'root'}'"
            )

            for item in items:

                item_name = item["name"]

                item_path = (
                    f"{folder_path}/{item_name}"
                    if folder_path
                    else item_name
                )

                # Folder recursion
                if "folder" in item:

                    logger.info(
                        f"Entering folder: "
                        f"{item_path}"
                    )

                    try:

                        files.extend(
                            self.list_folder(
                                drive_id,
                                item_path,
                            )
                        )

                    except Exception as exc:

                        logger.warning(
                            f"Could not scan folder "
                            f"'{item_path}': {exc}"
                        )

                # File
                elif "file" in item:

                    ext = os.path.splitext(
                        item_name
                    )[1].lower()

                    if ext in ALLOWED_EXTENSIONS:

                        logger.info(
                            f"Adding file: "
                            f"{item_path}"
                        )

                        files.append({
                            "name": item_name,
                            "path": item_path,
                            "last_modified": item.get(
                                "lastModifiedDateTime",
                                "",
                            ),
                            "size": item.get(
                                "size",
                                0,
                            ),
                            "web_url": item.get(
                                "webUrl",
                                "",
                            ),
                            "drive_id": drive_id,
                        })

            # Pagination
            url = data.get("@odata.nextLink")

            if url:
                logger.info(
                    "Fetching next page..."
                )

        return files

    # ──────────────────────────────────────────────────────────────────────
    # File Download
    # ──────────────────────────────────────────────────────────────────────

    def download_file(
        self,
        drive_id: str,
        sharepoint_path: str,
    ) -> bytes:
        """
        Download file content from SharePoint.
        """

        url = (
            f"https://graph.microsoft.com/v1.0/"
            f"drives/{drive_id}"
            f"/root:/{sharepoint_path}:/content"
        )

        r = requests.get(
            url,
            headers=self._headers(),
            timeout=120,
            stream=True,
        )

        if r.status_code in (403, 404):

            raise PermissionError(
                f"Access denied or file not found: "
                f"{sharepoint_path} "
                f"[{r.status_code}]"
            )

        r.raise_for_status()

        logger.info(
            f"Downloaded file: "
            f"{sharepoint_path}"
        )

        return r.content