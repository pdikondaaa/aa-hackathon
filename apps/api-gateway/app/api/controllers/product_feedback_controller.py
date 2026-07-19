from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.api.auth.auth_handler import get_current_user
from app.api.services.product_feedback_service import ProductFeedbackService
from app.api.services.user_service import get_or_create_user

_service = ProductFeedbackService()

pub_router   = APIRouter(prefix="/api/product-feedback",       tags=["Product Feedback"])
admin_router = APIRouter(prefix="/api/admin/product-feedback", tags=["Product Feedback (Admin)"])

VALID_TYPES   = {"improvement", "bug", "suggestion", "compliment"}
VALID_STATUSES = {"open", "reviewed", "resolved", "closed"}


def _resolve_user(current_user: dict) -> str:
    return get_or_create_user(
        current_user["user_id"],
        current_user["email"],
        current_user.get("name") or current_user["email"],
    )


# ---------- Models ----------

class SubmitProductFeedbackIn(BaseModel):
    type: str
    module: Optional[str] = None
    title: str
    description: str
    rating: int = 0

    @field_validator("type")
    @classmethod
    def type_must_be_valid(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_TYPES)}")
        return v

    @field_validator("rating")
    @classmethod
    def rating_in_range(cls, v: int) -> int:
        if not 0 <= v <= 5:
            raise ValueError("rating must be between 0 and 5")
        return v


class UpdateProductFeedbackIn(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v


class ProductFeedbackOut(BaseModel):
    id: str
    user_id: str
    type: str
    module: Optional[str] = None
    title: str
    description: str
    rating: int
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None


class ProductFeedbackAdminOut(ProductFeedbackOut):
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class ProductFeedbackListOut(BaseModel):
    data: list[ProductFeedbackAdminOut]
    total: int
    page: int
    limit: int


# ------------------------------------------------------------------ #
# 1. Submit feedback  POST /api/product-feedback                      #
# ------------------------------------------------------------------ #
@pub_router.post(
    "",
    response_model=ProductFeedbackOut,
    status_code=201,
    summary="Submit product feedback",
)
def submit_feedback(
    body: SubmitProductFeedbackIn,
    current_user: dict = Depends(get_current_user),
):
    """Submit a bug report / suggestion / improvement / compliment from the Share Feedback form."""
    user_id = _resolve_user(current_user)
    return _service.submit_feedback(
        user_id, body.type, body.module, body.title, body.description, body.rating
    )


# ------------------------------------------------------------------ #
# 2. List my submissions  GET /api/product-feedback                   #
# ------------------------------------------------------------------ #
@pub_router.get(
    "",
    response_model=list[ProductFeedbackOut],
    summary="List my product feedback submissions",
)
def list_my_feedback(current_user: dict = Depends(get_current_user)):
    user_id = _resolve_user(current_user)
    return _service.list_my_feedback(user_id)


# ------------------------------------------------------------------ #
# 3. List all feedback (admin)  GET /api/admin/product-feedback       #
# ------------------------------------------------------------------ #
@admin_router.get(
    "",
    response_model=ProductFeedbackListOut,
    summary="List product feedback (admin)",
)
def list_all_feedback(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = Query(None, description="Filter by feedback type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    _current_user: dict = Depends(get_current_user),
):
    """Feedback Review dashboard — returns all user-submitted feedback with submitter details."""
    return _service.list_all_feedback(page, limit, type, status)


# ------------------------------------------------------------------ #
# 4. Update status / admin notes (admin)  PATCH /api/admin/product-feedback/{id}
# ------------------------------------------------------------------ #
@admin_router.patch(
    "/{id}",
    response_model=ProductFeedbackOut,
    summary="Update product feedback status/notes (admin)",
)
def update_feedback(
    id: str,
    body: UpdateProductFeedbackIn,
    _current_user: dict = Depends(get_current_user),
):
    if body.status is None and body.admin_notes is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: status, admin_notes")
    result = _service.update_feedback(id, body.status, body.admin_notes)
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


# ------------------------------------------------------------------ #
# 5. Delete feedback (admin)  DELETE /api/admin/product-feedback/{id} #
# ------------------------------------------------------------------ #
@admin_router.delete(
    "/{id}",
    status_code=204,
    summary="Delete product feedback (admin)",
)
def delete_feedback(
    id: str,
    _current_user: dict = Depends(get_current_user),
):
    deleted = _service.delete_feedback(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback not found")
