import re
import json
from urllib.parse import urlparse, parse_qs, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Optional

# ── Domain keyword fallback map ───────────────────────────────────────────────
DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    'hr': [
        'leave', 'policy', 'policies', 'benefit', 'payroll', 'performance',
        'posh', 'maternity', 'paternity', 'insurance', 'ghi', 'pf', 'epf',
        'gratuity', 'referral', 'certification', 'attendance', 'wfh',
        'hrone', 'practo', 'takeCare', 'appraisal', 'salary', 'reimbursement',
    ],
    'it': [
        'technical', 'mfa', 'vpn', 'password', 'laptop', 'software',
        'network', 'security', 'onedrive', 'outlook', 'wifi',
        'remote access', 'polycom', 'hardware', 'printer', 'access',
    ],
    'admin': [
        'travel', 'cab', 'orix', 'parking', 'workplace', 'office supplies',
        'fountainhead', 'booking', 'transport', 'hotel', 'flight',
    ],
    'pmo': [
        'project', 'onboarding', 'abi', 'ncr', 'spencer', 'dell',
        'eli lilly', 'pmo', 'stress', 'timeline', 'milestone', 'delivery',
    ],
    'finance': [
        'zoho', 'expense', 'tds', 'tax', 'declaration', 'invoice',
        'reimbursement', 'budget',
    ],
    'org': [
        'company', 'mission', 'structure', 'organization', 'who are',
        'about', 'values', 'vision',
    ],
    'employee': [
        'blood group', 'date of joining', 'joining date',
        'mobile number', 'work phone', 'phone number',
        'employee count', 'total employees', 'how many employees',
        'employees in', 'employees from', 'staff in', 'staff from',
        'team members', 'people in',
        'reporting manager', 'reports to', 'reporting to', 'manager of',
        'skill set', 'employee directory', 'staff directory',
        'my designation', 'my manager', 'my department', 'my team',
        'my mobile', 'my email', 'my profile', 'my details',
        'who is', 'profile of', 'details of', 'info about', 'information about',
        'find employee', 'look up', 'lookup', 'search employee',
    ],
}

# ── Employee query pattern pre-router ─────────────────────────────────────────
# Split into small patterns (one concern each) to stay within complexity limits.
_EMP_PATTERNS = [
    # possessive field (part 1): "Amol's phone/email/designation/department"
    re.compile(r"\w+'s\s+(?:mobile|phone|email|designation|department|work.?phone)", re.IGNORECASE),
    # possessive field (part 2): "Amol's manager/role/grade/skill/project/joining"
    re.compile(r"\w+'s\s+(?:manager|role|grade|level|skill|project|blood.?group|joining)", re.IGNORECASE),
    # field of/for person (part 1): "mobile/phone/email/designation of Amol"
    re.compile(r"\b(?:mobile|work\s+phone|phone\s+number|email|designation)\s+(?:of|for)\s+[a-z]", re.IGNORECASE),
    # field of/for person (part 2): "blood group/joining date/manager of Amol"
    re.compile(r"\b(?:blood\s+group|joining\s+date|date\s+of\s+joining|manager)\s+(?:of|for)\s+[a-z]", re.IGNORECASE),
    # headcount: "how many employees"
    re.compile(r"\b(?:how\s+many|count|number\s+of|total)\s+employees?\b", re.IGNORECASE),
    # department listing: "employees in IT", "staff from Mumbai"
    re.compile(r"\bemployees?\s+(?:in|from|under|of)\b", re.IGNORECASE),
    re.compile(r"\b(?:staff|people|team)\s+(?:in|from|at|under)\b", re.IGNORECASE),
    # org structure: "manager of Priya", "reports to Sunita"
    re.compile(r"\b(?:manager\s+of|reports?\s+to|reporting\s+to|team\s+under)\s+[a-z]", re.IGNORECASE),
    # self-service (part 1): "my mobile/phone/email/designation/department/manager/role/grade"
    re.compile(r"\bmy\s+(?:mobile|phone|email|designation|department|manager|role|grade)\b", re.IGNORECASE),
    # self-service (part 2): "my level/skill/project/blood/joining/detail/info/profile/team"
    re.compile(r"\bmy\s+(?:level|skill|project|blood|joining|detail|info|profile|team|location|experience|contact)\b", re.IGNORECASE),
    # identity: "who am I", "about me"
    re.compile(r"\b(?:who\s+am\s+i|about\s+me)\b", re.IGNORECASE),
    # person lookup: "who is Amol", "who is Amol Metkari"
    re.compile(r"\bwho\s+is\s+\w", re.IGNORECASE),
    # profile/details/info of a person: "profile of Amol", "details of Priya", "info about Rahul"
    re.compile(r"\b(?:profile|details?|information|info)\s+(?:of|about|for)\s+\w", re.IGNORECASE),
    # find/search person: "find Amol", "look up Priya", "search for Rahul"
    re.compile(r"\b(?:find|search\s+for|look\s+up)\s+(?:employee\s+)?\w", re.IGNORECASE),
]


