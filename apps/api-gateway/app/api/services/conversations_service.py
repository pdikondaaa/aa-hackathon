import uuid
from datetime import datetime, timezone
from typing import Optional

from app.api.config.db_config import get_db_connection


class ConversationsService:

    def list_conversations(
        self,
        user_id: str,
        page: int,
        limit: int,
        search: Optional[str],
    ) -> dict:
        offset = (page - 1) * limit
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if search:
                    cur.execute(
                        """
                        SELECT id, title, created_at, updated_at
                        FROM conversations
                        WHERE user_id = %s AND is_deleted = FALSE AND title ILIKE %s
                        ORDER BY updated_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        (user_id, f"%{search}%", limit, offset),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, title, created_at, updated_at
                        FROM conversations
                        WHERE user_id = %s AND is_deleted = FALSE
                        ORDER BY updated_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        (user_id, limit, offset),
                    )
                rows = cur.fetchall()

                cur.execute(
                    "SELECT COUNT(*) FROM conversations WHERE user_id = %s AND is_deleted = FALSE",
                    (user_id,),
                )
                total = cur.fetchone()["count"]

        return {"data": [dict(r) for r in rows], "total": total, "page": page, "limit": limit}

    def create_conversation(self, user_id: str, title: Optional[str] = None) -> dict:
        conversation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        title = title or "New Conversation"
        print(f"inserting in db : {user_id}, {title}")
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO conversations (id, user_id, title, created_at, updated_at, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, FALSE)
                    RETURNING id, title, created_at, updated_at
                    """,
                    (conversation_id, user_id, title, now, now),
                )
                row = dict(cur.fetchone())

                cur.execute(
                    """
                    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'create', 'conversation', %s, 'success', %s)
                    """,
                    (str(uuid.uuid4()), user_id, conversation_id, now),
                )
            conn.commit()

        return row

    def get_conversation(self, conversation_id: str, user_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, created_at, updated_at
                    FROM conversations
                    WHERE id = %s AND user_id = %s AND is_deleted = FALSE
                    """,
                    (conversation_id, user_id),
                )
                row = cur.fetchone()
        return dict(row) if row else None

    def rename_conversation(self, conversation_id: str, title: str, user_id: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET title = %s, updated_at = %s
                    WHERE id = %s AND user_id = %s AND is_deleted = FALSE
                    RETURNING id, title, created_at, updated_at
                    """,
                    (title, now, conversation_id, user_id),
                )
                row = cur.fetchone()
            conn.commit()
        return dict(row) if row else None

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET is_deleted = TRUE, updated_at = %s
                    WHERE id = %s AND user_id = %s AND is_deleted = FALSE
                    """,
                    (now, conversation_id, user_id),
                )
                deleted = cur.rowcount > 0

                if deleted:
                    cur.execute(
                        """
                        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, status, created_at)
                        VALUES (%s, %s, 'delete', 'conversation', %s, 'success', %s)
                        """,
                        (str(uuid.uuid4()), user_id, conversation_id, now),
                    )
            conn.commit()
        return deleted
