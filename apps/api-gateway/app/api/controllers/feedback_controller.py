from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.api.auth.auth_handler import get_current_user
from app.api.services.feedback_service import FeedbackService
from app.api.services.user_service import get_or_create_user

_service = FeedbackService()

msg_router   = APIRouter(prefix="/api/messages",       tags=["Feedback"])
conv_router  = APIRouter(prefix="/api/conversations",  tags=["Feedback"])
fb_router    = APIRouter(prefix="/api/feedback",       tags=["Feedback"])
admin_router = APIRouter(prefix="/api/admin",          tags=["Feedback"])

VALID_RATINGS = {"up", "down"}


def _resolve_user(current_user: dict) -> str:
    return get_or_create_user(
        current_user["user_id"],
        current_user["email"],
        current_user.get("name") or current_user["email"],
    )


# ---------- Models ----------

class SubmitFeedbackIn(BaseModel):
    rating: str
    category: Optional[str] = None
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_must_be_valid(cls, v: str) -> str:
        if v not in VALID_RATINGS:
            raise ValueError("rating must be 'up' or 'down'")
        return v


class UpdateFeedbackIn(BaseModel):
    rating: Optional[str] = None
    category: Optional[str] = None
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_RATINGS:
            raise ValueError("rating must be 'up' or 'down'")
        return v


class FeedbackOut(BaseModel):
    id: str
    message_id: str
    user_id: str
    rating: str
    category: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime


class FeedbackMapEntry(BaseModel):
    id: str
    message_id: str
    rating: str
    category: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime


class FeedbackAdminOut(FeedbackOut):
    message_role: str
    message_content: str


class FeedbackListOut(BaseModel):
    data: list[FeedbackAdminOut]
    total: int
    page: int
    limit: int


# ------------------------------------------------------------------ #
# 1. Submit / update feedback  POST /api/messages/{id}/feedback      #
#    Uses upsert — safe to call even if feedback already exists.     #
# ------------------------------------------------------------------ #
@msg_router.post(
    "/{id}/feedback",
    response_model=FeedbackOut,
    status_code=201,
    summary="Submit feedback",
)
def submit_feedback(
    id: str,
    body: SubmitFeedbackIn,
    current_user: dict = Depends(get_current_user),
):
    """Thumbs up/down with optional category and comment for an assistant message.
    Upserts — safe to call again if the user changes their vote."""
    user_id = _resolve_user(current_user)
    result = _service.submit_feedback(
        id, user_id, body.rating, body.category, body.comment
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return result


# ------------------------------------------------------------------ #
# 2. Get conversation feedback  GET /api/conversations/{id}/feedback #
# ------------------------------------------------------------------ #
@conv_router.get(
    "/{id}/feedback",
    response_model=dict[str, FeedbackMapEntry],
    summary="Get feedback for a conversation",
)
def get_conversation_feedback(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    """Returns a map of message_id → feedback for all messages the user
    has rated in this conversation. Used to restore feedback state on load."""
    user_id = _resolve_user(current_user)
    result = _service.get_conversation_feedback(id, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


# ------------------------------------------------------------------ #
# 4. Update feedback  PATCH /api/feedback/{id}                       #
# ------------------------------------------------------------------ #
@fb_router.patch(
    "/{id}",
    response_model=FeedbackOut,
    summary="Update feedback",
)
def update_feedback(
    id: str,
    body: UpdateFeedbackIn,
    current_user: dict = Depends(get_current_user),
):
    """Edit the rating, category, or comment on an existing feedback record."""
    if body.rating is None and body.category is None and body.comment is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: rating, category, comment")
    user_id = _resolve_user(current_user)
    result = _service.update_feedback(
        id, user_id, body.rating, body.category, body.comment
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


# ------------------------------------------------------------------ #
# 5. Delete feedback  DELETE /api/feedback/{id}                      #
# ------------------------------------------------------------------ #
@fb_router.delete(
    "/{id}",
    status_code=204,
    summary="Delete feedback",
)
def delete_feedback(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a feedback record (used when the user toggles their vote off)."""
    user_id = _resolve_user(current_user)
    deleted = _service.delete_feedback(id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback not found")


# ------------------------------------------------------------------ #
# 6. List feedback (admin)  GET /api/admin/feedback                  #
# ------------------------------------------------------------------ #
@admin_router.get(
    "/feedback",
    response_model=FeedbackListOut,
    summary="List feedback (admin)",
)
def list_feedback(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    rating: Optional[str] = Query(None, description="Filter by 'up' or 'down'"),
    date_from: Optional[datetime] = Query(None, description="ISO 8601 start date"),
    date_to: Optional[datetime] = Query(None, description="ISO 8601 end date"),
    _current_user: dict = Depends(get_current_user),
):
    """Quality dashboard — returns all feedback with linked message content."""
    return _service.list_feedback(page, limit, rating, date_from, date_to)
