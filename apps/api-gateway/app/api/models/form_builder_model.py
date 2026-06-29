from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, field_validator


# ──────────────────────────────────────────────────────────────────────────────
# Shared sub-models
# ──────────────────────────────────────────────────────────────────────────────

class FieldOption(BaseModel):
    label: str
    value: str


class ValidationRules(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    custom_message: Optional[str] = None


class ConditionalAction(BaseModel):
    field: str
    operator: str           # eq | neq | gt | gte | lt | lte | contains | empty | not_empty
    value: Optional[Any] = None


class ConditionalLogic(BaseModel):
    when: ConditionalAction
    then: dict              # {action: show|hide|require|set_value, target?, value?, expr?}


# ──────────────────────────────────────────────────────────────────────────────
# Form Section
# ──────────────────────────────────────────────────────────────────────────────

class FormSectionCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0
    collapsed: bool = False
    conditions: List[dict] = []


class FormSectionRecord(FormSectionCreate):
    id: str
    form_id: str
    created_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Form Field
# ──────────────────────────────────────────────────────────────────────────────

VALID_FIELD_TYPES = {
    "text", "textarea", "number", "email", "phone", "url",
    "date", "datetime", "time", "dropdown", "radio", "checkbox",
    "toggle", "file", "signature", "richtext", "rating", "slider",
    "heading", "paragraph", "divider", "hidden",
}

VALID_WIDTHS = {"full", "half", "third", "quarter"}


class FormFieldCreate(BaseModel):
    field_type: str
    label: str
    name: str
    section_id: Optional[str] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    default_value: Optional[str] = None
    required: bool = False
    read_only: bool = False
    hidden: bool = False
    order_index: int = 0
    width: str = "full"
    options: List[FieldOption] = []
    validation_rules: dict = {}
    conditional_logic: List[dict] = []
    formula: Optional[str] = None
    style: dict = {}
    metadata: dict = {}

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str) -> str:
        if v not in VALID_FIELD_TYPES:
            raise ValueError(f"field_type '{v}' is not supported")
        return v

    @field_validator("width")
    @classmethod
    def validate_width(cls, v: str) -> str:
        if v not in VALID_WIDTHS:
            raise ValueError(f"width must be one of {VALID_WIDTHS}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        import re
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', v):
            raise ValueError("name must be a valid identifier (letters, digits, underscore)")
        return v


class FormFieldUpdate(BaseModel):
    label: Optional[str] = None
    section_id: Optional[str] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    default_value: Optional[str] = None
    required: Optional[bool] = None
    read_only: Optional[bool] = None
    hidden: Optional[bool] = None
    order_index: Optional[int] = None
    width: Optional[str] = None
    options: Optional[List[FieldOption]] = None
    validation_rules: Optional[dict] = None
    conditional_logic: Optional[List[dict]] = None
    formula: Optional[str] = None
    style: Optional[dict] = None
    metadata: Optional[dict] = None


class FormFieldRecord(FormFieldCreate):
    id: str
    form_id: str
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Form Definition
# ──────────────────────────────────────────────────────────────────────────────

class FormDefinitionCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    keywords: List[str] = []
    alias: Optional[str] = None
    icon: Optional[str] = None
    settings: dict = {}
    allowed_roles: List[str] = []
    sections: List[FormSectionCreate] = []
    fields: List[FormFieldCreate] = []

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        import re
        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', v):
            raise ValueError("slug must be lowercase alphanumeric with hyphens")
        return v


class FormDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    alias: Optional[str] = None
    icon: Optional[str] = None
    settings: Optional[dict] = None
    allowed_roles: Optional[List[str]] = None


class FormDefinitionRecord(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    category: Optional[str]
    status: str
    version: int
    tags: Optional[List[str]]
    keywords: Optional[List[str]]
    alias: Optional[str]
    icon: Optional[str]
    settings: dict
    allowed_roles: Optional[List[str]]
    created_by_user_id: str
    created_by_email: str
    updated_by_user_id: Optional[str]
    updated_by_email: Optional[str]
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    sections: List[FormSectionRecord] = []
    fields: List[FormFieldRecord] = []


class FormDefinitionListItem(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    category: Optional[str]
    status: str
    version: int
    icon: Optional[str]
    alias: Optional[str]
    created_by_email: str
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class FormDefinitionListResponse(BaseModel):
    items: List[FormDefinitionListItem]
    total: int
    page: int
    limit: int


# ──────────────────────────────────────────────────────────────────────────────
# Field Ordering (bulk reorder)
# ──────────────────────────────────────────────────────────────────────────────

class FieldOrderItem(BaseModel):
    id: str
    order_index: int
    section_id: Optional[str] = None


class FieldReorderRequest(BaseModel):
    fields: List[FieldOrderItem]


# ──────────────────────────────────────────────────────────────────────────────
# Form Submission
# ──────────────────────────────────────────────────────────────────────────────

class FormSubmissionCreate(BaseModel):
    form_id: str
    data: dict                          # {field_name: value}
    metadata: dict = {}                 # source, conversation_id, pre_filled, etc.


class FormSubmissionStatusUpdate(BaseModel):
    status: str
    review_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"submitted", "in_review", "approved", "rejected", "withdrawn"}
        if v not in valid:
            raise ValueError(f"status must be one of {valid}")
        return v


class FormSubmissionRecord(BaseModel):
    id: str
    form_id: str
    form_version: int
    submitted_by_user_id: str
    submitted_by_email: str
    submitted_by_name: Optional[str]
    status: str
    data: dict
    metadata: dict
    reviewed_by_email: Optional[str]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class FormSubmissionListResponse(BaseModel):
    items: List[FormSubmissionRecord]
    total: int
    page: int
    limit: int


# ──────────────────────────────────────────────────────────────────────────────
# Workflow Definition
# ──────────────────────────────────────────────────────────────────────────────

class WorkflowDefinitionCreate(BaseModel):
    form_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    trigger_event: str = "on_submit"
    trigger_conditions: dict = {}
    steps: List[dict] = []

    @field_validator("trigger_event")
    @classmethod
    def validate_trigger(cls, v: str) -> str:
        valid = {"on_submit", "on_status_change", "manual"}
        if v not in valid:
            raise ValueError(f"trigger_event must be one of {valid}")
        return v


class WorkflowDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    trigger_conditions: Optional[dict] = None
    steps: Optional[List[dict]] = None
    status: Optional[str] = None


class WorkflowDefinitionRecord(BaseModel):
    id: str
    form_id: Optional[str]
    name: str
    description: Optional[str]
    trigger_event: str
    trigger_conditions: dict
    steps: List[dict]
    status: str
    created_by_email: str
    created_at: datetime
    updated_at: datetime


class WorkflowDefinitionListResponse(BaseModel):
    items: List[WorkflowDefinitionRecord]
    total: int
    page: int
    limit: int


# ──────────────────────────────────────────────────────────────────────────────
# Workflow Instance (approval actions)
# ──────────────────────────────────────────────────────────────────────────────

class WorkflowApprovalAction(BaseModel):
    decision: str           # approve | reject
    comment: Optional[str] = None

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        if v not in {"approve", "reject"}:
            raise ValueError("decision must be 'approve' or 'reject'")
        return v


class WorkflowInstanceRecord(BaseModel):
    id: str
    workflow_def_id: str
    submission_id: Optional[str]
    status: str
    current_step_index: int
    context: dict
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]


# ──────────────────────────────────────────────────────────────────────────────
# Rule Definition
# ──────────────────────────────────────────────────────────────────────────────

class RuleDefinitionCreate(BaseModel):
    form_id: str
    name: str
    description: Optional[str] = None
    rule_type: str
    trigger_fields: List[str] = []
    conditions: List[dict] = []
    actions: List[dict] = []
    priority: int = 0
    is_active: bool = True

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str) -> str:
        valid = {"visibility", "validation", "calculation", "notification"}
        if v not in valid:
            raise ValueError(f"rule_type must be one of {valid}")
        return v


class RuleDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_fields: Optional[List[str]] = None
    conditions: Optional[List[dict]] = None
    actions: Optional[List[dict]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RuleDefinitionRecord(BaseModel):
    id: str
    form_id: str
    name: str
    description: Optional[str]
    rule_type: str
    trigger_fields: Optional[List[str]]
    conditions: List[dict]
    actions: List[dict]
    priority: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RuleDefinitionListResponse(BaseModel):
    items: List[RuleDefinitionRecord]
    total: int


# ──────────────────────────────────────────────────────────────────────────────
# Template
# ──────────────────────────────────────────────────────────────────────────────

class FormTemplateRecord(BaseModel):
    id: str
    name: str
    category: Optional[str]
    description: Optional[str]
    thumbnail_url: Optional[str]
    definition: dict
    is_system: bool
    usage_count: int
    tags: Optional[List[str]]
    created_at: datetime


class FormTemplateListResponse(BaseModel):
    items: List[FormTemplateRecord]
    total: int


# ──────────────────────────────────────────────────────────────────────────────
# Slash-command search
# ──────────────────────────────────────────────────────────────────────────────

class FormSearchResult(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    icon: Optional[str]
    alias: Optional[str]
    category: Optional[str]


class FormSearchResponse(BaseModel):
    results: List[FormSearchResult]


# ──────────────────────────────────────────────────────────────────────────────
# Rule Engine — evaluation request
# ──────────────────────────────────────────────────────────────────────────────

class RuleEvaluateRequest(BaseModel):
    values: dict = {}
    changed_fields: Optional[List[str]] = None


# ──────────────────────────────────────────────────────────────────────────────
# Slash Commands — admin-configurable "/" shortcuts
# ──────────────────────────────────────────────────────────────────────────────

class SlashCommandCreate(BaseModel):
    command: str                        # keyword after "/" e.g. "parking"
    label: str                          # display name in the menu
    description: Optional[str] = None
    type: str = "form"                  # 'form' | 'url' | 'builtin'
    form_id: Optional[str] = None      # required when type='form'
    url: Optional[str] = None          # required when type='url'
    action: Optional[str] = None       # required when type='builtin' e.g. 'parking', 'escalation'
    icon: Optional[str] = None
    is_active: bool = True
    order_index: int = 0

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in {"form", "url", "builtin"}:
            raise ValueError("type must be 'form', 'url', or 'builtin'")
        return v

    @field_validator("command")
    @classmethod
    def validate_command(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not re.match(r'^[a-z0-9][a-z0-9\-]*$', v):
            raise ValueError("command must be lowercase alphanumeric with hyphens")
        return v


class SlashCommandUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    form_id: Optional[str] = None
    url: Optional[str] = None
    action: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class SlashCommandRecord(BaseModel):
    id: str
    command: str
    label: str
    description: Optional[str]
    type: str
    form_id: Optional[str]
    form_name: Optional[str]
    form_slug: Optional[str]
    url: Optional[str]
    action: Optional[str]
    icon: Optional[str]
    is_active: bool
    order_index: int
    created_by_email: Optional[str]
    created_at: datetime
    updated_at: datetime


class SlashCommandListResponse(BaseModel):
    items: List[SlashCommandRecord]
    total: int


# ──────────────────────────────────────────────────────────────────────────────
# All-forms submissions (admin cross-form view)
# ──────────────────────────────────────────────────────────────────────────────

class AllSubmissionsListResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    limit: int