def _is_employee_query(query: str) -> bool:
    return any(p.search(query) for p in _EMP_PATTERNS)

# ── LLM routing prompt ───────────────────────────────────────────────────────
_ROUTING_PROMPT = """\
You are a query router for an internal company assistant called AURA.

Available departments and what they handle:
- hr: leave policies, benefits, payroll, performance, POSH, maternity/paternity, GHI insurance, PF/EPF, gratuity, referral, certification, attendance, WFH, HROne system, Practo, IL TakeCare
- it: technical support, MFA, VPN, passwords, laptop, software, network, security, OneDrive, Outlook, email backup, WiFi, remote access, Polycom
- admin: travel bookings, cab/ORIX, parking, workplace guidelines, office supplies, Fountainhead guidelines
- pmo: project tracking, onboarding process, project overviews (ABI/NCR/Spencer/Dell/Eli Lilly), PMO best practices, stress management
- finance: ZOHO expenses, TDS declarations, tax forms, expense submission
- org: company mission, structure, general company information
- employee: employee directory lookups — find employees by name, get contact details (mobile, work phone, email), list employees by department or location, org chart and reporting structure, headcount queries, skill-based searches, personal profile ("my designation", "my manager", "who am I")

User query: "{query}"

Which departments should handle this query? A query may need more than one department.
Reply with ONLY a valid JSON array. Examples:
  ["hr"]
  ["it"]
  ["hr", "it"]
  ["admin", "finance"]

Reply:"""

# ── Synthesis prompt ─────────────────────────────────────────────────────────
_SYNTHESIS_PROMPT = """\
You are AURA, a helpful internal company assistant.
Multiple departments have provided information for the user's query.
Synthesize their answers into one clear, well-organized response.
Mention which department is responsible for each part of the answer.

User query: "{query}"

Department responses:
{responses}

Provide a unified, concise, and accurate answer."""


