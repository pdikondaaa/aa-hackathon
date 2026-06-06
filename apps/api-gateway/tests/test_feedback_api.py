"""
TC-MSG-003 to TC-MSG-010 — Feedback endpoint tests.
Covers POST /api/messages/{id}/feedback and /api/conversations/{id}/feedback.
"""

import pytest
from unittest.mock import patch
from app.api.services.feedback_service import FeedbackService
from tests.conftest import MOCK_MSG_ID, MOCK_CONV_ID

MSG_FEEDBACK_URL  = f"/api/messages/{MOCK_MSG_ID}/feedback"
CONV_FEEDBACK_URL = f"/api/conversations/{MOCK_CONV_ID}/feedback"

MOCK_FEEDBACK = {
    "id":         "fb-00000000-0000-0000-0000-000000000001",
    "message_id": MOCK_MSG_ID,
    "user_id":    "dbu-00000000-0000-0000-0000-000000000001",
    "rating":     "up",
    "category":   None,
    "comment":    None,
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00",
}


class TestSubmitFeedback:

    # TC-MSG-003: Thumbs up stored successfully
    def test_thumbs_up_returns_200_or_201(self, client):
        with patch.object(FeedbackService, "submit_feedback", return_value=MOCK_FEEDBACK):
            response = client.post(MSG_FEEDBACK_URL, json={"rating": "up"})
        assert response.status_code in (200, 201)
        assert response.json()["rating"] == "up"

    # TC-MSG-004: Thumbs down stored
    def test_thumbs_down_returns_200_or_201(self, client):
        down_fb = {**MOCK_FEEDBACK, "rating": "down"}
        with patch.object(FeedbackService, "submit_feedback", return_value=down_fb):
            response = client.post(MSG_FEEDBACK_URL, json={"rating": "down"})
        assert response.status_code in (200, 201)
        assert response.json()["rating"] == "down"

    # Feedback with optional category and comment
    def test_feedback_with_comment(self, client):
        fb = {**MOCK_FEEDBACK, "category": "wrong_answer", "comment": "This is incorrect."}
        with patch.object(FeedbackService, "submit_feedback", return_value=fb):
            response = client.post(MSG_FEEDBACK_URL, json={
                "rating": "down",
                "category": "wrong_answer",
                "comment": "This is incorrect."
            })
        assert response.status_code in (200, 201)

    # Invalid rating → 422
    def test_invalid_rating_returns_422(self, client):
        response = client.post(MSG_FEEDBACK_URL, json={"rating": "meh"})
        assert response.status_code == 422

    def test_empty_rating_returns_422(self, client):
        response = client.post(MSG_FEEDBACK_URL, json={})
        assert response.status_code == 422

    def test_numeric_rating_returns_422(self, client):
        response = client.post(MSG_FEEDBACK_URL, json={"rating": 1})
        assert response.status_code == 422

    # No auth → 401/403
    def test_feedback_without_auth(self, unauth_client):
        response = unauth_client.post(MSG_FEEDBACK_URL, json={"rating": "up"})
        assert response.status_code in (401, 403)


class TestUpdateFeedback:

    # TC-MSG-005: Change feedback from up → down
    def test_update_feedback_returns_200(self, client):
        updated = {**MOCK_FEEDBACK, "rating": "down"}
        with patch.object(FeedbackService, "update_feedback", return_value=updated):
            response = client.patch(MSG_FEEDBACK_URL, json={"rating": "down"})
        assert response.status_code in (200, 201)

    # Invalid update rating
    def test_update_invalid_rating_returns_422(self, client):
        response = client.patch(MSG_FEEDBACK_URL, json={"rating": "neutral"})
        assert response.status_code == 422


class TestFeedbackRatingValues:
    """Parametrized boundary tests for rating field."""

    @pytest.mark.parametrize("rating,expected_status", [
        ("up",   [200, 201]),
        ("down", [200, 201]),
        ("UP",   [422]),
        ("Down", [422]),
        ("",     [422]),
        ("like", [422]),
        ("1",    [422]),
    ])
    def test_rating_boundary(self, client, rating, expected_status):
        mock_fb = {**MOCK_FEEDBACK, "rating": rating}
        with patch.object(FeedbackService, "submit_feedback", return_value=mock_fb):
            response = client.post(MSG_FEEDBACK_URL, json={"rating": rating})
        assert response.status_code in expected_status
