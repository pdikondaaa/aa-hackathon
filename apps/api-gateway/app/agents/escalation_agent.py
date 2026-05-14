import re
from typing import Optional

ESCALATION_MESSAGE = (
    "Your request requires further review by the concerned team. Please provide a few "
    "additional details in the form below so the team can better understand your concern"
    "and take the appropriate action.\n\n"
    "Once submitted, the information will be reviewed and you may be contacted "
    "for any further clarification if required.\n\n"
    "[📋 Open Escalation Form](#escalation)"
)

_LIST_PATTERNS = [
    re.compile(r"\bmy\s+escalation", re.IGNORECASE),
    re.compile(r"\bescalations?\s+(?:list|history|status)", re.IGNORECASE),
    re.compile(r"\b(?:show|list|get|view|display|give\s+me)\b.*\bescalation", re.IGNORECASE),
    re.compile(r"\bescalation.*\bsubmitted\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+escalation", re.IGNORECASE),
    re.compile(r"\bi\s+submitted.*\bescalation", re.IGNORECASE),
]


def _is_list_request(query: str) -> bool:
    return any(p.search(query) for p in _LIST_PATTERNS)


def _format_escalations(result: dict) -> str:
    rows = result.get("data", [])
    total = result.get("total", 0)

    if not rows:
        return "You have not submitted any escalations yet."

    lines = [f"**Your Escalations** ({total} total)"]
    for i, esc in enumerate(rows, 1):
        created = str(esc.get("created_at", ""))[:10]
        etype = esc.get("escalation_type", "N/A").upper()
        priority = esc.get("priority", "N/A")
        subject = esc.get("subject", "N/A")
        lines.append(f"{i}. **{subject}** — {etype} | {priority} | {created}")
    return "\n".join(lines)


def escalation_agent(query: str = "", user_id: Optional[str] = None) -> str:
    if user_id and _is_list_request(query):
        try:
            from app.api.services.escalations_service import EscalationsService
            result = EscalationsService().list_my_escalations(
                user_id=user_id, page=1, limit=20, status=None
            )
            return _format_escalations(result)
        except Exception as exc:
            print(f"[escalation_agent] list error: {exc}")
            return "Sorry, I could not retrieve your escalations at this time. Please try again."

    return ESCALATION_MESSAGE
