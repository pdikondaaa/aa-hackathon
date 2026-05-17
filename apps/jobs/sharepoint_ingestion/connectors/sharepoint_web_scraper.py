"""
SharePoint site scraper — URL-based, no Azure AD app registration required.

Flow:
  1. Login — Playwright opens a browser and handles Microsoft SSO.
             On first run the browser is headed so the user can complete
             MFA.  Session cookies are saved to disk afterward.
  2. Subsequent runs — cookies loaded from disk, browser runs headless.
             If the session has expired a re-login is triggered automatically.
  3. Data   — SharePoint REST API (_api/web) is called with the saved
             session cookies via requests.Session for speed.
  4. HTML   — Playwright navigates each page URL to get fully rendered
             HTML (handles SPFx / Viva-rendered content).

Usage from web_scraper_service.py:
    with SharePointSiteScraper(settings.SHAREPOINT_SITE_URL) as scraper:
        scraper.ensure_login(email, password)
        pages = scraper.list_pages()
        for page in pages:
            html = scraper.get_page_html(page["url"])

Configuration (.env):
    SHAREPOINT_SITE_URL          = https://alignedautomation.sharepoint.com/sites/Nexus
    SHAREPOINT_LOGIN_EMAIL       = you@alignedautomation.com
    SHAREPOINT_LOGIN_PASSWORD    = your-password-or-app-password
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

from utils.logging_config import get_logger

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_REST_HEADERS = {
    "Accept": "application/json;odata=verbose",
    "Content-Type": "application/json;odata=verbose",
}

# SharePoint page loads can be slow on first visit
_PAGE_LOAD_TIMEOUT_MS = 90_000

# Pause between page navigations (seconds) — be polite to the server
_PAGE_THROTTLE_S = 0.5

# Lists that are always present but contain no useful knowledge
_SYSTEM_LISTS = frozenset({
    "appdata", "cache profiles", "converted forms", "customized reports",
    "form templates", "list template gallery", "master page gallery",
    "relationships list", "reusable content", "site assets",
    "site collection documents", "site collection images", "site pages",
    "solution gallery", "style library", "theme gallery",
    "translation packages", "user information list", "web part gallery",
    "workflow history", "workflow tasks",
})

# Selectors to try when waiting for SharePoint page content to render
_CONTENT_SELECTORS = [
    "[data-automation-id='contentArea']",
    ".ms-rtestate-field",
    ".ms-webpart-zone",
    "#contentRow",
    "article",
    "main",
    "#s4-bodyContainer",
]


class SessionExpiredError(Exception):
    """Raised when SharePoint REST API returns 401/403 due to stale cookies."""


class SharePointSiteScraper:
    """
    Scrapes SharePoint pages and lists using Playwright auth + REST API.

    Use as a context manager to ensure the Playwright browser is always closed:

        with SharePointSiteScraper("https://tenant.sharepoint.com/sites/Nexus") as s:
            s.ensure_login(email, password)
            pages = s.list_pages()
    """

    def __init__(self, site_url: str, session_file: Optional[str] = None):
        self.site_url = site_url.rstrip("/")
        parsed = urlparse(self.site_url)
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"  # https://tenant.sharepoint.com
        self.tenant_host = parsed.netloc                       # tenant.sharepoint.com

        # Session cookie persistence
        default_session_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "storage",
        )
        Path(default_session_dir).mkdir(parents=True, exist_ok=True)
        self._session_file = session_file or os.path.join(
            default_session_dir, ".playwright_session.json"
        )

        # Internal state
        self._http: Optional[requests.Session] = None  # authenticated HTTP session
        self._pw = None            # playwright instance
        self._browser = None       # playwright browser
        self._context = None       # playwright browser context
        self._page = None          # reusable playwright page

    # ── Context manager ───────────────────────────────────────────────────────

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def close(self):
        """Release Playwright browser resources."""
        try:
            if self._page:
                self._page.close()
            if self._context:
                self._context.close()
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception as exc:
            logger.debug(f"Error during browser cleanup: {exc}")

    # ── Login / session management ────────────────────────────────────────────

    def ensure_login(self, email: str, password: str) -> None:
        """
        Ensure we have a valid authenticated session.

        1. Tries to load saved cookies from disk.
        2. If cookies are absent or stale, triggers a Playwright login.
           - First run (no saved session): headed mode so the user can
             complete MFA manually.
           - Re-login after expiry: also headed (MFA may appear again).
        3. Saves cookies to disk after a successful login.
        4. Sets up a requests.Session with the SharePoint cookies for
           fast REST API calls.
        """
        if self._try_load_session():
            logger.info("Loaded existing SharePoint session from disk")
            return

        logger.info("No valid session found — starting browser login")
        self._playwright_login(email, password, headless=False)

    def _try_load_session(self) -> bool:
        """
        Load cookies from disk and verify the session is still alive.
        Returns True if session is valid, False otherwise.
        """
        if not os.path.exists(self._session_file):
            return False

        try:
            with open(self._session_file, "r", encoding="utf-8") as fh:
                state = json.load(fh)
        except (json.JSONDecodeError, OSError):
            return False

        # Build HTTP session from saved cookies
        http = requests.Session()
        for cookie in state.get("cookies", []):
            http.cookies.set(
                cookie["name"], cookie["value"],
                domain=cookie.get("domain", ""),
            )

        # Verify with a lightweight REST API ping
        try:
            r = http.get(
                f"{self.site_url}/_api/web?$select=Title",
                headers=_REST_HEADERS,
                timeout=15,
            )
            if r.status_code in (200, 201):
                self._http = http
                self._init_playwright_context(state)
                logger.info("Session verification passed")
                return True
            logger.debug(f"Session check returned {r.status_code}, need re-login")
            return False
        except Exception as exc:
            logger.debug(f"Session check error: {exc}")
            return False

    def _playwright_login(self, email: str, password: str, headless: bool) -> None:
        """
        Open a Playwright browser, navigate to SharePoint, and complete the
        Microsoft SSO login flow.  Saves the session state after success.
        """
        if not headless:
            logger.info(
                ">>> A browser window will open. Complete login (including MFA) "
                "manually, then the scraper will continue automatically. <<<"
            )
        self._launch_browser(headless)
        try:
            self._page.goto(self.site_url, timeout=_PAGE_LOAD_TIMEOUT_MS)
        except Exception:
            pass  # redirect chains may throw; we'll wait for the login page

        # Microsoft auth uses several intermediate redirect pages that have no
        # login form.  Wait until we are past all of them before deciding whether
        # to show the email/password form.
        #   SAS/ProcessAuth   — Seamless SSO (Kerberos/PRT) probe
        #   _forms/default.aspx — SharePoint Forms-auth redirect handler
        try:
            self._page.wait_for_function(
                """() => {
                    const u = window.location.href;
                    return !u.includes('SAS/ProcessAuth') &&
                           !u.includes('/_forms/default.aspx');
                }""",
                timeout=45_000,
            )
        except Exception:
            pass  # wasn't on those pages, or timed out — proceed anyway

        # If the browser already landed on SharePoint content, auth is done.
        if self._page.url.startswith(self.base_url):
            logger.info(f"Already authenticated — landed on {self._page.url}")
            self._persist_session()
            return

        self._fill_microsoft_login(email, password)
        self._await_post_login_screens()
        self._persist_session()

    def _launch_browser(self, headless: bool) -> None:
        """Launch Playwright Chromium and create a fresh browser context + page."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise RuntimeError(
                "Playwright is not installed. "
                "Run: pip install playwright && playwright install chromium"
            )
        logger.info(f"Opening browser (headless={headless}) for SharePoint login")
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        self._context = self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        self._page = self._context.new_page()

    _EMAIL_SEL = "input[type=email], input[name=loginfmt]:not([type=hidden])"
    _PASS_SEL = "input[type=password], input[name=passwd]:not([type=hidden])"

    def _fill_microsoft_login(self, email: str, password: str) -> None:
        """Fill the Microsoft SSO email and password fields."""
        try:
            # Microsoft login uses heavy JS rendering — wait for the form to settle
            try:
                self._page.wait_for_load_state("networkidle", timeout=15_000)
            except Exception:
                pass  # proceed even if networkidle times out

            # Capture element handles so fill() acts on the exact visible element,
            # not a re-evaluated selector that might return the hidden loginfmt input
            el = self._page.wait_for_selector(
                self._EMAIL_SEL, state="visible", timeout=30_000
            )
            el.fill(email)
            self._page.keyboard.press("Enter")
            logger.info("Email submitted")

            el = self._page.wait_for_selector(
                self._PASS_SEL, state="visible", timeout=20_000
            )
            el.fill(password)
            self._page.keyboard.press("Enter")
            logger.info("Password submitted")
        except Exception as exc:
            raise RuntimeError(
                f"Could not complete Microsoft login: {exc}. "
                "Check SHAREPOINT_LOGIN_EMAIL and SHAREPOINT_LOGIN_PASSWORD."
            ) from exc

    def _await_post_login_screens(self) -> None:
        """Handle 'Stay signed in?' prompt and wait for SharePoint to load."""
        logger.info("Waiting for SharePoint to load (complete any MFA prompts)…")
        try:
            self._page.wait_for_selector("#idSIButton9", timeout=10_000)
            self._page.click("#idSIButton9")
            logger.info("Clicked 'Stay signed in'")
        except Exception:
            pass  # prompt didn't appear — fine

        try:
            self._page.wait_for_function(
                f"() => window.location.href.startsWith('{self.base_url}')",
                timeout=120_000,  # give user up to 2 min to complete MFA
            )
        except Exception as exc:
            raise RuntimeError(
                "Timed out waiting for SharePoint after login. "
                "If MFA is required, the browser must be in headed mode."
            ) from exc
        logger.info(f"Login successful — landed on {self._page.url}")

    def _persist_session(self) -> None:
        """Save Playwright storage state to disk and build the requests.Session."""
        state = self._context.storage_state()
        with open(self._session_file, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
        logger.info(f"Session saved to {self._session_file}")
        self._build_http_session(state)

    def _build_http_session(self, state: dict) -> None:
        """Create a requests.Session pre-loaded with SharePoint auth cookies."""
        self._http = requests.Session()
        for cookie in state.get("cookies", []):
            self._http.cookies.set(
                cookie["name"], cookie["value"],
                domain=cookie.get("domain", ""),
            )

    def _init_playwright_context(self, state: dict) -> None:
        """
        Restore a Playwright browser context from saved storage state so we can
        navigate pages for HTML extraction (headless, no login needed).
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.warning(
                "Playwright not installed — page HTML will be fetched via REST only"
            )
            return

        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        self._context = self._browser.new_context(storage_state=state)
        self._page = self._context.new_page()

    # ── REST API helpers ──────────────────────────────────────────────────────

    def _rest_get(self, path: str, params: Optional[dict] = None) -> dict:
        """
        Authenticated GET against the SharePoint REST API.
        Raises SessionExpiredError if the response indicates auth failure.
        """
        url = f"{self.site_url}/_api/{path}"
        r = self._http.get(url, headers=_REST_HEADERS, params=params, timeout=30)
        if r.status_code in (401, 403):
            raise SessionExpiredError(
                f"SharePoint REST API returned {r.status_code} for {path}. "
                "Session may have expired — delete storage/.playwright_session.json "
                "and run again to re-login."
            )
        r.raise_for_status()
        data = r.json()
        # OData verbose wraps results in {"d": ...}
        return data.get("d", data)

    def _rest_get_all(self, path: str) -> list[dict]:
        """
        Follow SharePoint REST API pagination (__next link) and collect all rows.
        """
        results: list[dict] = []
        url = f"{self.site_url}/_api/{path}"

        while url:
            r = self._http.get(url, headers=_REST_HEADERS, timeout=30)
            if r.status_code in (401, 403):
                raise SessionExpiredError(f"Session expired fetching {url}")
            r.raise_for_status()
            data = r.json()
            d = data.get("d", data)
            rows = d.get("results", d) if isinstance(d, dict) else d
            if isinstance(rows, list):
                results.extend(rows)
            # Follow next page
            url = data.get("d", {}).get("__next") or data.get("__next")
            time.sleep(_PAGE_THROTTLE_S)

        return results

    # ── Site pages ────────────────────────────────────────────────────────────

    def list_pages(self) -> list[dict]:
        """
        Return all site pages from the 'Site Pages' library.

        Each dict: { title, url, last_modified, server_relative_url }
        """
        items = self._rest_get_all(
            "web/lists/GetByTitle('Site Pages')/items"
            "?$select=Title,FileLeafRef,FileDirRef,Modified"
            "&$orderby=Modified desc"
            "&$top=500"
        )

        pages: list[dict] = []
        for item in items:
            file_name = item.get("FileLeafRef", "")
            dir_ref = item.get("FileDirRef", "")
            if not file_name.lower().endswith(".aspx"):
                continue
            server_rel = f"{dir_ref}/{file_name}"
            pages.append({
                "title": item.get("Title") or file_name.replace(".aspx", ""),
                "server_relative_url": server_rel,
                "url": f"{self.base_url}{server_rel}",
                "last_modified": item.get("Modified", ""),
            })

        logger.info(f"Discovered {len(pages)} site page(s)")
        return pages

    def get_page_html(self, page_url: str) -> str:
        """
        Navigate to *page_url* with the authenticated Playwright context and
        return the fully rendered HTML body (handles SPFx / Viva content).

        Falls back to an HTTP GET of the raw .aspx file if Playwright is
        unavailable.
        """
        if self._page is None:
            # Playwright not available — fetch raw file via HTTP
            return self._get_raw_aspx(page_url)

        try:
            logger.debug(f"Navigating to: {page_url}")
            self._page.goto(page_url, timeout=_PAGE_LOAD_TIMEOUT_MS)

            # Wait for at least one known content container to appear
            loaded = False
            for sel in _CONTENT_SELECTORS:
                try:
                    self._page.wait_for_selector(sel, timeout=8_000)
                    loaded = True
                    break
                except Exception:
                    continue

            if not loaded:
                # Fall back to networkidle if no known selector appeared
                try:
                    self._page.wait_for_load_state("networkidle", timeout=20_000)
                except Exception:
                    pass

            html = self._page.inner_html("body")
            logger.debug(f"  HTML size: {len(html):,} bytes")
            time.sleep(_PAGE_THROTTLE_S)
            return html

        except Exception as exc:
            logger.warning(f"Playwright failed for {page_url}: {exc}")
            return self._get_raw_aspx(page_url)

    def _get_raw_aspx(self, page_url: str) -> str:
        """HTTP GET of the raw .aspx file as fallback."""
        try:
            r = self._http.get(page_url, timeout=30)
            r.raise_for_status()
            return r.text
        except Exception as exc:
            logger.warning(f"Raw HTTP GET failed for {page_url}: {exc}")
            return ""

    # ── SharePoint lists ──────────────────────────────────────────────────────

    def list_all_lists(self) -> list[dict]:
        """
        Return all non-hidden, non-system SharePoint lists (document libraries
        are BaseType=1; custom/generic lists are BaseType=0).

        Each dict: { id, title, description, base_type }
        """
        d = self._rest_get(
            "web/lists"
            "?$filter=Hidden eq false"
            "&$select=Id,Title,Description,BaseType"
        )
        raw = d.get("results", [])
        sp_lists = []
        for lst in raw:
            title = lst.get("Title", "")
            if title.lower() in _SYSTEM_LISTS:
                continue
            sp_lists.append({
                "id": lst.get("Id", ""),
                "title": title,
                "description": lst.get("Description", ""),
                "base_type": lst.get("BaseType", 0),  # 0=list, 1=doc library
            })

        logger.info(f"Discovered {len(sp_lists)} usable list(s)")
        return sp_lists

    def get_list_items_as_text(self, list_title: str) -> str:
        """
        Fetch all items from a SharePoint list and format as structured plain text.

        Uses FieldValuesAsText to get display-formatted values (not raw IDs).
        Handles pagination automatically (1 000 rows per page).
        """
        encoded = list_title.replace("'", "''")
        items = self._rest_get_all(
            f"web/lists/GetByTitle('{encoded}')/items"
            "?$expand=FieldValuesAsText"
            "&$top=1000"
        )

        if not items:
            logger.info(f"List '{list_title}' has no items")
            return ""

        _SKIP = frozenset({
            "ID", "Id", "ContentTypeId", "Modified", "Created",
            "AuthorId", "EditorId", "OData__UIVersionString",
            "Attachments", "Edit", "LinkTitleNoMenu", "LinkTitle",
            "DocIcon", "ItemChildCount", "FolderChildCount",
            "ContentType",
        })

        lines = [f"SharePoint List: {list_title}", "=" * 60]
        for idx, item in enumerate(items, 1):
            lines.extend(self._format_list_item(idx, item, _SKIP))

        logger.info(f"Fetched {len(items)} item(s) from list '{list_title}'")
        return "\n".join(lines)

    @staticmethod
    def _format_list_item(idx: int, item: dict, skip: frozenset) -> list[str]:
        """Format one list item as labelled lines.  Returns [] when all fields are blank."""
        fvt = item.get("FieldValuesAsText") or {}
        # FieldValuesAsText may be a deferred link object rather than a real dict
        if fvt.get("__deferred"):
            return []
        parts: list[str] = []
        for key, val in fvt.items():
            if key.startswith("@") or key.startswith("_") or key in skip:
                continue
            if not val or val == "0" or not val.strip():
                continue
            parts.append(f"  {key}: {val}")
        if not parts:
            return []
        return [f"Item {idx}:", *parts, "-" * 40]

    # ── Document library file metadata (bonus: no download) ───────────────────

    def list_library_files(self, library_title: str) -> list[dict]:
        """
        Return file metadata from a document library (no download).
        Useful for surfacing file names / URLs as knowledge without full extraction.
        Each dict: { name, url, last_modified, file_size }
        """
        encoded = library_title.replace("'", "''")
        items = self._rest_get_all(
            f"web/lists/GetByTitle('{encoded}')/items"
            "?$select=FileLeafRef,FileRef,Modified,File_x0020_Size"
            "&$top=500"
        )
        files = []
        for item in items:
            files.append({
                "name": item.get("FileLeafRef", ""),
                "url": f"{self.base_url}{item.get('FileRef', '')}",
                "last_modified": item.get("Modified", ""),
                "file_size": item.get("File_x0020_Size", 0),
            })
        logger.info(
            f"Found {len(files)} file(s) in library '{library_title}'"
        )
        return files
