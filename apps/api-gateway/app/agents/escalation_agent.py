from typing import Optional

ESCALATION_MESSAGE = (
    "Your concern has been noted and this escalation is being sent to the appropriate team "
    "for immediate review and follow-up. We take all escalations seriously and will ensure your "
    "matter is handled with the urgency and care it deserves.\n\n"
    "Please fill out the form below to provide additional details or submit further queries and complaints:\n"
    "https://www.google.com"
)


def escalation_agent(_query: str, _context: Optional[str] = None) -> str:
    return ESCALATION_MESSAGE
