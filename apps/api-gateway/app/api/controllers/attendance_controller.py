from fastapi import APIRouter, Depends, HTTPException

from app.api.auth.auth_handler import get_current_user
from app.api.models.attendance_model import AttendanceOut
from app.api.services.attendance_service import AttendanceService

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

_service = AttendanceService()


@router.get(
    "/me",
    response_model=AttendanceOut,
    summary="Get my attendance",
    description=(
        "Returns this month and last month attendance records for the logged-in employee. "
        "The employee name is resolved from the Zoho People directory using the caller's email, "
        "then attendance records are fetched from the Aura DB."
    ),
)
def get_my_attendance(current_user: dict = Depends(get_current_user)):
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="User email not found in token")

    try:
        return _service.get_my_attendance(email)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        print(f"ERROR in GET /api/attendance/me for {email}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch attendance data")
