import os
from typing import List

# --- Deep agent (lazy singleton) ---
_admin_deep = None
_admin_deep_failed = False


def _get_deep():
    global _admin_deep, _admin_deep_failed
    if _admin_deep is None and not _admin_deep_failed:
        try:
            from app.agents.working.admin.admin_deep_agent import AdminDeepAgent
            _admin_deep = AdminDeepAgent()
        except Exception as exc:
            print(f"[AdminAgent] Deep agent init failed ({exc}); using keyword fallback")
            _admin_deep_failed = True
    return _admin_deep


# --- Simple keyword fallback ---
class AdminAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'admin_policies.txt')
        self.policies = self._load()

    def _load(self) -> str:
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return ""

    def _find_relevant(self, query: str) -> List[str]:
        query_lower = query.lower()
        lines = self.policies.split('\n')
        admin_keywords = {
            'travel': ['travel', 'trip', 'flight', 'hotel', 'booking', 'cab'],
            'expense': ['expense', 'reimbursement', 'cost', 'payment', 'zoho'],
            'office': ['office', 'supplies', 'equipment', 'facility', 'parking'],
            'event': ['event', 'meeting', 'conference'],
            'purchase': ['purchase', 'order', 'procurement', 'vendor'],
        }
        matched = [cat for cat, kws in admin_keywords.items() if any(k in query_lower for k in kws)]
        relevant, in_section = [], False
        for line in lines:
            if line.startswith('##'):
                in_section = any(cat in line.lower() for cat in matched)
            if in_section or any(k in line.lower() for cat in matched for k in admin_keywords[cat]):
                if line.strip():
                    relevant.append(line)
        return relevant[:10]

    def process_query(self, query: str) -> str:
        info = self._find_relevant(query)
        if not info:
            return f"Please contact Admin at admin@company.com for: '{query}'."
        return (
            "Based on admin policies:\n\n" +
            "\n".join(f"• {l}" for l in info) +
            "\n\nContact: admin@company.com | travel@company.com"
        )


_fallback = AdminAgent()


def admin_agent(query: str) -> str:
    deep = _get_deep()
    if deep:
        return deep.process_query(query)
    return _fallback.process_query(query)
