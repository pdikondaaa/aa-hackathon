"""COO Analytics Dashboard controller — executive-level strategic insights."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.api.auth.auth_handler import get_current_user
from app.api.services.coo_analytics_service import get_coo_dashboard, get_filter_options

router = APIRouter(prefix="/api/coo-analytics", tags=["COO Analytics"])


@router.get("/dashboard")
async def coo_dashboard(
    function:         Optional[str] = Query(None),
    subfunction:      Optional[str] = Query(None),
    client:           Optional[str] = Query(None),
    project_status:   Optional[str] = Query(None),
    billing:          Optional[str] = Query(None),
    delivery_manager: Optional[str] = Query(None),
    date_from:        Optional[str] = Query(None),
    date_to:          Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns comprehensive COO analytics data.
    Restricted to executive, business_lead, and functional_lead roles.
    All filters are optional — omit to get full company view.
    """
    filters = {k: v for k, v in {
        "function": function, "subfunction": subfunction, "client": client,
        "project_status": project_status, "billing": billing,
        "delivery_manager": delivery_manager, "date_from": date_from, "date_to": date_to,
    }.items() if v}
    try:
        return get_coo_dashboard(current_user["email"], filters)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/filters")
async def coo_filter_options(current_user: dict = Depends(get_current_user)):
    """Returns available dropdown options for COO Dashboard global filters."""
    try:
        return get_filter_options(current_user["email"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
