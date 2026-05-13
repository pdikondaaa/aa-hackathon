"""
IT Escalation Agent — handles critical IT issues that require L2/L3 support
or security-team intervention beyond standard helpdesk resolution.
"""
from typing import Optional


ESCALATION_TRIGGERS = [
    'data breach', 'hacked', 'ransomware', 'virus', 'malware', 'phishing',
    'server down', 'outage', 'production down', 'critical failure', 'data loss',
    'security incident', 'unauthorized access', 'account compromised',
    'entire team', 'all employees', 'company-wide',
]

ESCALATION_LEVELS = {
    'security': ['data breach', 'hacked', 'ransomware', 'virus', 'malware', 'phishing',
                 'security incident', 'unauthorized access', 'account compromised'],
    'critical': ['server down', 'outage', 'production down', 'critical failure', 'data loss'],
    'high': ['entire team', 'all employees', 'company-wide'],
}

IT_CONTACTS = {
    'security': {
        'team': 'IT Security Team',
        'email': 'security@company.com',
        'phone': '+1-800-IT-SEC',
        'sla': '30 minutes',
    },
    'critical': {
        'team': 'IT Infrastructure / L3 Support',
        'email': 'infra-oncall@company.com',
        'phone': '+1-800-IT-CRIT',
        'sla': '1 hour',
    },
    'high': {
        'team': 'IT L2 Support',
        'email': 'it-l2@company.com',
        'phone': '+1-800-IT-L2',
        'sla': '4 hours',
    },
}


class ITEscalationAgent:
    def _detect_level(self, query: str) -> str:
        query_lower = query.lower()
        for level in ('security', 'critical', 'high'):
            if any(trigger in query_lower for trigger in ESCALATION_LEVELS[level]):
                return level
        return 'high'

    def should_escalate(self, query: str) -> bool:
        query_lower = query.lower()
        return any(trigger in query_lower for trigger in ESCALATION_TRIGGERS)

    def process_query(self, query: str, context: Optional[str] = None) -> str:
        level = self._detect_level(query)
        contact = IT_CONTACTS[level]

        response = f"🚨 **IT Escalation Required** (Priority: {level.upper()})\n\n"
        response += "This issue requires escalated IT support beyond standard helpdesk.\n\n"

        if context:
            response += f"**Context:** {context}\n\n"

        response += "**Immediate Actions:**\n"
        if level == 'security':
            response += "1. **DO NOT** attempt to fix the issue yourself — this could destroy evidence\n"
            response += "2. Disconnect the affected device from the network if safe to do so\n"
            response += "3. Do not delete any files or emails related to the incident\n"
        response += f"4. Contact **{contact['team']}** immediately\n"
        response += f"   📧 {contact['email']} | 📞 {contact['phone']}\n"
        response += f"5. Expected response time: **{contact['sla']}**\n"
        response += "6. Provide: affected systems, error messages, timeline of events, user count impacted\n\n"
        response += "**Ticket:** A high-priority ticket will be auto-generated and assigned to the escalation team."

        return response


it_escalation_agent_instance = ITEscalationAgent()


def it_escalation_agent(query: str, context: Optional[str] = None) -> str:
    return it_escalation_agent_instance.process_query(query, context)
