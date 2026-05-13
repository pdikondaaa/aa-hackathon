import re
from typing import Dict, List, Tuple


class QueryRouter:
    """
    Keyword + pattern based router — used as fallback when LLM routing
    is unavailable in the MasterAgent.
    """

    def __init__(self):
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
                    'parental', 'hr', 'human resources', 'employee', 'benefits', 'salary', 'pay',
                    'performance', 'review', 'training', 'recruit', 'hiring', 'onboard',
                    'resign', 'posh', 'gratuity', 'pf', 'epf', 'insurance', 'ghi',
                    'referral', 'certification', 'attendance', 'wfh', 'comp off',
                    'relocat', 'transfer', 'shifting', 'moving to', 'accommodation',
                    'home town', 'hometown', 'new city',
                ],
                'patterns': [
                    r'\b(annual|casual|sick|maternity|paternity|parental)\s+leave\b',
                    r'\b(hr|human resources)\b',
                    r'\b(employee|staff)\s+(benefits|policies|handbook)\b',
                    r'\b(posh|gratuity|epf|provident\s+fund)\b',
                    r'\b(relocat|relocation|relocating|transfer)\b',
                    r'\b(shifting|moving)\s+to\b',
                ],
                'priority': 1,
            },
            'it': {
                'keywords': [
                    'computer', 'laptop', 'software', 'hardware', 'network', 'internet',
                    'email', 'vpn', 'access', 'password', 'login', 'security',
                    'printer', 'wifi', 'technical', 'support', 'it', 'helpdesk',
                    'mfa', '2fa', 'onedrive', 'outlook', 'teams', 'backup',
                    'install', 'configure', 'antivirus', 'remote access',
                ],
                'patterns': [
                    r'\b(it|tech|technical)\s+support\b',
                    r'\b(vpn|remote)\s+access\b',
                    r'\b(password|login)\s+(reset|issue|change)\b',
                    r'\b(mfa|two.?factor|authenticator)\b',
                ],
                'priority': 1,
            },
            'admin': {
                'keywords': [
                    'travel', 'expense', 'reimbursement', 'booking', 'hotel', 'flight',
                    'office', 'supplies', 'equipment', 'facility', 'event', 'meeting',
                    'cab', 'taxi', 'orix', 'cabman', 'parking', 'workplace', 'fountainhead',
                    'purchase', 'invoice', 'vendor', 'administration',
                ],
                'patterns': [
                    r'\b(travel|business\s+trip|cab)\b',
                    r'\b(expense\s+report|reimbursement)\b',
                    r'\b(office|meeting)\s+(supplies|room|booking)\b',
                    r'\b(orix|cabman|parking)\b',
                ],
                'priority': 1,
            },
            'pmo': {
                'keywords': [
                    'project', 'pmo', 'milestone', 'delivery', 'timeline', 'sprint',
                    'resource', 'allocation', 'risk', 'issue', 'blocker',
                    'onboarding process', 'project overview', 'eli lilly', 'abi', 'ncr',
                    'spencer', 'dell', 'best practice', 'process document', 'status report',
                ],
                'patterns': [
                    r'\b(pmo|project\s+management\s+office)\b',
                    r'\b(project|milestone)\s+(status|overview|tracking)\b',
                    r'\b(onboarding\s+process|process\s+document)\b',
                ],
                'priority': 1,
            },
            'finance': {
                'keywords': [
                    'zoho', 'expense report', 'expense claim', 'submit expense',
                    'tds', 'tax', 'income tax', 'declaration', 'form 16',
                    'finance', 'accounting', 'tds deduction', 'joint declaration',
                    'salary account', 'kotak',
                ],
                'patterns': [
                    r'\b(zoho|expense\s+(claim|report|submission))\b',
                    r'\b(tds|income\s+tax|tax\s+declaration)\b',
                    r'\b(form\s*16|joint\s+declaration)\b',
                ],
                'priority': 1,
            },
            'org': {
                'keywords': [
                    'company', 'organization', 'mission', 'vision', 'values', 'culture',
                    'structure', 'department', 'leadership', 'policy', 'procedure',
                    'contact', 'diversity', 'inclusion',
                ],
                'patterns': [
                    r'\b(company|organization)\s+(mission|vision|values|structure)\b',
                    r'\b(contact|communication)\s+information\b',
                ],
                'priority': 2,  # fallback domain
            },
        }

    def _score(self, query: str, domain: str) -> float:
        q = query.lower()
        rules = self.routing_rules[domain]

        kw_hits = sum(1 for kw in rules['keywords'] if kw in q)
        kw_score = min(1.0, kw_hits / 3.0) * 0.6

        pat_hits = sum(1 for p in rules['patterns'] if re.search(p, q, re.IGNORECASE))
        pat_score = min(1.0, pat_hits / 2.0) * 0.4

        return kw_score + pat_score

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
        return best, best_score


router = QueryRouter()


def route(query: str) -> str:
    """Legacy route function for backward compatibility."""
    agent, _ = router.route_query(query)
    return agent
