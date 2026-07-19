"""AURA usage analytics dashboard — real data from messages/conversations/users."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.api.auth.auth_handler import get_current_user
from app.api.services.aura_analytics_service import get_aura_dashboard, get_aura_users, get_recent_activities

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def aura_analytics_dashboard(
    range: Optional[str] = Query("week", description="today | week | month | quarter"),
    current_user: dict = Depends(get_current_user),
):
    """Returns AURA usage analytics — overview KPIs, charts, top queries and recent activity."""
    try:
        return get_aura_dashboard(range)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users")
async def aura_analytics_users(current_user: dict = Depends(get_current_user)):
    """Returns every AURA user with real conversation/query activity counts."""
    try:
        return get_aura_users()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/activities")
async def aura_analytics_activities(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Paginated recent-activity feed — every real user query across the org."""
    try:
        return get_recent_activities(page, limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
