"""
PMO Escalation Agent — handles project-level issues that require PMO leadership
intervention: schedule slippages, budget overruns, resource conflicts, scope changes.
"""
from typing import Optional


ESCALATION_TRIGGERS = [
    'project at risk', 'behind schedule', 'delayed', 'milestone missed',
    'budget overrun', 'scope creep', 'resource conflict', 'blocked',
    'client escalation', 'stakeholder concern', 'sponsor escalation',
    'project on hold', 'cancel project', 'project failure',
    'critical dependency', 'vendor delay', 'change request rejected',
]

ESCALATION_LEVELS = {
    'pmo_manager': ['behind schedule', 'delayed', 'milestone missed', 'scope creep',
                    'resource conflict', 'blocked', 'critical dependency'],
    'program_director': ['budget overrun', 'client escalation', 'stakeholder concern',
                         'project at risk', 'change request rejected', 'vendor delay'],
    'executive': ['sponsor escalation', 'project on hold', 'cancel project',
                  'project failure'],
}

PMO_CONTACTS = {
    'pmo_manager': {
        'role': 'PMO Manager',
        'email': 'pmo-manager@company.com',
        'phone': '+1-800-PMO-MGMT',
        'sla': '4 business hours',
    },
    'program_director': {
        'role': 'Program Director',
        'email': 'program-director@company.com',
        'phone': '+1-800-PMO-DIR',
        'sla': '2 business hours',
    },
    'executive': {
        'role': 'Executive Sponsor / CTO',
        'email': 'exec-pmo@company.com',
        'phone': '+1-800-PMO-EXEC',
        'sla': '1 business hour',
    },
}


class PMOEscalationAgent:
    def _detect_level(self, query: str) -> str:
        query_lower = query.lower()
        for level in ('executive', 'program_director', 'pmo_manager'):
            if any(trigger in query_lower for trigger in ESCALATION_LEVELS[level]):
                return level
        return 'pmo_manager'

    def should_escalate(self, query: str) -> bool:
        query_lower = query.lower()
        return any(trigger in query_lower for trigger in ESCALATION_TRIGGERS)

    def process_query(self, query: str, project_id: Optional[str] = None,
                      context: Optional[str] = None) -> str:
        level = self._detect_level(query)
        contact = PMO_CONTACTS[level]

        response = f"🔴 **PMO Escalation Required** (Escalated to: {contact['role']})\n\n"
        if project_id:
            response += f"**Project ID:** {project_id}\n\n"
        if context:
            response += f"**Context:** {context}\n\n"

        response += "**Escalation Steps:**\n"
        response += f"1. Contact **{contact['role']}**: {contact['email']} | {contact['phone']}\n"
        response += f"2. Expected response time: **{contact['sla']}**\n"
        response += "3. Prepare an escalation summary including:\n"
        response += "   • Project name and ID\n"
        response += "   • Issue description and impact (cost, time, scope)\n"
        response += "   • Actions already taken\n"
        response += "   • Proposed resolution or decision needed\n"
        response += "4. Update the project risk register on the PMO Portal\n"
        response += "5. Notify all key stakeholders via the standard escalation email template\n\n"
        response += "**PMO Portal:** pmo.company.com | **Escalation Template:** pmo.company.com/templates/escalation"

        return response


pmo_escalation_agent_instance = PMOEscalationAgent()


def pmo_escalation_agent(query: str, project_id: Optional[str] = None,
                          context: Optional[str] = None) -> str:
    return pmo_escalation_agent_instance.process_query(query, project_id, context)
