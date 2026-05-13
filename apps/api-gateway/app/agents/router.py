import re
from typing import Dict, List, Tuple

class QueryRouter:
    def __init__(self):
        # Define routing rules with priorities
        self.routing_rules = {
            'employee': {
                'keywords': [
                    'employee', 'staff', 'colleague', 'coworker', 'team member',
                    'who is', 'find person', 'contact details', 'email of', 'phone of',
                    'mobile of', 'designation of', 'job title of', 'department of',
                    'reporting to', 'manager of', 'works in', 'people directory',
                    'employee directory', 'employee list', 'staff list', 'org chart',
                    'head count', 'headcount', 'how many employees', 'total employees',
                ],
                'patterns': [
                    r'\bwho\s+is\s+[A-Z][a-z]+\b',
                    r'\b(find|search|get|show)\s+(employee|staff|person|colleague)\b',
                    r'\b(email|phone|mobile|contact)\s+(of|for)\s+\w+\b',
                    r'\b(employees?|staff)\s+(in|from|of)\s+\w+\b',
                    r'\b(designation|title|role)\s+of\s+\w+\b',
                ],
                'priority': 0,  # Highest priority for direct employee lookups
            },
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

    def _apply_priority_overrides(
        self, query_lower: str, scores: Dict[str, float]
    ) -> Tuple[str, float]:
        """Apply domain-specific priority rules and return (best_agent, best_score)."""
        best_agent = max(scores, key=scores.get)
        best_score = scores[best_agent]

        priority_rules = [
            ('employee', ['who is', 'find employee', 'employee directory', 'email of',
                          'phone of', 'contact of', 'designation of', 'how many employees']),
            ('hr',       ['leave', 'vacation', 'maternity', 'paternity', 'sick day']),
            ('it',       ['computer', 'software', 'password', 'login', 'network']),
            ('admin',    ['travel', 'expense', 'booking']),
        ]

        for agent, triggers in priority_rules:
            if best_agent == agent:
                continue
            if any(t in query_lower for t in triggers):
                candidate_score = scores.get(agent, 0)
                if candidate_score > 0.1:
                    best_agent = agent
                    best_score = candidate_score
                    break  # first matching rule wins

        return best_agent, best_score

    def route_query(self, query: str) -> Tuple[str, float]:
        """Route query to the most appropriate agent."""
        if not query or not query.strip():
            return 'org', 0.0

        scores = {agent: self._calculate_confidence(query, agent)
                  for agent in self.routing_rules}

        best_agent, best_score = self._apply_priority_overrides(query.lower(), scores)

        if best_score < 0.05:
            return 'org', best_score

        return best_agent, best_score

# Global router instance
router = QueryRouter()

def route(query: str) -> str:
    """Legacy route function for backward compatibility."""
    agent, _ = router.route_query(query)
    return agent
