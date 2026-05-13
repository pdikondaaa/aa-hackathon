"""Auth service — business logic for all auth operations.

user_id is always derived from JWT claims, never from request body/params.
SSO callback runs find-or-create + create session + audit in ONE transaction.
"""

from typing import Any, Optional

from app.api.auth.jwt_handler import _EXPIRY_SECONDS, issue_token
from app.api.auth.jwt_validator import validate_id_token as validate_azure_token
from app.api.config.db_config import get_db_connection
from app.api.repositories.auth_repository import AuthRepository

_repo = AuthRepository()


def _extract_azure_claims(claims: dict) -> tuple[str, str, str]:
    azure_oid: str = claims.get("oid", "")
    email: str = (
        claims.get("email")
        or claims.get("preferred_username")
        or claims.get("upn")
        or ""
    )
    display_name: str = claims.get("name", "")
    if not azure_oid or not email:
        raise ValueError("id_token is missing required claims (oid, email).")
    return azure_oid, email.lower(), display_name


class AuthService:

    def sso_callback(
        self,
        *,
        id_token: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> dict[str, Any]:
        azure_claims = validate_azure_token(id_token)
        azure_oid, email, display_name = _extract_azure_claims(azure_claims)

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                existing = _repo.find_user_by_oid(cur, azure_oid)
                if existing:
                    user = _repo.update_user_profile(
                        cur, azure_oid=azure_oid, email=email, display_name=display_name
                    )
                else:
                    user = _repo.create_user(
                        cur, azure_oid=azure_oid, email=email, display_name=display_name
                    )

                if not user["is_active"]:
                    raise PermissionError("User account has been deactivated.")

                session = _repo.create_session(
                    cur,
                    user_id=str(user["id"]),
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                _repo.write_audit_log(
                    cur,
                    user_id=str(user["id"]),
                    action="LOGIN",
                    entity_type="user_sessions",
                    entity_id=str(session["session_id"]),
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

        return {
            "access_token": issue_token(
                user_id=str(user["id"]),
                azure_oid=str(user["azure_oid"]),
                email=str(user["email"]),
                role=str(user["role"]),
                session_id=str(session["session_id"]),
            ),
            "token_type": "bearer",
            "expires_in": _EXPIRY_SECONDS,
        }

    def get_current_user(self, *, user_id: str) -> dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                user = _repo.get_user_by_id(cur, user_id)
        finally:
            conn.close()
        if not user:
            raise LookupError("User not found.")
        return dict(user)

    def logout(self, *, user_id: str, session_id: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                deactivated = _repo.deactivate_session(cur, session_id=session_id, user_id=user_id)
                if deactivated:
                    _repo.write_audit_log(
                        cur,
                        user_id=user_id,
                        action="LOGOUT",
                        entity_type="user_sessions",
                        entity_id=session_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                    )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def heartbeat(self, *, user_id: str, session_id: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                updated = _repo.update_last_activity(cur, session_id=session_id, user_id=user_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return updated

    def list_sessions(self, *, user_id: str) -> list[dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                rows = _repo.list_active_sessions(cur, user_id)
        finally:
            conn.close()
        return [dict(r) for r in rows]

    def revoke_session(self, *, session_id: str, user_id: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                revoked = _repo.deactivate_session(cur, session_id=session_id, user_id=user_id)
                if revoked:
                    _repo.write_audit_log(
                        cur,
                        user_id=user_id,
                        action="SESSION_REVOKE",
                        entity_type="user_sessions",
                        entity_id=session_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                    )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return revoked
