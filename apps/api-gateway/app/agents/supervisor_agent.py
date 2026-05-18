import re
import json
import socket
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from difflib import SequenceMatcher
from typing import Generator, Dict, List, Optional
from urllib.parse import urlparse

from app.agents.guardrails import check_input


def _check_ollama(base_url: str, timeout: int = 3) -> bool:
    """Return True if the Ollama host is reachable, log clearly if not."""
    parsed = urlparse(base_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 11434
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError as exc:
        print(
            f"[MasterAgent] Cannot reach Ollama at {base_url} -- {exc}\n"
            f"  -> Is the server running? Do you need VPN?\n"
            f"  -> Set OLLAMA_BASE_URL env var to override (e.g. http://localhost:11434)"
        )
        return False

# ── Greeting / small-talk fast-path ──────────────────────────────────────────
# Only pure bare greetings (1-2 words) get the static menu.
# Anything longer ("hello can you help with X", "hi what's my leave balance")
# falls through to routing so the right agent can answer.
_PURE_GREETINGS = frozenset({
    'hi', 'hello', 'hey', 'hii', 'hiii', 'howdy', 'greetings',
    'sup', 'yo', 'thanks', 'thank', 'thx', 'ty', 'thankyou',
    'bye', 'goodbye', 'cya',
})
_PURE_TWO_WORD = frozenset({
    'hi there', 'hello there', 'hey there',
    'good morning', 'good afternoon', 'good evening', 'good night', 'good day',
    'thank you', 'many thanks', 'see ya',
})


def _is_greeting(text: str) -> bool:
    clean = re.sub(r"[!.,?'\s]+", ' ', text.lower()).strip()
    if not clean:
        return False
    words = clean.split()
    if len(words) == 1:
        return words[0] in _PURE_GREETINGS
    if len(words) == 2:
        return f"{words[0]} {words[1]}" in _PURE_TWO_WORD
    return False


_GREETING_RESPONSE = (
    "Hello! I'm AURA, your Aligned Automation assistant.\n\n"
    "I can help you with:\n"
    "- **HR** — leave, benefits, payroll, appraisals, policies\n"
    "- **IT** — technical support, VPN, passwords, software\n"
    "- **Admin** — travel, cab bookings, office facilities\n"
    "- **Finance** — ZOHO expenses, TDS, tax declarations\n"
    "- **PMO** — project status, milestones, resources\n"
    "- **Employee Directory** — find colleagues, contact details\n"
    "- **Documents** — generate letters, certificates, and HR documents\n\n"
    "What can I help you with today?"
)

# ── Domain keyword map (used when LLM routing is unavailable) ─────────────────
# ── Escalation fuzzy matcher ─────────────────────────────────────────────────
_ESC_TARGETS = ["escalat", "escalate", "escalation", "escalated", "escalating"]


def _is_escalation_query(query: str) -> bool:
    q = query.lower()
    if "escalat" in q:
        return True
    for word in re.split(r"[\s.,!?;:]+", q):
        if len(word) < 5:
            continue
        if any(SequenceMatcher(None, word, t).ratio() >= 0.75 for t in _ESC_TARGETS):
            return True
    return False

# ── Domain keyword fallback map ───────────────────────────────────────────────
DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    'hr': [
        'leave', 'policy', 'policies', 'benefit', 'payroll', 'performance',
        'posh', 'maternity', 'paternity', 'insurance', 'ghi', 'pf', 'epf',
        'gratuity', 'referral', 'certification', 'attendance', 'wfh',
        'hrone', 'practo', 'takeCare', 'appraisal', 'salary', 'notice period',
        'resignation', 'onboarding', 'offboarding', 'increment',
    ],
    'it': [
        'technical', 'mfa', 'vpn', 'password', 'laptop', 'software',
        'network', 'security', 'onedrive', 'outlook', 'wifi',
        'remote access', 'polycom', 'hardware', 'printer', 'access',
        'helpdesk', 'antivirus', 'backup', 'teams', 'install',
    ],
    'admin': [
        'travel', 'cab', 'orix', 'cabman', 'parking', 'workplace', 'office supplies',
        'fountainhead', 'booking', 'transport', 'hotel', 'flight', 'visa letter',
        'meeting room', 'facility', 'vendor', 'invoice',
    ],
    'pmo': [
        'project', 'milestone', 'abi', 'ncr', 'spencer', 'dell',
        'eli lilly', 'pmo', 'timeline', 'delivery', 'resource allocation',
        'risk', 'blocker', 'change request', 'go-live', 'status report',
    ],
    'finance': [
        'zoho', 'expense', 'tds', 'tax', 'declaration', 'form 16',
        'reimbursement', 'kotak', 'income tax', 'investment proof', 'budget',
    ],
    'org': [
        'company', 'mission', 'structure', 'organization', 'organisation',
        'about', 'values', 'vision', 'culture', 'leadership', 'diversity',
    ],
    'employee': [
        'blood group', 'date of joining', 'joining date',
        'mobile number', 'work phone', 'phone number',
        'employee count', 'total employees', 'how many employees',
        'employees in', 'employees from', 'staff in', 'staff from',
        'team members', 'people in', 'reporting manager', 'reports to',
        'reporting to', 'manager of', 'skill set', 'employee directory',
        'staff directory', 'my designation', 'my manager', 'my department',
        'my mobile', 'my email', 'my profile', 'my details',
        'who is', 'profile of', 'details of', 'info about',
        'find employee', 'look up', 'lookup', 'search employee',
    ],
    'funny': [
        'joke', 'funny', 'laugh', 'meme', 'pun', 'humor', 'humour',
        'tell me a joke', 'make me laugh', 'lighten up', 'small talk',
        'sarcastic', 'witty', 'cheer me up', 'fun fact',
        'bored', 'boring', 'entertain', 'entertainment',
        'how are you', 'how r u', "what's up", 'wassup', 'whats up',
        'good morning', 'good afternoon', 'good evening', 'good night',
        'quiz', 'trivia', 'riddle', 'random', 'cool fact',
        'chat', 'talk to me', 'aura what', 'you there',
    ],
    'document': [
        'loan proof', 'experience letter', 'employment verification',
        'offer letter', 'relieving letter', 'address proof', 'bonafide',
        'internship certificate', 'promotion letter', 'noc',
        'no objection certificate', 'confirmation letter', 'id card request',
        'generate letter', 'generate certificate', 'generate document',
        'create letter', 'create certificate', 'draft letter',
        'need letter', 'need certificate', 'hr letter', 'hr document',
        'employment letter', 'company letter', 'salary certificate',
    ],
}

