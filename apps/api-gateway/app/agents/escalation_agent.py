import re
from typing import Optional

ESCALATION_MESSAGE = (
    "<p>Your request requires further review by the concerned team. "
    "Please provide a few additional details in the form below so the team can "
    "better understand your concern and take the appropriate action.</p>"
    "<p>Once submitted, the information will be reviewed and you may be contacted "
    "for any further clarification if required.</p>"
    '<p><a href="#escalation" style="display:inline-block;margin-top:6px;padding:10px 20px;'
    'background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">'
    "📋 Open Escalation Form</a></p>"
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
        return "<p>You have not submitted any escalations yet.</p>"

    items = []
    for esc in rows:
        created = str(esc.get("created_at", ""))[:10]
        etype = esc.get("escalation_type", "N/A").upper()
        priority = esc.get("priority", "N/A")
        subject = esc.get("subject", "N/A")
        items.append(
            f"<li><strong>{subject}</strong> — "
            f"<em>{etype}</em> | Priority: {priority} | {created}</li>"
        )
    return (
        f"<h3>Your Escalations ({total} total)</h3>"
        f"<ol>{''.join(items)}</ol>"
    )


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
            return "<p>Sorry, I could not retrieve your escalations at this time. Please try again.</p>"

    return ESCALATION_MESSAGE
