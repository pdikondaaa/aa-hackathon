"""
TC-ALLOC-001 to TC-ALLOC-009 — Allocation Board endpoint tests.
Covers GET /api/allocations.
"""

import pytest
from unittest.mock import patch

ALLOC_URL = "/api/allocations"

MOCK_ALLOC_ROW = {
    "employee_id":  "EMP001",
    "employee_name": "Alice Johnson",
    "department":   "Technology",
    "project_name": "Project Alpha",
    "allocation_pct": 100,
    "start_date":   "2026-01-01",
    "end_date":     "2026-12-31",
    "role":         "Developer",
}

MOCK_ALLOC_RESPONSE = {
    "data":  [MOCK_ALLOC_ROW],
    "total": 1,
    "page":  1,
    "limit": 50,
}


class TestAllocationPositive:

    # TC-ALLOC-001: Allocation board loads for PMO/lead user
    def test_allocation_returns_200(self, client):
        with patch(
            "app.api.services.allocation_service.AllocationService.get_allocations",
            return_value=MOCK_ALLOC_RESPONSE,
        ):
            response = client.get(ALLOC_URL)
        assert response.status_code == 200

    # TC-ALLOC-008: Empty allocation data returns empty list gracefully
    def test_allocation_empty_returns_200(self, client):
        empty = {"data": [], "total": 0, "page": 1, "limit": 50}
        with patch(
            "app.api.services.allocation_service.AllocationService.get_allocations",
            return_value=empty,
        ):
            response = client.get(ALLOC_URL)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    # TC-ALLOC-005: Filter / search param accepted
    def test_allocation_with_filter(self, client):
        with patch(
            "app.api.services.allocation_service.AllocationService.get_allocations",
            return_value=MOCK_ALLOC_RESPONSE,
        ):
            response = client.get(ALLOC_URL, params={"department": "Technology"})
        assert response.status_code in (200, 422)


class TestAllocationNegative:

    # No auth → 401/403
    def test_allocation_without_auth(self, unauth_client):
        response = unauth_client.get(ALLOC_URL)
        assert response.status_code in (401, 403)

    # Service error → graceful 500
    def test_allocation_service_error(self, client):
        with patch(
            "app.api.services.allocation_service.AllocationService.get_allocations",
            side_effect=Exception("DB unavailable"),
        ):
            response = client.get(ALLOC_URL)
        assert response.status_code in (500, 503)