# ── Document query pre-classifier (regex, no LLM) ────────────────────────────
_DOC_PATTERNS = [
    re.compile(
        r"\b(?:loan\s+proof|experience\s+letter|employment\s+verification|offer\s+letter|"
        r"relieving\s+letter|address\s+proof|bonafide|internship\s+certificate|"
        r"promotion\s+letter|no\s+objection\s+certificate|\bnoc\b|confirmation\s+letter|"
        r"id\s+card\s+request|salary\s+certificate|employment\s+letter)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:generate|create|draft|prepare|write|need|want|issue)\s+"
        r"(?:a\s+|an\s+)?(?:\w+\s+){0,3}(?:letter|certificate|document|proof)\b",
        re.IGNORECASE,
    ),
]


def _is_document_query(query: str) -> bool:
    return any(p.search(query) for p in _DOC_PATTERNS)


# ── Employee query pre-classifier (regex, no LLM) ────────────────────────────
_EMP_PATTERNS = [
    re.compile(r"\w+'s\s+(?:mobile|phone|email|designation|department|work.?phone)", re.IGNORECASE),
    re.compile(r"\w+'s\s+(?:manager|role|grade|level|skill|project|blood.?group|joining)", re.IGNORECASE),
    re.compile(r"\b(?:mobile|work\s+phone|phone\s+number|email|designation)\s+(?:of|for)\s+[a-z]", re.IGNORECASE),
    re.compile(r"\b(?:blood\s+group|joining\s+date|date\s+of\s+joining|manager)\s+(?:of|for)\s+[a-z]", re.IGNORECASE),
    re.compile(r"\b(?:how\s+many|count|number\s+of|total)\s+employees?\b", re.IGNORECASE),
    re.compile(r"\bemployees?\s+(?:in|from|under|of)\b", re.IGNORECASE),
    re.compile(r"\b(?:staff|people|team)\s+(?:in|from|at|under)\b", re.IGNORECASE),
    re.compile(r"\b(?:manager\s+of|reports?\s+to|reporting\s+to|team\s+under)\s+[a-z]", re.IGNORECASE),
    re.compile(r"\bmy\s+(?:mobile|phone|email|designation|department|manager|role|grade)\b", re.IGNORECASE),
    re.compile(r"\bmy\s+(?:level|skill|project|blood|joining|detail|info|profile|team|location|experience|contact)\b", re.IGNORECASE),
    re.compile(r"\b(?:who\s+am\s+i|about\s+me)\b", re.IGNORECASE),
    re.compile(r"\bwho\s+is\s+\w", re.IGNORECASE),
    re.compile(r"\b(?:profile|details?|information|info)\s+(?:of|about|for)\s+\w", re.IGNORECASE),
    re.compile(r"\b(?:find|search\s+for|look\s+up)\s+(?:employee\s+)?\w", re.IGNORECASE),
]


