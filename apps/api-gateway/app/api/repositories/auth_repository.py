"""Auth repository — all raw DB queries for the auth domain.

Schema reference:
  users        : id, email, azure_oid, display_name, role, is_active, last_login_at, created_at, updated_at
  user_sessions: id, user_id, session_id, ip_address, user_agent, login_time, last_activity, is_active
  audit_logs   : id, user_id, action, entity_type, entity_id, ip_address, user_agent, status, metadata, created_at
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional


class AuthRepository:

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def find_user_by_oid(self, cur, azure_oid: str) -> Optional[dict]:
        cur.execute(
            """
            SELECT id, email, azure_oid, display_name, role, is_active,
                   last_login_at, created_at, updated_at
            FROM users WHERE azure_oid = %s
            """,
            (azure_oid,),
        )
        return cur.fetchone()

    def create_user(self, cur, *, azure_oid: str, email: str, display_name: str) -> dict:
        now = datetime.now(timezone.utc)
        cur.execute(
            """
            INSERT INTO users
                (id, email, azure_oid, display_name, role, is_active,
                 last_login_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'user', TRUE, %s, %s, %s)
            RETURNING id, email, azure_oid, display_name, role, is_active,
                      last_login_at, created_at, updated_at
            """,
            (str(uuid.uuid4()), email, azure_oid, display_name, now, now, now),
        )
        return cur.fetchone()

    def update_user_profile(
        self, cur, *, azure_oid: str, email: str, display_name: str
    ) -> dict:
        now = datetime.now(timezone.utc)
        cur.execute(
            """
            UPDATE users
            SET email = %s, display_name = %s, last_login_at = %s, updated_at = %s
            WHERE azure_oid = %s
            RETURNING id, email, azure_oid, display_name, role, is_active,
                      last_login_at, created_at, updated_at
            """,
            (email, display_name, now, now, azure_oid),
        )
        return cur.fetchone()

    def get_user_by_id(self, cur, user_id: str) -> Optional[dict]:
        cur.execute(
            """
            SELECT id, email, azure_oid, display_name, role, is_active,
                   last_login_at, created_at, updated_at
            FROM users WHERE id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    def create_session(
        self,
        cur,
        *,
        user_id: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> dict:
        now = datetime.now(timezone.utc)
        session_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO user_sessions
                (id, user_id, session_id, ip_address, user_agent,
                 login_time, last_activity, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id, user_id, session_id, ip_address, user_agent,
                      login_time, last_activity, is_active
            """,
            (str(uuid.uuid4()), user_id, session_id,
             ip_address, user_agent, now, now),
        )
        return cur.fetchone()

    def get_session(self, cur, *, session_id: str, user_id: str) -> Optional[dict]:
        cur.execute(
            """
            SELECT id, session_id, last_activity
            FROM user_sessions
            WHERE session_id = %s AND user_id = %s AND is_active = TRUE
            """,
            (session_id, user_id),
        )
        return cur.fetchone()

    def list_active_sessions(self, cur, user_id: str) -> list:
        cur.execute(
            """
            SELECT id, session_id, ip_address, user_agent,
                   login_time, last_activity, is_active
            FROM user_sessions
            WHERE user_id = %s AND is_active = TRUE
            ORDER BY last_activity DESC
            """,
            (user_id,),
        )
        return cur.fetchall()

    def deactivate_session(self, cur, *, session_id: str, user_id: str) -> bool:
        now = datetime.now(timezone.utc)
        cur.execute(
            """
            UPDATE user_sessions
            SET is_active = FALSE, last_activity = %s
            WHERE session_id = %s AND user_id = %s AND is_active = TRUE
            """,
            (now, session_id, user_id),
        )
        return cur.rowcount > 0

    def update_last_activity(self, cur, *, session_id: str, user_id: str) -> bool:
        now = datetime.now(timezone.utc)
        cur.execute(
            """
            UPDATE user_sessions SET last_activity = %s
            WHERE session_id = %s AND user_id = %s AND is_active = TRUE
            """,
            (now, session_id, user_id),
        )
        return cur.rowcount > 0

    # ------------------------------------------------------------------
    # Audit log
    # ------------------------------------------------------------------

    def write_audit_log(
        self,
        cur,
        *,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        status: str = "success",
        metadata: Optional[dict] = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        cur.execute(
            """
            INSERT INTO audit_logs
                (id, user_id, action, entity_type, entity_id,
                 ip_address, user_agent, status, metadata, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()), user_id, action, entity_type, entity_id,
                ip_address, user_agent, status,
                json.dumps(metadata) if metadata else None,
                now,
            ),
        )
