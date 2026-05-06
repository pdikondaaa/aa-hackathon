import os
import re
from typing import Dict, List

class HRAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'hr_policies.txt')
        self.policies = self._load_policies()

    def _load_policies(self) -> str:
        """Load HR policies from file."""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return "HR policies file not found."

    def _find_relevant_info(self, query: str) -> List[str]:
        """Find relevant information based on query keywords."""
        query_lower = query.lower()
        lines = self.policies.split('\n')
        relevant_lines = []

        # Keywords related to HR topics
        hr_keywords = {
            'leave': ['leave', 'vacation', 'holiday', 'absence'],
            'sick': ['sick', 'medical', 'illness', 'health'],
            'maternity': ['maternity', 'pregnancy', 'birth', 'parental'],
            'paternity': ['paternity', 'father', 'parental'],
            'benefits': ['benefit', 'insurance', 'health', 'dental', 'retirement'],
            'performance': ['performance', 'review', 'appraisal', 'evaluation'],
            'salary': ['salary', 'pay', 'compensation', 'wage'],
            'hiring': ['hire', 'recruit', 'interview', 'job'],
            'training': ['training', 'development', 'learning', 'course']
        }

        # Find matching keywords
        matched_categories = []
        for category, keywords in hr_keywords.items():
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
            if in_relevant_section or any(keyword in line_lower for cat in matched_categories for keyword in hr_keywords[cat]):
                if line.strip():  # Skip empty lines
                    relevant_lines.append(line)

        return relevant_lines[:10]  # Limit to top 10 relevant lines

    def process_query(self, query: str) -> str:
        """Process HR-related query and return relevant information."""
        relevant_info = self._find_relevant_info(query)

        if not relevant_info:
            return f"I couldn't find specific HR information for your query: '{query}'. Please contact HR directly at hr@company.com for assistance."

        # Format the response
        response = f"Based on HR policies, here's information related to your query '{query}':\n\n"
        response += "\n".join(f"• {line}" for line in relevant_info)
        response += "\n\nFor more detailed information or specific cases, please contact HR at hr@company.com or call +1-800-HR-HELP."

        return response

# Global instance
hr_agent_instance = HRAgent()

def hr_agent(query: str) -> str:
    """HR Agent entry point."""
    return hr_agent_instance.process_query(query)
