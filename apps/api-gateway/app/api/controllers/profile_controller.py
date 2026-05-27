from fastapi import APIRouter, Depends, HTTPException

from app.api.auth.auth_handler import get_current_user
from app.api.services.user_service import (
    get_employee_profile,
    build_user_profile_response,
    get_todays_birthdays,
    get_todays_work_anniversaries,
)

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    summary="Get my profile",
    description=(
        "Returns the logged-in user's full profile from the Zoho People directory "
        "(people.vb_employees). This is the single source of truth for user identity "
        "across the application."
    ),
)
def get_my_profile(current_user: dict = Depends(get_current_user)):
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="User email not found in token")

    profile = get_employee_profile(email)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record found for email: {email}",
        )

    return build_user_profile_response(profile)


@router.get(
    "/birthdays/today",
    summary="Today's birthdays",
    description=(
        "Returns a list of active employees whose birthday falls today. "
        "Data is sourced from people.vb_employees."
    ),
)
def todays_birthdays(current_user: dict = Depends(get_current_user)):
    return {"birthdays": get_todays_birthdays()}


@router.get(
    "/anniversaries/today",
    summary="Today's work anniversaries",
    description=(
        "Returns a list of active employees whose work anniversary (DateOfJoining) "
        "falls today. Data is sourced from people.vb_employees."
    ),
)
def todays_work_anniversaries(current_user: dict = Depends(get_current_user)):
    return {"anniversaries": get_todays_work_anniversaries()}
