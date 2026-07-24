from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user
from app.api.models.form_builder_model import (
    FieldReorderRequest,
    FormDefinitionCreate,
    FormDefinitionUpdate,
    FormFieldCreate,
    FormFieldUpdate,
    FormSubmissionCreate,
    FormSubmissionStatusUpdate,
    RuleDefinitionCreate,
    RuleDefinitionUpdate,
    RuleEvaluateRequest,
    SlashCommandCreate,
    SlashCommandUpdate,
    WorkflowApprovalAction,
    WorkflowDefinitionCreate,
    WorkflowDefinitionUpdate,
)
from app.api.services.form_builder_service import FormBuilderService
from app.api.services.form_builder_ai_service import FormBuilderAIService
from app.api.services.rule_engine_service import RuleEngineService
from app.api.services.workflow_engine_service import WorkflowEngineService
from app.api.services.slash_command_service import SlashCommandService

_svc    = FormBuilderService()
_wf_svc = WorkflowEngineService()
_rule   = RuleEngineService()
_ai_svc = FormBuilderAIService()
_slash  = SlashCommandService()


class AiFormChatRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []
    current_form: dict = {}

# Public endpoints (authenticated users)
pub_router   = APIRouter(prefix="/api/ncl",       tags=["No-Code Platform"])
# Admin-only endpoints
admin_router = APIRouter(prefix="/api/admin/ncl", tags=["No-Code Platform (Admin)"])