def _is_employee_query(query: str) -> bool:
    return any(p.search(query) for p in _EMP_PATTERNS)


# ── LLM routing prompt — asks for ONE domain ─────────────────────────────────
_ROUTING_PROMPT = """\
You are a query router for AURA, an internal company assistant for Aligned Automation.

Departments and what they own:
- hr: leave, benefits, payroll, appraisals, POSH, maternity/paternity, GHI, PF/EPF, gratuity, referral, WFH, HROne, Practo, IL TakeCare, resignation, notice period
- it: technical support, MFA, VPN, passwords, laptop, software, network, security, OneDrive, Outlook, WiFi, remote access, Polycom, antivirus
- admin: travel bookings, cab/ORIX/Cabman, parking, workplace guidelines, office supplies, Fountainhead, meeting rooms, facility
- pmo: project tracking, milestones, onboarding process docs, project overviews (ABI/NCR/Spencer/Dell/Eli Lilly), risk management, PMO best practices
- finance: ZOHO expenses, TDS declarations, income tax, Form 16, expense reimbursement submission, Kotak salary account
- org: company mission, structure, values, culture, leadership, general company information
- employee: employee directory — find by name, contact details, department listing, org chart, headcount, skill search, self-service ("my designation", "my manager", "who am I")
- document: generate professional HR/corporate documents — experience letter, offer letter, relieving letter, loan proof, NOC, bonafide certificate, internship certificate, promotion letter, address proof, confirmation letter, employment verification, ID card request
- funny: jokes, small-talk, casual chat, morale-boost, humour — only when there is NO real business intent
- hr (default): leave, benefits, payroll, HR policies — also the fallback when no other domain clearly matches

User query: "{query}"

Which ONE department should handle this query?
Reply with ONLY the department name, one word, lowercase. No explanation.
Valid values: hr, it, admin, pmo, finance, org, employee, document, funny

If unsure, reply: hr

Reply:"""


_SYNTHESIS_PROMPT = """\
You are AURA, an internal company assistant for Aligned Automation.
Multiple departments have provided information relevant to the user's query.
Synthesize their responses into a single, coherent, concise answer.
Do not repeat information. Do not mention department names unless necessary.

Department responses:
{responses}

User query: "{query}"

Synthesized answer:"""


