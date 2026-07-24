import json
import uuid
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.api.config.db_config import get_db_connection
from app.api.models.form_builder_model import (
    FormDefinitionCreate,
    FormDefinitionUpdate,
    FormFieldCreate,
    FormFieldUpdate,
    FieldReorderRequest,
    FormSectionCreate,
    FormSubmissionCreate,
    FormSubmissionStatusUpdate,
    WorkflowDefinitionCreate,
    WorkflowDefinitionUpdate,
    WorkflowApprovalAction,
    RuleDefinitionCreate,
    RuleDefinitionUpdate,
)


def _now():
    return datetime.now(timezone.utc)


def _json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')


def _write_audit(cur, entity_type: str, entity_id: str, action: str,
                 actor_user_id: str, actor_email: str,
                 changes: dict = None, ip_address: str = None):
    cur.execute(
        """
        INSERT INTO ncl_audit_logs
            (id, entity_type, entity_id, action, actor_user_id, actor_email, changes, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            str(uuid.uuid4()), entity_type, entity_id, action,
            actor_user_id, actor_email,
            json.dumps(changes or {}), ip_address,
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _row_to_form(row: dict) -> dict:
    """Normalise DB row into a clean dict (parse JSONB strings if needed)."""
    for key in ("settings", "options", "validation_rules",
                "conditional_logic", "style", "metadata",
                "trigger_conditions", "steps", "conditions", "actions",
                "context", "changes", "definition", "snapshot"):
        if key in row and isinstance(row[key], str):
            try:
                row[key] = json.loads(row[key])
            except (json.JSONDecodeError, TypeError):
                pass
    for key in ("tags", "keywords", "allowed_roles", "trigger_fields"):
        if key in row and row[key] is None:
            row[key] = []
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Form Definitions
# ─────────────────────────────────────────────────────────────────────────────

class FormBuilderService:

    # ── List forms ────────────────────────────────────────────────────────────
    def list_forms(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        offset = (page - 1) * limit
        conditions = []
        params: list = []

        if status:
            conditions.append("status = %s")
            params.append(status)
        if category:
            conditions.append("category = %s")
            params.append(category)
        if search:
            conditions.append(
                "(name ILIKE %s OR description ILIKE %s OR alias ILIKE %s)"
            )
            like = f"%{search}%"
            params += [like, like, like]

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*) FROM ncl_form_definitions {where}",
                    params,
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    f"""
                    SELECT id, name, slug, description, category, status, version,
                           icon, alias, created_by_email, published_at,
                           created_at, updated_at
                    FROM   ncl_form_definitions
                    {where}
                    ORDER  BY updated_at DESC
                    LIMIT  %s OFFSET %s
                    """,
                    params + [limit, offset],
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in rows]

        return {"items": items, "total": total, "page": page, "limit": limit}

    # ── Get single form (with sections + fields) ──────────────────────────────
    def get_form(self, form_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_form_definitions WHERE id = %s",
                    (form_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                form = _row_to_form(dict(row))

                cur.execute(
                    "SELECT * FROM ncl_form_sections WHERE form_id = %s ORDER BY order_index",
                    (form_id,),
                )
                form["sections"] = [_row_to_form(dict(r)) for r in cur.fetchall()]

                cur.execute(
                    "SELECT * FROM ncl_form_fields WHERE form_id = %s ORDER BY order_index",
                    (form_id,),
                )
                form["fields"] = [_row_to_form(dict(r)) for r in cur.fetchall()]

        return form

    # ── Get form by slug ──────────────────────────────────────────────────────
    def get_form_by_slug(self, slug: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM ncl_form_definitions WHERE slug = %s",
                    (slug,),
                )
                row = cur.fetchone()
        return self.get_form(row["id"]) if row else None

    # ── Create form ───────────────────────────────────────────────────────────
    def create_form(
        self,
        body: FormDefinitionCreate,
        user_id: str,
        email: str,
    ) -> dict:
        form_id = str(uuid.uuid4())
        now = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Check slug uniqueness
                cur.execute(
                    "SELECT 1 FROM ncl_form_definitions WHERE slug = %s",
                    (body.slug,),
                )
                if cur.fetchone():
                    raise ValueError(f"Slug '{body.slug}' is already taken")

                cur.execute(
                    """
                    INSERT INTO ncl_form_definitions
                        (id, name, slug, description, category, status, version,
                         tags, keywords, alias, icon, settings, allowed_roles,
                         created_by_user_id, created_by_email,
                         created_at, updated_at)
                    VALUES
                        (%s,%s,%s,%s,%s,'draft',1,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        form_id, body.name, body.slug, body.description,
                        body.category,
                        body.tags or [], body.keywords or [],
                        body.alias, body.icon,
                        json.dumps(body.settings),
                        body.allowed_roles or [],
                        user_id, email, now, now,
                    ),
                )

                # Insert sections
                for i, sec in enumerate(body.sections):
                    cur.execute(
                        """
                        INSERT INTO ncl_form_sections
                            (id, form_id, title, description, order_index,
                             collapsed, conditions, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            str(uuid.uuid4()), form_id, sec.title,
                            sec.description, sec.order_index,
                            sec.collapsed, json.dumps(sec.conditions), now,
                        ),
                    )

                # Insert fields
                for field in body.fields:
                    self._insert_field(cur, form_id, field, now)

                _write_audit(cur, "ncl_form_definitions", form_id,
                             "created", user_id, email)
                conn.commit()

        return self.get_form(form_id)

    # ── Update form metadata ──────────────────────────────────────────────────
    def update_form(
        self,
        form_id: str,
        body: FormDefinitionUpdate,
        user_id: str,
        email: str,
    ) -> Optional[dict]:
        fields_to_set = []
        params: list = []

        if body.name is not None:
            fields_to_set.append("name = %s"); params.append(body.name)
        if body.description is not None:
            fields_to_set.append("description = %s"); params.append(body.description)
        if body.category is not None:
            fields_to_set.append("category = %s"); params.append(body.category)
        if body.tags is not None:
            fields_to_set.append("tags = %s"); params.append(body.tags)
        if body.keywords is not None:
            fields_to_set.append("keywords = %s"); params.append(body.keywords)
        if body.alias is not None:
            fields_to_set.append("alias = %s"); params.append(body.alias)
        if body.icon is not None:
            fields_to_set.append("icon = %s"); params.append(body.icon)
        if body.settings is not None:
            fields_to_set.append("settings = %s"); params.append(json.dumps(body.settings))
        if body.allowed_roles is not None:
            fields_to_set.append("allowed_roles = %s"); params.append(body.allowed_roles)

        if not fields_to_set:
            return self.get_form(form_id)

        fields_to_set += ["updated_by_user_id = %s", "updated_by_email = %s", "updated_at = %s"]
        params += [user_id, email, _now()]
        params.append(form_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE ncl_form_definitions SET {', '.join(fields_to_set)} WHERE id = %s",
                    params,
                )
                _write_audit(cur, "ncl_form_definitions", form_id,
                             "updated", user_id, email)
                conn.commit()

        return self.get_form(form_id)

    # ── Publish form ──────────────────────────────────────────────────────────
    def publish_form(
        self,
        form_id: str,
        user_id: str,
        email: str,
        change_notes: Optional[str] = None,
    ) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT version FROM ncl_form_definitions WHERE id = %s",
                    (form_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                new_version = row["version"] + 1
                now = _now()

                # Snapshot current definition
                form = self.get_form(form_id)
                cur.execute(
                    """
                    INSERT INTO ncl_form_versions
                        (id, form_id, version, snapshot, change_notes,
                         created_by_user_id, created_by_email, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        str(uuid.uuid4()), form_id, new_version,
                        json.dumps(form, default=_json_serial), change_notes,
                        user_id, email, now,
                    ),
                )

                cur.execute(
                    """
                    UPDATE ncl_form_definitions
                    SET    status = 'published', version = %s,
                           published_at = %s, updated_by_user_id = %s,
                           updated_by_email = %s, updated_at = %s
                    WHERE  id = %s
                    """,
                    (new_version, now, user_id, email, now, form_id),
                )
                _write_audit(cur, "ncl_form_definitions", form_id,
                             "published", user_id, email,
                             {"version": new_version})
                conn.commit()

        return self.get_form(form_id)

    # ── Archive / delete form ─────────────────────────────────────────────────
    def archive_form(self, form_id: str, user_id: str, email: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_form_definitions
                    SET    status = 'archived', updated_at = %s,
                           updated_by_user_id = %s, updated_by_email = %s
                    WHERE  id = %s
                    """,
                    (_now(), user_id, email, form_id),
                )
                if cur.rowcount == 0:
                    return False
                _write_audit(cur, "ncl_form_definitions", form_id,
                             "archived", user_id, email)
                conn.commit()
        return True

    def delete_form(self, form_id: str, user_id: str, email: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ncl_form_definitions WHERE id = %s",
                    (form_id,),
                )
                deleted = cur.rowcount > 0
                if deleted:
                    _write_audit(cur, "ncl_form_definitions", form_id,
                                 "deleted", user_id, email)
                conn.commit()
        return deleted

    # ─────────────────────────────────────────────────────────────────────────
    # Fields
    # ─────────────────────────────────────────────────────────────────────────

    def _insert_field(self, cur, form_id: str, field: FormFieldCreate,
                      now: datetime) -> str:
        field_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO ncl_form_fields
                (id, form_id, section_id, field_type, label, name,
                 placeholder, help_text, default_value, required,
                 read_only, hidden, order_index, width, options,
                 validation_rules, conditional_logic, formula,
                 style, metadata, created_at, updated_at)
            VALUES
                (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                field_id, form_id, field.section_id or None,
                field.field_type, field.label, field.name,
                field.placeholder, field.help_text, field.default_value,
                field.required, field.read_only, field.hidden,
                field.order_index, field.width,
                json.dumps([o.model_dump() for o in field.options]),
                json.dumps(field.validation_rules),
                json.dumps(field.conditional_logic),
                field.formula,
                json.dumps(field.style),
                json.dumps(field.metadata),
                now, now,
            ),
        )
        return field_id

    def add_field(
        self,
        form_id: str,
        body: FormFieldCreate,
        user_id: str,
        email: str,
    ) -> dict:
        now = _now()
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Check duplicate name within form
                cur.execute(
                    "SELECT 1 FROM ncl_form_fields WHERE form_id = %s AND name = %s",
                    (form_id, body.name),
                )
                if cur.fetchone():
                    raise ValueError(f"Field name '{body.name}' already exists in this form")

                field_id = self._insert_field(cur, form_id, body, now)
                _write_audit(cur, "ncl_form_definitions", form_id,
                             "field_added", user_id, email,
                             {"field_name": body.name, "field_id": field_id})
                conn.commit()

            with conn.cursor() as cur:
                cur.execute("SELECT * FROM ncl_form_fields WHERE id = %s", (field_id,))
                cols = [d[0] for d in cur.description]
                return _row_to_form(dict(cur.fetchone()))

    def update_field(
        self,
        field_id: str,
        body: FormFieldUpdate,
        user_id: str,
        email: str,
    ) -> Optional[dict]:
        parts = []
        params: list = []

        mapping: dict[str, Any] = {
            "label": body.label, "section_id": body.section_id,
            "placeholder": body.placeholder, "help_text": body.help_text,
            "default_value": body.default_value, "required": body.required,
            "read_only": body.read_only, "hidden": body.hidden,
            "order_index": body.order_index, "width": body.width,
            "formula": body.formula,
        }
        json_mapping = {
            "options": body.options,
            "validation_rules": body.validation_rules,
            "conditional_logic": body.conditional_logic,
            "style": body.style,
            "metadata": body.metadata,
        }

        for col, val in mapping.items():
            if val is not None:
                parts.append(f"{col} = %s"); params.append(val)

        for col, val in json_mapping.items():
            if val is not None:
                parts.append(f"{col} = %s")
                if col == "options":
                    params.append(json.dumps([o.model_dump() for o in val]))
                else:
                    params.append(json.dumps(val))

        if not parts:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM ncl_form_fields WHERE id = %s", (field_id,))
                    cols = [d[0] for d in cur.description]
                    row = cur.fetchone()
                    return _row_to_form(dict(row)) if row else None

        parts.append("updated_at = %s"); params.append(_now())
        params.append(field_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE ncl_form_fields SET {', '.join(parts)} WHERE id = %s",
                    params,
                )
                conn.commit()
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM ncl_form_fields WHERE id = %s", (field_id,))
                cols = [d[0] for d in cur.description]
                row = cur.fetchone()
                return _row_to_form(dict(row)) if row else None

    def delete_field(self, field_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM ncl_form_fields WHERE id = %s", (field_id,))
                deleted = cur.rowcount > 0
                conn.commit()
        return deleted

    def reorder_fields(self, form_id: str, body: FieldReorderRequest) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for item in body.fields:
                    cur.execute(
                        """
                        UPDATE ncl_form_fields
                        SET    order_index = %s, section_id = %s, updated_at = %s
                        WHERE  id = %s AND form_id = %s
                        """,
                        (item.order_index, item.section_id, _now(),
                         item.id, form_id),
                    )
                conn.commit()
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # Form Submissions
    # ─────────────────────────────────────────────────────────────────────────

    def submit_form(
        self,
        body: FormSubmissionCreate,
        user_id: str,
        email: str,
        name: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        submission_id = str(uuid.uuid4())
        now = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Fetch current form version
                cur.execute(
                    "SELECT version, status FROM ncl_form_definitions WHERE id = %s",
                    (body.form_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise ValueError("Form not found")
                if row["status"] != "published":
                    raise ValueError("Form is not published")
                version = row["version"]

                cur.execute(
                    """
                    INSERT INTO ncl_form_submissions
                        (id, form_id, form_version, submitted_by_user_id,
                         submitted_by_email, submitted_by_name, status,
                         data, metadata, ip_address, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,'submitted',%s,%s,%s,%s,%s)
                    """,
                    (
                        submission_id, body.form_id, version,
                        user_id, email, name,
                        json.dumps(body.data),
                        json.dumps(body.metadata),
                        ip_address, now, now,
                    ),
                )
                _write_audit(cur, "ncl_form_submissions", submission_id,
                             "submitted", user_id, email)
                conn.commit()

        return self.get_submission(submission_id)

    def get_submission(self, submission_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_form_submissions WHERE id = %s",
                    (submission_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                cols = [d[0] for d in cur.description]
                return _row_to_form(dict(row))

    def list_submissions(
        self,
        form_id: str,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> dict:
        offset = (page - 1) * limit
        conditions = ["form_id = %s"]
        params: list = [form_id]

        if status:
            conditions.append("status = %s"); params.append(status)
        if user_email:
            conditions.append("submitted_by_email = %s"); params.append(user_email)

        where = "WHERE " + " AND ".join(conditions)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*) FROM ncl_form_submissions {where}", params
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT * FROM ncl_form_submissions {where} "
                    f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    params + [limit, offset],
                )
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in cur.fetchall()]

        return {"items": items, "total": total, "page": page, "limit": limit}

    def delete_submission(self, submission_id: str, user_id: str, email: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ncl_form_submissions WHERE id = %s",
                    (submission_id,),
                )
                deleted = cur.rowcount > 0
                if deleted:
                    _write_audit(cur, "ncl_form_submissions", submission_id,
                                 "deleted", user_id, email)
                conn.commit()
        return deleted

    def update_submission_status(
        self,
        submission_id: str,
        body: FormSubmissionStatusUpdate,
        reviewer_user_id: str,
        reviewer_email: str,
    ) -> Optional[dict]:
        now = _now()
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ncl_form_submissions
                    SET    status = %s, review_notes = %s,
                           reviewed_by_user_id = %s, reviewed_by_email = %s,
                           reviewed_at = %s, updated_at = %s
                    WHERE  id = %s
                    """,
                    (
                        body.status, body.review_notes,
                        reviewer_user_id, reviewer_email,
                        now, now, submission_id,
                    ),
                )
                if cur.rowcount == 0:
                    return None
                _write_audit(
                    cur, "ncl_form_submissions", submission_id,
                    body.status, reviewer_user_id, reviewer_email,
                )
                conn.commit()
        return self.get_submission(submission_id)

    # ─────────────────────────────────────────────────────────────────────────
    # Workflow Definitions
    # ─────────────────────────────────────────────────────────────────────────

    def list_workflows(
        self,
        form_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        offset = (page - 1) * limit
        conditions: list = []
        params: list = []

        if form_id:
            conditions.append("form_id = %s"); params.append(form_id)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*) FROM ncl_workflow_definitions {where}", params
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT * FROM ncl_workflow_definitions {where} "
                    f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    params + [limit, offset],
                )
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in cur.fetchall()]

        return {"items": items, "total": total, "page": page, "limit": limit}

    def create_workflow(
        self,
        body: WorkflowDefinitionCreate,
        user_id: str,
        email: str,
    ) -> dict:
        wf_id = str(uuid.uuid4())
        now = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ncl_workflow_definitions
                        (id, form_id, name, description, trigger_event,
                         trigger_conditions, steps, status,
                         created_by_user_id, created_by_email,
                         created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s,%s)
                    """,
                    (
                        wf_id, body.form_id, body.name, body.description,
                        body.trigger_event,
                        json.dumps(body.trigger_conditions),
                        json.dumps(body.steps),
                        user_id, email, now, now,
                    ),
                )
                _write_audit(cur, "ncl_workflow_definitions", wf_id,
                             "created", user_id, email)
                conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_workflow_definitions WHERE id = %s", (wf_id,)
                )
                cols = [d[0] for d in cur.description]
                return _row_to_form(dict(cur.fetchone()))

    def update_workflow(
        self,
        wf_id: str,
        body: WorkflowDefinitionUpdate,
        user_id: str,
        email: str,
    ) -> Optional[dict]:
        parts = []
        params: list = []

        if body.name is not None:
            parts.append("name = %s"); params.append(body.name)
        if body.description is not None:
            parts.append("description = %s"); params.append(body.description)
        if body.trigger_event is not None:
            parts.append("trigger_event = %s"); params.append(body.trigger_event)
        if body.trigger_conditions is not None:
            parts.append("trigger_conditions = %s")
            params.append(json.dumps(body.trigger_conditions))
        if body.steps is not None:
            parts.append("steps = %s"); params.append(json.dumps(body.steps))
        if body.status is not None:
            parts.append("status = %s"); params.append(body.status)

        if not parts:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM ncl_workflow_definitions WHERE id = %s", (wf_id,)
                    )
                    cols = [d[0] for d in cur.description]
                    row = cur.fetchone()
                    return _row_to_form(dict(row)) if row else None

        parts.append("updated_at = %s"); params.append(_now())
        params.append(wf_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE ncl_workflow_definitions SET {', '.join(parts)} WHERE id = %s",
                    params,
                )
                _write_audit(cur, "ncl_workflow_definitions", wf_id,
                             "updated", user_id, email)
                conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_workflow_definitions WHERE id = %s", (wf_id,)
                )
                cols = [d[0] for d in cur.description]
                row = cur.fetchone()
                return _row_to_form(dict(row)) if row else None

    def delete_workflow(self, wf_id: str, user_id: str, email: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ncl_workflow_definitions WHERE id = %s", (wf_id,)
                )
                deleted = cur.rowcount > 0
                if deleted:
                    _write_audit(cur, "ncl_workflow_definitions", wf_id,
                                 "deleted", user_id, email)
                conn.commit()
        return deleted

    # ─────────────────────────────────────────────────────────────────────────
    # Rule Definitions
    # ─────────────────────────────────────────────────────────────────────────

    def list_rules(self, form_id: str) -> dict:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_rule_definitions "
                    "WHERE form_id = %s ORDER BY priority, created_at",
                    (form_id,),
                )
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in cur.fetchall()]
        return {"items": items, "total": len(items)}

    def create_rule(
        self,
        body: RuleDefinitionCreate,
        user_id: str,
        email: str,
    ) -> dict:
        rule_id = str(uuid.uuid4())
        now = _now()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ncl_rule_definitions
                        (id, form_id, name, description, rule_type,
                         trigger_fields, conditions, actions,
                         priority, is_active, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        rule_id, body.form_id, body.name, body.description,
                        body.rule_type, body.trigger_fields or [],
                        json.dumps(body.conditions),
                        json.dumps(body.actions),
                        body.priority, body.is_active, now, now,
                    ),
                )
                conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_rule_definitions WHERE id = %s", (rule_id,)
                )
                cols = [d[0] for d in cur.description]
                return _row_to_form(dict(cur.fetchone()))

    def update_rule(
        self,
        rule_id: str,
        body: RuleDefinitionUpdate,
    ) -> Optional[dict]:
        parts = []
        params: list = []

        if body.name is not None:
            parts.append("name = %s"); params.append(body.name)
        if body.description is not None:
            parts.append("description = %s"); params.append(body.description)
        if body.trigger_fields is not None:
            parts.append("trigger_fields = %s"); params.append(body.trigger_fields)
        if body.conditions is not None:
            parts.append("conditions = %s"); params.append(json.dumps(body.conditions))
        if body.actions is not None:
            parts.append("actions = %s"); params.append(json.dumps(body.actions))
        if body.priority is not None:
            parts.append("priority = %s"); params.append(body.priority)
        if body.is_active is not None:
            parts.append("is_active = %s"); params.append(body.is_active)

        if not parts:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM ncl_rule_definitions WHERE id = %s", (rule_id,)
                    )
                    cols = [d[0] for d in cur.description]
                    row = cur.fetchone()
                    return _row_to_form(dict(row)) if row else None

        parts.append("updated_at = %s"); params.append(_now())
        params.append(rule_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE ncl_rule_definitions SET {', '.join(parts)} WHERE id = %s",
                    params,
                )
                conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_rule_definitions WHERE id = %s", (rule_id,)
                )
                cols = [d[0] for d in cur.description]
                row = cur.fetchone()
                return _row_to_form(dict(row)) if row else None

    def delete_rule(self, rule_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ncl_rule_definitions WHERE id = %s", (rule_id,)
                )
                deleted = cur.rowcount > 0
                conn.commit()
        return deleted

    # ─────────────────────────────────────────────────────────────────────────
    # Templates
    # ─────────────────────────────────────────────────────────────────────────

    def list_templates(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        conditions: list = []
        params: list = []

        if category:
            conditions.append("category = %s"); params.append(category)
        if search:
            conditions.append("(name ILIKE %s OR description ILIKE %s)")
            like = f"%{search}%"
            params += [like, like]

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT * FROM ncl_form_templates {where} "
                    f"ORDER BY is_system DESC, usage_count DESC",
                    params,
                )
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in cur.fetchall()]

        return {"items": items, "total": len(items)}

    def use_template(self, template_id: str) -> Optional[dict]:
        """Return template definition and increment usage count."""
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM ncl_form_templates WHERE id = %s",
                    (template_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                cols = [d[0] for d in cur.description]
                tpl = _row_to_form(dict(row))

                cur.execute(
                    "UPDATE ncl_form_templates SET usage_count = usage_count + 1 WHERE id = %s",
                    (template_id,),
                )
                conn.commit()
        return tpl

    # ─────────────────────────────────────────────────────────────────────────
    # Slash-command search
    # ─────────────────────────────────────────────────────────────────────────

    def search_forms(self, query: str, user_role: Optional[str] = None) -> list:
        """Full-text search for published forms (used by chat slash commands)."""
        like = f"%{query}%"
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, slug, description, icon, alias, category,
                           allowed_roles
                    FROM   ncl_form_definitions
                    WHERE  status = 'published'
                      AND  (name ILIKE %s OR alias ILIKE %s
                            OR description ILIKE %s
                            OR %s = ANY(keywords)
                            OR %s = ANY(tags))
                    ORDER  BY name
                    LIMIT  10
                    """,
                    (like, like, like, query.lower(), query.lower()),
                )
                cols = [d[0] for d in cur.description]
                rows = [dict(r) for r in cur.fetchall()]

        # Filter by role visibility
        if user_role:
            def _role_allowed(row: dict) -> bool:
                roles = row.get("allowed_roles") or []
                return not roles or user_role in roles
            rows = [r for r in rows if _role_allowed(r)]

        return rows

    # ─────────────────────────────────────────────────────────────────────────
    # Audit logs
    # ─────────────────────────────────────────────────────────────────────────

    def list_audit_logs(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> dict:
        offset = (page - 1) * limit
        conditions: list = []
        params: list = []

        if entity_type:
            conditions.append("entity_type = %s"); params.append(entity_type)
        if entity_id:
            conditions.append("entity_id = %s"); params.append(entity_id)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*) FROM ncl_audit_logs {where}", params
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT * FROM ncl_audit_logs {where} "
                    f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    params + [limit, offset],
                )
                cols = [d[0] for d in cur.description]
                items = [_row_to_form(dict(r)) for r in cur.fetchall()]

        return {"items": items, "total": total, "page": page, "limit": limit}