# ─────────────────────────────────────────────────────────────────────────────
# FORMS — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/forms", summary="List all forms")
def admin_list_forms(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    return _svc.list_forms(page, limit, status, category, search)


@admin_router.post("/forms", status_code=201, summary="Create form")
def admin_create_form(
    body: FormDefinitionCreate,
    user: dict = Depends(get_current_user),
):
    try:
        return _svc.create_form(body, user["user_id"], user["email"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@admin_router.get("/forms/{form_id}", summary="Get form by ID")
def admin_get_form(form_id: str, user: dict = Depends(get_current_user)):
    form = _svc.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@admin_router.patch("/forms/{form_id}", summary="Update form metadata")
def admin_update_form(
    form_id: str,
    body: FormDefinitionUpdate,
    user: dict = Depends(get_current_user),
):
    form = _svc.update_form(form_id, body, user["user_id"], user["email"])
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@admin_router.post(
    "/forms/{form_id}/publish",
    summary="Publish form (creates a version snapshot)",
)
def admin_publish_form(
    form_id: str,
    change_notes: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    form = _svc.publish_form(form_id, user["user_id"], user["email"], change_notes)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@admin_router.post("/forms/{form_id}/archive", summary="Archive form")
def admin_archive_form(form_id: str, user: dict = Depends(get_current_user)):
    if not _svc.archive_form(form_id, user["user_id"], user["email"]):
        raise HTTPException(status_code=404, detail="Form not found")
    return {"message": "Form archived"}


@admin_router.delete("/forms/{form_id}", summary="Delete form")
def admin_delete_form(form_id: str, user: dict = Depends(get_current_user)):
    if not _svc.delete_form(form_id, user["user_id"], user["email"]):
        raise HTTPException(status_code=404, detail="Form not found")
    return {"message": "Form deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# FIELDS — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.post(
    "/forms/{form_id}/fields",
    status_code=201,
    summary="Add field to form",
)
def admin_add_field(
    form_id: str,
    body: FormFieldCreate,
    user: dict = Depends(get_current_user),
):
    try:
        return _svc.add_field(form_id, body, user["user_id"], user["email"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@admin_router.patch(
    "/forms/{form_id}/fields/{field_id}",
    summary="Update form field",
)
def admin_update_field(
    form_id: str,
    field_id: str,
    body: FormFieldUpdate,
    user: dict = Depends(get_current_user),
):
    field = _svc.update_field(field_id, body, user["user_id"], user["email"])
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@admin_router.delete(
    "/forms/{form_id}/fields/{field_id}",
    summary="Delete form field",
)
def admin_delete_field(
    form_id: str,
    field_id: str,
    user: dict = Depends(get_current_user),
):
    if not _svc.delete_field(field_id):
        raise HTTPException(status_code=404, detail="Field not found")
    return {"message": "Field deleted"}


@admin_router.put(
    "/forms/{form_id}/fields/reorder",
    summary="Bulk reorder / move fields between sections",
)
def admin_reorder_fields(
    form_id: str,
    body: FieldReorderRequest,
    user: dict = Depends(get_current_user),
):
    _svc.reorder_fields(form_id, body)
    return {"message": "Fields reordered"}


# ─────────────────────────────────────────────────────────────────────────────
# SUBMISSIONS — view & status updates
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get(
    "/forms/{form_id}/submissions",
    summary="List submissions for a form",
)
def admin_list_submissions(
    form_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    return _svc.list_submissions(form_id, page, limit, status)


@admin_router.delete(
    "/submissions/{submission_id}",
    summary="Delete a submission permanently",
)
def admin_delete_submission(submission_id: str, user: dict = Depends(get_current_user)):
    if not _svc.delete_submission(submission_id, user["user_id"], user["email"]):
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"message": "Submission deleted"}


@admin_router.patch(
    "/submissions/{submission_id}/status",
    summary="Approve / reject / update submission status",
)
def admin_update_submission_status(
    submission_id: str,
    body: FormSubmissionStatusUpdate,
    user: dict = Depends(get_current_user),
):
    record = _svc.update_submission_status(
        submission_id, body, user["user_id"], user["email"]
    )
    if not record:
        raise HTTPException(status_code=404, detail="Submission not found")
    return record


# ─────────────────────────────────────────────────────────────────────────────
# WORKFLOWS — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/workflows", summary="List workflow definitions")
def admin_list_workflows(
    form_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    return _svc.list_workflows(form_id, page, limit)


@admin_router.post("/workflows", status_code=201, summary="Create workflow definition")
def admin_create_workflow(
    body: WorkflowDefinitionCreate,
    user: dict = Depends(get_current_user),
):
    return _svc.create_workflow(body, user["user_id"], user["email"])


@admin_router.patch("/workflows/{wf_id}", summary="Update workflow definition")
def admin_update_workflow(
    wf_id: str,
    body: WorkflowDefinitionUpdate,
    user: dict = Depends(get_current_user),
):
    wf = _svc.update_workflow(wf_id, body, user["user_id"], user["email"])
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@admin_router.delete("/workflows/{wf_id}", summary="Delete workflow definition")
def admin_delete_workflow(wf_id: str, user: dict = Depends(get_current_user)):
    if not _svc.delete_workflow(wf_id, user["user_id"], user["email"]):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# RULES — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/forms/{form_id}/rules", summary="List rule definitions for a form")
def admin_list_rules(form_id: str, user: dict = Depends(get_current_user)):
    return _svc.list_rules(form_id)


@admin_router.post(
    "/forms/{form_id}/rules",
    status_code=201,
    summary="Create rule definition",
)
def admin_create_rule(
    form_id: str,
    body: RuleDefinitionCreate,
    user: dict = Depends(get_current_user),
):
    body.form_id = form_id
    return _svc.create_rule(body, user["user_id"], user["email"])


@admin_router.patch("/rules/{rule_id}", summary="Update rule definition")
def admin_update_rule(
    rule_id: str,
    body: RuleDefinitionUpdate,
    user: dict = Depends(get_current_user),
):
    rule = _svc.update_rule(rule_id, body)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@admin_router.delete("/rules/{rule_id}", summary="Delete rule definition")
def admin_delete_rule(rule_id: str, user: dict = Depends(get_current_user)):
    if not _svc.delete_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOGS — read-only
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/audit-logs", summary="List NCL audit logs")
def admin_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    return _svc.list_audit_logs(entity_type, entity_id, page, limit)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — Forms discovery, renderer, submission
# ─────────────────────────────────────────────────────────────────────────────

@pub_router.get("/forms/search", summary="Search published forms (slash-command)")
def search_forms(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
):
    role = user.get("role")
    results = _svc.search_forms(q, role)
    return {"results": results}


@pub_router.get("/forms/published", summary="List all published forms")
def list_published_forms(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    return _svc.list_forms(page, limit, status="published", category=category)


@pub_router.get("/forms/{slug}", summary="Get published form by slug (for rendering)")
def get_form_by_slug(slug: str, user: dict = Depends(get_current_user)):
    form = _svc.get_form_by_slug(slug)
    if not form or form["status"] != "published":
        raise HTTPException(status_code=404, detail="Form not found")
    allowed = form.get("allowed_roles") or []
    if allowed and user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this form")
    return form


@pub_router.post("/forms/{slug}/submit", status_code=201, summary="Submit a form")
def submit_form(
    slug: str,
    body: FormSubmissionCreate,
    request: Request,
    user: dict = Depends(get_current_user),
):
    form = _svc.get_form_by_slug(slug)
    if not form or form["status"] != "published":
        raise HTTPException(status_code=404, detail="Form not found")
    body.form_id = form["id"]
    ip = request.client.host if request.client else None
    try:
        submission = _svc.submit_form(
            body,
            user["user_id"],
            user["email"],
            user.get("name") or user["email"],
            ip,
        )
        # Trigger any active workflows for this form asynchronously (fire-and-forget)
        try:
            _wf_svc.trigger_for_submission(submission["id"])
        except Exception:
            pass
        return submission
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@pub_router.get("/my-submissions", summary="List my form submissions")
def list_my_submissions(
    form_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    if form_id:
        return _svc.list_submissions(
            form_id, page, limit, user_email=user["email"]
        )
    # List across all forms for this user
    return _svc.list_submissions("", page, limit, user_email=user["email"])


@pub_router.get(
    "/submissions/{submission_id}",
    summary="Get a single submission (owner or admin)",
)
def get_submission(
    submission_id: str,
    user: dict = Depends(get_current_user),
):
    record = _svc.get_submission(submission_id)
    if not record:
        raise HTTPException(status_code=404, detail="Submission not found")
    if record["submitted_by_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return record


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATES — Public read, admin create/update
# ─────────────────────────────────────────────────────────────────────────────

@pub_router.get("/templates", summary="List form templates")
def list_templates(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    _user: dict = Depends(get_current_user),
):
    return _svc.list_templates(category, search)


@pub_router.post(
    "/templates/{template_id}/use",
    summary="Get template definition to pre-fill designer",
)
def use_template(template_id: str, _user: dict = Depends(get_current_user)):
    tpl = _svc.use_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


# ─────────────────────────────────────────────────────────────────────────────
# WORKFLOW INSTANCES — Admin & user-facing approval actions
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/workflow-instances", summary="List workflow instances")
def admin_list_wf_instances(
    submission_id: Optional[str] = Query(None),
    workflow_def_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    return _wf_svc.list_instances(submission_id, workflow_def_id, status, page, limit)


@admin_router.get(
    "/workflow-instances/{instance_id}",
    summary="Get workflow instance details",
)
def admin_get_wf_instance(instance_id: str, user: dict = Depends(get_current_user)):
    inst = _wf_svc.get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


@admin_router.get(
    "/workflow-instances/{instance_id}/steps",
    summary="Get step execution logs for a workflow instance",
)
def admin_get_step_logs(instance_id: str, user: dict = Depends(get_current_user)):
    return {"items": _wf_svc.get_step_logs(instance_id)}


@admin_router.post(
    "/workflow-instances/{instance_id}/cancel",
    summary="Cancel a running workflow instance",
)
def admin_cancel_wf_instance(instance_id: str, user: dict = Depends(get_current_user)):
    if not _wf_svc.cancel_instance(instance_id):
        raise HTTPException(status_code=404, detail="Instance not found")
    return {"message": "Instance cancelled"}


@pub_router.post(
    "/workflow-instances/{instance_id}/approve",
    summary="Submit approval decision for a waiting workflow step",
)
def approve_workflow_step(
    instance_id: str,
    body: WorkflowApprovalAction,
    user: dict = Depends(get_current_user),
):
    try:
        inst = _wf_svc.process_approval(
            instance_id,
            body.decision,
            body.comment,
            user["user_id"],
            user["email"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


# ─────────────────────────────────────────────────────────────────────────────
# RULE ENGINE — Real-time evaluation & admin preview
# ─────────────────────────────────────────────────────────────────────────────

@pub_router.post(
    "/forms/{form_id}/evaluate-rules",
    summary="Evaluate business rules for a form against current field values",
)
def evaluate_rules(
    form_id: str,
    body: RuleEvaluateRequest,
    _user: dict = Depends(get_current_user),
):
    """
    Called from the frontend on every field change to get real-time
    visibility, validation, and calculation updates.
    Returns field_states (per field: visible, required, error, value)
    and any notification messages.
    """
    return _rule.evaluate(form_id, body.values, body.changed_fields)


@pub_router.post(
    "/forms/{form_id}/validate-rules",
    summary="Server-side rule validation before submission",
)
def validate_rules(
    form_id: str,
    body: RuleEvaluateRequest,
    _user: dict = Depends(get_current_user),
):
    """
    Returns validation errors from the rule engine.
    Called by the form renderer just before final submission.
    """
    errors = _rule.validate_submission(form_id, body.values)
    return {"valid": len(errors) == 0, "errors": errors}


@admin_router.post(
    "/forms/{form_id}/evaluate-rules/preview",
    summary="Preview rule evaluation with any values (not restricted to published)",
)
def admin_preview_rules(
    form_id: str,
    body: RuleEvaluateRequest,
    user: dict = Depends(get_current_user),
):
    return _rule.evaluate(form_id, body.values, body.changed_fields)


# ─────────────────────────────────────────────────────────────────────────────
# AI FORM BUILDER — Conversational form creation
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.post(
    "/ai-form-builder/chat",
    summary="AI Form Builder — generate form operations from natural language",
)
def ai_form_builder_chat(
    body: AiFormChatRequest,
    user: dict = Depends(get_current_user),
):
    """
    Accepts a natural-language message about a form and returns structured
    operations (add_field, update_field, set_form_meta, etc.) that the
    frontend applies to the live form state.
    """
    try:
        return _ai_svc.chat(
            message=body.message,
            conversation_history=body.conversation_history,
            current_form=body.current_form,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# SLASH COMMANDS — Admin CRUD
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/slash-commands", summary="List all slash commands")
def admin_list_slash_commands(user: dict = Depends(get_current_user)):
    return _slash.list_slash_commands(active_only=False)


@admin_router.post("/slash-commands", status_code=201, summary="Create slash command")
def admin_create_slash_command(
    body: SlashCommandCreate,
    user: dict = Depends(get_current_user),
):
    try:
        return _slash.create_slash_command(body, user["user_id"], user["email"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.patch("/slash-commands/{cmd_id}", summary="Update slash command")
def admin_update_slash_command(
    cmd_id: str,
    body: SlashCommandUpdate,
    user: dict = Depends(get_current_user),
):
    result = _slash.update_slash_command(cmd_id, body, user["user_id"], user["email"])
    if not result:
        raise HTTPException(status_code=404, detail="Slash command not found")
    return result


@admin_router.delete("/slash-commands/{cmd_id}", summary="Delete slash command")
def admin_delete_slash_command(cmd_id: str, user: dict = Depends(get_current_user)):
    if not _slash.delete_slash_command(cmd_id):
        raise HTTPException(status_code=404, detail="Slash command not found")
    return {"message": "Slash command deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# SLASH COMMANDS — Public endpoints (chat slash menu)
# ─────────────────────────────────────────────────────────────────────────────

@pub_router.get("/slash-commands", summary="List all active slash commands")
def list_slash_commands(user: dict = Depends(get_current_user)):
    return _slash.list_slash_commands(active_only=True)


@pub_router.get("/slash-commands/search", summary="Search active slash commands")
def search_slash_commands(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
):
    results = _slash.search_slash_commands(q)
    return {"results": results}


# ─────────────────────────────────────────────────────────────────────────────
# ALL SUBMISSIONS — Cross-form admin view
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/all-submissions", summary="List submissions across all forms")
def admin_list_all_submissions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    form_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    return _slash.list_all_submissions(page, limit, form_id, status, search)


# ─────────────────────────────────────────────────────────────────────────────
# EMPLOYEE SEARCH — approver picker for workflow steps
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("/employees/search", summary="Search employees for approver picker")
def admin_search_employees(
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    if not q or len(q.strip()) < 2:
        return {"employees": []}

    import os
    from app.api.config.db_config import get_db_connection
    employee_view = os.getenv("EMPLOYEE_VIEW", "people.vb_employees")
    pattern = f"%{q.strip().lower()}%"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT "EmailId", "FirstName", "LastName", "Department", "Designation"
                FROM {employee_view}
                WHERE "EmployeeStatus" ILIKE 'Active'
                  AND (
                    LOWER(COALESCE("FirstName", '') || ' ' || COALESCE("LastName", '')) LIKE %s
                    OR LOWER(COALESCE("EmailId", '')) LIKE %s
                  )
                ORDER BY "FirstName", "LastName"
                LIMIT %s
                """,
                (pattern, pattern, limit),
            )
            rows = cur.fetchall()

    employees = []
    for row in rows:
        email = (row.get("EmailId") or "").strip()
        first = (row.get("FirstName") or "").strip()
        last  = (row.get("LastName")  or "").strip()
        if not email:
            continue
        employees.append({
            "email":       email,
            "name":        f"{first} {last}".strip() or email,
            "department":  (row.get("Department")  or "").strip(),
            "designation": (row.get("Designation") or "").strip(),
        })

    return {"employees": employees}
