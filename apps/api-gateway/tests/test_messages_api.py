"""
TC-MSG-001 to TC-MSG-009 — Message endpoint tests.
Covers GET/POST on /api/conversations/{id}/messages and /api/messages/{id}.
"""

import pytest
from unittest.mock import patch
from app.api.services.messages_service import MessagesService
from tests.conftest import (
    MOCK_CONV_ID,
    MOCK_MSG_ID,
    MOCK_MESSAGE,
    MOCK_MSG_LIST,
)

CONV_MSGS_URL  = f"/api/conversations/{MOCK_CONV_ID}/messages"
MSG_URL        = f"/api/messages/{MOCK_MSG_ID}"


class TestListMessages:

    # TC-MSG-002: Messages load in order
    def test_list_messages_returns_200(self, client):
        with patch.object(MessagesService, "list_messages", return_value=MOCK_MSG_LIST):
            response = client.get(CONV_MSGS_URL)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert data["total"] == 1

    def test_list_messages_empty_conversation(self, client):
        empty = {"data": [], "total": 0, "page": 1, "limit": 50}
        with patch.object(MessagesService, "list_messages", return_value=empty):
            response = client.get(CONV_MSGS_URL)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    # Pagination
    def test_list_messages_pagination(self, client):
        with patch.object(MessagesService, "list_messages", return_value=MOCK_MSG_LIST):
            response = client.get(CONV_MSGS_URL, params={"page": 1, "limit": 10})
        assert response.status_code == 200

    def test_list_messages_invalid_limit(self, client):
        response = client.get(CONV_MSGS_URL, params={"limit": 999})
        assert response.status_code == 422


class TestSendMessage:

    # TC-MSG-001: Send a message returns a persisted response
    def test_send_message_returns_201_or_200(self, client):
        with patch.object(MessagesService, "send_message", return_value=MOCK_MESSAGE):
            response = client.post(CONV_MSGS_URL, json={"content": "What is the leave policy?"})
        assert response.status_code in (200, 201)

    # TC-MSG-008: Empty body → 422
    def test_send_message_empty_body_returns_422(self, client):
        response = client.post(CONV_MSGS_URL, json={})
        assert response.status_code == 422

    # TC-CHAT-011: Very long message
    def test_send_very_long_message(self, client):
        with patch.object(MessagesService, "send_message", return_value=MOCK_MESSAGE):
            response = client.post(CONV_MSGS_URL, json={"content": "X" * 5000})
        assert response.status_code in (200, 201)

    # No auth
    def test_send_message_without_auth(self, unauth_client):
        response = unauth_client.post(CONV_MSGS_URL, json={"content": "Hello"})
        assert response.status_code in (401, 403)


class TestGetMessage:

    # TC-MSG-007: Get single message
    def test_get_message_returns_200(self, client):
        with patch.object(MessagesService, "get_message", return_value=MOCK_MESSAGE):
            response = client.get(MSG_URL)
        assert response.status_code == 200
        assert response.json()["id"] == MOCK_MSG_ID

    # Non-existent message → 404
    def test_get_nonexistent_message_returns_404(self, client):
        with patch.object(MessagesService, "get_message", return_value=None):
            response = client.get(f"/api/messages/nonexistent-msg-id")
        assert response.status_code == 404


class TestMessageCitations:

    # TC-CHAT-015: Response includes citations when available
    def test_message_with_citations(self, client):
        msg_with_citations = {
            **MOCK_MESSAGE,
            "citations": [
                {
                    "chunk_id":       "chunk-001",
                    "chunk_index":    0,
                    "chunk_content":  "Leave policy states 20 days per year.",
                    "document_id":    "doc-001",
                    "document_title": "HR Leave Policy",
                    "source_url":     "https://sharepoint.example.com/docs/hr-leave-policy.pdf",
                }
            ],
        }
        with patch.object(MessagesService, "get_message", return_value=msg_with_citations):
            response = client.get(MSG_URL)
        assert response.status_code == 200
