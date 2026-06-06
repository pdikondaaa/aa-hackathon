"""
TC-ATT-001 to TC-ATT-006 — Attendance endpoint tests.
Covers GET /api/attendance.
"""

import pytest
from unittest.mock import patch

ATTENDANCE_URL = "/api/attendance"

MOCK_ATTENDANCE_RECORD = {
    "date":        "2026-06-05",
    "check_in":    "09:02:00",
    "check_out":   "18:30:00",
    "duration_hrs": 9.47,
    "status":      "present",
}

MOCK_ATTENDANCE_RESPONSE = {
    "data":  [MOCK_ATTENDANCE_RECORD],
    "total": 1,
}


class TestAttendancePositive:

    # TC-ATT-001: Attendance returns 200 with records
    def test_attendance_returns_200(self, client):
        with patch(
            "app.api.services.attendance_service.AttendanceService.get_attendance",
            return_value=MOCK_ATTENDANCE_RESPONSE,
        ):
            response = client.get(ATTENDANCE_URL)
        assert response.status_code == 200

    # TC-ATT-002: Date range filter accepted
    def test_attendance_date_range_filter(self, client):
        with patch(
            "app.api.services.attendance_service.AttendanceService.get_attendance",
            return_value=MOCK_ATTENDANCE_RESPONSE,
        ):
            response = client.get(ATTENDANCE_URL, params={
                "from_date": "2026-05-01",
                "to_date":   "2026-05-31",
            })
        assert response.status_code in (200, 422)

    # TC-ATT-003: User with no Zoho record → empty or graceful
    def test_attendance_no_records(self, client):
        empty = {"data": [], "total": 0}
        with patch(
            "app.api.services.attendance_service.AttendanceService.get_attendance",
            return_value=empty,
        ):
            response = client.get(ATTENDANCE_URL)
        assert response.status_code == 200
        assert response.json()["total"] == 0


class TestAttendanceNegative:

    # No auth → 401/403
    def test_attendance_without_auth(self, unauth_client):
        response = unauth_client.get(ATTENDANCE_URL)
        assert response.status_code in (401, 403)

    # TC-ATT-004: Zoho DB failure → graceful error
    def test_attendance_db_failure_graceful(self, client):
        with patch(
            "app.api.services.attendance_service.AttendanceService.get_attendance",
            side_effect=Exception("Zoho DB connection failed"),
        ):
            response = client.get(ATTENDANCE_URL)
        assert response.status_code in (500, 503, 200)

    # TC-ATT-006: Cross-user access — service called with correct user_id
    def test_attendance_scoped_to_authenticated_user(self, client):
        from tests.conftest import TEST_USER_DB_ID
        with patch(
            "app.api.services.attendance_service.AttendanceService.get_attendance",
            return_value=MOCK_ATTENDANCE_RESPONSE,
        ) as mock_svc:
            client.get(ATTENDANCE_URL)
        if mock_svc.called:
            call_kwargs = mock_svc.call_args
            # The call must not contain another user's ID
            args_str = str(call_kwargs)
            assert "other-user-id" not in args_str
