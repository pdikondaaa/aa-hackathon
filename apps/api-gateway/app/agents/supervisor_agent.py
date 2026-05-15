import re
import functools
import json
import socket
from typing import Generator
from urllib.parse import urlparse

from langchain.tools import tool
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent

from app.agents.guardrails import check_input
from app.agents.working.config import LLMConfig


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
            f"[MasterAgent] Cannot reach Ollama at {base_url} — {exc}\n"
            f"  → Is the server running? Do you need VPN?\n"
            f"  → Set OLLAMA_BASE_URL env var to override (e.g. http://localhost:11434)"
        )
        return False

# ── Greeting / small-talk fast-path ──────────────────────────────────────────
_GREETING_FIRST_WORDS = frozenset({
    'hi', 'hello', 'hey', 'howdy', 'greetings',
    'thanks', 'thank', 'thx', 'ty',
    'bye', 'goodbye', 'sup',
})


def _is_greeting(text: str) -> bool:
    """True for short social messages that need no agent or DB call."""
    clean = re.sub(r"[!.,?'\s]+", ' ', text.lower()).strip()
    words = clean.split()
    if not words or len(words) > 6:
        return False
    first = words[0]
    if first in _GREETING_FIRST_WORDS:
        return True
    if first == 'good' and len(words) > 1 and words[1] in ('morning', 'afternoon', 'evening', 'day', 'night'):
        return True
    if first in ('how', 'hows') and len(words) > 1 and words[1] in ('are', 'is', 'you', 'it', 'going'):
        return True
    return False


_GREETING_RESPONSE = (
    "Hello! I'm AURA, your Aligned Automation assistant.\n\n"
    "I can help you with:\n"
    "- **HR** — leave, benefits, payroll, appraisals, policies\n"
    "- **IT** — technical support, VPN, passwords, software\n"
    "- **Admin** — travel, cab bookings, office facilities\n"
    "- **Finance** — ZOHO expenses, TDS, tax declarations\n"
    "- **PMO** — project status, milestones, resources\n"
    "- **Employee Directory** — find colleagues, contact details\n\n"
    "What can I help you with today?"
)

# ── LLM + agents (loaded once at module level) ────────────────────────────────
cfg = LLMConfig()

_ollama_available = _check_ollama(cfg.base_url)

# num_predict caps reasoning verbosity; timeout makes the call fail fast
# instead of hanging for minutes when the server is unreachable.
llm = ChatOllama(
    base_url=cfg.base_url,
    model=cfg.model,
    temperature=0,
    num_predict=512,
    timeout=30,
)

from app.agents.working.hr_agent import HRAgent
from app.agents.working.it_agent import ITAgent
from app.agents.working.admin_agent import AdminAgent
from app.agents.working.pmo_agent import PMOAgent
from app.agents.working.finance_agent import FinanceAgent
from app.agents.org_agent import OrgDeepAgent
from app.agents.employee.employee_agent import employee_agent as employee_agent_fn
from app.agents.escalation_agent import escalation_agent as escalation_agent_fn

_hr_agent = HRAgent()
_it_agent = ITAgent()
_admin_agent = AdminAgent()
_pmo_agent = PMOAgent()
_finance_agent = FinanceAgent()
_org_agent = OrgDeepAgent()

# ── Tools ─────────────────────────────────────────────────────────────────────

def _with_sources(result: str, agent: object) -> str:
    sources = [s for s in getattr(agent, 'last_sources', []) if s]
    if not sources:
        return result
    unique = list(dict.fromkeys(sources))
    source_lines = "\n".join(f"- {s}" for s in unique)
    return f"{result}\n\n**Sources:**\n{source_lines}"


@tool
def hr_tool(query: str) -> str:
    """Handle HR queries: leave, benefits, payroll, appraisals, POSH, PF/EPF, resignation, notice period, WFH, GHI, Practo, HROne."""
    return _with_sources(_hr_agent.process_query(query), _hr_agent)


@tool
def it_tool(query: str) -> str:
    """Handle IT queries: technical support, MFA, VPN, passwords, laptop, software, network, OneDrive, Outlook, antivirus."""
    return _with_sources(_it_agent.process_query(query), _it_agent)


@tool
def admin_tool(query: str) -> str:
    """Handle Admin queries: travel bookings, cab/ORIX/Cabman, parking, meeting rooms, office supplies, Fountainhead, facility."""
    return _with_sources(_admin_agent.process_query(query), _admin_agent)