class MasterAgent:
    """Orchestrates all domain slave agents."""

    def __init__(self):
        self._slaves: Dict[str, object] = {}
        self._llm = None
        self._setup_llm()

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama
            from app.agents.working.config import LLMConfig
            cfg = LLMConfig()
            self._llm = ChatOllama(
                base_url=cfg.base_url,
                model=cfg.model,
                temperature=0,
                num_predict=64,
            )
            print("[MasterAgent] LLM routing ready")
        except Exception as exc:
            print(f"[MasterAgent] LLM routing unavailable ({exc}); keyword routing active")

    def _get_slave(self, domain: str) -> Optional[object]:
        if domain in self._slaves:
            return self._slaves[domain]

        agent = None
        try:
            if domain == 'hr':
                from app.agents.working.hr.hr_deep_agent import HRDeepAgent
                agent = HRDeepAgent()
            elif domain == 'it':
                from app.agents.working.it.it_deep_agent import ITDeepAgent
                agent = ITDeepAgent()
            elif domain == 'admin':
                from app.agents.working.admin.admin_deep_agent import AdminDeepAgent
                agent = AdminDeepAgent()
            elif domain == 'pmo':
                from app.agents.working.pmo.pmo_deep_agent import PMODeepAgent
                agent = PMODeepAgent()
            elif domain == 'finance':
                from app.agents.working.finance.finance_deep_agent import FinanceDeepAgent
                agent = FinanceDeepAgent()
            elif domain == 'org':
                from app.agents.org_agent import org_agent as _fn

                class _OrgWrapper:
                    last_sources: List[str] = []

                    def process_query(self, q: str) -> str:
                        return _fn(q)

                agent = _OrgWrapper()

            elif domain == 'employee':
                from app.agents.employee.employee_agent import employee_agent as _fn

                class _EmpWrapper:
                    last_sources: List[str] = []

                    def process_query(self, q: str, user_email: str = "") -> str:
                        return _fn(q, user_email=user_email)

                agent = _EmpWrapper()

            elif domain == 'escalation':
                from app.agents.escalation_agent import escalation_agent as _fn

                class _EscWrapper:
                    last_sources: List[str] = []

                    def process_query(self, q: str) -> str:
                        return _fn()

                agent = _EscWrapper()

            if agent:
                self._slaves[domain] = agent
                print(f"[MasterAgent] Slave loaded: {domain}")
        except Exception as exc:
            print(f"[MasterAgent] Could not load slave '{domain}': {exc}")

        return agent

    def _route_llm(self, query: str) -> List[str]:
        if not self._llm:
            return []
        try:
            prompt = _ROUTING_PROMPT.format(query=query)
            response = self._llm.invoke(prompt)
            content = response.content.strip()
            match = re.search(r'\[[^\]]*\]', content, re.DOTALL)
            if match:
                domains = json.loads(match.group())
                valid = [d for d in domains if d in DOMAIN_KEYWORDS]
                if valid:
                    print(f"[MasterAgent] LLM routed → {valid}")
                    return valid
        except Exception as exc:
            print(f"[MasterAgent] LLM routing error ({exc})")
        return []

    def _route_keywords(self, query: str) -> List[str]:
        q = query.lower()
        scores = {
            domain: sum(1 for kw in keywords if kw in q)
            for domain, keywords in DOMAIN_KEYWORDS.items()
        }
        scores = {d: s for d, s in scores.items() if s > 0}
        if not scores:
            return ['hr']
        top_score = max(scores.values())
        threshold = max(1, top_score // 2)
        ranked = sorted(scores.items(), key=lambda x: -x[1])
        selected = [d for d, s in ranked if s >= threshold][:3]
        print(f"[MasterAgent] Keyword routed → {selected}")
        return selected

    def _route(self, query: str) -> List[str]:
        # Escalation check is highest priority — always bypasses other routing
        if 'escalat' in query.lower():
            print("[MasterAgent] Escalation keyword → ['escalation']")
            return ['escalation']
        if _is_employee_query(query):
            print("[MasterAgent] Employee pattern → ['employee']")
            return ['employee']
        domains = self._route_llm(query)
        if not domains:
            domains = self._route_keywords(query)
        return domains

    def _synthesize(self, query: str, responses: Dict[str, str]) -> str:
        formatted = "\n\n".join(
            f"[{domain.upper()} Department]\n{resp}"
            for domain, resp in responses.items()
        )
        if self._llm:
            try:
                from langchain_ollama import ChatOllama
                from app.agents.working.config import LLMConfig
                cfg = LLMConfig()
                synth_llm = ChatOllama(
                    base_url=cfg.base_url,
                    model=cfg.model,
                    temperature=0.1,
                    num_predict=cfg.max_tokens,
                )
                prompt = _SYNTHESIS_PROMPT.format(query=query, responses=formatted)
                return synth_llm.invoke(prompt).content
            except Exception as exc:
                print(f"[MasterAgent] Synthesis LLM error ({exc}); using section format")
        parts = [f"**{domain.upper()}**\n\n{resp}" for domain, resp in responses.items()]
        return "\n\n---\n\n".join(parts)

    def _run_slave(self, domain: str, query: str, user_email: str = ""):
        slave = self._get_slave(domain)
        if not slave:
            return domain, None, []
        try:
            if domain == 'employee':
                resp = slave.process_query(query, user_email=user_email)
            else:
                resp = slave.process_query(query)
            sources = getattr(slave, 'last_sources', [])
            return domain, resp, [s for s in sources if s]
        except Exception as exc:
            print(f"[MasterAgent] Slave '{domain}' error: {exc}")
            return domain, None, []

    def process_query(self, query: str, user_email: str = "") -> str:
        if not query or not query.strip():
            return "Please enter a question."

        domains = self._route(query)

        responses: Dict[str, str] = {}
        all_sources: List[str] = []

        with ThreadPoolExecutor(max_workers=min(len(domains), 4)) as pool:
            futures = {pool.submit(self._run_slave, d, query, user_email): d for d in domains}
            for fut in as_completed(futures):
                domain, resp, sources = fut.result()
                if resp:
                    responses[domain] = resp
                    all_sources.extend(sources)

        if not responses:
            return (
                "I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly."
            )

        final = (
            next(iter(responses.values()))
            if len(responses) == 1
            else self._synthesize(query, responses)
        )

        unique_sources = list(dict.fromkeys(all_sources))
        if unique_sources:
            def _source_label(url: str) -> str:
                try:
                    qs = parse_qs(urlparse(url).query)
                    if "file" in qs:
                        return unquote(qs["file"][0])
                except Exception:
                    pass
                return unquote(url.split("/")[-1]) or url

            source_list = "\n".join(
                f"  • [{_source_label(s)}]({s})" for s in unique_sources
            )
            final += f"\n\n---\n📄 **Sources**\n{source_list}"

        return final


# ── Singleton + public entry point (used by chat.py) ────────────────────────
_master = MasterAgent()


def run_assistant(query: str, user_email: str = "") -> str:
    return _master.process_query(query, user_email=user_email)
