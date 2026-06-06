"""
TC-PROF-001 to TC-PROF-005 — User Profile endpoint tests.
Covers GET /api/profile.
"""

import pytest
from unittest.mock import patch

PROFILE_URL = "/api/profile"

MOCK_PROFILE = {
    "full_name":               "Test User",
    "first_name":              "Test",
    "last_name":               "User",
    "email":                   "testuser@alignedautomation.com",
    "employee_id":             "EMP9999",
    "designation":             "Software Engineer",
    "department":              "Technology",
    "parent_department":       "Engineering",
    "role":                    "IC",
    "grade":                   "L4",
    "employee_type":           "Full Time",
    "employee_status":         "Active",
    "reporting_manager":       "Jane Manager",
    "reporting_manager_email": "jane@alignedautomation.com",
    "work_location":           "Pune",
    "mobile":                  "+91-9000000000",
}


class TestProfilePositive:

    # TC-PROF-001: Profile returns 200 with employee data
    def test_get_profile_returns_200(self, client):
        with patch(
            "app.api.services.user_service.get_employee_profile",
            return_value=MOCK_PROFILE,
        ):
            response = client.get(PROFILE_URL)
        assert response.status_code == 200

    # TC-PROF-002: Profile hides PII fields (Aadhar, PAN)
    def test_profile_no_sensitive_pii(self, client):
        profile_with_pii = {
            **MOCK_PROFILE,
            "Aadhar":         "1234-5678-9012",
            "PAN":            "ABCDE1234F",
            "PersonalEmailId": "personal@gmail.com",
        }
        with patch(
            "app.api.services.user_service.get_employee_profile",
            return_value=profile_with_pii,
        ):
            response = client.get(PROFILE_URL)
        assert response.status_code == 200
        raw = response.text
        assert "1234-5678-9012" not in raw
        assert "ABCDE1234F" not in raw


class TestProfileNegative:

    # TC-PROF-003: User not in Zoho People returns graceful response
    def test_profile_user_not_found_graceful(self, client):
        with patch(
            "app.api.services.user_service.get_employee_profile",
            return_value=None,
        ):
            response = client.get(PROFILE_URL)
        assert response.status_code in (200, 404)

    # No auth → 401/403
    def test_profile_without_auth(self, unauth_client):
        response = unauth_client.get(PROFILE_URL)
        assert response.status_code in (401, 403)

    # Zoho DB down → graceful error
    def test_profile_db_error_graceful(self, client):
        with patch(
            "app.api.services.user_service.get_employee_profile",
            side_effect=Exception("Zoho DB unreachable"),
        ):
            response = client.get(PROFILE_URL)
        assert response.status_code in (200, 404, 500, 503)
