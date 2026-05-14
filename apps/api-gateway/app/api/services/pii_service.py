import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.api.config.db_config import get_db_connection

_SELECT_RULE_COLS = """
    id, rule_name, rule_version, pii_type, detection_method, pattern,
    replacement_token, severity, is_active, description,
    created_by, created_at, updated_at
"""

_SELECT_LOG_COLS = """
    id, source_type, source_table, source_id,
    user_id, conversation_id, message_id, rule_id,
    pii_type, detection_method, match_count, value_hash, value_length,
    match_positions, confidence_score, action_taken, replacement_token,
    is_false_positive, reviewed_by, reviewed_at, review_notes, created_at
"""


class PiiService:

    # ------------------------------------------------------------------ #
    # List PII rules  GET /api/admin/pii/rules                            #
    # ------------------------------------------------------------------ #
    def list_rules(
        self,
        page: int,
        limit: int,
        is_active: Optional[bool],
        pii_type: Optional[str],
        detection_method: Optional[str],
    ) -> dict:
        offset = (page - 1) * limit
        filters: list[str] = []
        params: list = []

        if is_active is not None:
            filters.append("is_active = %s")
            params.append(is_active)
        if pii_type:
            filters.append("pii_type = %s")
            params.append(pii_type)
        if detection_method:
            filters.append("detection_method = %s")
            params.append(detection_method)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_SELECT_RULE_COLS}
                    FROM pii_redaction_rules
                    {where}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    f"SELECT COUNT(*) FROM pii_redaction_rules {where}",
                    params,
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Create PII rule  POST /api/admin/pii/rules                          #
    # ------------------------------------------------------------------ #
    def create_rule(
        self,
        actor_id: str,
        rule_name: str,
        pii_type: str,
        detection_method: str,
        pattern: str,
        replacement_token: str,
        severity: str,
        description: Optional[str],
    ) -> dict:
        now = datetime.now(timezone.utc)
        rule_id = str(uuid.uuid4())
        audit_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    INSERT INTO pii_redaction_rules
                        (id, rule_name, rule_version, pii_type, detection_method, pattern,
                         replacement_token, severity, is_active, description,
                         created_by, created_at, updated_at)
                    VALUES (%s, %s, 1, %s, %s, %s, %s, %s, TRUE, %s, %s, %s, %s)
                    RETURNING {_SELECT_RULE_COLS}
                    """,
                    (
                        rule_id, rule_name, pii_type, detection_method, pattern,
                        replacement_token, severity, description,
                        actor_id, now, now,
                    ),
                )
                row = dict(cur.fetchone())

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'create', 'pii_rule', %s, 'success', %s)
                    """,
                    (audit_id, actor_id, rule_id, now),
                )
            conn.commit()

        return row

    # ------------------------------------------------------------------ #
    # Update PII rule  PATCH /api/admin/pii/rules/{id}                    #
    # ------------------------------------------------------------------ #
    def update_rule(
        self,
        rule_id: str,
        actor_id: str,
        pattern: Optional[str],
        replacement_token: Optional[str],
        severity: Optional[str],
        description: Optional[str],
        is_active: Optional[bool],
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        audit_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE pii_redaction_rules
                    SET
                        pattern           = COALESCE(%s, pattern),
                        replacement_token = COALESCE(%s, replacement_token),
                        severity          = COALESCE(%s, severity),
                        description       = COALESCE(%s, description),
                        is_active         = COALESCE(%s, is_active),
                        rule_version      = rule_version + 1,
                        updated_at        = %s
                    WHERE id = %s
                    RETURNING {_SELECT_RULE_COLS}
                    """,
                    (pattern, replacement_token, severity, description, is_active, now, rule_id),
                )
                row = cur.fetchone()
                if not row:
                    return None

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'update', 'pii_rule', %s, 'success', %s)
                    """,
                    (audit_id, actor_id, rule_id, now),
                )
            conn.commit()

        return dict(row)

    # ------------------------------------------------------------------ #
    # Test PII rule  POST /api/admin/pii/rules/test  (in-memory only)     #
    # ------------------------------------------------------------------ #
    def test_rule(
        self,
        detection_method: str,
        pattern: str,
        replacement_token: str,
        sample_text: str,
    ) -> dict:
        matches: list[dict] = []
        error: Optional[str] = None
        redacted = sample_text

        if detection_method == "regex":
            try:
                compiled = re.compile(pattern)
                for m in compiled.finditer(sample_text):
                    matches.append({"match": m.group(), "start": m.start(), "end": m.end()})
                redacted = compiled.sub(replacement_token, sample_text)
            except re.error as exc:
                error = str(exc)
        else:
            error = "NER dry-run is not supported in-process; deploy the rule to test via the agent."

        return {
            "detection_method": detection_method,
            "pattern": pattern,
            "replacement_token": replacement_token,
            "matches": matches,
            "match_count": len(matches),
            "redacted_text": redacted,
            "error": error,
        }

    # ------------------------------------------------------------------ #
    # List PII events  GET /api/admin/pii/logs                            #
    # ------------------------------------------------------------------ #
    def list_logs(
        self,
        page: int,
        limit: int,
        user_id: Optional[str],
        conversation_id: Optional[str],
        pii_type: Optional[str],
        detection_method: Optional[str],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
    ) -> dict:
        offset = (page - 1) * limit
        filters: list[str] = []
        params: list = []

        if user_id:
            filters.append("user_id = %s")
            params.append(user_id)
        if conversation_id:
            filters.append("conversation_id = %s")
            params.append(conversation_id)
        if pii_type:
            filters.append("pii_type = %s")
            params.append(pii_type)
        if detection_method:
            filters.append("detection_method = %s")
            params.append(detection_method)
        if date_from:
            filters.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            filters.append("created_at <= %s")
            params.append(date_to)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_SELECT_LOG_COLS}
                    FROM pii_redaction_logs
                    {where}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    f"SELECT COUNT(*) FROM pii_redaction_logs {where}",
                    params,
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Get PII event  GET /api/admin/pii/logs/{id}                         #
    # ------------------------------------------------------------------ #
    def get_log(self, log_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_SELECT_LOG_COLS} FROM pii_redaction_logs WHERE id = %s",
                    (log_id,),
                )
                row = cur.fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Mark false positive  PATCH /api/admin/pii/logs/{id}/review          #
    # ------------------------------------------------------------------ #
    def review_log(
        self,
        log_id: str,
        actor_id: str,
        is_false_positive: bool,
        review_notes: Optional[str],
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        audit_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE pii_redaction_logs
                    SET
                        is_false_positive = %s,
                        reviewed_by       = %s,
                        reviewed_at       = %s,
                        review_notes      = COALESCE(%s, review_notes)
                    WHERE id = %s
                    RETURNING {_SELECT_LOG_COLS}
                    """,
                    (is_false_positive, actor_id, now, review_notes, log_id),
                )
                row = cur.fetchone()
                if not row:
                    return None

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'review', 'pii_log', %s, 'success', %s)
                    """,
                    (audit_id, actor_id, log_id, now),
                )
            conn.commit()

        return dict(row)

    # ------------------------------------------------------------------ #
    # PII analytics  GET /api/admin/pii/analytics                         #
    # ------------------------------------------------------------------ #
    def get_analytics(self) -> dict:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Heatmap: total matches by pii_type
                cur.execute(
                    """
                    SELECT pii_type, SUM(match_count) AS total_matches
                    FROM pii_redaction_logs
                    GROUP BY pii_type
                    ORDER BY total_matches DESC
                    """
                )
                heatmap = [dict(r) for r in cur.fetchall()]

                # Top offending rules by hit count
                cur.execute(
                    """
                    SELECT
                        r.id, r.rule_name, r.pii_type, r.severity,
                        COUNT(l.id) AS hit_count,
                        SUM(l.match_count) AS total_matches
                    FROM pii_redaction_rules r
                    LEFT JOIN pii_redaction_logs l ON l.rule_id = r.id
                    GROUP BY r.id, r.rule_name, r.pii_type, r.severity
                    ORDER BY hit_count DESC
                    LIMIT 10
                    """
                )
                top_rules = [dict(r) for r in cur.fetchall()]

                # False-positive rate
                cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE is_false_positive = TRUE) AS fp_count,
                        COUNT(*) AS total_reviewed
                    FROM pii_redaction_logs
                    WHERE reviewed_at IS NOT NULL
                    """
                )
                fp_row = dict(cur.fetchone())
                total_reviewed = fp_row["total_reviewed"] or 0
                fp_rate = (
                    round(fp_row["fp_count"] / total_reviewed * 100, 2)
                    if total_reviewed > 0 else 0.0
                )

        return {
            "heatmap": heatmap,
            "top_rules": top_rules,
            "false_positive_rate": fp_rate,
            "total_reviewed": total_reviewed,
        }
