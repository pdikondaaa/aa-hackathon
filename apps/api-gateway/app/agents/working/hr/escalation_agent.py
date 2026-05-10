"""
HR Escalation Agent — handles sensitive or complex HR cases that cannot
be resolved through standard policy lookup and require human HR intervention.
"""
from typing import Optional


ESCALATION_TRIGGERS = [
    'harassment', 'discrimination', 'misconduct', 'termination', 'wrongful',
    'complaint', 'grievance', 'conflict', 'legal', 'lawsuit', 'hostile',
    'retaliation', 'whistleblower', 'investigation', 'suspension', 'appeal',
]

ESCALATION_LEVELS = {
    'low': ['complaint', 'grievance', 'conflict'],
    'medium': ['harassment', 'discrimination', 'misconduct', 'investigation'],
    'high': ['termination', 'wrongful', 'legal', 'lawsuit', 'retaliation', 'suspension'],
}

HR_CONTACTS = {
    'low': {
        'name': 'HR Business Partner',
        'email': 'hr-bp@company.com',
        'phone': '+1-800-HR-HELP',
    },
    'medium': {
        'name': 'HR Manager',
        'email': 'hr-manager@company.com',
        'phone': '+1-800-HR-MGMT',
    },
    'high': {
        'name': 'Chief HR Officer',
        'email': 'chro@company.com',
        'phone': '+1-800-HR-EXEC',
    },
}


class HREscalationAgent:
    def _detect_level(self, query: str) -> str:
        query_lower = query.lower()
        for level in ('high', 'medium', 'low'):
            if any(trigger in query_lower for trigger in ESCALATION_LEVELS[level]):
                return level
        return 'low'

    def should_escalate(self, query: str) -> bool:
        query_lower = query.lower()
        return any(trigger in query_lower for trigger in ESCALATION_TRIGGERS)

    def process_query(self, query: str, context: Optional[str] = None) -> str:
        level = self._detect_level(query)
        contact = HR_CONTACTS[level]

        response = f"⚠️ **HR Escalation Required** (Priority: {level.upper()})\n\n"
        response += "This matter requires direct HR intervention and cannot be resolved through automated policy lookup.\n\n"

        if context:
            response += f"**Context:** {context}\n\n"

        response += "**Next Steps:**\n"
        response += f"1. Your case has been flagged for **{contact['name']}**\n"
        response += f"2. Contact: {contact['email']} | {contact['phone']}\n"
        response += "3. Please document the incident with dates, times, and witnesses\n"
        response += "4. Keep all related communications and evidence\n"
        response += "5. You will receive a response within 2 business days\n\n"
        response += "**Confidentiality:** All escalated HR matters are handled with strict confidentiality.\n"
        response += "\n*If this is an urgent safety matter, please contact security or emergency services immediately.*"

        return response


hr_escalation_agent_instance = HREscalationAgent()


def hr_escalation_agent(query: str, context: Optional[str] = None) -> str:
    return hr_escalation_agent_instance.process_query(query, context)
