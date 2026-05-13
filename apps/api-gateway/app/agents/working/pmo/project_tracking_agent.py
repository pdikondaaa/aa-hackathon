"""
PMO Project Tracking Agent — handles project status queries, milestone updates,
resource allocation checks, and delivery timeline questions.
"""
from typing import List, Optional


TRACKING_KEYWORDS = {
    'status': ['project status', 'status update', 'how is the project', 'project progress',
               'update on', 'where are we', 'current status'],
    'milestone': ['milestone', 'deliverable', 'deadline', 'due date', 'when is',
                  'completion date', 'go-live', 'release date'],
    'resource': ['resource', 'team member', 'allocated', 'utilization', 'capacity',
                 'bandwidth', 'who is working', 'staffing'],
    'risk': ['risk', 'issue', 'blocker', 'impediment', 'concern', 'problem',
             'challenge', 'dependency'],
    'budget': ['budget', 'cost', 'spend', 'burn rate', 'forecasted cost',
               'remaining budget', 'over budget', 'cost variance'],
    'report': ['report', 'dashboard', 'pmo report', 'weekly report', 'monthly report',
               'status report', 'project report', 'executive summary'],
    'change': ['change request', 'scope change', 'change order', 'change management',
               'baseline change', 'requirement change'],
}

TRACKING_GUIDES = {
    'status': (
        "**Project Status Check:**\n"
        "• Live dashboards: pmo.company.com/dashboard\n"
        "• Filter by project name, ID, portfolio, or project manager\n"
        "• RAG status: 🟢 Green (on track) | 🟡 Amber (at risk) | 🔴 Red (critical)\n"
        "• Status is updated weekly by the Project Manager every Monday\n"
        "• For a specific project, provide the Project ID to your PM or PMO team"
    ),
    'milestone': (
        "**Milestone & Deliverable Tracking:**\n"
        "• View milestones: pmo.company.com/milestones\n"
        "• Milestone changes must be approved via Change Request process\n"
        "• Missed milestones must be reported to PMO within 24 hours\n"
        "• Baseline dates are locked after project kick-off\n"
        "• Contact your Project Manager for milestone-specific queries"
    ),
    'resource': (
        "**Resource Tracking:**\n"
        "• Resource allocation: pmo.company.com/resources\n"
        "• New resource requests: Submit via PMO Portal → Resource Management\n"
        "• Utilization reports: Available weekly (auto-generated on Fridays)\n"
        "• Over-allocation alerts are sent to PMs automatically\n"
        "• Resource conflicts escalate to the PMO Manager"
    ),
    'risk': (
        "**Risk & Issue Management:**\n"
        "• Risk register: pmo.company.com/risks\n"
        "• Log new risks: PMO Portal → Risk Register → Add New\n"
        "• Risk ratings: Critical / High / Medium / Low\n"
        "• All risks must have an owner, mitigation plan, and review date\n"
        "• Critical risks are auto-escalated to PMO Manager within 1 hour"
    ),
    'budget': (
        "**Budget Tracking:**\n"
        "• Budget dashboard: pmo.company.com/budget\n"
        "• Budget variances >10% must be reported to the Program Director\n"
        "• Monthly budget reviews are held with Finance and the PM\n"
        "• Budget change requests require Finance + Sponsor approval\n"
        "• Burn rate alerts are sent when 80% of budget is consumed"
    ),
    'report': (
        "**PMO Reports:**\n"
        "• Weekly status reports: Auto-sent to stakeholders every Friday\n"
        "• Monthly portfolio dashboard: Available on pmo.company.com/reports\n"
        "• Executive summaries: Prepared by PMO team on the 1st of each month\n"
        "• Custom reports: Request from pmo@company.com with a 2-day lead time\n"
        "• Historical reports: Archived on the PMO SharePoint"
    ),
    'change': (
        "**Change Request Process:**\n"
        "1. Submit a Change Request on PMO Portal: pmo.company.com/change\n"
        "2. Document: scope/timeline/cost impact, reason, and alternatives\n"
        "3. Change Control Board (CCB) reviews within 3 business days\n"
        "4. Approved changes update the project baseline automatically\n"
        "5. Rejected changes can be appealed to the Program Director"
    ),
}


class ProjectTrackingAgent:
    def _match_categories(self, query: str) -> List[str]:
        query_lower = query.lower()
        return [
            cat for cat, phrases in TRACKING_KEYWORDS.items()
            if any(phrase in query_lower for phrase in phrases)
        ]

    def process_query(self, query: str, project_id: Optional[str] = None) -> str:
        categories = self._match_categories(query)

        if not categories:
            return (
                f"I couldn't find specific project tracking information for: '{query}'.\n\n"
                "For project tracking queries:\n"
                "• PMO Portal: pmo.company.com\n"
                "• PMO Team: pmo@company.com | +1-800-PMO-HELP\n"
                "• Contact your Project Manager for project-specific details"
            )

        header = "**PMO Project Tracking Information**"
        if project_id:
            header += f" — Project: {project_id}"
        response = header + "\n\n"

        for cat in categories:
            response += TRACKING_GUIDES[cat] + "\n\n"

        response += "---\n"
        response += "📊 **PMO Portal:** pmo.company.com | **PMO Team:** pmo@company.com | +1-800-PMO-HELP"
        return response


project_tracking_agent_instance = ProjectTrackingAgent()


def project_tracking_agent(query: str, project_id: Optional[str] = None) -> str:
    return project_tracking_agent_instance.process_query(query, project_id)
