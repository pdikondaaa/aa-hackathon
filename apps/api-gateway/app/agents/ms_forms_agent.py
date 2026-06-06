"""
ms_forms_agent.py
=================
Creates Microsoft Forms on behalf of the authenticated user using the
Microsoft Forms REST API (forms.office.com/formapi).

Token:   Delegated token for resource https://forms.office.com,
         acquired via MSAL with scope "https://forms.office.com/Forms.ReadWrite".

Strategy:
  1. POST the full form (title + questions) in a single request.
  2. If the API ignores questions, PATCH the form with questions after creation.
  3. If PATCH also fails, return the form shell with the edit URL so the user
     can add questions manually.
"""

import urllib.parse
import uuid
import requests


# Integer type codes used by forms.office.com/formapi (internal OData API)
# 1=Text  2=Choice  3=Rating  4=Date
QUESTION_TYPE_MAP = {
    "text":            1,
    "single_choice":   2,
    "multiple_choice": 2,
    "rating":          3,
    "date":            4,
    "yes_no":          2,
}


class MSFormsAgentError(Exception):
    """Raised when the Forms REST API returns an unrecoverable error."""
    pass


class MSFormsAgent:
    """Creates Microsoft Forms via forms.office.com REST API."""

    def __init__(self, access_token: str, tenant_id: str, user_oid: str):
        if not access_token:
            raise MSFormsAgentError("A valid Forms access token is required.")
        if not tenant_id:
            raise MSFormsAgentError("tenant_id is required.")
        if not user_oid:
            raise MSFormsAgentError("user_oid is required.")

        self._base    = f"https://forms.office.com/formapi/api/{tenant_id}"
        self._user_id = user_oid
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }
        print(f"[MSFormsAgent] tenant={tenant_id} user={user_oid}")

    # ── Public entry point ────────────────────────────────────────────────

    def create_form(self, title: str, description: str, questions: list) -> dict:
        q_payloads = [self._build_question_payload(q, i) for i, q in enumerate(questions)]

        # Strategy 1: include questions in the initial POST
        form_id, web_url, edit_url = self._create_form(title, description, q_payloads)

        return {
            "form_id":  form_id,
            "web_url":  web_url,
            "edit_url": edit_url,
            "title":    title,
        }

    # ── Private helpers ───────────────────────────────────────────────────

    def _build_question_payload(self, question: dict, index: int) -> dict:
        q_type   = question.get("type", "text")
        q_text   = question.get("text", f"Question {index + 1}").strip()
        required = question.get("required", False)
        choices  = question.get("choices", [])

        q_id = "r" + uuid.uuid4().hex[:8]
        payload: dict = {
            "id":           q_id,
            "questionType": QUESTION_TYPE_MAP.get(q_type, 1),
            "title":        q_text,
            "isRequired":   required,
            "order":        (index + 1) * 1_000_000,
        }

        if q_type in ("single_choice", "multiple_choice", "yes_no"):
            if q_type == "yes_no":
                choices = ["Yes", "No"]
            payload["choices"] = [{"text": c.strip()} for c in choices if c.strip()]
            if q_type == "multiple_choice":
                payload["allowMultipleSelection"] = True

        if q_type == "rating":
            payload["ratingLevel"] = 5

        return payload

    def _create_form(self, title: str, description: str, questions: list):
        """POST to create the form shell, then PATCH questions onto it."""
        url = f"{self._base}/users/{self._user_id}/forms"
        payload: dict = {"title": title}
        if description and description.strip():
            payload["description"] = description.strip()

        print(f"[MSFormsAgent] POST {url}")
        resp = requests.post(url, json=payload, headers=self._headers, timeout=15)
        print(f"[MSFormsAgent] Create response {resp.status_code}: {resp.text[:600]}")
        self._raise_for_status(resp, "create form")

        data    = resp.json()
        form_id = data.get("id", "")
        if not form_id:
            raise MSFormsAgentError(f"Forms API returned no form ID. Response: {data}")

        web_url  = (data.get("webUrl")
                    or f"https://forms.office.com/Pages/ResponsePage.aspx?id={form_id}")
        edit_url = (data.get("editUrl") or data.get("editLink")
                    or f"https://forms.office.com/Pages/DesignPage.aspx#FormId={form_id}")

        print(f"[MSFormsAgent] Form created: id={form_id}")

        if questions:
            self._patch_questions(form_id, questions)

        return form_id, web_url, edit_url

    def _form_url(self, form_id: str) -> str:
        """OData key format: /users/{uid}/forms('{encoded_id}')"""
        encoded = urllib.parse.quote(form_id, safe="")
        return f"{self._base}/users/{self._user_id}/forms('{encoded}')"

    def _patch_questions(self, form_id: str, questions: list):
        """POST questions one-by-one via the OData navigation property."""
        q_url = f"{self._form_url(form_id)}/questions"
        all_ok = True
        for i, q in enumerate(questions):
            print(f"[MSFormsAgent] POST {q_url} (Q{i+1})")
            r = requests.post(q_url, json=q, headers=self._headers, timeout=15)
            print(f"[MSFormsAgent] Q{i+1} response {r.status_code}: {r.text[:300]}")
            if not r.ok:
                all_ok = False
                break
        if not all_ok:
            print("[MSFormsAgent] Questions could not be added — user can add via edit URL.")

    @staticmethod
    def _raise_for_status(response: requests.Response, action: str):
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
                "Authentication failed — session may have expired. Please sign in again."
            )
        if status == 403:
            raise MSFormsAgentError(
                "Permission denied. Ensure 'Forms.ReadWrite' consent is granted for your account."
            )
        raise MSFormsAgentError(
            f"Forms API error while trying to {action} (HTTP {status}): {err_msg}"
        )
