"""
Employee Directory API controller.
Exposes the active-employee roster sourced from people.vb_employees (Zoho People).
"""
from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.auth.auth_handler import get_current_user
from app.api.services.employee_directory_service import get_employee_directory
from app.api.services.graph_photo_service import get_employee_photo

router = APIRouter(prefix="/api/employees", tags=["Employee Directory"])


@router.get("/directory")
async def employee_directory(current_user: dict = Depends(get_current_user)):
    """Returns the full active-employee list plus department/designation filter options."""
    try:
        return get_employee_directory()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/photo/{email}")
async def employee_photo(email: str, current_user: dict = Depends(get_current_user)):
    """Proxies the employee's Microsoft 365 profile photo via Graph (app-only auth)."""
    result = get_employee_photo(email)
    if not result:
        raise HTTPException(status_code=404, detail="Photo not available")
    content, content_type = result
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "private, max-age=21600"})
