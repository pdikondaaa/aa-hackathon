from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.api.auth.jwt_auth_handler import jwt_auth
from app.api.services.escalations_service import EscalationsService, VALID_STATUSES

_service = EscalationsService()

esc_router   = APIRouter(prefix="/api/escalations", tags=["Escalations"])
admin_router = APIRouter(prefix="/api/admin",       tags=["Escalations"])


# ---------- Models ----------

class CreateEscalationIn(BaseModel):
    escalation_type: str
    subject: str
    reason: str
    priority: str
    form_payload: Optional[dict[str, Any]] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None


class UpdateStatusIn(BaseModel):
    status: str
    assigned_team: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


class EscalationOut(BaseModel):
    id: str
    user_id: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    escalation_type: str
    subject: str
    reason: str
    form_payload: Optional[Any] = None
    priority: str
    status: str
    assigned_team: Optional[str] = None
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class EscalationListOut(BaseModel):
    data: list[EscalationOut]
    total: int
    page: int
    limit: int


# ------------------------------------------------------------------ #
# 1. Create escalation  POST /api/escalations                        #
# ------------------------------------------------------------------ #
@esc_router.post(
    "",
    response_model=EscalationOut,
    status_code=201,
    summary="Create escalation",
)
def create_escalation(body: CreateEscalationIn, ctx: dict = Depends(jwt_auth)):
    """Submit a manual or AI-triggered escalation form."""
    return _service.create_escalation(
        ctx["claims"]["sub"],
        body.escalation_type,
        body.subject,
        body.reason,
        body.priority,
        body.form_payload,
        body.conversation_id,
        body.message_id,
    )


# ------------------------------------------------------------------ #
# 2. List my escalations  GET /api/escalations                       #
# ------------------------------------------------------------------ #
@esc_router.get(
    "",
    response_model=EscalationListOut,
    summary="List my escalations",
)
def list_my_escalations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    ctx: dict = Depends(jwt_auth),
):
    """Return the authenticated user's own escalation records."""
    return _service.list_my_escalations(ctx["claims"]["sub"], page, limit, status)


# ------------------------------------------------------------------ #
# 3. Get escalation  GET /api/escalations/{id}                       #
# ------------------------------------------------------------------ #
@esc_router.get(
    "/{id}",
    response_model=EscalationOut,
    summary="Get escalation",
)
def get_escalation(id: str, ctx: dict = Depends(jwt_auth)):
    """View full status and details of a single escalation."""
    record = _service.get_escalation(id, ctx["claims"]["sub"])
    if not record:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return record


# ------------------------------------------------------------------ #
# 4. Update escalation status  PATCH /api/escalations/{id}          #
# ------------------------------------------------------------------ #
@esc_router.patch(
    "/{id}",
    response_model=EscalationOut,
    summary="Update escalation status",
)
def update_escalation_status(id: str, body: UpdateStatusIn, ctx: dict = Depends(jwt_auth)):
    """Move escalation through submitted → in_progress → resolved (admin/team).
    Optionally set assigned_team, assigned_to, and resolution_notes."""
    record = _service.update_status(
        id,
        ctx["claims"]["sub"],
        body.status,
        body.assigned_team,
        body.assigned_to,
        body.resolution_notes,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return record


# ------------------------------------------------------------------ #
# 5. List all escalations (admin)  GET /api/admin/escalations        #
# ------------------------------------------------------------------ #
@admin_router.get(
    "/escalations",
    response_model=EscalationListOut,
    summary="List all escalations (admin)",
)
def list_all_escalations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    escalation_type: Optional[str] = Query(None, description="Filter by type (hr / it / admin)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    ctx: dict = Depends(jwt_auth),
):
    """Team queue view — all escalations, filterable by escalation_type and status."""
    return _service.list_all_escalations(page, limit, escalation_type, status)


# ------------------------------------------------------------------ #
# 6. Get escalation form schema  GET /api/escalations/forms/{type}   #
# ------------------------------------------------------------------ #
@esc_router.get(
    "/forms/{type}",
    summary="Get escalation form schema",
)
def get_form_schema(type: str, ctx: dict = Depends(jwt_auth)):
    """Return the dynamic form field definition for a given escalation type (hr / it / admin)."""
    schema = _service.get_form_schema(type)
    if not schema:
        raise HTTPException(
            status_code=404,
            detail=f"No form schema found for type '{type}'. Valid types: hr, it, admin",
        )
    return schema
