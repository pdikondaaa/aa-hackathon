from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth.auth_handler import get_current_user
from app.api.models.escalation_model import (
    EscalationCreate,
    EscalationListResponse,
    EscalationRecord,
    EscalationStatusUpdate,
)
from app.api.services.escalations_service import EscalationsService
from app.api.services.user_service import get_or_create_user

_service = EscalationsService()


def _resolve_user(current_user: dict) -> str:
    return get_or_create_user(
        current_user["user_id"],
        current_user["email"],
        current_user.get("name") or current_user["email"],
    )

esc_router   = APIRouter(prefix="/api/escalations", tags=["Escalations"])
admin_router = APIRouter(prefix="/api/admin",       tags=["Escalations"])


# ------------------------------------------------------------------ #
# 1. Create escalation  POST /api/escalations                        #
# ------------------------------------------------------------------ #
@esc_router.post(
    "",
    response_model=EscalationRecord,
    status_code=201,
    summary="Create escalation",
)
def create_escalation(body: EscalationCreate, current_user: dict = Depends(get_current_user)):
    """Submit a manual or AI-triggered escalation form."""
    return _service.create_escalation(
        current_user["user_id"],
        current_user["email"],
        current_user.get("name") or current_user["email"],
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
    response_model=EscalationListResponse,
    summary="List my escalations",
)
def list_my_escalations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user),
):
    """Return escalation records for the authenticated user."""
    user_id = _resolve_user(current_user)
    return _service.list_my_escalations(user_id, page, limit, status)


# ------------------------------------------------------------------ #
# 3. Get escalation  GET /api/escalations/{id}                       #
# ------------------------------------------------------------------ #
@esc_router.get(
    "/{id}",
    response_model=EscalationRecord,
    summary="Get escalation",
)
def get_escalation(id: str, current_user: dict = Depends(get_current_user)):
    """View full status and details of a single escalation."""
    user_id = _resolve_user(current_user)
    record = _service.get_escalation(id, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return record


# ------------------------------------------------------------------ #
# 4. Update escalation status  PATCH /api/escalations/{id}          #
# ------------------------------------------------------------------ #
@esc_router.patch(
    "/{id}",
    response_model=EscalationRecord,
    summary="Update escalation status",
)
def update_escalation_status(id: str, body: EscalationStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Move escalation through submitted → in_progress → resolved (admin/team).
    Optionally set assigned_team, assigned_to, and resolution_notes."""
    user_id = _resolve_user(current_user)
    record = _service.update_status(
        id,
        user_id,
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
    response_model=EscalationListResponse,
    summary="List all escalations (admin)",
)
def list_all_escalations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    escalation_type: Optional[str] = Query(None, description="Filter by type (hr / it / admin)"),
    status: Optional[str] = Query(None, description="Filter by status"),
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
def get_form_schema(type: str):
    """Return the dynamic form field definition for a given escalation type (hr / it / admin)."""
    schema = _service.get_form_schema(type)
    if not schema:
        raise HTTPException(
            status_code=404,
            detail=f"No form schema found for type '{type}'. Valid types: hr, it, admin",
        )
    return schema
