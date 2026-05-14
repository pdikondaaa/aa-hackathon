import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.api.config.db_config import get_db_connection

VALID_STATUSES = ("submitted", "in_progress", "resolved")

_FORM_SCHEMAS: dict[str, dict] = {
    "hr": {
        "type": "hr",
        "title": "HR Escalation",
        "fields": [
            {"name": "subject",     "type": "text",     "label": "Subject",     "required": True},
            {"name": "reason",      "type": "textarea", "label": "Reason",      "required": True},
            {"name": "hr_category", "type": "select",   "label": "Category",    "required": True,
             "options": ["Harassment", "Leave", "Payroll", "Performance", "Other"]},
            {"name": "priority",    "type": "select",   "label": "Priority",    "required": True,
             "options": ["low", "medium", "high"]},
        ],
    },
    "it": {
        "type": "it",
        "title": "IT Escalation",
        "fields": [
            {"name": "subject",     "type": "text",     "label": "Subject",     "required": True},
            {"name": "reason",      "type": "textarea", "label": "Reason",      "required": True},
            {"name": "it_category", "type": "select",   "label": "Category",    "required": True,
             "options": ["Access", "Hardware", "Software", "Network", "Other"]},
            {"name": "asset_id",    "type": "text",     "label": "Asset ID",    "required": False},
            {"name": "priority",    "type": "select",   "label": "Priority",    "required": True,
             "options": ["low", "medium", "high", "critical"]},
        ],
    },
    "admin": {
        "type": "admin",
        "title": "Admin Escalation",
        "fields": [
            {"name": "subject",        "type": "text",     "label": "Subject",  "required": True},
            {"name": "reason",         "type": "textarea", "label": "Reason",   "required": True},
            {"name": "admin_category", "type": "select",   "label": "Category", "required": True,
             "options": ["Policy", "Compliance", "Facilities", "Other"]},
            {"name": "priority",       "type": "select",   "label": "Priority", "required": True,
             "options": ["low", "medium", "high"]},
        ],
    },
}

_SELECT_COLS = """
    id, user_id, conversation_id, message_id, escalation_type, subject, reason,
    form_payload, priority, status, assigned_team, assigned_to,
    resolved_at, resolution_notes, created_at, updated_at
"""


class EscalationsService:

    # ------------------------------------------------------------------ #
    # Create escalation  POST /api/escalations                            #
    # ------------------------------------------------------------------ #
    def create_escalation(
        self,
        azure_oid: str,
        email: str,
        display_name: str,
        escalation_type: str,
        subject: str,
        reason: str,
        priority: str,
        form_payload: Optional[dict],
        conversation_id: Optional[str],
        message_id: Optional[str],
    ) -> dict:
        now = datetime.now(timezone.utc)
        escalation_id = str(uuid.uuid4())
        audit_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Upsert user by azure_oid → get their DB-generated UUID
                cur.execute(
                    """
                    INSERT INTO users (email, azure_oid, display_name, last_login_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (azure_oid) DO UPDATE
                        SET last_login_at = EXCLUDED.last_login_at,
                            updated_at    = EXCLUDED.updated_at
                    RETURNING id
                    """,
                    (email, azure_oid, display_name, now, now),
                )
                user_id = str(cur.fetchone()["id"])

                cur.execute(
                    f"""
                    INSERT INTO escalation_records
                        (id, user_id, conversation_id, message_id, escalation_type,
                         subject, reason, form_payload, priority, status,
                         created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'submitted', %s, %s)
                    RETURNING {_SELECT_COLS}
                    """,
                    (
                        escalation_id, user_id, conversation_id, message_id,
                        escalation_type, subject, reason,
                        json.dumps(form_payload or {}),
                        priority, now, now,
                    ),
                )
                row = dict(cur.fetchone())

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'create', 'escalation', %s, 'success', %s)
                    """,
                    (audit_id, user_id, escalation_id, now),
                )
            conn.commit()

        return row

    # ------------------------------------------------------------------ #
    # List my escalations  GET /api/escalations                           #
    # ------------------------------------------------------------------ #
    def list_my_escalations(
        self,
        user_id: str,
        page: int,
        limit: int,
        status: Optional[str],
    ) -> dict:
        offset = (page - 1) * limit
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if status:
                    cur.execute(
                        f"""
                        SELECT {_SELECT_COLS}
                        FROM escalation_records
                        WHERE user_id = %s AND status = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        (user_id, status, limit, offset),
                    )
                else:
                    cur.execute(
                        f"""
                        SELECT {_SELECT_COLS}
                        FROM escalation_records
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        (user_id, limit, offset),
                    )
                rows = [dict(r) for r in cur.fetchall()]

                if status:
                    cur.execute(
                        "SELECT COUNT(*) FROM escalation_records WHERE user_id = %s AND status = %s",
                        (user_id, status),
                    )
                else:
                    cur.execute(
                        "SELECT COUNT(*) FROM escalation_records WHERE user_id = %s",
                        (user_id,),
                    )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Get escalation  GET /api/escalations/{id}                           #
    # ------------------------------------------------------------------ #
    def get_escalation(self, escalation_id: str, user_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_SELECT_COLS}
                    FROM escalation_records
                    WHERE id = %s AND user_id = %s
                    """,
                    (escalation_id, user_id),
                )
                row = cur.fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Update escalation status  PATCH /api/escalations/{id}              #
    # ------------------------------------------------------------------ #
    def update_status(
        self,
        escalation_id: str,
        actor_id: str,
        new_status: str,
        assigned_team: Optional[str],
        assigned_to: Optional[str],
        resolution_notes: Optional[str],
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        audit_id = str(uuid.uuid4())
        resolved_at = now if new_status == "resolved" else None

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE escalation_records
                    SET
                        status           = %s,
                        assigned_team    = COALESCE(%s, assigned_team),
                        assigned_to      = COALESCE(%s, assigned_to),
                        resolved_at      = COALESCE(%s, resolved_at),
                        resolution_notes = COALESCE(%s, resolution_notes),
                        updated_at       = %s
                    WHERE id = %s
                    RETURNING {_SELECT_COLS}
                    """,
                    (
                        new_status, assigned_team, assigned_to,
                        resolved_at, resolution_notes, now,
                        escalation_id,
                    ),
                )
                row = cur.fetchone()
                if not row:
                    return None

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'update_status', 'escalation', %s, 'success', %s)
                    """,
                    (audit_id, actor_id, escalation_id, now),
                )
            conn.commit()

        return dict(row)

    # ------------------------------------------------------------------ #
    # List all escalations (admin)  GET /api/admin/escalations            #
    # ------------------------------------------------------------------ #
    def list_all_escalations(
        self,
        page: int,
        limit: int,
        escalation_type: Optional[str],
        status: Optional[str],
    ) -> dict:
        offset = (page - 1) * limit
        filters: list[str] = []
        params: list = []

        if escalation_type:
            filters.append("escalation_type = %s")
            params.append(escalation_type)
        if status:
            filters.append("status = %s")
            params.append(status)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_SELECT_COLS}
                    FROM escalation_records
                    {where}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    f"SELECT COUNT(*) FROM escalation_records {where}",
                    params,
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Get escalation form schema  GET /api/escalations/forms/{type}       #
    # ------------------------------------------------------------------ #
    def get_form_schema(self, form_type: str) -> Optional[dict[str, Any]]:
        return _FORM_SCHEMAS.get(form_type.lower())
