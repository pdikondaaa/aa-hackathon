import os
from typing import List

# --- Deep agent (lazy singleton) ---
_it_deep = None
_it_deep_failed = False


def _get_deep():
    global _it_deep, _it_deep_failed
    if _it_deep is None and not _it_deep_failed:
        try:
            from app.agents.working.it.it_deep_agent import ITDeepAgent
            _it_deep = ITDeepAgent()
        except Exception as exc:
            print(f"[ITAgent] Deep agent init failed ({exc}); using keyword fallback")
            _it_deep_failed = True
    return _it_deep


# --- Simple keyword fallback ---
class ITAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'it_policies.txt')
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
        it_keywords = {
            'access': ['access', 'login', 'password', 'vpn', 'remote'],
            'email': ['email', 'mail', 'outlook'],
            'software': ['software', 'install', 'application'],
            'security': ['security', 'encryption', 'protection', 'mfa'],
            'device': ['device', 'computer', 'laptop', 'phone'],
            'network': ['network', 'internet', 'wifi'],
            'hardware': ['hardware', 'printer', 'monitor'],
        }
        matched = [cat for cat, kws in it_keywords.items() if any(k in query_lower for k in kws)]
        relevant, in_section = [], False
        for line in lines:
            if line.startswith('##'):
                in_section = any(cat in line.lower() for cat in matched)
            if in_section or any(k in line.lower() for cat in matched for k in it_keywords[cat]):
                if line.strip():
                    relevant.append(line)
        return relevant[:10]

    def process_query(self, query: str) -> str:
        info = self._find_relevant(query)
        if not info:
            return f"Please contact IT Helpdesk at helpdesk@company.com or call +1-800-IT-HELP for: '{query}'."
        return (
            "Based on IT policies:\n\n" +
            "\n".join(f"• {l}" for l in info) +
            "\n\nContact: helpdesk@company.com | +1-800-IT-HELP"
        )


_fallback = ITAgent()


def it_agent(query: str) -> str:
    deep = _get_deep()
    if deep:
        return deep.process_query(query)
    return _fallback.process_query(query)
