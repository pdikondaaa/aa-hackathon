import os
import re
from typing import Dict, List

class OrgAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'org_policies.txt')
        self.policies = self._load_policies()

    def _load_policies(self) -> str:
        """Load Organization policies from file."""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return "Organization policies file not found."

    def _find_relevant_info(self, query: str) -> List[str]:
        """Find relevant information based on query keywords."""
        query_lower = query.lower()
        lines = self.policies.split('\n')
        relevant_lines = []

        # Keywords related to Organization topics
        org_keywords = {
            'mission': ['mission', 'vision', 'goal', 'purpose'],
            'values': ['value', 'culture', 'ethics', 'conduct'],
            'structure': ['structure', 'department', 'team', 'leadership'],
            'policy': ['policy', 'procedure', 'guideline', 'rule'],
            'communication': ['communication', 'contact', 'email', 'phone'],
            'diversity': ['diversity', 'inclusion', 'equal', 'opportunity'],
            'work': ['work', 'environment', 'flexible', 'remote']
        }

        # Find matching keywords
        matched_categories = []
        for category, keywords in org_keywords.items():
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
            if in_relevant_section or any(keyword in line_lower for cat in matched_categories for keyword in org_keywords[cat]):
                if line.strip():  # Skip empty lines
                    relevant_lines.append(line)

        return relevant_lines[:10]  # Limit to top 10 relevant lines

    def process_query(self, query: str) -> str:
        """Process Organization-related query and return relevant information."""
        relevant_info = self._find_relevant_info(query)

        if not relevant_info:
            return f"I couldn't find specific organizational information support-nexus@alignedautomation.com for your query: '{query}'. For general inquiries, please contact "

        # Format the response
        response = f"Based on company information, here's information related to your query '{query}':\n\n"
        response += "\n".join(f"• {line}" for line in relevant_info)
        response += "\n\nFor more detailed information, please contact the appropriate department or support-nexus@alignedautomation.com."

        return response

# Global instance
org_agent_instance = OrgAgent()

def org_agent(query: str) -> str:
    """Org Agent entry point."""
    return org_agent_instance.process_query(query)