@tool
def pmo_tool(query: str) -> str:
    """Handle PMO queries: project tracking, milestones, onboarding docs, project overviews, risk management, PMO best practices."""
    return _with_sources(_pmo_agent.process_query(query), _pmo_agent)


@tool
def finance_tool(query: str) -> str:
    """Handle Finance queries: ZOHO expenses, TDS declarations, income tax, Form 16, expense reimbursement, Kotak salary account."""
    return _with_sources(_finance_agent.process_query(query), _finance_agent)


@tool
def org_tool(query: str) -> str:
    """Handle organization queries: company mission, structure, values, culture, leadership, general company information."""
    return _with_sources(_org_agent.process_query(query), _org_agent)


@tool
def employee_tool(query: str) -> str:
    """Handle employee directory queries: find by name, contact details, department listing, org chart, headcount, skill search, self-service lookups."""
    return employee_agent_fn(query)


@tool
def escalation_tool(_query: str) -> str:
    """Escalate unresolved or sensitive issues that no other department can handle."""
    return escalation_agent_fn()


# ── Supervisor prompt ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are AURA, the Aligned Automation internal assistant.

Your job:
- Understand the user's intent
- Select the correct department tool
- Always use a tool — never answer from your own knowledge
- If a tool returns insufficient information, try another relevant tool
- Return a concise, professional response

Available departments:
- HR — leave, benefits, payroll, appraisals, policies
- IT — technical support, VPN, passwords, software, laptops
- Admin — travel, cab bookings, parking, meeting rooms, facility
- PMO — project tracking, milestones, onboarding docs
- Finance — ZOHO expenses, TDS, income tax, Form 16
- Organization — company mission, values, culture, leadership
- Employee Directory — find colleagues, contact details, org chart
- Escalation — unresolved or sensitive issues

