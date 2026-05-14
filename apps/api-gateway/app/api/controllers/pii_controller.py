from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.api.services.pii_service import PiiService

_service = PiiService()

router = APIRouter(prefix="/api/admin/pii", tags=["PII"])

VALID_DETECTION_METHODS = {"regex", "ner"}


# ---------- Rule models ----------

class CreateRuleIn(BaseModel):
    rule_name: str
    pii_type: str
    detection_method: str
    pattern: str
    replacement_token: str
    severity: str
    description: Optional[str] = None

    @field_validator("detection_method")
    @classmethod
    def detection_method_must_be_valid(cls, v: str) -> str:
        if v not in VALID_DETECTION_METHODS:
            raise ValueError(f"detection_method must be one of: {', '.join(VALID_DETECTION_METHODS)}")
        return v


class UpdateRuleIn(BaseModel):
    pattern: Optional[str] = None
    replacement_token: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TestRuleIn(BaseModel):
    detection_method: str
    pattern: str
    replacement_token: str
    sample_text: str

    @field_validator("detection_method")
    @classmethod
    def detection_method_must_be_valid(cls, v: str) -> str:
        if v not in VALID_DETECTION_METHODS:
            raise ValueError(f"detection_method must be one of: {', '.join(VALID_DETECTION_METHODS)}")
        return v


class PiiRuleOut(BaseModel):
    id: str
    rule_name: str
    rule_version: int
    pii_type: str
    detection_method: str
    pattern: str
    replacement_token: str
    severity: str
    is_active: bool
    description: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class PiiRuleListOut(BaseModel):
    data: list[PiiRuleOut]
    total: int
    page: int
    limit: int


# ---------- Log models ----------

class ReviewLogIn(BaseModel):
    is_false_positive: bool
    review_notes: Optional[str] = None


class PiiLogOut(BaseModel):
    id: str
    source_type: Optional[str] = None
    source_table: Optional[str] = None
    source_id: Optional[str] = None
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    rule_id: Optional[str] = None
    pii_type: str
    detection_method: Optional[str] = None
    match_count: Optional[int] = None
    value_hash: Optional[str] = None
    value_length: Optional[int] = None
    match_positions: Optional[Any] = None
    confidence_score: Optional[float] = None
    action_taken: Optional[str] = None
    replacement_token: Optional[str] = None
    is_false_positive: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime


class PiiLogListOut(BaseModel):
    data: list[PiiLogOut]
    total: int
    page: int
    limit: int


# ------------------------------------------------------------------ #
# 1. List PII rules  GET /api/admin/pii/rules                        #
# ------------------------------------------------------------------ #
@router.get("/rules", response_model=PiiRuleListOut, summary="List PII rules")
def list_pii_rules(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    pii_type: Optional[str] = Query(None),
    detection_method: Optional[str] = Query(None),
):
    """View all PII detection rules."""
    return _service.list_rules(page, limit, is_active, pii_type, detection_method)


# ------------------------------------------------------------------ #
# 2. Create PII rule  POST /api/admin/pii/rules                      #
# ------------------------------------------------------------------ #
@router.post("/rules", response_model=PiiRuleOut, status_code=201, summary="Create PII rule")
def create_pii_rule(body: CreateRuleIn):
    """Add a new regex or NER detection rule."""
    return _service.create_rule(
        "dev-user",
        body.rule_name,
        body.pii_type,
        body.detection_method,
        body.pattern,
        body.replacement_token,
        body.severity,
        body.description,
    )


# ------------------------------------------------------------------ #
# 3. Test PII rule  POST /api/admin/pii/rules/test  (in-memory)      #
# ------------------------------------------------------------------ #
@router.post("/rules/test", summary="Test PII rule")
def test_pii_rule(body: TestRuleIn):
    """Dry-run a rule against sample text — no DB writes."""
    return _service.test_rule(
        body.detection_method, body.pattern, body.replacement_token, body.sample_text
    )


# ------------------------------------------------------------------ #
# 4. Update PII rule  PATCH /api/admin/pii/rules/{id}                #
# ------------------------------------------------------------------ #
@router.patch("/rules/{id}", response_model=PiiRuleOut, summary="Update PII rule")
def update_pii_rule(id: str, body: UpdateRuleIn):
    """Toggle active state or edit pattern/token/severity — bumps rule_version."""
    if all(v is None for v in [body.pattern, body.replacement_token, body.severity, body.description, body.is_active]):
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    rule = _service.update_rule(
        id, "dev-user",
        body.pattern, body.replacement_token, body.severity, body.description, body.is_active,
    )
    if not rule:
        raise HTTPException(status_code=404, detail="PII rule not found")
    return rule


# ------------------------------------------------------------------ #
# 5. List PII events  GET /api/admin/pii/logs                        #
# ------------------------------------------------------------------ #
@router.get("/logs", response_model=PiiLogListOut, summary="List PII events")
def list_pii_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Query(None),
    conversation_id: Optional[str] = Query(None),
    pii_type: Optional[str] = Query(None),
    detection_method: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None, description="ISO 8601 start date"),
    date_to: Optional[datetime] = Query(None, description="ISO 8601 end date"),
):
    """Filter PII redaction events by user, conversation, type, method, or date range."""
    return _service.list_logs(
        page, limit, user_id, conversation_id, pii_type, detection_method, date_from, date_to
    )


# ------------------------------------------------------------------ #
# 6. Get PII event  GET /api/admin/pii/logs/{id}                     #
# ------------------------------------------------------------------ #
@router.get("/logs/{id}", response_model=PiiLogOut, summary="Get PII event")
def get_pii_log(id: str):
    """Fetch a single PII redaction event with all fields."""
    log = _service.get_log(id)
    if not log:
        raise HTTPException(status_code=404, detail="PII log not found")
    return log


# ------------------------------------------------------------------ #
# 7. Mark false positive  PATCH /api/admin/pii/logs/{id}/review      #
# ------------------------------------------------------------------ #
@router.patch("/logs/{id}/review", response_model=PiiLogOut, summary="Mark false positive")
def review_pii_log(id: str, body: ReviewLogIn):
    """Reviewer marks a redaction event as FP or TP, with optional review notes."""
    log = _service.review_log(id, "dev-user", body.is_false_positive, body.review_notes)
    if not log:
        raise HTTPException(status_code=404, detail="PII log not found")
    return log


# ------------------------------------------------------------------ #
# 8. PII analytics  GET /api/admin/pii/analytics                     #
# ------------------------------------------------------------------ #
@router.get("/analytics", summary="PII analytics")
def pii_analytics():
    """Heatmap by pii_type, top offending rules by hit count, and overall FP rate."""
    return _service.get_analytics()
