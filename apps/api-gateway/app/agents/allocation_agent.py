"""
PMO Allocation Agent.
Thin orchestration layer between the controller and allocation_service.
Returns structured data (not prose) — the UI renders it.

Role resolution is designation-based:
  email → employee_details.designation → allocation_role_map.role
"""
import os

from app.api.services.allocation_service import (
    get_board_data,
    get_employee_detail,
    get_user_profile,
    get_available_months,
    build_ask_context,
    has_direct_reports,
    get_my_team_allocation,
)
from app.utils.logging_config import get_logger

logger = get_logger("allocation_agent")


class AllocationAgent:

    def get_board(self, user_email: str, date_from: str = None, date_to: str = None) -> dict:
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
        return get_board_data(user_email, date_from=date_from, date_to=date_to)

    def get_filter_options(self) -> dict:
        """Returns available months derived from actual allocation data."""
        return {"available_months": get_available_months()}

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
            "email":              email,
            "designation":        profile["designation"],
            "role":               profile["role"],
            "has_direct_reports": has_direct_reports(email),
        }

    def get_my_team(self, email: str) -> dict:
        """
        Return the requesting user's direct reports' allocation rows, unmasked.
        Direct reports are resolved by an exact email match on
        people.vb_employees.ReportingManagerEmail — a real reporting-line
        check, independent of designation/role bucket. Empty team_rows if
        the user has no direct reports.
        """
        logger.info(f"AllocationAgent.get_my_team for {email}")
        return {"team_rows": get_my_team_allocation(email)}

    def ask_aura(self, user_email: str, question: str) -> str:
        """
        Answer a natural-language question about allocation data scoped to the user's role.
        Uses the configured LLM provider (Claude, Groq, or Ollama) via create_llm().
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

        try:
            from app.agents.working.config import LLMConfig, create_llm
            cfg = LLMConfig()
            llm = create_llm(temperature=0.1, max_tokens=512, cfg=cfg)
            result = llm.invoke([
                ("system", system_prompt),
                ("human", question.strip()),
            ])
            return result.content if hasattr(result, "content") else str(result)
        except Exception as exc:
            raise RuntimeError(f"LLM error: {exc}") from exc


allocation_agent = AllocationAgent()
