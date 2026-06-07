from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ── Announcements ─────────────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    rich_content: Optional[str] = None
    banner_image_url: Optional[str] = None
    priority: str = "medium"        # critical | high | medium | low
    display_mode: str = "banner"    # banner | overlay | carousel | inline
    status: str = "draft"           # draft | published | scheduled | archived
    audience_roles: Optional[List[str]] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    cta_type: Optional[str] = "link"  # link | acknowledge | dismiss
    auto_hide_seconds: Optional[int] = None
    allow_dismiss: bool = True
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    rich_content: Optional[str] = None
    banner_image_url: Optional[str] = None
    priority: Optional[str] = None
    display_mode: Optional[str] = None
    status: Optional[str] = None
    audience_roles: Optional[List[str]] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    cta_type: Optional[str] = None
    auto_hide_seconds: Optional[int] = None
    allow_dismiss: Optional[bool] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


class AnnouncementRecord(BaseModel):
    id: str
    title: str
    message: str
    rich_content: Optional[str] = None
    banner_image_url: Optional[str] = None
    priority: str
    display_mode: str
    status: str
    audience_roles: Optional[List[str]] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    cta_type: Optional[str] = None
    auto_hide_seconds: Optional[int] = None
    allow_dismiss: bool
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_by_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_dismissed: bool = False


class AnnouncementListResponse(BaseModel):
    data: List[AnnouncementRecord]
    total: int
    page: int
    limit: int


# ── Events ────────────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    event_type: str = "general"
    status: str = "upcoming"        # upcoming | live | completed | cancelled
    publish_status: str = "draft"   # draft | published | archived
    starts_at: datetime
    ends_at: Optional[datetime] = None
    timezone: str = "Asia/Kolkata"
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    is_virtual: bool = False
    rsvp_enabled: bool = False
    rsvp_deadline: Optional[datetime] = None
    max_attendees: Optional[int] = None
    reminder_minutes: Optional[List[int]] = None
    audience_roles: Optional[List[str]] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    event_type: Optional[str] = None
    status: Optional[str] = None
    publish_status: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    timezone: Optional[str] = None
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    is_virtual: Optional[bool] = None
    rsvp_enabled: Optional[bool] = None
    rsvp_deadline: Optional[datetime] = None
    max_attendees: Optional[int] = None
    reminder_minutes: Optional[List[int]] = None
    audience_roles: Optional[List[str]] = None


class EventRecord(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    event_type: str
    status: str
    publish_status: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    timezone: str
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    is_virtual: bool
    rsvp_enabled: bool
    rsvp_deadline: Optional[datetime] = None
    max_attendees: Optional[int] = None
    reminder_minutes: Optional[List[int]] = None
    audience_roles: Optional[List[str]] = None
    created_by_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    rsvp_count: int = 0
    user_rsvp_status: Optional[str] = None


class EventListResponse(BaseModel):
    data: List[EventRecord]
    total: int
    page: int
    limit: int


class RSVPCreate(BaseModel):
    rsvp_status: str = "attending"  # attending | not_attending | maybe
