"""Auth controller — HTTP layer for all /api/auth/* endpoints."""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.api.auth.jwt_auth_handler import jwt_auth
from app.api.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])

_service = AuthService()


# ── Request / Response models ──────────────────────────────────────────────

class SSOCallbackRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class UserOut(BaseModel):
    id: str
    email: str
    azure_oid: str
    display_name: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SessionOut(BaseModel):
    id: str
    session_id: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    login_time: datetime
    last_activity: datetime
    is_active: bool


# ── Helpers ────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Request) -> Optional[str]:
    return request.headers.get("User-Agent")


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/sso/callback", response_model=TokenResponse, summary="SSO callback")
def sso_callback(body: SSOCallbackRequest, request: Request) -> Any:
    """
    Validate Azure AD id_token → find-or-create user → create session → return AURA JWT.
    Writes: users, user_sessions, audit_logs (LOGIN).
    """
    try:
        return _service.sso_callback(
            id_token=body.id_token,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/me", response_model=UserOut, summary="Get current user")
def get_me(ctx: dict = Depends(jwt_auth)) -> Any:
    """Return the authenticated user's profile (reads: users)."""
    try:
        return _service.get_current_user(user_id=ctx["claims"]["sub"])
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout")
def logout(request: Request, ctx: dict = Depends(jwt_auth)) -> None:
    """Mark current session inactive. Writes: user_sessions, audit_logs (LOGOUT)."""
    _service.logout(
        user_id=ctx["claims"]["sub"],
        session_id=ctx["session_id"],
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT, summary="Heartbeat")
def heartbeat(ctx: dict = Depends(jwt_auth)) -> None:
    """Update last_activity on the current session (writes: user_sessions)."""
    _service.heartbeat(user_id=ctx["claims"]["sub"], session_id=ctx["session_id"])


@router.get("/sessions", response_model=list[SessionOut], summary="List my sessions")
def list_sessions(ctx: dict = Depends(jwt_auth)) -> Any:
    """Return all active sessions for the authenticated user (reads: user_sessions)."""
    return _service.list_sessions(user_id=ctx["claims"]["sub"])


@router.delete("/sessions/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke session")
def revoke_session(id: str, request: Request, ctx: dict = Depends(jwt_auth)) -> None:
    """
    Sign out a specific device. user_id always from JWT — prevents revoking another user's session.
    Writes: user_sessions, audit_logs (SESSION_REVOKE).
    """
    revoked = _service.revoke_session(
        session_id=id,
        user_id=ctx["claims"]["sub"],
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or already inactive.")
