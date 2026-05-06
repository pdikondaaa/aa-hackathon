from app.agents.router import router
from app.agents.hr_agent import hr_agent
from app.agents.admin_agent import admin_agent
from app.agents.it_agent import it_agent
from app.agents.org_agent import org_agent
from typing import Dict, Any

class SupervisorAgent:
    def __init__(self):
        self.agents = {
            'hr': hr_agent,
            'admin': admin_agent,
            'it': it_agent,
            'org': org_agent
        }

        self.agent_descriptions = {
            'hr': 'Human Resources - handles leave policies, employee benefits, performance reviews, and HR procedures',
            'admin': 'Administration - manages travel, expenses, office supplies, events, and administrative procedures',
            'it': 'Information Technology - handles technical support, software/hardware issues, security, and IT policies',
            'org': 'Organization - provides company information, policies, structure, and general organizational details'
        }

    def _analyze_query_complexity(self, query: str) -> Dict[str, Any]:
        """Analyze query to determine if it needs multiple agents or escalation."""
        query_lower = query.lower()

        # Check for multi-department queries
        departments_mentioned = []
        if any(word in query_lower for word in ['hr', 'human resources', 'leave', 'benefits', 'salary']):
            departments_mentioned.append('hr')
        if any(word in query_lower for word in ['travel', 'expense', 'office', 'admin']):
            departments_mentioned.append('admin')
        if any(word in query_lower for word in ['computer', 'software', 'network', 'it', 'technical']):
            departments_mentioned.append('it')

        # Check for urgent/escalation keywords
        urgent_keywords = ['urgent', 'emergency', 'immediately', 'asap', 'critical', 'broken']
        is_urgent = any(word in query_lower for word in urgent_keywords)

        # Check for complex queries
        complex_indicators = ['and', 'also', 'as well as', 'plus', 'multiple', 'both']
        is_complex = any(indicator in query_lower for indicator in complex_indicators)

        return {
            'departments_mentioned': departments_mentioned,
            'is_urgent': is_urgent,
            'is_complex': is_complex,
            'needs_multiple_agents': len(departments_mentioned) > 1 or is_complex
        }

    def _generate_supervisor_response(self, query: str, agent: str, confidence: float, analysis: Dict[str, Any]) -> str:
        """Generate supervisor-level response with context."""
        agent_name = agent.upper()
        description = self.agent_descriptions[agent]

        response = f"🤖 **Supervisor Agent Analysis**\n\n"
        response += f"Query: '{query}'\n"
        response += f"Routed to: {agent_name} Department\n"
        response += f"Confidence: {confidence:.2%}\n"
        response += f"Department: {description}\n\n"

        if analysis['is_urgent']:
            response += "⚠️ **URGENT REQUEST DETECTED** - This will be prioritized.\n\n"

        if analysis['needs_multiple_agents']:
            response += "📋 **MULTI-DEPARTMENT QUERY** - This may involve coordination between departments.\n\n"

        response += "---\n\n"
        return response

    def process_query(self, query: str) -> str:
        """Process query through supervisor agent coordination."""
        # Route the query
        agent, confidence = router.route_query(query)

        # Analyze query complexity
        analysis = self._analyze_query_complexity(query)

        # Get response from appropriate agent
        agent_response = self.agents[agent](query)

        # Generate supervisor context
        supervisor_context = self._generate_supervisor_response(query, agent, confidence, analysis)

        # Combine responses
        final_response = supervisor_context + agent_response

        # Add follow-up information for complex queries
        if analysis['needs_multiple_agents']:
            final_response += "\n\n💡 **Note:** If this query involves multiple departments, please provide more specific details or contact the relevant department directly."

        if analysis['is_urgent']:
            final_response += "\n\n🚨 **Urgent requests** are prioritized. If you need immediate assistance, please call the emergency hotline."

        return final_response

# Global supervisor instance
supervisor = SupervisorAgent()

def run_assistant(query: str) -> str:
    """Main entry point - supervisor agent coordinates all requests."""
    return supervisor.process_query(query)
