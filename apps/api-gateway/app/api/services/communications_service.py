import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.api.config.db_config import get_db_connection

# Column lists — used in SELECT / RETURNING clauses
_ANN_COLS = (
    "id, title, message, rich_content, banner_image_url, priority, display_mode, "
    "status, audience_roles, cta_label, cta_url, cta_type, auto_hide_seconds, "
    "allow_dismiss, scheduled_start, scheduled_end, published_at, "
    "created_by_email, created_at, updated_at"
)

_EVENT_COLS = (
    "id, title, description, cover_image_url, event_type, status, publish_status, "
    "starts_at, ends_at, timezone, location, virtual_link, is_virtual, "
    "rsvp_enabled, rsvp_deadline, max_attendees, reminder_minutes, audience_roles, "
    "created_by_email, created_at, updated_at"
)


def _row(r) -> dict:
    return dict(r) if r else None


class CommunicationsService:

    # ══════════════════════════════════════════════════════════════════════════
    # ANNOUNCEMENTS
    # ══════════════════════════════════════════════════════════════════════════

    def create_announcement(self, data: dict, creator_email: str) -> dict:
        ann_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        published_at = now if data.get("status") == "published" else None

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    INSERT INTO org_announcements (
                        id, title, message, rich_content, banner_image_url,
                        priority, display_mode, status, audience_roles,
                        cta_label, cta_url, cta_type, auto_hide_seconds,
                        allow_dismiss, scheduled_start, scheduled_end,
                        published_at, created_by_email, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    ) RETURNING {_ANN_COLS}
                    """,
                    (
                        ann_id, data["title"], data["message"],
                        data.get("rich_content"), data.get("banner_image_url"),
                        data.get("priority", "medium"), data.get("display_mode", "banner"),
                        data.get("status", "draft"), data.get("audience_roles"),
                        data.get("cta_label"), data.get("cta_url"),
                        data.get("cta_type", "link"), data.get("auto_hide_seconds"),
                        data.get("allow_dismiss", True),
                        data.get("scheduled_start"), data.get("scheduled_end"),
                        published_at, creator_email, now, now,
                    ),
                )
                row = _row(cur.fetchone())
            conn.commit()
        row["is_dismissed"] = False
        return row

    def list_announcements(
        self,
        page: int,
        limit: int,
        status: Optional[str],
        user_email: Optional[str] = None,
    ) -> dict:
        offset = (page - 1) * limit
        filters, params = [], []
        if status:
            filters.append("status = %s")
            params.append(status)
        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_ANN_COLS}
                    FROM org_announcements
                    {where}
                    ORDER BY
                        CASE priority
                            WHEN 'critical' THEN 1
                            WHEN 'high'     THEN 2
                            WHEN 'medium'   THEN 3
                            ELSE 4
                        END,
                        created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [_row(r) for r in cur.fetchall()]

                cur.execute(f"SELECT COUNT(*) FROM org_announcements {where}", params)
                total = cur.fetchone()["count"]

                self._inject_dismissed(cur, rows, user_email)

        return {"data": rows, "total": total, "page": page, "limit": limit}

    def get_active_announcements(self, user_email: str) -> List[dict]:
        """Return published announcements within their scheduling window."""
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_ANN_COLS}
                    FROM org_announcements
                    WHERE status = 'published'
                      AND (scheduled_start IS NULL OR scheduled_start <= %s)
                      AND (scheduled_end   IS NULL OR scheduled_end   >= %s)
                    ORDER BY
                        CASE priority
                            WHEN 'critical' THEN 1
                            WHEN 'high'     THEN 2
                            WHEN 'medium'   THEN 3
                            ELSE 4
                        END,
                        created_at DESC
                    """,
                    (now, now),
                )
                rows = [_row(r) for r in cur.fetchall()]
                self._inject_dismissed(cur, rows, user_email)
        return rows

    def get_announcement(self, ann_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_ANN_COLS} FROM org_announcements WHERE id = %s",
                    (ann_id,),
                )
                r = cur.fetchone()
        if not r:
            return None
        row = _row(r)
        row["is_dismissed"] = False
        return row

    def update_announcement(self, ann_id: str, data: dict) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        field_map = {
            "title": "title", "message": "message", "rich_content": "rich_content",
            "banner_image_url": "banner_image_url", "priority": "priority",
            "display_mode": "display_mode", "status": "status",
            "audience_roles": "audience_roles", "cta_label": "cta_label",
            "cta_url": "cta_url", "cta_type": "cta_type",
            "auto_hide_seconds": "auto_hide_seconds", "allow_dismiss": "allow_dismiss",
            "scheduled_start": "scheduled_start", "scheduled_end": "scheduled_end",
        }
        fields, params = [], []
        for key, col in field_map.items():
            if key in data:
                fields.append(f"{col} = %s")
                params.append(data[key])

        if not fields:
            return self.get_announcement(ann_id)

        if data.get("status") == "published":
            fields.append("published_at = COALESCE(published_at, %s)")
            params.append(now)

        fields.append("updated_at = %s")
        params.append(now)
        params.append(ann_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE org_announcements
                    SET {', '.join(fields)}
                    WHERE id = %s
                    RETURNING {_ANN_COLS}
                    """,
                    params,
                )
                r = cur.fetchone()
            conn.commit()
        if not r:
            return None
        row = _row(r)
        row["is_dismissed"] = False
        return row

    def delete_announcement(self, ann_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM org_announcements WHERE id = %s RETURNING id",
                    (ann_id,),
                )
                deleted = cur.fetchone() is not None
            conn.commit()
        return deleted

    def dismiss_announcement(self, ann_id: str, user_email: str) -> None:
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO org_announcement_dismissals
                        (id, announcement_id, user_email, dismissed_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (announcement_id, user_email) DO NOTHING
                    """,
                    (str(uuid.uuid4()), ann_id, user_email, now),
                )
            conn.commit()

    # ══════════════════════════════════════════════════════════════════════════
    # EVENTS
    # ══════════════════════════════════════════════════════════════════════════

    def create_event(self, data: dict, creator_email: str) -> dict:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    INSERT INTO org_events (
                        id, title, description, cover_image_url, event_type,
                        status, publish_status, starts_at, ends_at, timezone,
                        location, virtual_link, is_virtual, rsvp_enabled,
                        rsvp_deadline, max_attendees, reminder_minutes,
                        audience_roles, created_by_email, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    ) RETURNING {_EVENT_COLS}
                    """,
                    (
                        event_id, data["title"], data.get("description"),
                        data.get("cover_image_url"), data.get("event_type", "general"),
                        data.get("status", "upcoming"), data.get("publish_status", "draft"),
                        data["starts_at"], data.get("ends_at"),
                        data.get("timezone", "Asia/Kolkata"),
                        data.get("location"), data.get("virtual_link"),
                        data.get("is_virtual", False), data.get("rsvp_enabled", False),
                        data.get("rsvp_deadline"), data.get("max_attendees"),
                        data.get("reminder_minutes"),
                        data.get("audience_roles"), creator_email, now, now,
                    ),
                )
                row = _row(cur.fetchone())
            conn.commit()
        row["rsvp_count"] = 0
        row["user_rsvp_status"] = None
        return row

    def list_events(
        self,
        page: int,
        limit: int,
        status: Optional[str],
        publish_status: Optional[str],
        user_email: Optional[str] = None,
    ) -> dict:
        offset = (page - 1) * limit
        filters, params = [], []
        if status:
            filters.append("status = %s")
            params.append(status)
        if publish_status:
            filters.append("publish_status = %s")
            params.append(publish_status)
        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT {_EVENT_COLS}
                    FROM org_events
                    {where}
                    ORDER BY starts_at ASC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [_row(r) for r in cur.fetchall()]

                cur.execute(f"SELECT COUNT(*) FROM org_events {where}", params)
                total = cur.fetchone()["count"]

                self._inject_rsvp_data(cur, rows, user_email)

        return {"data": rows, "total": total, "page": page, "limit": limit}

    def get_event(self, event_id: str, user_email: Optional[str] = None) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_EVENT_COLS} FROM org_events WHERE id = %s",
                    (event_id,),
                )
                r = cur.fetchone()
                if not r:
                    return None
                row = _row(r)
                self._inject_rsvp_data(cur, [row], user_email)
        return row

    def update_event(self, event_id: str, data: dict) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        field_map = {
            "title": "title", "description": "description",
            "cover_image_url": "cover_image_url", "event_type": "event_type",
            "status": "status", "publish_status": "publish_status",
            "starts_at": "starts_at", "ends_at": "ends_at",
            "timezone": "timezone", "location": "location",
            "virtual_link": "virtual_link", "is_virtual": "is_virtual",
            "rsvp_enabled": "rsvp_enabled", "rsvp_deadline": "rsvp_deadline",
            "max_attendees": "max_attendees", "reminder_minutes": "reminder_minutes",
            "audience_roles": "audience_roles",
        }
        fields, params = [], []
        for key, col in field_map.items():
            if key in data:
                fields.append(f"{col} = %s")
                params.append(data[key])

        if not fields:
            return self.get_event(event_id)

        fields.append("updated_at = %s")
        params.append(now)
        params.append(event_id)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE org_events
                    SET {', '.join(fields)}
                    WHERE id = %s
                    RETURNING {_EVENT_COLS}
                    """,
                    params,
                )
                r = cur.fetchone()
                if not r:
                    conn.commit()
                    return None
                row = _row(r)
                self._inject_rsvp_data(cur, [row], None)
            conn.commit()
        return row

    def delete_event(self, event_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM org_events WHERE id = %s RETURNING id",
                    (event_id,),
                )
                deleted = cur.fetchone() is not None
            conn.commit()
        return deleted

    def submit_rsvp(
        self, event_id: str, user_email: str, user_name: str, rsvp_status: str
    ) -> dict:
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO org_event_rsvps
                        (id, event_id, user_email, user_name, rsvp_status, responded_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (event_id, user_email) DO UPDATE
                        SET rsvp_status  = EXCLUDED.rsvp_status,
                            responded_at = EXCLUDED.responded_at
                    RETURNING id, event_id, user_email, user_name, rsvp_status, responded_at
                    """,
                    (str(uuid.uuid4()), event_id, user_email, user_name, rsvp_status, now),
                )
                row = _row(cur.fetchone())
            conn.commit()
        return row

    # ── Private helpers ───────────────────────────────────────────────────── #

    @staticmethod
    def _inject_dismissed(cur, rows: List[dict], user_email: Optional[str]) -> None:
        """Attach is_dismissed flag to each announcement row in-place."""
        for r in rows:
            r["is_dismissed"] = False
        if not user_email or not rows:
            return
        ann_ids = [str(r["id"]) for r in rows]
        placeholders = ", ".join(["%s"] * len(ann_ids))
        cur.execute(
            f"""
            SELECT announcement_id
            FROM org_announcement_dismissals
            WHERE user_email = %s AND announcement_id IN ({placeholders})
            """,
            (user_email, *ann_ids),
        )
        dismissed = {str(r["announcement_id"]) for r in cur.fetchall()}
        for r in rows:
            r["is_dismissed"] = str(r["id"]) in dismissed

    @staticmethod
    def _inject_rsvp_data(
        cur, rows: List[dict], user_email: Optional[str]
    ) -> None:
        """Attach rsvp_count and user_rsvp_status to each event row in-place."""
        for r in rows:
            r["rsvp_count"] = 0
            r["user_rsvp_status"] = None
        if not rows:
            return
        event_ids = [str(r["id"]) for r in rows]
        placeholders = ", ".join(["%s"] * len(event_ids))

        cur.execute(
            f"""
            SELECT event_id, COUNT(*) AS cnt
            FROM org_event_rsvps
            WHERE event_id IN ({placeholders}) AND rsvp_status = 'attending'
            GROUP BY event_id
            """,
            event_ids,
        )
        counts = {str(r["event_id"]): r["cnt"] for r in cur.fetchall()}

        user_rsvps = {}
        if user_email:
            cur.execute(
                f"""
                SELECT event_id, rsvp_status
                FROM org_event_rsvps
                WHERE user_email = %s AND event_id IN ({placeholders})
                """,
                (user_email, *event_ids),
            )
            user_rsvps = {str(r["event_id"]): r["rsvp_status"] for r in cur.fetchall()}

        for r in rows:
            r["rsvp_count"] = counts.get(str(r["id"]), 0)
            r["user_rsvp_status"] = user_rsvps.get(str(r["id"]))
