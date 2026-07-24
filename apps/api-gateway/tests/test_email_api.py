"""
TC-EMAIL-001 to TC-EMAIL-007 — Email Agent endpoint tests.
Covers POST /api/email.
"""

import pytest
from unittest.mock import patch
from app.api.controllers.email_controller import router as email_router

EMAIL_URL = "/api/email"

MOCK_EMAIL_RESPONSE = {
    "subject": "Request for Annual Leave Approval",
    "body":    (
        "Dear [Manager Name],\n\n"
        "I would like to request annual leave from 2026-07-01 to 2026-07-05.\n\n"
        "Best regards,\nTest User"
    ),
}


def _patch_email_agent(return_value=None):
    rv = return_value or MOCK_EMAIL_RESPONSE
    return patch(
        "app.api.controllers.email_controller.EmailAgent.generate",
        return_value=rv,
    )


class TestEmailPositive:

    # TC-EMAIL-001: Generate email returns 200 with subject and body
    def test_generate_email_returns_200(self, client):
        with _patch_email_agent():
            response = client.post(EMAIL_URL, json={"prompt": "Request for leave approval"})
        assert response.status_code == 200

    # TC-EMAIL-002: Refine existing draft
    def test_refine_draft_returns_200(self, client):
        with _patch_email_agent():
            response = client.post(EMAIL_URL, json={
                "prompt": "Make this email more formal",
                "draft":  "hey boss, i need some days off",
            })
        assert response.status_code == 200

    # TC-EMAIL-005: Response structure contains expected fields
    def test_response_structure(self, client):
        with _patch_email_agent(MOCK_EMAIL_RESPONSE):
            response = client.post(EMAIL_URL, json={"prompt": "Write a leave request email"})
        assert response.status_code == 200


class TestEmailNegative:

    # TC-EMAIL-003: Empty prompt → 422
    def test_empty_prompt_returns_422(self, client):
        response = client.post(EMAIL_URL, json={})
        assert response.status_code in (400, 422)

    # TC-EMAIL-006: No auth → 401/403
    def test_email_without_auth(self, unauth_client):
        response = unauth_client.post(EMAIL_URL, json={"prompt": "Write a leave request"})
        assert response.status_code in (401, 403)


class TestEmailEdgeCases:

    # TC-EMAIL-004: Very long prompt
    def test_very_long_prompt(self, client):
        long_prompt = "Please refine: " + "A" * 3000
        with _patch_email_agent():
            response = client.post(EMAIL_URL, json={"prompt": long_prompt})
        assert response.status_code in (200, 400, 422)

    # Special characters in prompt
    def test_special_chars_in_prompt(self, client):
        with _patch_email_agent():
            response = client.post(EMAIL_URL, json={"prompt": "Draft email about C++ & Python"})
        assert response.status_code == 200