Rules:
- Always use a tool; never invent an answer
- Keep responses concise and professional
- If the query is ambiguous, pick the most likely department
- If the tool response contains a "**Sources:**" section, preserve it verbatim at the end of your reply
"""

# ── Create supervisor via LangGraph ──────────────────────────────────────────

_supervisor = create_react_agent(
    model=llm,
    tools=[
        hr_tool,
        it_tool,
        admin_tool,
        pmo_tool,
        finance_tool,
        org_tool,
        employee_tool,
        escalation_tool,
    ],
    prompt=_SYSTEM_PROMPT,
)

# recursion_limit=5 caps the ReAct loop at 5 steps (reason→tool→reason→tool→answer),
# preventing multi-hop spirals that add several seconds each iteration.
_INVOKE_CONFIG = {"recursion_limit": 5}

_OLLAMA_DOWN_MSG = (
    "The AI service is currently unreachable. "
    "Please check that the Ollama server is running and accessible, then try again."
)

# ── Keyword-based direct router (fallback when LangGraph/Ollama unavailable) ─

_HR_KW      = {'leave', 'vacation', 'benefit', 'payroll', 'appraisal', 'posh', 'pf',
               'epf', 'resign', 'wfh', 'hrone', 'gratuity', 'notice', 'increment',
               'performance', 'training', 'referral', 'probation', 'salary', 'grievance',
               'allowance', 'maternity', 'paternity', 'sick', 'casual', 'annual'}
_IT_KW      = {'laptop', 'vpn', 'password', 'software', 'network', 'outlook', 'mfa',
               '2fa', 'antivirus', 'printer', 'hardware', 'wifi', 'internet', 'remote',
               'backup', 'helpdesk', 'onedrive', 'teams', 'account', 'lockout', 'reset',
               'install', 'virus', 'malware', 'vdi'}
_ADMIN_KW   = {'travel', 'cab', 'parking', 'meeting', 'facility', 'supply', 'orix',
               'cabman', 'visitor', 'access', 'fountainhead', 'vendor', 'reception',
               'stationery', 'accommodation', 'hotel', 'booking', 'canteen'}
_PMO_KW     = {'project', 'milestone', 'pmo', 'risk', 'resource', 'budget', 'deliverable',
               'sprint', 'portfolio', 'allocation', 'utilization', 'utilisation',
               'onboarding', 'abi', 'ncr', 'spencer', 'dell', 'status', 'timeline'}
_FINANCE_KW = {'expense', 'tds', 'tax', 'form16', 'form 16', 'reimbursement', 'kotak',
               'zoho', 'invoice', 'receipt', 'declaration', 'investment', 'finance',
               'accounts', 'deduction', 'salary slip'}
_ORG_KW     = {'mission', 'vision', 'values', 'culture', 'leadership', 'org', 'company',
               'history', 'dei', 'diversity', 'inclusion', 'structure', 'department',
               'hierarchy', 'policy'}
_EMP_PATS   = re.compile(
    r'\b(employee|colleague|staff|directory|who is|find|contact|'
    r'email of|phone of|mobile of|headcount|head count)\b', re.IGNORECASE
)


def _route_direct(query: str) -> str:
    """Keyword router — picks a domain agent without needing the LLM supervisor."""
    q_words = set(re.findall(r'\b\w+\b', query.lower()))
    if _EMP_PATS.search(query):
        return employee_agent_fn(query)
    for kw_set, handler in (
        (_HR_KW,      lambda q: _with_sources(_hr_agent.process_query(q),      _hr_agent)),
        (_IT_KW,      lambda q: _with_sources(_it_agent.process_query(q),      _it_agent)),
        (_ADMIN_KW,   lambda q: _with_sources(_admin_agent.process_query(q),   _admin_agent)),
        (_PMO_KW,     lambda q: _with_sources(_pmo_agent.process_query(q),     _pmo_agent)),
        (_FINANCE_KW, lambda q: _with_sources(_finance_agent.process_query(q), _finance_agent)),
        (_ORG_KW,     lambda q: _with_sources(_org_agent.process_query(q),     _org_agent)),
    ):
        if q_words & kw_set:
            return handler(query)
    # Default: HR handles most general workplace queries
    return _with_sources(_hr_agent.process_query(query), _hr_agent)


# ── LRU cache for repeated queries ───────────────────────────────────────────
# Skips the full LLM+retrieval pipeline for identical queries (common in demos).
@functools.lru_cache(maxsize=256)
def _cached_invoke(query: str) -> str:
    if not _ollama_available:
        return _route_direct(query)
    try:
        result = _supervisor.invoke({"messages": [("user", query)]}, config=_INVOKE_CONFIG)
        messages = result.get("messages", [])
        if not messages:
            return "No response generated."
        final = messages[-1]
        content = final.content if hasattr(final, "content") else str(final)
        return content.strip() or "No response generated."
    except Exception as exc:
        print(f"[MasterAgent] Supervisor invoke error ({exc}) — direct routing fallback")
        return _route_direct(query)


# ── MasterAgent ───────────────────────────────────────────────────────────────

class MasterAgent:

    def process_query(self, query: str, _user_email: str = "") -> str:
        q = query.strip()
        if not q:
            return "Please enter a question."

        if _is_greeting(q):
            return _GREETING_RESPONSE

        is_blocked, category, fallback = check_input(q)
        if is_blocked:
            return fallback

        try:
            return _cached_invoke(q)
        except Exception as exc:
            print(f"[MasterAgent] Supervisor error: {exc}")
            return (
                "I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly."
            )

    def stream_query(self, query: str) -> Generator[str, None, None]:
        """Yield SSE-formatted chunks. Each chunk is a JSON object: {content: str}."""
        q = query.strip()
        if not q:
            yield _sse({"content": "Please enter a question."})
            yield _sse_done()
            return

        if _is_greeting(q):
            yield _sse({"content": _GREETING_RESPONSE})
            yield _sse_done()
            return

        is_blocked, category, fallback = check_input(q)
        if is_blocked:
            yield _sse({"content": fallback})
            yield _sse_done()
            return

        streamed = False
        if _ollama_available:
            try:
                for chunk, metadata in _supervisor.stream(
                    {"messages": [("user", q)]},
                    config=_INVOKE_CONFIG,
                    stream_mode="messages",
                ):
                    # Only stream token chunks from the agent node (not tool output)
                    if (
                        hasattr(chunk, "content")
                        and chunk.content
                        and metadata.get("langgraph_node") == "agent"
                    ):
                        yield _sse({"content": chunk.content})
                        streamed = True
            except Exception as exc:
                print(f"[MasterAgent] Stream error ({exc}) — direct routing fallback")

        if not streamed:
            yield _sse({"content": _route_direct(q)})

        yield _sse_done()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _sse_done() -> str:
    return "data: [DONE]\n\n"


# ── Singleton + public entry points ──────────────────────────────────────────
_master = MasterAgent()


def run_assistant(query: str, user_email: str = "") -> str:
    return _master.process_query(query, user_email)


def stream_assistant(query: str, _user_email: str = "") -> Generator[str, None, None]:
    return _master.stream_query(query)
