import re
from typing import Dict, List, Tuple

class QueryRouter:
    def __init__(self):
        # Define routing rules with priorities
        self.routing_rules = {
            'hr': {
                'keywords': [
                    'leave', 'vacation', 'holiday', 'sick', 'medical', 'maternity', 'paternity',
                    'hr', 'human resources', 'employee', 'benefits', 'salary', 'pay',
                    'performance', 'review', 'training', 'recruitment', 'hiring'
                ],
                'patterns': [
                    r'\b(annual|casual|sick|maternity|paternity)\s+leave\b',
                    r'\b(hr|human resources)\b',
                    r'\b(employee|staff)\s+(benefits|policies)\b'
                ],
                'priority': 1
            },
            'it': {
                'keywords': [
                    'computer', 'laptop', 'software', 'hardware', 'network', 'internet',
                    'email', 'vpn', 'access', 'password', 'login', 'security',
                    'printer', 'wifi', 'technical', 'support', 'it', 'help'
                ],
                'patterns': [
                    r'\b(it|tech|technical)\s+support\b',
                    r'\b(vpn|remote)\s+access\b',
                    r'\b(password|login)\s+(reset|issue)\b'
                ],
                'priority': 1
            },
            'admin': {
                'keywords': [
                    'travel', 'expense', 'reimbursement', 'booking', 'hotel', 'flight',
                    'office', 'supplies', 'equipment', 'facility', 'event', 'meeting',
                    'purchase', 'invoice', 'payment', 'vendor', 'administration'
                ],
                'patterns': [
                    r'\b(travel|business trip)\b',
                    r'\b(expense\s+report|reimbursement)\b',
                    r'\b(office|meeting)\s+(supplies|room)\b'
                ],
                'priority': 1
            },
            'org': {
                'keywords': [
                    'company', 'organization', 'mission', 'vision', 'values', 'culture',
                    'structure', 'department', 'leadership', 'policy', 'procedure',
                    'communication', 'contact', 'diversity', 'inclusion'
                ],
                'patterns': [
                    r'\b(company|organization)\s+(mission|vision|values)\b',
                    r'\b(organizational|company)\s+structure\b',
                    r'\b(contact|communication)\s+information\b'
                ],
                'priority': 2  # Lower priority - fallback
            }
        }

    def _calculate_confidence(self, query: str, agent: str) -> float:
        """Calculate confidence score for routing to an agent."""
        query_lower = query.lower()
        rules = self.routing_rules[agent]

        score = 0.0
        total_weight = 0.0

        # Keyword matching (weight: 0.6)
        keyword_matches = 0
        for keyword in rules['keywords']:
            if keyword in query_lower:
                keyword_matches += 1

        if rules['keywords']:
            keyword_score = min(1.0, keyword_matches / 3.0)  # Cap at 3 matches for high confidence
            score += 0.6 * keyword_score
            total_weight += 0.6

        # Pattern matching (weight: 0.4)
        pattern_matches = 0
        for pattern in rules['patterns']:
            if re.search(pattern, query_lower, re.IGNORECASE):
                pattern_matches += 1

        if rules['patterns']:
            pattern_score = min(1.0, pattern_matches / 2.0)  # Cap at 2 patterns for high confidence
            score += 0.4 * pattern_score
            total_weight += 0.4

        # Normalize score
        if total_weight > 0:
            score = score / total_weight

        return score

    def route_query(self, query: str) -> Tuple[str, float]:
        """
        Route query to the most appropriate agent.

        Returns:
            Tuple of (agent_name, confidence_score)
        """
        if not query or not query.strip():
            return 'org', 0.0

        scores = {}
        for agent in self.routing_rules:
            scores[agent] = self._calculate_confidence(query, agent)

        # Find the agent with highest score
        best_agent = max(scores, key=scores.get)
        best_score = scores[best_agent]

        # Apply priority adjustments
        query_lower = query.lower()

        # HR gets priority for leave-related queries
        if 'leave' in query_lower and best_agent != 'hr':
            hr_score = scores.get('hr', 0)
            if hr_score > 0.1:  # If HR has any reasonable match
                best_agent = 'hr'
                best_score = hr_score

        # IT gets priority for technical issues
        if any(word in query_lower for word in ['computer', 'software', 'password', 'login', 'network']) and best_agent != 'it':
            it_score = scores.get('it', 0)
            if it_score > 0.1:
                best_agent = 'it'
                best_score = it_score

        # Admin gets priority for travel/expenses
        if any(word in query_lower for word in ['travel', 'expense', 'booking']) and best_agent != 'admin':
            admin_score = scores.get('admin', 0)
            if admin_score > 0.1:
                best_agent = 'admin'
                best_score = admin_score

        # If confidence is too low, default to org
        if best_score < 0.05:
            return 'org', best_score

        return best_agent, best_score

# Global router instance
router = QueryRouter()

def route(query: str) -> str:
    """Legacy route function for backward compatibility."""
    agent, confidence = router.route_query(query)
    return agent
