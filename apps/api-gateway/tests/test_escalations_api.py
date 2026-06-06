"""
TC-ESC-001 to TC-ESC-010 — Escalation endpoint tests.
Covers POST/GET/PATCH /api/escalations and /api/escalations/forms/{type}.
"""

import pytest
from unittest.mock import patch
from app.api.services.escalations_service import EscalationsService
from tests.conftest import MOCK_ESC_ID, MOCK_ESCALATION, MOCK_ESC_LIST

BASE      = "/api/escalations"
ADMIN_BASE = "/api/admin/escalations"

VALID_ESCALATION_PAYLOAD = {
    "escalation_type": "hr",
    "subject":         "Payslip discrepancy",
    "reason":          "My payslip for April 2026 has incorrect deductions.",
    "priority":        "medium",
    "form_payload":    {},
    "conversation_id": None,
    "message_id":      None,
}


class TestCreateEscalation:

    # TC-ESC-001: Create HR escalation returns 201
    def test_create_hr_escalation_returns_201(self, client):
        with patch.object(EscalationsService, "create_escalation", return_value=MOCK_ESCALATION):
            response = client.post(BASE, json=VALID_ESCALATION_PAYLOAD)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == MOCK_ESC_ID
        assert data["escalation_type"] == "hr"

    # TC-ESC-002: Create IT escalation
    def test_create_it_escalation_returns_201(self, client):
        payload = {**VALID_ESCALATION_PAYLOAD, "escalation_type": "it", "subject": "VPN issue"}
        it_esc = {**MOCK_ESCALATION, "escalation_type": "it"}
        with patch.object(EscalationsService, "create_escalation", return_value=it_esc):
            response = client.post(BASE, json=payload)
        assert response.status_code == 201
        assert response.json()["escalation_type"] == "it"

    # TC-ESC-003: Create Admin escalation
    def test_create_admin_escalation_returns_201(self, client):
        payload = {**VALID_ESCALATION_PAYLOAD, "escalation_type": "admin", "subject": "Parking"}
        admin_esc = {**MOCK_ESCALATION, "escalation_type": "admin"}
        with patch.object(EscalationsService, "create_escalation", return_value=admin_esc):
            response = client.post(BASE, json=payload)
        assert response.status_code == 201

    # TC-ESC-004: Missing required fields → 422
    def test_create_missing_subject_returns_422(self, client):
        payload = {k: v for k, v in VALID_ESCALATION_PAYLOAD.items() if k != "subject"}
        response = client.post(BASE, json=payload)
        assert response.status_code == 422

    def test_create_missing_type_returns_422(self, client):
        payload = {k: v for k, v in VALID_ESCALATION_PAYLOAD.items() if k != "escalation_type"}
        response = client.post(BASE, json=payload)
        assert response.status_code == 422

    def test_create_empty_body_returns_422(self, client):
        response = client.post(BASE, json={})
        assert response.status_code == 422

    # No auth → 401/403
    def test_create_without_auth(self, unauth_client):
        response = unauth_client.post(BASE, json=VALID_ESCALATION_PAYLOAD)
        assert response.status_code in (401, 403)


class TestListEscalations:

    # TC-ESC-005: List own escalations returns 200
    def test_list_my_escalations_returns_200(self, client):
        with patch.object(EscalationsService, "list_my_escalations", return_value=MOCK_ESC_LIST):
            response = client.get(BASE)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert data["total"] == 1

    # Empty list
    def test_list_returns_empty_list(self, client):
        empty = {"data": [], "total": 0, "page": 1, "limit": 20}
        with patch.object(EscalationsService, "list_my_escalations", return_value=empty):
            response = client.get(BASE)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    # Filter by status
    def test_list_filter_by_status(self, client):
        with patch.object(EscalationsService, "list_my_escalations", return_value=MOCK_ESC_LIST):
            response = client.get(BASE, params={"status": "submitted"})
        assert response.status_code == 200

    # Pagination params
    def test_list_invalid_limit(self, client):
        response = client.get(BASE, params={"limit": 200})
        assert response.status_code == 422

    # TC-ESC-006: Cannot see other users' escalations (service returns only own)
    def test_list_returns_only_own_escalations(self, client):
        my_list = {"data": [MOCK_ESCALATION], "total": 1, "page": 1, "limit": 20}
        with patch.object(EscalationsService, "list_my_escalations", return_value=my_list) as mock_svc:
            response = client.get(BASE)
        assert response.status_code == 200
        # Verify service was called with the correct user_id from token
        from tests.conftest import TEST_USER_DB_ID
        mock_svc.assert_called_once()
        call_args = mock_svc.call_args[0]
        assert call_args[0] == TEST_USER_DB_ID


class TestGetEscalation:

    # Get existing escalation returns 200
    def test_get_escalation_returns_200(self, client):
        with patch.object(EscalationsService, "get_escalation", return_value=MOCK_ESCALATION):
            response = client.get(f"{BASE}/{MOCK_ESC_ID}")
        assert response.status_code == 200
        assert response.json()["id"] == MOCK_ESC_ID

    # Non-existent → 404
    def test_get_nonexistent_returns_404(self, client):
        with patch.object(EscalationsService, "get_escalation", return_value=None):
            response = client.get(f"{BASE}/nonexistent-id")
        assert response.status_code == 404

    # TC-SEC-007 / TC-ESC-006: IDOR — get another user's escalation
    def test_idor_returns_404(self, client):
        with patch.object(EscalationsService, "get_escalation", return_value=None):
            response = client.get(f"{BASE}/other-user-escalation-id")
        assert response.status_code == 404


class TestEscalationForms:

    # Form schema for valid type
    def test_get_form_schema_hr(self, client):
        mock_schema = {"fields": [{"name": "subject", "type": "text"}]}
        with patch.object(EscalationsService, "get_form_schema", return_value=mock_schema):
            response = client.get(f"{BASE}/forms/hr")
        assert response.status_code == 200

    def test_get_form_schema_it(self, client):
        mock_schema = {"fields": [{"name": "device", "type": "text"}]}
        with patch.object(EscalationsService, "get_form_schema", return_value=mock_schema):
            response = client.get(f"{BASE}/forms/it")
        assert response.status_code == 200

    # Unknown type → 404
    def test_get_form_schema_unknown_type_returns_404(self, client):
        with patch.object(EscalationsService, "get_form_schema", return_value=None):
            response = client.get(f"{BASE}/forms/unknown_type")
        assert response.status_code == 404
