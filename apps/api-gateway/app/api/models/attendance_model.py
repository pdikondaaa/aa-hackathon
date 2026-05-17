from pydantic import BaseModel
from typing import Optional


class AttendanceRecord(BaseModel):
    date: str
    day: str
    check_in: Optional[str]
    check_out: Optional[str]
    duration_minutes: int
    duration_label: str
    status: str  # "full_day" | "half_day" | "short" | "no_checkout"


class MonthSummary(BaseModel):
    month_label: str        # e.g. "May 2026"
    year: int
    month_number: int
    total_days: int
    total_minutes: int
    total_hours_label: str  # e.g. "78h 30m"
    records: list[AttendanceRecord]


class AttendanceOut(BaseModel):
    employee_name: str
    this_month: MonthSummary
    last_month: MonthSummary
    total_days_combined: int
    total_minutes_combined: int
    total_hours_combined: str


class ReporteeAttendanceOut(BaseModel):
    """Attendance summary for a single reportee — returned to their manager."""
    viewer_email: str           # The manager who requested this
    reportee_email: str         # The reportee being viewed
    reportee_name: str          # Full name of the reportee
    attendance: AttendanceOut   # Full attendance summary
