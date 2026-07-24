"""
Microsoft Graph profile photo service — app-only (client credentials) auth.
Reuses the same Azure AD app registration as the shared-calendar integration
(graph_calendar_controller.py); that registration already has photo read access.
"""
import os
import time
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[5] / ".env")

_TENANT_ID     = os.environ.get("AZURE_TENANT_ID", "")
_CLIENT_ID     = os.environ.get("SHAREPOINT_CLIENT_ID", "")
_CLIENT_SECRET = os.environ.get("SHAREPOINT_CLIENT_SECRET", "")
_GRAPH         = "https://graph.microsoft.com/v1.0"

_PHOTO_TTL_HIT  = 6 * 3600   # re-check employees who have a photo every 6h
_PHOTO_TTL_MISS = 3600       # re-check employees without one every 1h

_token_cache = {"token": None, "expires_at": 0.0}
_photo_cache = {}  # email -> (content: bytes | None, content_type: str | None, cached_at: float)


def _app_token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 30:
        return _token_cache["token"]

    r = httpx.post(
        f"https://login.microsoftonline.com/{_TENANT_ID}/oauth2/v2.0/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     _CLIENT_ID,
            "client_secret": _CLIENT_SECRET,
            "scope":         "https://graph.microsoft.com/.default",
        },
        timeout=10,
    )
    r.raise_for_status()
    body = r.json()
    _token_cache["token"] = body["access_token"]
    _token_cache["expires_at"] = now + int(body.get("expires_in", 3600))
    return _token_cache["token"]


def get_employee_photo(email: str):
    """
    Returns (content_bytes, content_type) for the employee's Microsoft 365
    profile photo, or None if they have none / it can't be fetched.
    In-memory cached so a full directory render doesn't re-hit Graph per view.
    """
    email = (email or "").strip().lower()
    if not email:
        return None

    cached = _photo_cache.get(email)
    if cached:
        content, content_type, cached_at = cached
        ttl = _PHOTO_TTL_HIT if content else _PHOTO_TTL_MISS
        if time.time() - cached_at < ttl:
            return (content, content_type) if content else None

    if not (_TENANT_ID and _CLIENT_ID and _CLIENT_SECRET):
        return None

    try:
        token = _app_token()
        r = httpx.get(
            f"{_GRAPH}/users/{email}/photo/$value",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except Exception:
        _photo_cache[email] = (None, None, time.time())
        return None

    if r.status_code == 200:
        content_type = r.headers.get("content-type", "image/jpeg")
        _photo_cache[email] = (r.content, content_type, time.time())
        return (r.content, content_type)

    _photo_cache[email] = (None, None, time.time())
    return None
