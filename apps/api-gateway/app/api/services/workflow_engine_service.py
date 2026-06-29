"""
Workflow Engine — executes workflow instances step-by-step.

Supported step types:
  approval    — waits for a human approve/reject decision
  email       — sends an email via SMTP
  webhook     — POSTs JSON payload to an external URL
  api_call    — makes a configurable HTTP request
  condition   — branches based on a JS-style expression evaluated on submission data
  notification — creates an internal notification (stored in context)
  delay       — marks step waiting; a scheduler would re-trigger after delay_seconds
"""
import json
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests

from app.api.config.db_config import get_db_connection


def _now():
    return datetime.now(timezone.utc)


def _row_to_dict(cur, row):
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    for key in ("steps", "trigger_conditions", "context",
                "input_data", "output_data", "changes"):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except Exception:
                pass
    return d


# ─────────────────────────────────────────────────────────────────────────────
# Expression evaluator (safe subset for condition steps)
# ─────────────────────────────────────────────────────────────────────────────

def _eval_condition(expr: str, context: dict) -> bool:
    """Very simple condition evaluator — supports field comparisons only.
    expr format: "field_name operator value"  e.g. "status eq approved"
    or compound: "field1 eq x AND field2 neq y"
    For complex expressions, use the rule engine instead.
    """
    def _single(part: str) -> bool:
        tokens = part.strip().split()
        if len(tokens) < 3:
            return False
        field, op, val = tokens[0], tokens[1].lower(), ' '.join(tokens[2:])
        actual = str(context.get(field, ''))
        if op == 'eq':   return actual == val
        if op == 'neq':  return actual != val
        if op == 'gt':   return float(actual or 0) > float(val)
        if op == 'gte':  return float(actual or 0) >= float(val)
        if op == 'lt':   return float(actual or 0) < float(val)
        if op == 'lte':  return float(actual or 0) <= float(val)
        if op == 'contains': return val.lower() in actual.lower()
        if op == 'empty':    return not actual.strip()
        return False

    if ' AND ' in expr.upper():
        return all(_single(p) for p in expr.split(' AND '))
    if ' OR ' in expr.upper():
        return any(_single(p) for p in expr.split(' OR '))
    return _single(expr)


# ─────────────────────────────────────────────────────────────────────────────
# Step handlers
# ─────────────────────────────────────────────────────────────────────────────

