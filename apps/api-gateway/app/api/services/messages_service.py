import uuid
from datetime import datetime, timezone
from typing import Optional

from app.agents.supervisor_agent import run_assistant
from app.api.config.db_config import get_db_connection


class MessagesService:

    # ------------------------------------------------------------------ #
    # Send message  (POST /api/conversations/{id}/messages)               #
    # ------------------------------------------------------------------ #
    def send_message(self, conversation_id: str, user_id: str, content: str) -> dict:
        now = datetime.now(timezone.utc)
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())
        prompt_log_id = str(uuid.uuid4())
        routing_log_id = str(uuid.uuid4())

        # ── Phase 1: persist records and verify ownership ──────────────────
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM conversations WHERE id = %s AND user_id = %s AND is_deleted = FALSE",
                    (conversation_id, user_id),
                )
                if not cur.fetchone():
                    return None

                cur.execute(
                    """
                    INSERT INTO messages (id, conversation_id, role, content, status, created_at)
                    VALUES (%s, %s, 'user', %s, 'done', %s)
                    """,
                    (user_msg_id, conversation_id, content, now),
                )

                cur.execute(
                    """
                    INSERT INTO messages (id, conversation_id, role, content, status, created_at)
                    VALUES (%s, %s, 'assistant', '', 'pending', %s)
                    """,
                    (assistant_msg_id, conversation_id, now),
                )

                cur.execute(
                    "INSERT INTO agent_routing_logs (id, message_id, created_at) VALUES (%s, %s, %s)",
                    (routing_log_id, user_msg_id, now),
                )

                cur.execute(
                    "INSERT INTO prompt_logs (id, message_id, created_at) VALUES (%s, %s, %s)",
                    (prompt_log_id, user_msg_id, now),
                )

                cur.execute(
                    "UPDATE conversations SET updated_at = %s WHERE id = %s",
                    (now, conversation_id),
                )
            conn.commit()

        # ── Phase 2: call the agent (outside the DB transaction) ───────────
        try:
            answer = run_assistant(content)
            final_status = "done"
        except Exception as exc:
            print(f"Agent error for message {assistant_msg_id}: {exc}")
            answer = "Sorry, I encountered an error while processing your request. Please try again."
            final_status = "error"

        # ── Phase 3: write the real answer back ────────────────────────────
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE messages SET content = %s, status = %s
                    WHERE id = %s
                    RETURNING id, conversation_id, role, content, status, created_at
                    """,
                    (answer, final_status, assistant_msg_id),
                )
                assistant_row = dict(cur.fetchone())
            conn.commit()

        return assistant_row

    # ------------------------------------------------------------------ #
    # List messages  (GET /api/conversations/{id}/messages)               #
    # ------------------------------------------------------------------ #
    def list_messages(
        self,
        conversation_id: str,
        user_id: str,
        page: int,
        limit: int,
    ) -> Optional[dict]:
        offset = (page - 1) * limit
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM conversations WHERE id = %s AND user_id = %s AND is_deleted = FALSE",
                    (conversation_id, user_id),
                )
                if not cur.fetchone():
                    return None

                cur.execute(
                    """
                    SELECT id, conversation_id, role, content, status, created_at
                    FROM messages
                    WHERE conversation_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s OFFSET %s
                    """,
                    (conversation_id, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    "SELECT COUNT(*) FROM messages WHERE conversation_id = %s",
                    (conversation_id,),
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Get message  (GET /api/messages/{id})                               #
    # ------------------------------------------------------------------ #
    def get_message(self, message_id: str, user_id: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT m.id, m.conversation_id, m.role, m.content, m.status, m.created_at
                    FROM messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.id = %s AND c.user_id = %s AND c.is_deleted = FALSE
                    """,
                    (message_id, user_id),
                )
                row = cur.fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Regenerate response  (POST /api/messages/{id}/regenerate)           #
    # ------------------------------------------------------------------ #
    def regenerate_response(self, message_id: str, user_id: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        new_msg_id = str(uuid.uuid4())
        prompt_log_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Verify the target message is an assistant message owned by this user
                cur.execute(
                    """
                    SELECT m.id, m.conversation_id, m.role
                    FROM messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.id = %s AND m.role = 'assistant'
                      AND c.user_id = %s AND c.is_deleted = FALSE
                    """,
                    (message_id, user_id),
                )
                original = cur.fetchone()
                if not original:
                    return None

                conversation_id = original["conversation_id"]

                # Mark original as superseded
                cur.execute(
                    "UPDATE messages SET status = 'superseded' WHERE id = %s",
                    (message_id,),
                )

                # Insert fresh assistant placeholder
                cur.execute(
                    """
                    INSERT INTO messages (id, conversation_id, role, content, status, created_at)
                    VALUES (%s, %s, 'assistant', '', 'pending', %s)
                    RETURNING id, conversation_id, role, content, status, created_at
                    """,
                    (new_msg_id, conversation_id, now),
                )
                new_row = dict(cur.fetchone())

                # prompt_logs — agent layer fills the remaining columns
                cur.execute(
                    """
                    INSERT INTO prompt_logs (id, message_id, created_at)
                    VALUES (%s, %s, %s)
                    """,
                    (prompt_log_id, new_msg_id, now),
                )

            conn.commit()

        return new_row

    # ------------------------------------------------------------------ #
    # Stop generation  (POST /api/messages/{id}/stop)                     #
    # ------------------------------------------------------------------ #
    def stop_generation(self, message_id: str, user_id: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE messages m
                    SET status = 'stopped'
                    FROM conversations c
                    WHERE m.id = %s
                      AND m.conversation_id = c.id
                      AND c.user_id = %s
                      AND c.is_deleted = FALSE
                      AND m.status IN ('pending', 'streaming')
                    RETURNING m.id, m.conversation_id, m.role, m.content, m.status, m.created_at
                    """,
                    (message_id, user_id),
                )
                row = cur.fetchone()
            conn.commit()
        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Get citations  (GET /api/messages/{id}/citations)                   #
    # ------------------------------------------------------------------ #
    def get_citations(self, message_id: str, user_id: str) -> Optional[list]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Verify ownership
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
                    SELECT
                        dc.id          AS chunk_id,
                        dc.chunk_index,
                        dc.content     AS chunk_content,
                        d.id           AS document_id,
                        d.title        AS document_title,
                        d.source_url
                    FROM message_citations mc
                    JOIN document_chunks dc ON dc.id = mc.chunk_id
                    JOIN documents        d  ON d.id  = dc.document_id
                    WHERE mc.message_id = %s
                    ORDER BY mc.citation_order ASC
                    """,
                    (message_id,),
                )
                rows = [dict(r) for r in cur.fetchall()]

        return rows
