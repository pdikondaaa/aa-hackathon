import os
import re
from typing import Dict, List

class ITAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'it_policies.txt')
        self.policies = self._load_policies()

    def _load_policies(self) -> str:
        """Load IT policies from file."""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return "IT policies file not found."

    def _find_relevant_info(self, query: str) -> List[str]:
        """Find relevant information based on query keywords."""
        query_lower = query.lower()
        lines = self.policies.split('\n')
        relevant_lines = []

        # Keywords related to IT topics
        it_keywords = {
            'access': ['access', 'login', 'password', 'vpn', 'remote'],
            'email': ['email', 'mail', 'outlook', 'communication'],
            'software': ['software', 'install', 'application', 'program'],
            'security': ['security', 'password', 'encryption', 'protection'],
            'device': ['device', 'computer', 'laptop', 'phone', 'mobile'],
            'network': ['network', 'internet', 'wifi', 'connection'],
            'support': ['support', 'help', 'issue', 'problem', 'fix'],
            'hardware': ['hardware', 'printer', 'monitor', 'keyboard']
        }

        # Find matching keywords
        matched_categories = []
        for category, keywords in it_keywords.items():
            if any(keyword in query_lower for keyword in keywords):
                matched_categories.append(category)

        # Extract relevant sections
        current_section = ""
        in_relevant_section = False

        for line in lines:
            line_lower = line.lower().strip()

            # Check if this is a section header
            if line.startswith('##') or line.startswith('###'):
                current_section = line_lower.replace('#', '').strip()
                in_relevant_section = any(cat in current_section.lower() for cat in matched_categories)

            # If we're in a relevant section or the line contains matched keywords
            if in_relevant_section or any(keyword in line_lower for cat in matched_categories for keyword in it_keywords[cat]):
                if line.strip():  # Skip empty lines
                    relevant_lines.append(line)

        return relevant_lines[:10]  # Limit to top 10 relevant lines

    def process_query(self, query: str) -> str:
        """Process IT-related query and return relevant information."""
        relevant_info = self._find_relevant_info(query)

        if not relevant_info:
            return f"I couldn't find specific IT information for your query: '{query}'. Please contact IT Support at helpdesk@company.com or call +1-800-IT-HELP."

        # Format the response
        response = f"Based on IT policies, here's information related to your query '{query}':\n\n"
        response += "\n".join(f"• {line}" for line in relevant_info)
        response += "\n\nFor technical assistance or if you need immediate help, contact IT Support at helpdesk@company.com or call +1-800-IT-HELP."

        return response

# Global instance
it_agent_instance = ITAgent()

def it_agent(query: str) -> str:
    """IT Agent entry point."""
    return it_agent_instance.process_query(query)
