"""
PMO Allocation Agent.
Thin orchestration layer between the controller and allocation_service.
Returns structured data (not prose) — the UI renders it.

Role resolution is designation-based:
  email → employee_details.designation → allocation_role_map.role
"""
import os
import requests

from app.api.services.allocation_service import (
    get_board_data,
    get_employee_detail,
    get_user_profile,
    build_ask_context,
)
from app.utils.logging_config import get_logger

logger = get_logger("allocation_agent")


class AllocationAgent:

    def get_board(self, user_email: str) -> dict:
        """
        Returns the full board payload for the requesting user.
        Role is resolved from the user's designation in employee_details.

        Response shape:
          analytics view (executive / business_lead / functional_lead):
            { role, designation, view, allocation_rows, analytics }
          team view (team_lead):
            { role, designation, view, team_rows }
          self view (employee):
            { role, designation, view, my_allocation }
        """
        logger.info(f"AllocationAgent.get_board for {user_email}")
        return get_board_data(user_email)

    def get_employee(self, employee_id: str, requester_email: str) -> dict:
        """
        Return single employee detail.
        Sensitive fields (Effort %, Billability %, Completion Status) are null
        when the requester's designation-based role lacks column-level access.
        """
        logger.info(f"AllocationAgent.get_employee {employee_id} by {requester_email}")
        return get_employee_detail(employee_id, requester_email) or {}

    def get_role(self, email: str) -> dict:
        """
        Return the user's designation and derived allocation role.
        Designation is looked up from employee_details; role from allocation_role_map.

        Response: { email, designation, role }
        """
        profile = get_user_profile(email)
        return {
            "email":       email,
            "designation": profile["designation"],
            "role":        profile["role"],
        }


    def ask_aura(self, user_email: str, question: str) -> str:
        """
        Answer a natural-language question about allocation data scoped to the user's role.
        Uses Ollama (same model as email agent) with a context block built from live DB data.
        """
        logger.info(f"AllocationAgent.ask_aura from {user_email}: {question[:80]}")
        context_text, role = build_ask_context(user_email)

        system_prompt = (
            "You are Aura, an AI assistant for the PMO Allocation Board at Aligned Automation. "
            "You answer questions about resource allocation, project staffing, team composition, "
            "availability, and billability using ONLY the data provided in the context block below. "
            "Be concise, factual, and helpful. If the data does not contain enough information to "
            "answer, say so clearly. Never invent data.\n\n"
            "ALLOCATION CONTEXT:\n"
            "---\n"
            f"{context_text}\n"
            "---"
        )

        ollama_url   = os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434")
        ollama_model = os.environ.get("OLLAMA_MODEL", "gpt-oss")

        payload = {
            "model": ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": question.strip()},
            ],
            "stream": False,
        }
        try:
            resp = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=120)
            resp.raise_for_status()
            return resp.json()["message"]["content"]
        except requests.exceptions.ConnectionError:
            raise RuntimeError(f"Cannot reach LLM at {ollama_url}.")
        except requests.exceptions.Timeout:
            raise RuntimeError("LLM request timed out.")
        except (KeyError, requests.exceptions.HTTPError) as exc:
            raise RuntimeError(f"LLM error: {exc}") from exc


allocation_agent = AllocationAgent()
