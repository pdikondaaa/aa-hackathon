"""FastAPI dependency: jwt_auth

Verifies AURA's own JWT, loads user from DB, validates session liveness.

Usage:
    @router.get("/me")
    def me(ctx: dict = Depends(jwt_auth)):
        return ctx["user"]
"""

from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.auth.jwt_handler import decode_token
from app.api.config.db_config import get_db_connection
from app.api.repositories.auth_repository import AuthRepository

_bearer = HTTPBearer(auto_error=True)
_repo = AuthRepository()


def jwt_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict[str, Any]:
    try:
        claims = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = claims["sub"]
    session_id: str = claims["session_id"]

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Load user — reject if deactivated
            user = _repo.get_user_by_id(cur, user_id)
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User account is inactive or not found.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Verify session is still active (lookup by session_id column)
            session = _repo.get_session(cur, session_id=session_id, user_id=user_id)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked or does not exist.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    finally:
        conn.close()

    return {"user": dict(user), "session_id": session_id, "claims": claims}
