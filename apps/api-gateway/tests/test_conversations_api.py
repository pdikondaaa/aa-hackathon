"""
TC-CONV-001 to TC-CONV-010 — Conversation CRUD endpoint tests.
Covers GET/POST/PATCH/DELETE /api/conversations.
"""

import pytest
from unittest.mock import patch
from app.api.services.conversations_service import ConversationsService
from tests.conftest import (
    MOCK_CONV_ID,
    MOCK_CONVERSATION,
    MOCK_CONV_LIST,
)

BASE = "/api/conversations"


class TestListConversations:

    # TC-CONV-001 / TC-CONV-002: List returns paginated conversations
    def test_list_returns_200_with_conversations(self, client):
        with patch.object(ConversationsService, "list_conversations", return_value=MOCK_CONV_LIST):
            response = client.get(BASE)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert data["total"] == 1

    def test_list_returns_empty_when_no_conversations(self, client):
        empty = {"data": [], "total": 0, "page": 1, "limit": 20}
        with patch.object(ConversationsService, "list_conversations", return_value=empty):
            response = client.get(BASE)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    # Pagination params are accepted
    def test_list_pagination_params(self, client):
        with patch.object(ConversationsService, "list_conversations", return_value=MOCK_CONV_LIST):
            response = client.get(BASE, params={"page": 2, "limit": 10})
        assert response.status_code == 200

    # Search param accepted
    def test_list_search_param(self, client):
        with patch.object(ConversationsService, "list_conversations", return_value=MOCK_CONV_LIST):
            response = client.get(BASE, params={"search": "HR query"})
        assert response.status_code == 200

    # Invalid limit → 422
    def test_list_invalid_limit_too_high(self, client):
        response = client.get(BASE, params={"limit": 500})
        assert response.status_code == 422

    def test_list_invalid_page_zero(self, client):
        response = client.get(BASE, params={"page": 0})
        assert response.status_code == 422


class TestCreateConversation:

    # TC-CONV-001: Create returns 201 with conversation
    def test_create_returns_201(self, client):
        with patch.object(ConversationsService, "create_conversation", return_value=MOCK_CONVERSATION):
            response = client.post(BASE, json={"title": "New Chat"})
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == MOCK_CONV_ID
        assert data["title"] == "Test Conversation"

    # Create with no title (optional field)
    def test_create_without_title(self, client):
        with patch.object(ConversationsService, "create_conversation", return_value=MOCK_CONVERSATION):
            response = client.post(BASE, json={})
        assert response.status_code == 201

    # TC-CONV-001: Service error → 500
    def test_create_service_error_returns_500(self, client):
        with patch.object(ConversationsService, "create_conversation", side_effect=Exception("DB down")):
            response = client.post(BASE, json={"title": "Test"})
        assert response.status_code == 500


class TestGetConversation:

    # TC-CONV-003: Get existing conversation returns 200
    def test_get_conversation_returns_200(self, client):
        with patch.object(ConversationsService, "get_conversation", return_value=MOCK_CONVERSATION):
            response = client.get(f"{BASE}/{MOCK_CONV_ID}")
        assert response.status_code == 200
        assert response.json()["id"] == MOCK_CONV_ID

    # Non-existent conversation → 404
    def test_get_nonexistent_conversation_returns_404(self, client):
        with patch.object(ConversationsService, "get_conversation", return_value=None):
            response = client.get(f"{BASE}/nonexistent-id")
        assert response.status_code == 404

    # TC-CONV-006: Cross-user access attempt returns 404 (user scoping in service)
    def test_get_other_users_conversation_returns_404(self, client):
        with patch.object(ConversationsService, "get_conversation", return_value=None):
            response = client.get(f"{BASE}/other-user-conv-id")
        assert response.status_code == 404


class TestRenameConversation:

    # TC-CONV-004: Rename updates title
    def test_rename_returns_200(self, client):
        renamed = {**MOCK_CONVERSATION, "title": "Updated Title"}
        with patch.object(ConversationsService, "rename_conversation", return_value=renamed):
            response = client.patch(f"{BASE}/{MOCK_CONV_ID}", json={"title": "Updated Title"})
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    # Missing title → 422
    def test_rename_without_title_returns_422(self, client):
        response = client.patch(f"{BASE}/{MOCK_CONV_ID}", json={})
        assert response.status_code == 422

    # Non-existent conversation → 404
    def test_rename_nonexistent_conversation_returns_404(self, client):
        with patch.object(ConversationsService, "rename_conversation", return_value=None):
            response = client.patch(f"{BASE}/nonexistent", json={"title": "X"})
        assert response.status_code == 404


class TestDeleteConversation:

    # TC-CONV-005: Delete returns 204
    def test_delete_returns_204(self, client):
        with patch.object(ConversationsService, "delete_conversation", return_value=True):
            response = client.delete(f"{BASE}/{MOCK_CONV_ID}")
        assert response.status_code == 204

    # Delete non-existent → 404
    def test_delete_nonexistent_returns_404(self, client):
        with patch.object(ConversationsService, "delete_conversation", return_value=False):
            response = client.delete(f"{BASE}/nonexistent")
        assert response.status_code == 404


class TestConversationsUnauth:

    def test_list_unauthenticated(self, unauth_client):
        assert unauth_client.get(BASE).status_code in (401, 403)

    def test_create_unauthenticated(self, unauth_client):
        assert unauth_client.post(BASE, json={"title": "X"}).status_code in (401, 403)

    def test_delete_unauthenticated(self, unauth_client):
        assert unauth_client.delete(f"{BASE}/{MOCK_CONV_ID}").status_code in (401, 403)