class MasterAgent:
    """Single orchestrator — routes to one domain agent and returns its response."""

    # Domains to pre-warm at startup (excludes employee/escalation — no heavy init)
    _PREWARM_DOMAINS = ['hr', 'it', 'admin', 'pmo', 'finance', 'org']

    def __init__(self):
        self._slaves: Dict[str, object] = {}
        self._llm = None
        self._setup_llm()
        threading.Thread(target=self._prewarm, daemon=True).start()

    def _prewarm(self) -> None:
        """Load all domain agents in background so first user query isn't slow."""
        for domain in self._PREWARM_DOMAINS:
            try:
                self._get_slave(domain)
            except Exception as exc:
                print(f"[MasterAgent] Pre-warm failed for '{domain}': {exc}")

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama
            from app.agents.working.config import LLMConfig
            cfg = LLMConfig()
            self._llm = ChatOllama(
                base_url=cfg.base_url,
                model=cfg.model,
                temperature=0,
                num_predict=16,
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
                from app.agents.working.hr_agent import HRAgent
                agent = HRAgent()
            elif domain == 'it':
                from app.agents.working.it_agent import ITAgent
                agent = ITAgent()
            elif domain == 'admin':
                from app.agents.working.admin_agent import AdminAgent
                agent = AdminAgent()
            elif domain == 'pmo':
                from app.agents.working.pmo_agent import PMOAgent
                agent = PMOAgent()
            elif domain == 'finance':
                from app.agents.working.finance_agent import FinanceAgent
                agent = FinanceAgent()
            elif domain == 'org':
                from app.agents.org_agent import OrgDeepAgent
                agent = OrgDeepAgent()
            elif domain == 'employee':
                from app.agents.employee.employee_agent import employee_agent as _emp_fn

                class _EmpWrapper:
                    last_sources: List[str] = []

                    def __init__(self, fn) -> None:
                        self._fn = fn

                    def process_query(self, q: str, user_email: str = "") -> str:
                        return self._fn(q, user_email=user_email)

                agent = _EmpWrapper(_emp_fn)
            elif domain == 'escalation':
                from app.agents.escalation_agent import escalation_agent as _esc_fn

                class _EscWrapper:
                    last_sources: List[str] = []

                    def __init__(self, fn) -> None:
                        self._fn = fn

                    def process_query(self, q: str = "", user_id: str = "", **__) -> str:
                        return self._fn(query=q, user_id=user_id or None)

                agent = _EscWrapper(_esc_fn)
            elif domain == 'document':
                from app.agents.document_agent import document_agent_fn as _doc_fn

                class _DocWrapper:
                    last_sources: List[str] = []

                    def __init__(self, fn) -> None:
                        self._fn = fn

                    def process_query(self, q: str, user_email: str = "", user_id: str = "", **__) -> str:
                        return self._fn(q, user_email=user_email, user_id=user_id)

                agent = _DocWrapper(_doc_fn)

            elif domain == 'funny':
                from app.agents.working.funny_agent import FunnyAgent
                agent = FunnyAgent()

            if agent:
                self._slaves[domain] = agent
                print(f"[MasterAgent] Agent loaded: {domain}")
        except Exception as exc:
            print(f"[MasterAgent] Could not load agent '{domain}': {exc}")

        return agent

    def _route_llm(self, query: str) -> Optional[str]:
        if not self._llm:
            return None
        try:
            prompt = _ROUTING_PROMPT.format(query=query)
            with ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(self._llm.invoke, prompt)
                response = future.result(timeout=5)
            tokens = response.content.strip().lower().split()
            if not tokens:
                return None
            domain = tokens[0]
            if domain in DOMAIN_KEYWORDS or domain == 'document':
                print(f"[MasterAgent] LLM routed -> {domain}")
                return domain
        except FuturesTimeout:
            print("[MasterAgent] LLM routing timed out -- falling back to keywords")
        except Exception as exc:
            print(f"[MasterAgent] LLM routing error ({exc})")
        return None

    def _route_keywords(self, query: str) -> str:
        q = query.lower()
        scores = {
            domain: sum(1 for kw in keywords if kw in q)
            for domain, keywords in DOMAIN_KEYWORDS.items()
        }
        best = max(scores, key=scores.get)
        if scores[best] == 0:
            print("[MasterAgent] No keyword match -- defaulting to hr")
            return 'hr'
        print(f"[MasterAgent] Keyword routed -> {best} (score={scores[best]})")
        return best

    def _route(self, query: str, user_email: str = "", user_id: str = "") -> str:
        # Active document session takes priority — route follow-up field replies correctly
        try:
            from app.agents.document_agent import has_active_session
            if has_active_session(user_email, user_id):
                print("[MasterAgent] Active document session -> document")
                return 'document'
        except Exception as exc:
            print(f"[MasterAgent] Session check error: {exc}")

        # Escalation keyword — highest priority, bypass LLM
        if 'escalat' in query.lower():
            print("[MasterAgent] Escalation keyword -> escalation")
            return 'escalation'

        # Employee pattern pre-classifier — deterministic, no LLM needed
        if _is_employee_query(query):
            print("[MasterAgent] Employee pattern -> employee")
            return 'employee'

        # Document pattern pre-classifier — deterministic, no LLM needed
        if _is_document_query(query):
            print("[MasterAgent] Document pattern -> document")
            return 'document'

        # LLM routing — preferred when available
        domain = self._route_llm(query)
        if domain:
            return domain

        # Keyword fallback
        return self._route_keywords(query)

    def _run_agent(self, domain: str, query: str, user_email: str = "", user_id: str = ""):
        agent = self._get_slave(domain)
        if not agent:
            return None, []
        try:
            if domain == 'document':
                resp = agent.process_query(query, user_email=user_email, user_id=user_id)
            elif domain == 'employee':
                resp = agent.process_query(query, user_email=user_email)
            elif domain == 'escalation':
                resp = agent.process_query(query, user_id=user_id)
            else:
                resp = agent.process_query(query)
            sources = getattr(agent, 'last_sources', [])
            return resp, [s for s in sources if s]
        except Exception as exc:
            print(f"[MasterAgent] Agent '{domain}' error: {exc}")
            return None, []

    def _contextual_block_response(self, query: str, category: str) -> Optional[str]:
        """
        Generate a query-aware response for distress and out-of-scope blocks.
        Returns None if LLM is unavailable or times out — caller falls back to static message.
        """
        if not self._llm:
            return None
        from app.agents.guardrails import DISTRESS_PROMPT, ORG_SCOPE_PROMPT
        prompts = {
            'distress': DISTRESS_PROMPT,
            'org_scope': ORG_SCOPE_PROMPT,
        }
        prompt_template = prompts.get(category)
        if not prompt_template:
            return None
        try:
            from langchain_ollama import ChatOllama
            from app.agents.working.config import LLMConfig
            cfg = LLMConfig()
            llm = ChatOllama(
                base_url=cfg.base_url,
                model=cfg.model,
                temperature=0.3,
                num_predict=200,
            )
            prompt = prompt_template.format(query=query)
            with ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(llm.invoke, prompt)
                response = future.result(timeout=10)
            return response.content.strip() or None
        except FuturesTimeout:
            print(f"[MasterAgent] Contextual block response timed out for category={category}")
        except Exception as exc:
            print(f"[MasterAgent] Contextual block response error (category={category}): {exc}")
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

    def _run_slave(self, domain: str, query: str, user_email: str = "", user_id: str = ""):
        slave = self._get_slave(domain)
        if not slave:
            return domain, None, []
        try:
            if domain == 'document':
                resp = slave.process_query(query, user_email=user_email, user_id=user_id)
            elif domain == 'employee':
                resp = slave.process_query(query, user_email=user_email)
            elif domain == 'escalation':
                resp = slave.process_query(query, user_id=user_id)
            else:
                resp = slave.process_query(query)
            sources = getattr(slave, 'last_sources', [])
            return domain, resp, [s for s in sources if s]
        except Exception as exc:
            print(f"[MasterAgent] _run_slave error for domain '{domain}': {exc}")
        return domain, None, []

    def process_query(self, query: str, user_email: str = "", user_id: str = "") -> str:
        try:
            return self._process_query_inner(query, user_email=user_email, user_id=user_id)
        except Exception as exc:
            print(f"[MasterAgent] Unhandled exception in process_query: {exc}")
            return (
                "I encountered an unexpected error processing your request. "
                "Please try again or contact support if the issue persists."
            )

    def _process_query_inner(self, query: str, user_email: str = "", user_id: str = "") -> str:
        q = query.strip()
        if not q:
            return "Please enter a question."

        # Greetings go to FunnyAgent for a dynamic, emoji-rich, non-static reply.
        # If FunnyAgent is offline, fall back to the static menu.
        if _is_greeting(q):
            resp, _ = self._run_agent('funny', q, user_email, user_id)
            return resp or _GREETING_RESPONSE

        is_blocked, category, fallback = check_input(q)
        if is_blocked:
            return fallback

        domain = self._route(q, user_email=user_email, user_id=user_id)
        resp, sources = self._run_agent(domain, q, user_email, user_id)

        if not resp:
            return (
                "I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly."
            )

        return resp

    def stream_query(
        self, query: str, user_email: str = "", user_id: str = "",
    ) -> Generator[str, None, None]:
        """Yield SSE-formatted chunks. Each chunk is a JSON object: {content: str}."""
        try:
            answer = self._process_query_inner(
                query, user_email=user_email, user_id=user_id,
            )
        except Exception as exc:
            print(f"[MasterAgent] stream_query error: {exc}")
            answer = (
                "I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly."
            )
        yield _sse({"content": answer})
        yield _sse_done()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _sse_done() -> str:
    return "data: [DONE]\n\n"


# ── Singleton + public entry points ──────────────────────────────────────────
_master = MasterAgent()


def run_assistant(query: str, user_email: str = "", user_id: str = "") -> str:
    return _master.process_query(query, user_email=user_email, user_id=user_id)


def stream_assistant(query: str, user_email: str = "", user_id: str = "") -> Generator[str, None, None]:
    return _master.stream_query(query, user_email=user_email, user_id=user_id)