def _handle_email(step_config: dict, context: dict) -> dict:
    """Send email via SMTP. Returns {status, message_id}."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.office365.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender    = step_config.get("from", smtp_user)

    to_addr = step_config.get("to", "")
    # Support template variable substitution in to/subject/body
    for key, val in context.items():
        to_addr = to_addr.replace(f"{{{{{key}}}}}", str(val))

    subject = step_config.get("subject", "Notification from AURA")
    for key, val in context.items():
        subject = subject.replace(f"{{{{{key}}}}}", str(val))

    body = step_config.get("body", "")
    for key, val in context.items():
        body = body.replace(f"{{{{{key}}}}}", str(val))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = to_addr
    msg.attach(MIMEText(body, "html" if step_config.get("html") else "plain"))

    with smtplib.SMTP(smtp_host, smtp_port) as srv:
        srv.ehlo()
        srv.starttls()
        if smtp_user:
            srv.login(smtp_user, smtp_pass)
        srv.sendmail(sender, to_addr, msg.as_string())

    return {"status": "sent", "to": to_addr, "subject": subject}


def _handle_webhook(step_config: dict, context: dict) -> dict:
    """POST JSON to a webhook URL."""
    url = step_config.get("url", "")
    payload = step_config.get("payload", {})
    # Merge submission context into payload if requested
    if step_config.get("include_context"):
        payload = {**payload, **context}
    headers = step_config.get("headers", {"Content-Type": "application/json"})
    timeout = step_config.get("timeout_seconds", 10)

    resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    return {"status_code": resp.status_code, "response": resp.text[:500]}


def _handle_api_call(step_config: dict, context: dict) -> dict:
    """Generic HTTP request."""
    method  = step_config.get("method", "POST").upper()
    url     = step_config.get("url", "")
    payload = step_config.get("payload", {})
    if step_config.get("include_context"):
        payload = {**payload, **context}
    headers = step_config.get("headers", {"Content-Type": "application/json"})
    timeout = step_config.get("timeout_seconds", 10)

    resp = requests.request(method, url, json=payload, headers=headers, timeout=timeout)
    return {"status_code": resp.status_code, "response": resp.text[:500]}


def _handle_condition(step_config: dict, context: dict) -> dict:
    """Evaluate a condition and return which branch to take."""
    expr   = step_config.get("expression", "")
    result = _eval_condition(expr, context)
    return {"condition_result": result, "branch": "true" if result else "false"}


def _handle_notification(step_config: dict, context: dict) -> dict:
    """Store a notification message in the instance context."""
    msg = step_config.get("message", "")
    for key, val in context.items():
        msg = msg.replace(f"{{{{{key}}}}}", str(val))
    return {"notification": msg}


# ─────────────────────────────────────────────────────────────────────────────
# WorkflowEngineService
# ─────────────────────────────────────────────────────────────────────────────

class WorkflowEngineService:

    # ── Trigger: create an instance for a submission ──────────────────────────
    def trigger_for_submission(self, submission_id: str) -> list:
        """Find all active workflows for this submission's form and start them."""
        instances_started = []

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT form_id, data FROM ncl_form_submissions WHERE id = %s",
                    (submission_id,),
                )
                row = cur.fetchone()
                if not row:
                    return []
                form_id, sub_data = row[0], row[1]
                if isinstance(sub_data, str):
                    try:
                        sub_data = json.loads(sub_data)
                    except Exception:
                        sub_data = {}

                cur.execute(
                    """
                    SELECT id FROM ncl_workflow_definitions
                    WHERE  form_id = %s
                      AND  status  = 'active'
                      AND  trigger_event = 'on_submit'
                    """,
                    (form_id,),
                )
                wf_ids = [r[0] for r in cur.fetchall()]

        for wf_id in wf_ids:
            inst = self.start_instance(wf_id, submission_id, sub_data)
            instances_started.append(inst)

        return instances_started

    # ── Start a workflow instance ─────────────────────────────────────────────
    def start_instance(
        self,
        workflow_def_id: str,
        submission_id: Optional[str],
        initial_context: dict,
    ) -> dict:
        instance_id = str(uuid.uuid4())
        now = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ncl_workflow_instances
                        (id, workflow_def_id, submission_id, status,
                         current_step_index, context, started_at)
                    VALUES (%s,%s,%s,'running',0,%s,%s)
                    """,
                    (
                        instance_id, workflow_def_id, submission_id,
                        json.dumps(initial_context), now,
                    ),
                )
                conn.commit()

        # Execute first step immediately
        self._advance_instance(instance_id)
        return self.get_instance(instance_id)

    # ── Advance instance to next step ─────────────────────────────────────────
    def _advance_instance(self, instance_id: str):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT wi.id, wi.workflow_def_id, wi.current_step_index,
                           wi.context, wi.status,
                           wd.steps
                    FROM   ncl_workflow_instances wi
                    JOIN   ncl_workflow_definitions wd ON wd.id = wi.workflow_def_id
                    WHERE  wi.id = %s
                    """,
                    (instance_id,),
                )
                row = cur.fetchone()
                if not row:
                    return
                (inst_id, wf_def_id, step_idx,
                 context_raw, inst_status, steps_raw) = row

        if inst_status not in ("running",):
            return

        context = json.loads(context_raw) if isinstance(context_raw, str) else (context_raw or {})
        steps   = json.loads(steps_raw)   if isinstance(steps_raw,   str) else (steps_raw   or [])

        if step_idx >= len(steps):
            self._complete_instance(instance_id, context)
            return

        step = steps[step_idx]
        self._execute_step(instance_id, step_idx, step, context)

    # ── Execute a single step ─────────────────────────────────────────────────
    def _execute_step(
        self,
        instance_id: str,
        step_idx: int,
        step: dict,
        context: dict,
    ):
        step_type = step.get("type", "")
        step_name = step.get("name", step_type)
        config    = step.get("config", {})
        log_id    = str(uuid.uuid4())
        now       = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ncl_workflow_step_logs
                        (id, instance_id, step_index, step_type, step_name,
                         status, input_data, started_at)
                    VALUES (%s,%s,%s,%s,%s,'running',%s,%s)
                    """,
                    (log_id, instance_id, step_idx, step_type, step_name,
                     json.dumps(context), now),
                )
                conn.commit()

        # Approval step — pauses execution; waits for human action
        if step_type == "approval":
            self._set_instance_status(instance_id, "waiting_approval", step_idx)
            self._complete_step_log(log_id, "waiting", {}, None)
            return

        # Delay step — pause; a scheduler would call _advance_instance later
        if step_type == "delay":
            self._set_instance_status(instance_id, "waiting_delay", step_idx)
            self._complete_step_log(log_id, "waiting", {"delay_seconds": config.get("delay_seconds", 60)}, None)
            return

        # Execute non-blocking steps
        output = {}
        error  = None
        try:
            if step_type == "email":
                output = _handle_email(config, context)
            elif step_type == "webhook":
                output = _handle_webhook(config, context)
            elif step_type == "api_call":
                output = _handle_api_call(config, context)
            elif step_type == "condition":
                output = _handle_condition(config, context)
            elif step_type == "notification":
                output = _handle_notification(config, context)
            else:
                output = {"skipped": True, "reason": f"Unknown step type: {step_type}"}
        except Exception as exc:
            error  = str(exc)
            output = {}

        # Merge output into context
        new_context = {**context, **{f"step_{step_idx}_{k}": v for k, v in output.items()}}

        if error:
            self._complete_step_log(log_id, "failed", output, error)
            if step.get("on_failure") == "continue":
                self._advance_to_next(instance_id, step_idx + 1, new_context)
            else:
                self._fail_instance(instance_id, error, new_context)
        else:
            self._complete_step_log(log_id, "completed", output, None)
            self._advance_to_next(instance_id, step_idx + 1, new_context)

    def _advance_to_next(self, instance_id: str, next_idx: int, context: dict):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_workflow_instances
                    SET    current_step_index = %s, context = %s
                    WHERE  id = %s
                    """,
                    (next_idx, json.dumps(context), instance_id),
                )
                conn.commit()
        self._advance_instance(instance_id)

    def _complete_instance(self, instance_id: str, context: dict):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_workflow_instances
                    SET    status = 'completed', completed_at = %s, context = %s
                    WHERE  id = %s
                    """,
                    (_now(), json.dumps(context), instance_id),
                )
                conn.commit()

    def _fail_instance(self, instance_id: str, error: str, context: dict):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_workflow_instances
                    SET    status = 'failed', error_message = %s,
                           completed_at = %s, context = %s
                    WHERE  id = %s
                    """,
                    (error, _now(), json.dumps(context), instance_id),
                )
                conn.commit()

    def _set_instance_status(
        self, instance_id: str, status: str, step_idx: int
    ):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_workflow_instances
                    SET    status = %s, current_step_index = %s
                    WHERE  id = %s
                    """,
                    (status, step_idx, instance_id),
                )
                conn.commit()

    def _complete_step_log(
        self,
        log_id: str,
        status: str,
        output_data: dict,
        error: Optional[str],
    ):
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_workflow_step_logs
                    SET    status = %s, output_data = %s,
                           error_message = %s, completed_at = %s
                    WHERE  id = %s
                    """,
                    (status, json.dumps(output_data), error, _now(), log_id),
                )
                conn.commit()

    # ── Approval action ───────────────────────────────────────────────────────
    def process_approval(
        self,
        instance_id: str,
        decision: str,         # approve | reject
        comment: Optional[str],
        actor_user_id: str,
        actor_email: str,
    ) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT status, current_step_index, context FROM ncl_workflow_instances WHERE id = %s",
                    (instance_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                status, step_idx, context_raw = row

        if status != "waiting_approval":
            raise ValueError("Instance is not waiting for approval")

        context = json.loads(context_raw) if isinstance(context_raw, str) else (context_raw or {})
        context[f"approval_{step_idx}_decision"] = decision
        context[f"approval_{step_idx}_comment"]  = comment or ""
        context[f"approval_{step_idx}_by"]       = actor_email

        if decision == "reject":
            self._fail_instance(instance_id, f"Rejected by {actor_email}: {comment}", context)
        else:
            self._advance_to_next(instance_id, step_idx + 1, context)

        return self.get_instance(instance_id)

    # ── Read helpers ──────────────────────────────────────────────────────────
    def get_instance(self, instance_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_workflow_instances WHERE id = %s",
                    (instance_id,),
                )
                return _row_to_dict(cur, cur.fetchone())

    def list_instances(
        self,
        submission_id: Optional[str] = None,
        workflow_def_id: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        offset = (page - 1) * limit
        conditions: list = []
        params: list = []

        if submission_id:
            conditions.append("submission_id = %s"); params.append(submission_id)
        if workflow_def_id:
            conditions.append("workflow_def_id = %s"); params.append(workflow_def_id)
        if status:
            conditions.append("status = %s"); params.append(status)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*) FROM ncl_workflow_instances {where}", params
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT * FROM ncl_workflow_instances {where} "
                    f"ORDER BY started_at DESC LIMIT %s OFFSET %s",
                    params + [limit, offset],
                )
                items = [_row_to_dict(cur, r) for r in cur.fetchall()]

        return {"items": items, "total": total, "page": page, "limit": limit}

    def get_step_logs(self, instance_id: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_workflow_step_logs WHERE instance_id = %s ORDER BY step_index",
                    (instance_id,),
                )
                return [_row_to_dict(cur, r) for r in cur.fetchall()]

    def cancel_instance(self, instance_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE ncl_workflow_instances SET status='cancelled', completed_at=%s WHERE id=%s",
                    (_now(), instance_id),
                )
                updated = cur.rowcount > 0
                conn.commit()
        return updated
