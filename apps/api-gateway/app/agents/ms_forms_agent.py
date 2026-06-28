"""
ms_forms_agent.py
=================
Creates Microsoft Forms on behalf of the authenticated user using the
Microsoft Graph API with a delegated access token.

Endpoint used:
  POST https://graph.microsoft.com/v1.0/forms                     — create form shell
  POST https://graph.microsoft.com/v1.0/forms/{formId}/questions  — add each question

Required Azure AD permission (delegated):
  Forms.ReadWrite   (admin consent required)

The caller (forms_controller.py) must supply the user's Graph-scoped
access token. The token is obtained on the frontend via MSAL with the
scope: "https://graph.microsoft.com/Forms.ReadWrite"
"""

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Map from our question-type names → Graph API questionType values
# Reference: https://learn.microsoft.com/en-us/graph/api/resources/questionitem
QUESTION_TYPE_MAP = {
    "text":              "text",
    "single_choice":     "choice",
    "multiple_choice":   "choice",
    "rating":            "rating",
    "date":              "date",
    "yes_no":            "choice",  # implemented as a 2-option choice
}


class MSFormsAgentError(Exception):
    """Raised when the Graph API returns an error."""
    pass


class MSFormsAgent:
    """Creates Microsoft Forms via Graph API using a delegated user token."""

    def __init__(self, access_token: str):
        if not access_token:
            raise MSFormsAgentError("A valid Graph access token is required.")
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    # ── Public entry point ────────────────────────────────────────────────

    def create_form(self, title: str, description: str, questions: list) -> dict:
        """
        Creates a form shell, adds all questions, and returns the result dict.

        Parameters
        ----------
        title       : str   — Form title (required)
        description : str   — Optional form description
        questions   : list  — List of dicts:
                              {
                                "text":    "Question text",
                                "type":    "text|single_choice|multiple_choice|rating|date|yes_no",
                                "required": True/False,
                                "choices":  ["Option A", "Option B"]  # for choice types only
                              }

        Returns
        -------
        dict — { form_id, web_url, edit_url, title }
        """
        form_id, web_url, edit_url = self._create_form_shell(title, description)

        for idx, q in enumerate(questions):
            try:
                self._add_question(form_id, q, idx)
            except MSFormsAgentError as exc:
                # Log and continue — partial form is better than no form
                print(f"[MSFormsAgent] Warning: failed to add question {idx + 1}: {exc}")

        return {
            "form_id":  form_id,
            "web_url":  web_url,
            "edit_url": edit_url,
            "title":    title,
        }

    # ── Private helpers ───────────────────────────────────────────────────

    def _create_form_shell(self, title: str, description: str):
        """POST /v1.0/forms — creates the empty form and returns (form_id, web_url, edit_url)."""
        payload = {"title": title}
        if description and description.strip():
            payload["description"] = description.strip()

        resp = requests.post(
            f"{GRAPH_BASE}/forms",
            json=payload,
            headers=self._headers,
            timeout=15,
        )
        self._raise_for_status(resp, "create form")

        data      = resp.json()
        form_id   = data.get("id", "")
        web_url   = data.get("webUrl", "")
        # editLink is the HR editing URL; may not always be present in v1.0
        edit_url  = data.get("editLink") or data.get("editUrl") or web_url

        if not form_id:
            raise MSFormsAgentError("Graph API returned a form without an ID.")

        print(f"[MSFormsAgent] Form created: id={form_id}")
        return form_id, web_url, edit_url

    def _add_question(self, form_id: str, question: dict, index: int):
        """POST /v1.0/forms/{formId}/questions — adds a single question."""
        q_type   = question.get("type", "text")
        q_text   = question.get("text", f"Question {index + 1}").strip()
        required = question.get("required", False)
        choices  = question.get("choices", [])

        graph_type = QUESTION_TYPE_MAP.get(q_type, "text")

        payload = {
            "questionType": graph_type,
            "displayName":  q_text,
            "isRequired":   required,
        }

        # Attach choices for choice-type questions
        if graph_type == "choice":
            if q_type == "yes_no":
                choices = ["Yes", "No"]
            option_list = [{"displayName": c.strip()} for c in choices if c.strip()]
            if option_list:
                payload["choices"]    = option_list
                payload["allowsMultipleSelection"] = (q_type == "multiple_choice")

        # Rating scale — default 1–5 stars
        if graph_type == "rating":
            payload["ratingLevel"] = 5

        resp = requests.post(
            f"{GRAPH_BASE}/forms/{form_id}/questions",
            json=payload,
            headers=self._headers,
            timeout=15,
        )
        self._raise_for_status(resp, f"add question '{q_text}'")
        print(f"[MSFormsAgent] Question {index + 1} added: {q_text}")

    @staticmethod
    def _raise_for_status(response: requests.Response, action: str):
        """Raise MSFormsAgentError with a human-readable message on non-2xx."""
        if response.ok:
            return
        status = response.status_code
        try:
            err_body = response.json()
            err_msg  = err_body.get("error", {}).get("message", response.text)
        except Exception:
            err_msg = response.text

        if status == 401:
            raise MSFormsAgentError(
                "Authentication failed. Your session may have expired — please refresh and try again."
            )
        if status == 403:
            raise MSFormsAgentError(
                "Permission denied. The 'Forms.ReadWrite' permission has not been granted yet. "
                "Please contact your Azure AD admin to enable this permission."
            )
        if status == 404:
            raise MSFormsAgentError(
                "Microsoft Forms endpoint not found. Ensure your tenant has Microsoft Forms enabled."
            )
        raise MSFormsAgentError(f"Graph API error while trying to {action} (HTTP {status}): {err_msg}")
