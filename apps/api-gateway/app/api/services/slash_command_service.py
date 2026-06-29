import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from psycopg2.extras import RealDictCursor

from app.api.config.db_config import get_db_connection
from app.api.models.form_builder_model import SlashCommandCreate, SlashCommandUpdate


def _now():
    return datetime.now(timezone.utc)


def _row_to_cmd(row: dict) -> dict:
    if row is None:
        return None
    r = dict(row)
    for field in ("created_at", "updated_at"):
        if isinstance(r.get(field), datetime):
            r[field] = r[field].isoformat()
    return r


class SlashCommandService:

    def list_slash_commands(self, active_only: bool = False) -> dict:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where = "WHERE sc.is_active = TRUE" if active_only else ""
                cur.execute(
                    f"""
                    SELECT
                        sc.*,
                        fd.name  AS form_name,
                        fd.slug  AS form_slug
                    FROM ncl_slash_commands sc
                    LEFT JOIN ncl_form_definitions fd ON fd.id = sc.form_id
                    {where}
                    ORDER BY sc.order_index ASC, sc.created_at ASC
                    """
                )
                rows = [_row_to_cmd(r) for r in cur.fetchall()]
                return {"items": rows, "total": len(rows)}
        finally:
            conn.close()

    def get_slash_command(self, cmd_id: str) -> Optional[dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT sc.*, fd.name AS form_name, fd.slug AS form_slug
                    FROM ncl_slash_commands sc
                    LEFT JOIN ncl_form_definitions fd ON fd.id = sc.form_id
                    WHERE sc.id = %s
                    """,
                    (cmd_id,),
                )
                return _row_to_cmd(cur.fetchone())
        finally:
            conn.close()

    def create_slash_command(self, body: SlashCommandCreate, user_id: str, email: str) -> dict:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check for duplicate command keyword
                cur.execute(
                    "SELECT id FROM ncl_slash_commands WHERE command = %s",
                    (body.command,),
                )
                if cur.fetchone():
                    raise ValueError(f"A slash command '/{body.command}' already exists")

                new_id = str(uuid.uuid4())
                now = _now()
                cur.execute(
                    """
                    INSERT INTO ncl_slash_commands
                        (id, command, label, description, type, form_id, url, action, icon,
                         is_active, order_index, created_by_user_id, created_by_email,
                         created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING *
                    """,
                    (
                        new_id, body.command, body.label, body.description,
                        body.type,
                        body.form_id or None,
                        body.url or None,
                        body.action or None,
                        body.icon, body.is_active, body.order_index,
                        user_id, email, now, now,
                    ),
                )
                row = _row_to_cmd(cur.fetchone())
                conn.commit()

                # Attach form name/slug if form type
                if body.form_id:
                    cur.execute(
                        "SELECT name, slug FROM ncl_form_definitions WHERE id = %s",
                        (body.form_id,),
                    )
                    fd = cur.fetchone()
                    if fd:
                        row["form_name"] = fd["name"]
                        row["form_slug"] = fd["slug"]

                return row
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def update_slash_command(self, cmd_id: str, body: SlashCommandUpdate,
                             user_id: str, email: str) -> Optional[dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id FROM ncl_slash_commands WHERE id = %s", (cmd_id,)
                )
                if not cur.fetchone():
                    return None

                updates = {}
                for field in ("label", "description", "type", "form_id", "url",
                              "action", "icon", "is_active", "order_index"):
                    val = getattr(body, field, None)
                    if val is not None:
                        updates[field] = val

                if not updates:
                    return self.get_slash_command(cmd_id)

                updates["updated_at"] = _now()
                set_clause = ", ".join(f"{k} = %s" for k in updates)
                values = list(updates.values()) + [cmd_id]

                cur.execute(
                    f"UPDATE ncl_slash_commands SET {set_clause} WHERE id = %s RETURNING *",
                    values,
                )
                row = _row_to_cmd(cur.fetchone())
                conn.commit()

                # Attach form info
                if row and row.get("form_id"):
                    cur.execute(
                        "SELECT name, slug FROM ncl_form_definitions WHERE id = %s",
                        (row["form_id"],),
                    )
                    fd = cur.fetchone()
                    if fd:
                        row["form_name"] = fd["name"]
                        row["form_slug"] = fd["slug"]

                return row
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def delete_slash_command(self, cmd_id: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ncl_slash_commands WHERE id = %s RETURNING id",
                    (cmd_id,),
                )
                deleted = cur.fetchone() is not None
                conn.commit()
                return deleted
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def search_slash_commands(self, query: str) -> list:
        """
        Full-text search over active slash commands.
        Returns up to 10 results matching the command keyword, label, or description.
        """
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                q = f"%{query.lower()}%"
                cur.execute(
                    """
                    SELECT sc.*, fd.name AS form_name, fd.slug AS form_slug
                    FROM ncl_slash_commands sc
                    LEFT JOIN ncl_form_definitions fd ON fd.id = sc.form_id
                    WHERE sc.is_active = TRUE
                      AND (
                          LOWER(sc.command)     LIKE %s OR
                          LOWER(sc.label)       LIKE %s OR
                          LOWER(sc.description) LIKE %s
                      )
                    ORDER BY sc.order_index ASC, sc.label ASC
                    LIMIT 10
                    """,
                    (q, q, q),
                )
                return [_row_to_cmd(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def list_all_submissions(self, page: int = 1, limit: int = 20,
                             form_id: str = None, status: str = None,
                             search: str = None) -> dict:
        """Cross-form submission list for admin view."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                conditions = []
                params = []

                if form_id:
                    conditions.append("s.form_id = %s")
                    params.append(form_id)
                if status:
                    conditions.append("s.status = %s")
                    params.append(status)
                if search:
                    conditions.append(
                        "(LOWER(s.submitted_by_email) LIKE %s OR LOWER(f.name) LIKE %s)"
                    )
                    like = f"%{search.lower()}%"
                    params.extend([like, like])

                where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
                offset = (page - 1) * limit

                cur.execute(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM ncl_form_submissions s
                    JOIN ncl_form_definitions f ON f.id = s.form_id
                    {where}
                    """,
                    params,
                )
                total = cur.fetchone()["total"]

                cur.execute(
                    f"""
                    SELECT
                        s.id, s.form_id, f.name AS form_name, f.slug AS form_slug,
                        s.form_version, s.submitted_by_user_id, s.submitted_by_email,
                        s.submitted_by_name, s.status, s.data, s.metadata,
                        s.reviewed_by_email, s.reviewed_at, s.review_notes,
                        s.created_at, s.updated_at
                    FROM ncl_form_submissions s
                    JOIN ncl_form_definitions f ON f.id = s.form_id
                    {where}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    params + [limit, offset],
                )
                items = []
                for row in cur.fetchall():
                    r = dict(row)
                    for field in ("data", "metadata"):
                        if isinstance(r.get(field), str):
                            try:
                                r[field] = json.loads(r[field])
                            except Exception:
                                pass
                    for field in ("created_at", "updated_at", "reviewed_at"):
                        if isinstance(r.get(field), datetime):
                            r[field] = r[field].isoformat()
                    items.append(r)

                return {"items": items, "total": total, "page": page, "limit": limit}
        finally:
            conn.close()
