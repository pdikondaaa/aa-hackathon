"""
Skills Analytics API controller.
Exposes org-wide skill aggregates from employee_details.primary_skills.
No sensitive allocation columns are returned.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth.auth_handler import get_current_user
from app.api.services.skills_service import get_skills_analytics

router = APIRouter(prefix="/api/skills", tags=["Skills"])


@router.get("/analytics")
async def skill_analytics(current_user: dict = Depends(get_current_user)):
    """
    Returns org-wide skill analytics:
      - summary stats (total employees, unique skills, avg skills/person, top skill)
      - top_skills list with counts
      - skills_by_function breakdown
      - skills_by_exp_group breakdown
      - full employee list with skill_list (no sensitive fields)
      - filter_options for frontend dropdowns
    """
    try:
        return get_skills_analytics()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))