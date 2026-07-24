"""
TC-AUTH-007 to TC-AUTH-010 — API-level authentication tests.
Tests that verify the auth middleware rejects bad/missing tokens.
"""

import pytest


PROTECTED_ENDPOINTS = [
    ("GET",  "/api/conversations"),
    ("POST", "/api/conversations"),
    ("GET",  "/api/escalations"),
    ("GET",  "/api/profile"),
    ("GET",  "/api/attendance"),
    ("POST", "/api/chat"),
    ("GET",  "/api/documents"),
]


class TestMissingToken:
    """TC-AUTH-007 — API calls without Authorization header return 401/403."""

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_no_token_rejected(self, unauth_client, method, path):
        fn = getattr(unauth_client, method.lower())
        if method == "POST":
            response = fn(path, json={})
        else:
            response = fn(path)
        assert response.status_code in (401, 403), (
            f"{method} {path} should require auth but returned {response.status_code}"
        )


class TestTamperedToken:
    """TC-AUTH-008 — Structurally valid but tampered JWT returns 401/403."""

    def test_tampered_jwt_rejected(self, unauth_client):
        tampered = "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJoYWNrZWQifQ.invalidsignature"
        response = unauth_client.get(
            "/api/conversations",
            headers={"Authorization": tampered},
        )
        assert response.status_code in (401, 403)

    def test_malformed_token_rejected(self, unauth_client):
        response = unauth_client.get(
            "/api/conversations",
            headers={"Authorization": "Bearer notavalidtoken"},
        )
        assert response.status_code in (401, 403)

    def test_empty_bearer_token_rejected(self, unauth_client):
        response = unauth_client.get(
            "/api/conversations",
            headers={"Authorization": "Bearer "},
        )
        assert response.status_code in (401, 403)


class TestAuthenticatedAccess:
    """Verify that authenticated users CAN access protected endpoints."""

    def test_authenticated_can_reach_conversations(self, client):
        from unittest.mock import patch
        from app.api.services.conversations_service import ConversationsService
        from tests.conftest import MOCK_CONV_LIST

        with patch.object(ConversationsService, "list_conversations", return_value=MOCK_CONV_LIST):
            response = client.get("/api/conversations")
        assert response.status_code == 200

    def test_authenticated_can_reach_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
