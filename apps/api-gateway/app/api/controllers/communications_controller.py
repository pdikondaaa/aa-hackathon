from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth.auth_handler import get_current_user
from app.api.models.communications_model import (
    AnnouncementCreate,
    AnnouncementListResponse,
    AnnouncementRecord,
    AnnouncementUpdate,
    EventCreate,
    EventListResponse,
    EventRecord,
    EventUpdate,
    RSVPCreate,
)
from app.api.services.communications_service import CommunicationsService

_service = CommunicationsService()

# Public endpoints — any authenticated user
pub_router = APIRouter(prefix="/api/communications", tags=["Communications"])

# Admin endpoints — admin role expected (enforced by front-end; API is auth-gated)
admin_router = APIRouter(prefix="/api/admin/communications", tags=["Communications"])


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC — Announcements
# ═══════════════════════════════════════════════════════════════════════════

@pub_router.get(
    "/announcements/active",
    summary="Get active announcements for the current user",
)
def get_active_announcements(current_user: dict = Depends(get_current_user)):
    """Returns published announcements within their scheduling window,
    annotated with the current user's dismissal status."""
    return _service.get_active_announcements(current_user["email"])


@pub_router.post(
    "/announcements/{id}/dismiss",
    summary="Dismiss an announcement (do not show again)",
)
def dismiss_announcement(id: str, current_user: dict = Depends(get_current_user)):
    _service.dismiss_announcement(id, current_user["email"])
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC — Events
# ═══════════════════════════════════════════════════════════════════════════

@pub_router.get(
    "/events",
    response_model=EventListResponse,
    summary="List published events",
)
def list_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by event status"),
    current_user: dict = Depends(get_current_user),
):
    return _service.list_events(page, limit, status, "published", current_user["email"])


@pub_router.get(
    "/events/{id}",
    response_model=EventRecord,
    summary="Get a single event",
)
def get_event(id: str, current_user: dict = Depends(get_current_user)):
    event = _service.get_event(id, current_user["email"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@pub_router.post(
    "/events/{id}/rsvp",
    summary="RSVP to an event",
)
def submit_rsvp(
    id: str,
    body: RSVPCreate,
    current_user: dict = Depends(get_current_user),
):
    event = _service.get_event(id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.get("rsvp_enabled"):
        raise HTTPException(status_code=400, detail="RSVP is not enabled for this event")
    return _service.submit_rsvp(
        id,
        current_user["email"],
        current_user.get("name") or current_user["email"],
        body.rsvp_status,
    )


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN — Announcements
# ═══════════════════════════════════════════════════════════════════════════

@admin_router.get(
    "/announcements",
    response_model=AnnouncementListResponse,
    summary="Admin: List all announcements",
)
def admin_list_announcements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    return _service.list_announcements(page, limit, status, current_user["email"])


@admin_router.post(
    "/announcements",
    response_model=AnnouncementRecord,
    status_code=201,
    summary="Admin: Create announcement",
)
def admin_create_announcement(
    body: AnnouncementCreate,
    current_user: dict = Depends(get_current_user),
):
    return _service.create_announcement(body.model_dump(), current_user["email"])


@admin_router.get(
    "/announcements/{id}",
    response_model=AnnouncementRecord,
    summary="Admin: Get announcement",
)
def admin_get_announcement(id: str, current_user: dict = Depends(get_current_user)):
    ann = _service.get_announcement(id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ann


@admin_router.patch(
    "/announcements/{id}",
    response_model=AnnouncementRecord,
    summary="Admin: Update announcement",
)
def admin_update_announcement(
    id: str,
    body: AnnouncementUpdate,
    current_user: dict = Depends(get_current_user),
):
    ann = _service.update_announcement(id, body.model_dump(exclude_unset=True))
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ann


@admin_router.delete(
    "/announcements/{id}",
    status_code=204,
    summary="Admin: Delete announcement",
)
def admin_delete_announcement(id: str, current_user: dict = Depends(get_current_user)):
    if not _service.delete_announcement(id):
        raise HTTPException(status_code=404, detail="Announcement not found")


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN — Events
# ═══════════════════════════════════════════════════════════════════════════

@admin_router.get(
    "/events",
    response_model=EventListResponse,
    summary="Admin: List all events",
)
def admin_list_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    publish_status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    return _service.list_events(page, limit, status, publish_status, current_user["email"])


@admin_router.post(
    "/events",
    response_model=EventRecord,
    status_code=201,
    summary="Admin: Create event",
)
def admin_create_event(
    body: EventCreate,
    current_user: dict = Depends(get_current_user),
):
    return _service.create_event(body.model_dump(), current_user["email"])


@admin_router.get(
    "/events/{id}",
    response_model=EventRecord,
    summary="Admin: Get event",
)
def admin_get_event(id: str, current_user: dict = Depends(get_current_user)):
    event = _service.get_event(id, current_user["email"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@admin_router.patch(
    "/events/{id}",
    response_model=EventRecord,
    summary="Admin: Update event",
)
def admin_update_event(
    id: str,
    body: EventUpdate,
    current_user: dict = Depends(get_current_user),
):
    event = _service.update_event(id, body.model_dump(exclude_unset=True))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@admin_router.delete(
    "/events/{id}",
    status_code=204,
    summary="Admin: Delete event",
)
def admin_delete_event(id: str, current_user: dict = Depends(get_current_user)):
    if not _service.delete_event(id):
        raise HTTPException(status_code=404, detail="Event not found")
