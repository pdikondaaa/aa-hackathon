import re
import json
import socket
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Generator, Dict, List, Optional
from urllib.parse import urlparse

from app.agents.guardrails import check_input

# ── Apply-leave fast-path ─────────────────────────────────────────────────────
_APPLY_LEAVE_RE = re.compile(
    r"""
    \b(?:
        apply(?:ing)?\s+(?:for\s+)?(?:a\s+)?leave |
        (?:request|submit|raise)\s+(?:a\s+)?leave(?:\s+request)? |
        (?:take|need|want)\s+(?:a\s+)?leave |
        leave\s+application |
        apply\s+leave
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_APPLY_LEAVE_RESPONSE = (
    "Sure! You can apply for leave directly through the <strong>Zoho People</strong> portal.\n\n"
    '<a href="https://people.zoho.com/alignedautomationservices/zp#leavetracker/mydata/applyleave" '
    'target="_blank" rel="noopener noreferrer" '
    'style="display:inline-block;margin-top:8px;padding:10px 20px;background:#2563eb;color:#fff;'
    'border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95em;">'
    '📅 Apply Leave on Zoho People</a>'
)



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
    "<p>Hello! I'm <strong>AURA</strong>, your Aligned Automation assistant.</p>"
    "<p>I can help you with:</p>"
    "<ul>"
    "<li><strong>HR</strong> — leave, benefits, payroll, appraisals, policies</li>"
    "<li><strong>IT</strong> — technical support, VPN, passwords, software</li>"
    "<li><strong>Admin</strong> — travel, cab bookings, office facilities</li>"
    "<li><strong>Finance</strong> — ZOHO expenses, TDS, tax declarations</li>"
    "<li><strong>PMO</strong> — project status, milestones, resources</li>"
    "<li><strong>Employee Directory</strong> — find colleagues, contact details</li>"
    "<li><strong>Attendance</strong> — check-in/out records, working hours</li>"
    "</ul>"
    "<p>What can I help you with today?</p>"
)

# ── Combined intent + routing LLM prompt ─────────────────────────────────────
_ROUTING_PROMPT = """\
You are a query router for AURA, an internal company assistant for Aligned Automation.

Step 1 — classify the intent:
- knowledge: the user wants information, policy details, how-to guidance, or process help
- action: the user wants to perform an action (apply leave, generate a document, escalate)
- data_lookup: the user wants specific data (employee details, attendance records, allocation)
- casual: jokes, small-talk, banter, humour, chit-chat with NO business intent at all
- unclear: you cannot determine the intent

Step 2 — pick the ONE department that should handle this query:
- hr: leave, benefits, payroll, appraisals, POSH, maternity/paternity, GHI, PF/EPF, gratuity, referral, WFH, HROne, Practo, IL TakeCare, resignation, notice period, attendance policy, attendance correction
- it: technical support, MFA, VPN, passwords, laptop, software, network, security, OneDrive, Outlook, WiFi, remote access, Polycom, antivirus
- admin: travel bookings, cab/ORIX/Cabman, parking, workplace guidelines, office supplies, Fountainhead, meeting rooms, facility
- pmo: project tracking, milestones, onboarding process docs, project overviews (ABI/NCR/Spencer/Dell/Eli Lilly), risk management, PMO best practices
- finance: ZOHO expenses, TDS declarations, income tax, Form 16, expense reimbursement submission, Kotak salary account
- org: company mission, structure, values, culture, leadership, general company information
- employee: employee directory — find by name, contact details, department listing, org chart, headcount, skill search, self-service ("my designation", "my manager", "who am I")
- document: generate professional HR/corporate documents — experience letter, offer letter, relieving letter, loan proof, NOC, bonafide certificate, internship certificate, promotion letter, address proof, confirmation letter, employment verification, ID card request
- attendance: attendance records/data — check-in time, check-out time, clock-in, punch-in, working hours, attendance of a specific employee or department
- funny: jokes, small-talk, casual chat, morale-boost, humour — ONLY when intent is casual with NO real business question

User query: "{query}"

Reply with EXACTLY two words separated by a space: <intent> <department>
Example: knowledge hr
Example: casual funny
Example: unclear hr

If intent is casual, department MUST be funny.
If intent is unclear and you cannot pick a department confidently, reply: unclear none

Reply:"""

# ── Casual intent heuristic (fallback when LLM is unavailable) ────────────────
_CASUAL_WORDS = frozenset({
    'joke', 'jokes', 'funny', 'laugh', 'meme', 'pun', 'humor', 'humour',
    'lol', 'lmao', 'haha', 'rofl', 'sarcastic', 'witty', 'bored',
    'cheer', 'fun', 'entertain', 'riddle', 'knock knock',
})
_BUSINESS_WORDS = frozenset({
    'policy', 'leave', 'salary', 'payroll', 'benefit', 'insurance',
    'vpn', 'password', 'laptop', 'software', 'travel', 'cab', 'expense',
    'project', 'milestone', 'employee', 'attendance', 'document', 'letter',
    'certificate', 'manager', 'department', 'team', 'allocation',
    'onboarding', 'appraisal', 'increment', 'resignation', 'notice',
    'reimbursement', 'tax', 'tds', 'pf', 'epf', 'ghi', 'posh',
    'escalat', 'help', 'how', 'what', 'process', 'apply', 'request',
})


def _heuristic_is_casual(query: str) -> bool:
    """Quick check: is this clearly casual/joke/small-talk with no business intent?"""
    words = set(re.split(r'[\s.,!?;:]+', query.lower()))
    has_casual = bool(words & _CASUAL_WORDS)
    has_business = bool(words & _BUSINESS_WORDS)
    return has_casual and not has_business


# ── Lightweight keyword router (only when LLM is completely unavailable) ───────
# Maps domain -> keywords.  Used as a last resort before disambiguation.
# Intentionally kept small — the LLM prompt is the primary router.
_FALLBACK_KEYWORDS: Dict[str, List[str]] = {
    'hr': [
        'leave', 'policy', 'policies', 'benefit', 'payroll', 'performance',
        'posh', 'maternity', 'paternity', 'insurance', 'ghi', 'pf', 'epf',
        'gratuity', 'referral', 'appraisal', 'salary', 'notice period',
        'resignation', 'onboarding', 'offboarding', 'increment', 'wfh',
    ],
    'it': [
        'vpn', 'password', 'laptop', 'software', 'network', 'mfa',
        'onedrive', 'outlook', 'wifi', 'remote access', 'antivirus',
        'helpdesk', 'printer', 'teams',
    ],
    'admin': [
        'travel', 'cab', 'orix', 'cabman', 'parking', 'office supplies',
        'fountainhead', 'booking', 'hotel', 'flight', 'meeting room',
        'facility',
    ],
    'pmo': [
        'project', 'milestone', 'pmo', 'timeline', 'delivery',
        'resource allocation', 'blocker', 'go-live', 'status report',
    ],
    'finance': [
        'expense', 'tds', 'tax', 'declaration', 'form 16',
        'reimbursement', 'kotak', 'income tax', 'investment proof',
    ],
    'org': [
        'company', 'mission', 'structure', 'organization', 'organisation',
        'values', 'vision', 'culture', 'leadership',
    ],
    'employee': [
        'employee directory', 'reporting manager', 'my manager',
        'my designation', 'my department', 'my profile', 'who is',
        'employee count', 'total employees',
    ],
    'attendance': [
        'attendance', 'check-in', 'check-out', 'checkin', 'checkout',
        'clock in', 'clock out', 'punch in', 'punch out',
        'working hours', 'hours worked',
    ],
    'document': [
        'experience letter', 'offer letter', 'relieving letter',
        'loan proof', 'noc', 'bonafide', 'salary certificate',
        'generate letter', 'generate certificate',
    ],
    'funny': [
        'joke', 'funny', 'laugh', 'meme', 'pun', 'humor', 'humour',
    ],
}


def _fallback_keyword_route(query: str) -> Optional[str]:
    """
    Lightweight keyword match — only used when LLM is completely unreachable.
    Returns None (-> disambiguation) instead of defaulting to any domain.
    """
    q = query.lower()
    scores = {
        domain: sum(1 for kw in keywords if kw in q)
        for domain, keywords in _FALLBACK_KEYWORDS.items()
    }
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return None  # no match — disambiguation, NOT a blind default
    print(f"[MasterAgent] Keyword fallback (LLM offline) -> {best} (score={scores[best]})")
    return best


_DISAMBIGUATION_RESPONSE = (
    "<p>I'm not sure which area that falls under. Could you tell me a bit more?</p>"
    "<p>I can help with:</p>"
    "<ul>"
    "<li><strong>HR</strong> — leave, benefits, payroll, appraisals, policies</li>"
    "<li><strong>IT</strong> — technical support, VPN, passwords, software</li>"
    "<li><strong>Admin</strong> — travel, cab bookings, office facilities</li>"
    "<li><strong>Finance</strong> — ZOHO expenses, TDS, tax declarations</li>"
    "<li><strong>PMO</strong> — project status, milestones, resources</li>"
    "<li><strong>Employee Directory</strong> — find colleagues, contact details</li>"
    "<li><strong>Attendance</strong> — check-in/out records, working hours</li>"
    "</ul>"
    "<p>Just rephrase your question and I'll route it to the right team.</p>"
)


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

    _PREWARM_DOMAINS = ['hr', 'it', 'admin', 'pmo', 'finance', 'org']

    def __init__(self):
        self._slaves: Dict[str, object] = {}
        self._llm = None
        self._setup_llm()
        threading.Thread(target=self._prewarm, daemon=True).start()

    def _prewarm(self) -> None:
        for domain in self._PREWARM_DOMAINS:
            try:
                self._get_slave(domain)
            except Exception as exc:
                print(f"[MasterAgent] Pre-warm failed for '{domain}': {exc}")

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama
            from app.agents.working.config import LLMConfig, is_reachable
            cfg = LLMConfig()

            # Check actual connectivity — don't just create the object
            if is_reachable(cfg.base_url, timeout=3):
                url, model = cfg.base_url, cfg.model
            elif is_reachable(cfg.fallback_url, timeout=3):
                url, model = cfg.fallback_url, cfg.fallback_model
            else:
                print("[MasterAgent] LLM routing unavailable (no Ollama endpoint reachable); keyword fallback active")
                self._llm = None
                return

            self._llm = ChatOllama(
                base_url=url,
                model=model,
                temperature=0,
                num_predict=16,
                timeout=8,
            )
            print(f"[MasterAgent] LLM routing ready | endpoint={url} | model={model}")
        except Exception as exc:
            print(f"[MasterAgent] LLM routing unavailable ({exc}); keyword fallback active")
            self._llm = None

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
            elif domain == 'attendance':
                from app.agents.employee.attendance_agent import attendance_agent as _att_fn

                class _AttWrapper:
                    last_sources: List[str] = []

                    def __init__(self, fn) -> None:
                        self._fn = fn

                    def process_query(self, q: str, user_email: str = "") -> str:
                        return self._fn(q, user_email=user_email)

                agent = _AttWrapper(_att_fn)
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

    _VALID_DOMAINS = frozenset({
        'hr', 'it', 'admin', 'pmo', 'finance', 'org',
        'employee', 'attendance', 'document', 'funny',
    })

    def _route_llm(self, query: str) -> tuple:
        """
        Returns (intent, domain) using the combined intent+routing prompt.
        intent is one of: knowledge, action, data_lookup, casual, unclear
        domain is one of the valid domains, or None if unresolved.
        """
        if not self._llm:
            return None, None
        try:
            prompt = _ROUTING_PROMPT.format(query=query)
            ex = ThreadPoolExecutor(max_workers=1)
            future = ex.submit(self._llm.invoke, prompt)
            try:
                response = future.result(timeout=8)
            except FuturesTimeout:
                print("[MasterAgent] LLM routing timed out")
                future.cancel()
                ex.shutdown(wait=False)
                return None, None
            finally:
                ex.shutdown(wait=False)
            tokens = response.content.strip().lower().split()
            if len(tokens) >= 2:
                intent, domain = tokens[0], tokens[1]
                if intent == 'casual':
                    domain = 'funny'  # enforce: casual always goes to funny
                if domain in self._VALID_DOMAINS:
                    print(f"[MasterAgent] LLM routed -> intent={intent} domain={domain}")
                    return intent, domain
                if domain == 'none':
                    print(f"[MasterAgent] LLM routed -> intent={intent} domain=none")
                    return intent, None
            elif len(tokens) == 1 and tokens[0] in self._VALID_DOMAINS:
                # Backward compat: LLM returned just a domain
                print(f"[MasterAgent] LLM routed (single token) -> {tokens[0]}")
                return 'knowledge', tokens[0]
        except FuturesTimeout:
            print("[MasterAgent] LLM routing timed out")
        except Exception as exc:
            print(f"[MasterAgent] LLM routing error ({exc})")
        return None, None

    def _route(self, query: str, user_email: str = "", user_id: str = "") -> Optional[str]:
        # Active document session takes priority — route follow-up field replies correctly
        try:
            from app.agents.document_agent import has_active_session
            if has_active_session(user_email, user_id):
                print("[MasterAgent] Active document session -> document")
                return 'document'
        except Exception as exc:
            print(f"[MasterAgent] Session check error: {exc}")

        # Escalation substring — unambiguous, safety-critical, skip LLM
        if 'escalat' in query.lower():
            print("[MasterAgent] Escalation keyword -> escalation")
            return 'escalation'

        # Combined intent + domain LLM routing — single call handles everything
        intent, domain = self._route_llm(query)
        if intent == 'casual':
            return 'funny'
        if domain and domain in self._VALID_DOMAINS:
            return domain

        # LLM unavailable or unclear — try heuristic casual check
        if _heuristic_is_casual(query):
            print("[MasterAgent] Heuristic casual -> funny")
            return 'funny'

        # LLM unavailable — keyword fallback (returns None if no match)
        if intent is None:
            kw_domain = _fallback_keyword_route(query)
            if kw_domain:
                return kw_domain

        # No confident route — disambiguation
        print("[MasterAgent] No confident route — disambiguation")
        return None

    def _run_agent(
        self,
        domain: str,
        query: str,
        user_email: str = "",
        user_id: str = "",
        conversation_history: Optional[List[Dict]] = None,
    ):
        agent = self._get_slave(domain)
        if not agent:
            return None, []
        try:
            if domain == 'document':
                resp = agent.process_query(query, user_email=user_email, user_id=user_id)
            elif domain in ('employee', 'attendance'):
                resp = agent.process_query(query, user_email=user_email)
            elif domain == 'escalation':
                resp = agent.process_query(query, user_id=user_id)
            else:
                resp = agent.process_query(query, conversation_history=conversation_history or [])
            sources = getattr(agent, 'last_sources', [])
            return resp, [s for s in sources if s]
        except Exception as exc:
            print(f"[MasterAgent] Agent '{domain}' error: {exc}")
            return None, []

    def _contextual_block_response(self, query: str, category: str) -> Optional[str]:
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
        parts = [f"<h3>{domain.upper()}</h3>{resp}" for domain, resp in responses.items()]
        return "<hr>".join(parts)

    def _run_slave(self, domain: str, query: str, user_email: str = "", user_id: str = ""):
        slave = self._get_slave(domain)
        if not slave:
            return domain, None, []
        try:
            if domain == 'document':
                resp = slave.process_query(query, user_email=user_email, user_id=user_id)
            elif domain in ('employee', 'attendance'):
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
            return "<p>Please enter a question.</p>"

        if _is_greeting(q):
            return _GREETING_RESPONSE

        if _APPLY_LEAVE_RE.search(q):
            return _APPLY_LEAVE_RESPONSE

        is_blocked, category, fallback = check_input(q)
        if is_blocked:
            if category in ('jailbreak', 'security', 'harmful'):
                return fallback
            return self._contextual_block_response(q, category) or fallback

        domain = self._route(q, user_email=user_email, user_id=user_id)

        # No confident route — ask user to clarify instead of blind default
        if domain is None:
            return _DISAMBIGUATION_RESPONSE

        resp, sources = self._run_agent(domain, q, user_email, user_id)

        if not resp:
            return (
                "<p>I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly.</p>"
            )

        if sources:
            items = "".join(
                f'<li><a href="{s}" target="_blank">{_source_label(s)}</a></li>'
                for s in dict.fromkeys(sources)
            )
            resp += f"<hr><p><strong>📄 Sources</strong></p><ul>{items}</ul>"

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


def _source_label(url: str) -> str:
    """Return a short human-readable label for a source URL."""
    from urllib.parse import urlparse
    path = urlparse(url).path.rstrip("/")
    name = path.split("/")[-1] if path else url
    # Strip common extensions for readability
    for ext in (".pdf", ".docx", ".doc", ".xlsx", ".txt", ".md"):
        if name.lower().endswith(ext):
            name = name[: -len(ext)]
            break
    return name or url


# ── Singleton + public entry points ──────────────────────────────────────────
_master = MasterAgent()


def run_assistant(query: str, user_email: str = "", user_id: str = "") -> str:
    return _master.process_query(query, user_email=user_email, user_id=user_id)


def stream_assistant(query: str, user_email: str = "", user_id: str = "") -> Generator[str, None, None]:
    return _master.stream_query(query, user_email=user_email, user_id=user_id)
