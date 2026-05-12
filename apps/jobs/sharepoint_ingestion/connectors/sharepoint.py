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

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".csv", ".docx", ".pptx", ".doc", ".xlsx"}


class SharePointConnector:
    """Handles authentication and file listing/download from SharePoint via Graph API."""

    def __init__(self):
        self._access_token: Optional[str] = None

    # ─── Authentication ───────────────────────────────────────────────────────

    def _acquire_token(self) -> str:
        app = msal.ConfidentialClientApplication(
            client_id=settings.CLIENT_ID,
            client_credential=settings.CLIENT_SECRET,
            authority=settings.authority,
        )
        token_resp = app.acquire_token_silent(scopes=settings.graph_scopes, account=None)
        if not token_resp:
            token_resp = app.acquire_token_for_client(scopes=settings.graph_scopes)
        if "access_token" not in token_resp:
            raise RuntimeError(f"Could not acquire access token: {token_resp}")
        logger.info("Access token acquired successfully")
        return token_resp["access_token"]

    @property
    def access_token(self) -> str:
        if not self._access_token:
            self._access_token = self._acquire_token()
        return self._access_token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.access_token}"}

    def refresh_token(self):
        """Force token refresh — call if a 401 is encountered mid-job."""
        self._access_token = None
        _ = self.access_token

    # ─── Site / Drive resolution ──────────────────────────────────────────────

    def get_site_id(self) -> str:
        url = (
            f"https://graph.microsoft.com/v1.0/sites/"
            f"{settings.TENANT_NAME}:/{settings.SHAREPOINT_SITE_PATH}"
        )
        r = requests.get(url, headers=self._headers(), timeout=30)
        r.raise_for_status()
        site_id = r.json()["id"]
        logger.info(f"Resolved site id: {site_id}")
        return site_id

    def get_drive_id(self, site_id: str) -> str:
        url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
        r = requests.get(url, headers=self._headers(), timeout=30)
        r.raise_for_status()
        for drive in r.json().get("value", []):
            if drive["name"] == settings.DOCUMENT_LIBRARY_NAME:
                logger.info(f"Resolved drive id for '{settings.DOCUMENT_LIBRARY_NAME}': {drive['id']}")
                return drive["id"]
        raise RuntimeError(
            f"Document library '{settings.DOCUMENT_LIBRARY_NAME}' not found in site {site_id}"
        )

    # ─── File listing ─────────────────────────────────────────────────────────

    def list_folder(self, drive_id: str, folder_path: str = "") -> list:
        """
        Recursively list all allowed-extension files under folder_path.
        Returns a flat list of file-info dicts.
        """
        if folder_path:
            url = (
                f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
                f"/root:/{folder_path}:/children"
            )
        else:
            url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"

        r = requests.get(url, headers=self._headers(), timeout=30)
        r.raise_for_status()

        files = []
        for item in r.json().get("value", []):
            item_path = f"{folder_path}/{item['name']}" if folder_path else item["name"]

            if "folder" in item:
                files.extend(self.list_folder(drive_id, item_path))
            elif "file" in item:
                ext = os.path.splitext(item["name"])[1].lower()
                if ext in ALLOWED_EXTENSIONS:
                    files.append({
                        "name": item["name"],
                        "path": item_path,
                        "last_modified": item.get("lastModifiedDateTime", ""),
                        "size": item.get("size", 0),
                        "web_url": item.get("webUrl", ""),
                        "drive_id": drive_id,
                    })

        return files

    # ─── File download ────────────────────────────────────────────────────────

    def download_file(self, drive_id: str, sharepoint_path: str) -> bytes:
        """Download file binary content from SharePoint. Returns raw bytes."""
        url = (
            f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
            f"/root:/{sharepoint_path}:/content"
        )
        r = requests.get(url, headers=self._headers(), timeout=120, stream=True)

        if r.status_code in (403, 404):
            raise PermissionError(
                f"Access denied or file not found: {sharepoint_path} [{r.status_code}]"
            )
        r.raise_for_status()
        return r.content
