import os
from typing import List

# --- Deep agent (lazy singleton) ---
_hr_deep = None
_hr_deep_failed = False


def _get_deep():
    global _hr_deep, _hr_deep_failed
    if _hr_deep is None and not _hr_deep_failed:
        try:
            from app.agents.working.hr.hr_deep_agent import HRDeepAgent
            _hr_deep = HRDeepAgent()
        except Exception as exc:
            print(f"[HRAgent] Deep agent init failed ({exc}); using keyword fallback")
            _hr_deep_failed = True
    return _hr_deep


# --- Simple keyword fallback ---
class HRAgent:
    def __init__(self):
        self.data_file = os.path.join(os.path.dirname(__file__), 'data', 'hr_policies.txt')
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
        hr_keywords = {
            'leave': ['leave', 'vacation', 'annual', 'casual', 'sick', 'maternity', 'paternity'],
            'benefits': ['benefit', 'insurance', 'health', 'dental', 'medical', 'wellness'],
            'salary': ['salary', 'pay', 'compensation', 'bonus', 'increment', 'payroll'],
            'performance': ['performance', 'review', 'appraisal', 'feedback', 'kpi'],
            'recruitment': ['recruit', 'hiring', 'onboarding', 'joining', 'offer'],
            'training': ['training', 'learning', 'development', 'course', 'certification'],
            'policy': ['policy', 'rule', 'procedure', 'guideline', 'code of conduct'],
        }
        matched = [cat for cat, kws in hr_keywords.items() if any(k in query_lower for k in kws)]
        relevant, in_section = [], False
        for line in lines:
            if line.startswith('##'):
                in_section = any(cat in line.lower() for cat in matched)
            if in_section or any(k in line.lower() for cat in matched for k in hr_keywords[cat]):
                if line.strip():
                    relevant.append(line)
        return relevant[:10]

    def process_query(self, query: str) -> str:
        info = self._find_relevant(query)
        if not info:
            return f"Please contact HR at hr@company.com or call +1-800-HR-HELP for: '{query}'."
        return (
            f"Based on HR policies:\n\n" +
            "\n".join(f"• {l}" for l in info) +
            "\n\nContact: hr@company.com | +1-800-HR-HELP"
        )


_fallback = HRAgent()


def hr_agent(query: str) -> str:
    deep = _get_deep()
    if deep:
        return deep.process_query(query)
    return _fallback.process_query(query)
