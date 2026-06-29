"""
graph_calendar_controller.py
============================
GET /api/communications/shared-calendar

Fetches upcoming calendar events from a shared/company-wide mailbox using
Microsoft Graph API with app-only (client credentials) auth.

Prerequisites (one-time Azure admin setup):
  1. Grant the app registration "Calendars.Read" Application permission
     and admin-consent it in Azure Portal → App registrations → API permissions.
  2. Set SHARED_MAILBOX_EMAIL in .env (e.g. hr@alignedautomation.com).
     SHAREPOINT_CLIENT_ID / SHAREPOINT_CLIENT_SECRET are reused — same app.
"""

import os
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth.auth_handler import get_current_user

router = APIRouter(prefix="/api/communications", tags=["Communications"])

_TENANT_ID      = os.environ.get("AZURE_TENANT_ID", "")
_CLIENT_ID      = os.environ.get("SHAREPOINT_CLIENT_ID", "")
_CLIENT_SECRET  = os.environ.get("SHAREPOINT_CLIENT_SECRET", "")
_SHARED_MAILBOX = os.environ.get("SHARED_MAILBOX_EMAIL", "")

_GRAPH = "https://graph.microsoft.com/v1.0"


def _app_token() -> str:
    url = f"https://login.microsoftonline.com/{_TENANT_ID}/oauth2/v2.0/token"
    r = httpx.post(url, data={
        "grant_type":    "client_credentials",
        "client_id":     _CLIENT_ID,
        "client_secret": _CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }, timeout=10)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Graph token error: {r.text}")
    return r.json()["access_token"]


def _status(start: str, end: str) -> str:
    now = datetime.now(timezone.utc)
    try:
        s = datetime.fromisoformat(start.replace("Z", "+00:00"))
        e = datetime.fromisoformat(end.replace("Z", "+00:00"))
        if e < now:
            return "completed"
        if s <= now <= e:
            return "live"
    except Exception:
        pass
    return "upcoming"


@router.get("/shared-calendar", summary="Get shared mailbox calendar events")
def get_shared_calendar(current_user: dict = Depends(get_current_user)):
    """
    Returns upcoming events from the configured shared/company mailbox
    for the next 60 days. Returns an empty list if SHARED_MAILBOX_EMAIL
    or credentials are not configured, so the feature degrades gracefully.
    """
    if not (_CLIENT_SECRET and _SHARED_MAILBOX):
        return []

    try:
        token = _app_token()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    now     = datetime.now(timezone.utc)
    start   = now.isoformat()
    end     = (now + timedelta(days=60)).isoformat()

    url = (
        f"{_GRAPH}/users/{_SHARED_MAILBOX}/calendarView"
        f"?startDateTime={start}&endDateTime={end}"
        f"&$select=id,subject,bodyPreview,start,end,location,isOnlineMeeting,onlineMeeting"
        f"&$orderby=start/dateTime"
        f"&$top=50"
    )
    r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Graph calendarView error: {r.text}")

    results = []
    for e in r.json().get("value", []):
        s_dt  = (e.get("start") or {}).get("dateTime", "")
        e_dt  = (e.get("end")   or {}).get("dateTime", "")
        tz    = (e.get("start") or {}).get("timeZone", "UTC")
        loc   = (e.get("location") or {}).get("displayName", "")
        join  = ((e.get("onlineMeeting") or {}).get("joinUrl"))

        results.append({
            "id":               f"graph-{e['id']}",
            "title":            e.get("subject") or "Untitled",
            "description":      e.get("bodyPreview") or "",
            "starts_at":        s_dt,
            "ends_at":          e_dt,
            "timezone":         tz,
            "status":           _status(s_dt, e_dt),
            "event_type":       "general",
            "is_virtual":       bool(e.get("isOnlineMeeting")),
            "virtual_link":     join,
            "location":         loc or None,
            "rsvp_enabled":     False,
            "rsvp_count":       0,
            "user_rsvp_status": None,
            "cover_image_url":  None,
            "source":           "graph",
        })

    return results
