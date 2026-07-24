"""Admin users controller — portal-managed role/admin assignment."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user, get_current_admin_user
from app.api.services.app_user_service import (
    VALID_ROLES,
    get_role,
    list_users,
    upsert_user_role,
    delete_user,
)

# Self-service — any authenticated user looks up their own role
router = APIRouter(prefix="/api/users", tags=["Users"])

# Admin-only — manage every user's role
admin_router = APIRouter(prefix="/api/admin/users", tags=["Admin Users"])


class RoleBody(BaseModel):
    role: str


@router.get("/me/role")
async def get_my_role(current_user: dict = Depends(get_current_user)):
    """Return the logged-in user's role."""
    return {"email": current_user["email"], "role": get_role(current_user["email"])}


@admin_router.get("")
async def admin_list_users(current_user: dict = Depends(get_current_admin_user)):
    """List all users with an app_users role assignment."""
    try:
        return {"users": list_users()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@admin_router.put("/{email}")
async def admin_set_user_role(
    email: str,
    body: RoleBody,
    current_user: dict = Depends(get_current_admin_user),
):
    """Create or update a user's role (this is how admin access is granted)."""
    if email.lower() == current_user["email"].lower():
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
    try:
        return upsert_user_role(email, body.role, current_user["email"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@admin_router.delete("/{email}")
async def admin_remove_user(
    email: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Remove a user's role assignment (reverts them to the default role)."""
    if email.lower() == current_user["email"].lower():
        raise HTTPException(status_code=400, detail="Cannot remove your own role")
    try:
        removed = delete_user(email)
        if not removed:
            raise HTTPException(status_code=404, detail=f"No role assignment for {email}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
