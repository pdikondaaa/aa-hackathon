"""
Shared pytest fixtures for AURA API tests.

Run unit tests (no live services):
    cd apps/api-gateway
    pytest

Run integration tests (requires DB + Ollama):
    cd apps/api-gateway
    pytest -m integration
"""

import os
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Set placeholder env vars BEFORE any app module is imported.
# This prevents psycopg2 / Ollama connection errors at import time.
# ---------------------------------------------------------------------------
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "test_db")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")
os.environ.setdefault("ZOHO_DB_HOST", "localhost")
os.environ.setdefault("ZOHO_DB_PORT", "5432")
os.environ.setdefault("ZOHO_DB_NAME", "test_db")
os.environ.setdefault("ZOHO_DB_USER", "test")
os.environ.setdefault("ZOHO_DB_PWD", "test")
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")
os.environ.setdefault("AZURE_TENANT_ID", "00000000-0000-0000-0000-000000000000")
os.environ.setdefault("AZURE_CLIENT_ID", "00000000-0000-0000-0000-000000000000")
os.environ.setdefault("JWKS_URL", "https://login.microsoftonline.com/test/discovery/keys")

# ---------------------------------------------------------------------------
# Canonical test data — shared across test modules
# ---------------------------------------------------------------------------
TEST_USER_OID   = "oid-00000000-0000-0000-0000-000000000001"
TEST_USER_DB_ID = "dbu-00000000-0000-0000-0000-000000000001"
TEST_USER = {
    "user_id": TEST_USER_OID,
    "email":   "testuser@alignedautomation.com",
    "name":    "Test User",
}

MOCK_CONV_ID = "conv-00000000-0000-0000-0000-000000000001"
MOCK_MSG_ID  = "msg-00000000-0000-0000-0000-000000000001"
MOCK_ESC_ID  = "esc-00000000-0000-0000-0000-000000000001"

MOCK_CONVERSATION = {
    "id":         MOCK_CONV_ID,
    "title":      "Test Conversation",
    "created_at": datetime(2026, 1, 1, 0, 0, 0),
    "updated_at": datetime(2026, 1, 1, 0, 0, 0),
}

MOCK_MESSAGE = {
    "id":              MOCK_MSG_ID,
    "conversation_id": MOCK_CONV_ID,
    "role":            "assistant",
    "content":         "Hello! How can I help you?",
    "status":          "completed",
    "created_at":      datetime(2026, 1, 1, 0, 0, 0),
}

MOCK_ESCALATION = {
    "id":               MOCK_ESC_ID,
    "escalation_type":  "hr",
    "subject":          "Test Subject",
    "reason":           "Test reason description",
    "priority":         "medium",
    "status":           "submitted",
    "form_payload":     {},
    "conversation_id":  None,
    "message_id":       None,
    "created_at":       datetime(2026, 1, 1, 0, 0, 0),
    "updated_at":       datetime(2026, 1, 1, 0, 0, 0),
}

MOCK_CONV_LIST = {
    "data":  [MOCK_CONVERSATION],
    "total": 1,
    "page":  1,
    "limit": 20,
}

MOCK_MSG_LIST = {
    "data":  [MOCK_MESSAGE],
    "total": 1,
    "page":  1,
    "limit": 50,
}

MOCK_ESC_LIST = {
    "data":  [MOCK_ESCALATION],
    "total": 1,
    "page":  1,
    "limit": 20,
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def fastapi_app():
    """Import and return the FastAPI app (session-scoped — one import per run)."""
    from app.main import app as _app
    return _app


@pytest.fixture
def client(fastapi_app):
    """
    HTTP test client with:
      - get_current_user → returns TEST_USER (bypasses Azure AD JWT validation)
      - get_or_create_user → returns TEST_USER_DB_ID (bypasses DB upsert)
    """
    from app.api.auth.auth_handler import get_current_user

    fastapi_app.dependency_overrides[get_current_user] = lambda: TEST_USER

    with patch(
        "app.api.services.user_service.get_or_create_user",
        return_value=TEST_USER_DB_ID,
    ):
        with TestClient(fastapi_app, raise_server_exceptions=False) as c:
            yield c

    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def unauth_client(fastapi_app):
    """Test client with NO auth override — use to verify 401/403 responses."""
    with TestClient(fastapi_app, raise_server_exceptions=False) as c:
        yield c
