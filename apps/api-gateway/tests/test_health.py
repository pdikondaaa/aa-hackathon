"""
TC-HLTH-001 to TC-HLTH-004 — Health endpoint tests.
No auth or DB required; these call the lightweight /health routes.
"""

import pytest


class TestHealthEndpoints:

    # TC-HLTH-001: Service health check
    def test_health_returns_up(self, unauth_client):
        response = unauth_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert data["service"] == "up"

    # TC-HLTH-002: DB health check returns a structured response
    def test_health_db_returns_json(self, unauth_client):
        response = unauth_client.get("/health/db")
        assert response.status_code == 200
        data = response.json()
        assert "db" in data

    # TC-HLTH-003: Health endpoint is publicly accessible (no token needed)
    def test_health_no_auth_required(self, unauth_client):
        response = unauth_client.get("/health")
        assert response.status_code != 401
        assert response.status_code != 403

    # TC-HLTH-004: Debug endpoint is restricted (returns 401/403/404 without auth)
    def test_debug_endpoint_restricted(self, unauth_client):
        response = unauth_client.get("/debug")
        assert response.status_code in (401, 403, 404, 405)
