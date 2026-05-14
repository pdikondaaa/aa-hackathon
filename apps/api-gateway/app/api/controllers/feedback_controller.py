from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.api.services.feedback_service import FeedbackService

_service = FeedbackService()

msg_router   = APIRouter(prefix="/api/messages",  tags=["Feedback"])
fb_router    = APIRouter(prefix="/api/feedback",  tags=["Feedback"])
admin_router = APIRouter(prefix="/api/admin",     tags=["Feedback"])

VALID_RATINGS = {"up", "down"}


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


class FeedbackAdminOut(FeedbackOut):
    message_role: str
    message_content: str


class FeedbackListOut(BaseModel):
    data: list[FeedbackAdminOut]
    total: int
    page: int
    limit: int


# ------------------------------------------------------------------ #
# 1. Submit feedback  POST /api/messages/{id}/feedback               #
# ------------------------------------------------------------------ #
@msg_router.post(
    "/{id}/feedback",
    response_model=FeedbackOut,
    status_code=201,
    summary="Submit feedback",
)
def submit_feedback(id: str, body: SubmitFeedbackIn):
    """Thumbs up/down with optional category and comment for an assistant message."""
    result = _service.submit_feedback(
        id, "dev-user", body.rating, body.category, body.comment
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return result


# ------------------------------------------------------------------ #
# 2. Update feedback  PATCH /api/feedback/{id}                       #
# ------------------------------------------------------------------ #
@fb_router.patch(
    "/{id}",
    response_model=FeedbackOut,
    summary="Update feedback",
)
def update_feedback(id: str, body: UpdateFeedbackIn):
    """Edit the rating, category, or comment on an existing feedback record."""
    if body.rating is None and body.category is None and body.comment is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: rating, category, comment")
    result = _service.update_feedback(
        id, "dev-user", body.rating, body.category, body.comment
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


# ------------------------------------------------------------------ #
# 3. List feedback (admin)  GET /api/admin/feedback                  #
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
):
    """Quality dashboard — returns all feedback with linked message content."""
    return _service.list_feedback(page, limit, rating, date_from, date_to)
