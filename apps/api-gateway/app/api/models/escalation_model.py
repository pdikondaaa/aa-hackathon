from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator

from app.api.services.escalations_service import VALID_STATUSES


class EscalationCreate(BaseModel):
    escalation_type: str
    subject: str
    reason: str
    priority: str
    form_payload: Optional[dict[str, Any]] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None


class EscalationStatusUpdate(BaseModel):
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


class EscalationRecord(BaseModel):
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


class EscalationListResponse(BaseModel):
    data: list[EscalationRecord]
    total: int
    page: int
    limit: int
