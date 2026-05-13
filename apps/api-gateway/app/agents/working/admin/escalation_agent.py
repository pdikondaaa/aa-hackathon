"""
Admin Escalation Agent — handles administrative matters that exceed standard
policy limits or require management approval (large expenses, vendor disputes, etc.)
"""
from typing import Optional


ESCALATION_TRIGGERS = [
    'exceeds limit', 'over budget', 'emergency purchase', 'urgent procurement',
    'vendor dispute', 'invoice dispute', 'refund', 'contract issue',
    'policy exception', 'special approval', 'large expense', 'out of policy',
    'facility emergency', 'security concern', 'building issue',
]

ESCALATION_LEVELS = {
    'finance': ['exceeds limit', 'over budget', 'large expense', 'out of policy',
                'invoice dispute', 'refund', 'contract issue'],
    'operations': ['emergency purchase', 'urgent procurement', 'vendor dispute', 'special approval'],
    'facilities': ['facility emergency', 'building issue', 'security concern'],
}

ADMIN_CONTACTS = {
    'finance': {
        'team': 'Finance & Procurement',
        'email': 'finance@company.com',
        'phone': '+1-800-FIN-HELP',
        'sla': '2 business days',
    },
    'operations': {
        'team': 'Operations Manager',
        'email': 'ops-manager@company.com',
        'phone': '+1-800-OPS-HELP',
        'sla': '1 business day',
    },
    'facilities': {
        'team': 'Facilities Management',
        'email': 'facilities@company.com',
        'phone': '+1-800-FAC-HELP',
        'sla': '4 hours (emergencies: immediate)',
    },
}


class AdminEscalationAgent:
    def _detect_level(self, query: str) -> str:
        query_lower = query.lower()
        for level in ('facilities', 'finance', 'operations'):
            if any(trigger in query_lower for trigger in ESCALATION_LEVELS[level]):
                return level
        return 'operations'

    def should_escalate(self, query: str) -> bool:
        query_lower = query.lower()
        return any(trigger in query_lower for trigger in ESCALATION_TRIGGERS)

    def process_query(self, query: str, context: Optional[str] = None) -> str:
        level = self._detect_level(query)
        contact = ADMIN_CONTACTS[level]

        response = f"📋 **Admin Escalation Required** (Team: {contact['team']})\n\n"
        response += "This administrative matter requires escalated approval beyond standard policy.\n\n"

        if context:
            response += f"**Context:** {context}\n\n"

        response += "**Required Steps:**\n"
        response += f"1. Contact **{contact['team']}**: {contact['email']} | {contact['phone']}\n"
        response += f"2. Expected response: **{contact['sla']}**\n"
        response += "3. Provide supporting documents (quotes, invoices, incident reports)\n"
        response += "4. Get written approval before proceeding with the action\n"
        response += "5. Keep records of all approvals for audit purposes\n\n"
        response += "**Policy Reminder:** All exceptions require documented justification and management sign-off."

        return response


admin_escalation_agent_instance = AdminEscalationAgent()


def admin_escalation_agent(query: str, context: Optional[str] = None) -> str:
    return admin_escalation_agent_instance.process_query(query, context)
