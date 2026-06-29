import uuid
from datetime import datetime, timezone
from typing import Optional

from app.api.config.db_config import get_db_connection


def _keyword_score(query: str, text: str) -> int:
    """Count overlapping meaningful words between query and text."""
    stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'my', 'i', 'what', 'how', 'can', 'me', 'for', 'of', 'in'}
    q_words = {w for w in query.lower().split() if len(w) > 2 and w not in stopwords}
    t_words = {w for w in text.lower().split() if len(w) > 2 and w not in stopwords}
    return len(q_words & t_words)


class FeedbackService:

    # ------------------------------------------------------------------ #
    # Submit / upsert feedback  POST /api/messages/{id}/feedback          #
    # Safe to call even if a record already exists (changes the rating).  #
    # ------------------------------------------------------------------ #
    def submit_feedback(
        self,
        message_id: str,
        user_id: str,
        rating: str,
        category: Optional[str],
        comment: Optional[str],
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        feedback_id = str(uuid.uuid4())
        audit_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Verify the message exists and belongs to this user
                cur.execute(
                    """
                    SELECT m.id
                    FROM messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.id = %s AND c.user_id = %s AND c.is_deleted = FALSE
                    """,
                    (message_id, user_id),
                )
                if not cur.fetchone():
                    return None

                cur.execute(
                    """
                    INSERT INTO feedback
                        (id, message_id, user_id, rating, category, comment, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (message_id, user_id)
                    DO UPDATE SET
                        rating   = EXCLUDED.rating,
                        category = COALESCE(EXCLUDED.category, feedback.category),
                        comment  = COALESCE(EXCLUDED.comment, feedback.comment)
                    RETURNING id, message_id, user_id, rating, category, comment, created_at
                    """,
                    (feedback_id, message_id, user_id, rating, category, comment, now),
                )
                row = dict(cur.fetchone())

                cur.execute(
                    """
                    INSERT INTO audit_logs
                        (id, user_id, action, entity_type, entity_id, status, created_at)
                    VALUES (%s, %s, 'create', 'feedback', %s, 'success', %s)
                    """,
                    (audit_id, user_id, row["id"], now),
                )
            conn.commit()

        return row

    # ------------------------------------------------------------------ #
    # Update feedback  PATCH /api/feedback/{id}                           #
    # ------------------------------------------------------------------ #
    def update_feedback(
        self,
        feedback_id: str,
        user_id: str,
        rating: Optional[str],
        category: Optional[str],
        comment: Optional[str],
    ) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE feedback
                    SET
                        rating   = COALESCE(%s, rating),
                        category = COALESCE(%s, category),
                        comment  = COALESCE(%s, comment)
                    WHERE id = %s AND user_id = %s
                    RETURNING id, message_id, user_id, rating, category, comment, created_at
                    """,
                    (rating, category, comment, feedback_id, user_id),
                )
                row = cur.fetchone()
            conn.commit()

        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Delete feedback  DELETE /api/feedback/{id}                          #
    # ------------------------------------------------------------------ #
    def delete_feedback(self, feedback_id: str, user_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM feedback WHERE id = %s AND user_id = %s RETURNING id",
                    (feedback_id, user_id),
                )
                deleted = cur.fetchone() is not None
            conn.commit()
        return deleted

    # ------------------------------------------------------------------ #
    # Get feedback for a conversation  GET /api/conversations/{id}/feedback
    # Returns a map of message_id → {id, rating} for the given user.    #
    # ------------------------------------------------------------------ #
    def get_conversation_feedback(self, conversation_id: str, user_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Verify the conversation belongs to this user
                cur.execute(
                    "SELECT id FROM conversations WHERE id = %s AND user_id = %s AND is_deleted = FALSE",
                    (conversation_id, user_id),
                )
                if not cur.fetchone():
                    return None

                cur.execute(
                    """
                    SELECT f.id, f.message_id, f.rating, f.category, f.comment, f.created_at
                    FROM feedback f
                    JOIN messages m ON m.id = f.message_id
                    WHERE m.conversation_id = %s AND f.user_id = %s
                    """,
                    (conversation_id, user_id),
                )
                rows = [dict(r) for r in cur.fetchall()]

        return {r["message_id"]: r for r in rows}

    # ------------------------------------------------------------------ #
    # List feedback (admin)  GET /api/admin/feedback                      #
    # ------------------------------------------------------------------ #
    def list_feedback(
        self,
        page: int,
        limit: int,
        rating: Optional[str],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
    ) -> dict:
        offset = (page - 1) * limit
        filters = []
        params: list = []

        if rating:
            filters.append("f.rating = %s")
            params.append(rating)
        if date_from:
            filters.append("f.created_at >= %s")
            params.append(date_from)
        if date_to:
            filters.append("f.created_at <= %s")
            params.append(date_to)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT
                        f.id, f.message_id, f.user_id, f.rating, f.category, f.comment,
                        f.created_at,
                        m.role    AS message_role,
                        m.content AS message_content
                    FROM feedback f
                    JOIN messages m ON m.id = f.message_id
                    {where}
                    ORDER BY f.created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    f"SELECT COUNT(*) FROM feedback f {where}",
                    params,
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Real-time correction retrieval                                       #
    # Fetches negative-feedback Q&A pairs relevant to the current query.  #
    # Used by the supervisor to inject corrections into the LLM context.  #
    # ------------------------------------------------------------------ #
    def get_corrections_for_query(self, query: str, limit: int = 3) -> list:
        """
        Return up to `limit` past negative-feedback correction pairs that are
        relevant to `query`, ranked by keyword overlap.

        Each item: {user_question, bad_answer, correction}
        """
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        f.comment          AS correction,
                        m.content          AS bad_answer,
                        m.conversation_id  AS conv_id,
                        m.id               AS msg_id
                    FROM feedback f
                    JOIN messages m ON m.id = f.message_id
                    WHERE f.rating = 'down'
                      AND f.comment IS NOT NULL
                      AND f.comment <> ''
                      AND m.role = 'assistant'
                    ORDER BY f.created_at DESC
                    LIMIT 100
                    """,
                )
                rows = [dict(r) for r in cur.fetchall()]

                # For each bad assistant message, fetch the preceding user message
                result = []
                for row in rows:
                    cur.execute(
                        """
                        SELECT content FROM messages
                        WHERE conversation_id = %s
                          AND role = 'user'
                          AND id < %s
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        (row["conv_id"], row["msg_id"]),
                    )
                    prev = cur.fetchone()
                    row["user_question"] = prev["content"] if prev else ""
                    result.append(row)

        # Rank by keyword overlap against the current query
        scored = [
            (_keyword_score(query, row["user_question"]), row)
            for row in result
            if row["user_question"]
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

        # Only return results with at least one overlapping keyword
        return [row for score, row in scored if score > 0][:limit]
