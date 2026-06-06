"""
TC-DOC-001 to TC-DOC-007 — Documents endpoint tests.
Covers GET /api/documents.
"""

import pytest
from unittest.mock import patch

DOCS_URL = "/api/documents"

MOCK_DOC = {
    "id":            "doc-00000000-0000-0000-0001",
    "file_name":     "HR Leave Policy.pdf",
    "document_name": "HR Leave Policy",
    "source_url":    "https://alignedautomation.sharepoint.com/sites/Nexus/Documents/HR Leave Policy.pdf",
    "file_type":     "pdf",
    "last_modified": "2026-01-01T00:00:00",
}

MOCK_DOCS_RESPONSE = {
    "data":  [MOCK_DOC],
    "total": 1,
}


class TestDocumentsPositive:

    # TC-DOC-001: Document list returns 200
    def test_documents_list_returns_200(self, client):
        with patch(
            "app.api.services.documents_service.DocumentsService.list_documents",
            return_value=MOCK_DOCS_RESPONSE,
        ):
            response = client.get(DOCS_URL)
        assert response.status_code == 200

    # TC-DOC-002: Search param accepted
    def test_documents_search_returns_200(self, client):
        with patch(
            "app.api.services.documents_service.DocumentsService.list_documents",
            return_value=MOCK_DOCS_RESPONSE,
        ):
            response = client.get(DOCS_URL, params={"search": "POSH Policy"})
        assert response.status_code == 200

    # TC-DOC-005: Empty document list
    def test_documents_empty_list(self, client):
        empty = {"data": [], "total": 0}
        with patch(
            "app.api.services.documents_service.DocumentsService.list_documents",
            return_value=empty,
        ):
            response = client.get(DOCS_URL)
        assert response.status_code == 200
        assert response.json()["total"] == 0


class TestDocumentsNegative:

    # No auth → 401/403
    def test_documents_without_auth(self, unauth_client):
        response = unauth_client.get(DOCS_URL)
        assert response.status_code in (401, 403)

    # Service error → graceful 500
    def test_documents_service_error(self, client):
        with patch(
            "app.api.services.documents_service.DocumentsService.list_documents",
            side_effect=Exception("SharePoint unavailable"),
        ):
            response = client.get(DOCS_URL)
        assert response.status_code in (500, 503)
