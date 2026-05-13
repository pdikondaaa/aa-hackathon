from app.agents.router import router
from app.agents.hr_agent import hr_agent
from app.agents.admin_agent import admin_agent
from app.agents.it_agent import it_agent
from app.agents.org_agent import org_agent
from app.agents.employee import employee_agent
from typing import Dict, Any, List

# Lazy-import retriever so startup never fails if DB is unavailable
def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


class SupervisorAgent:
    def __init__(self):
        self.agents = {
            'hr': hr_agent,
            'admin': admin_agent,
            'it': it_agent,
            'org': org_agent,
            'employee': employee_agent,
        }

        self.agent_descriptions = {
            'hr': 'Human Resources - handles leave policies, employee benefits, performance reviews, and HR procedures',
            'admin': 'Administration - manages travel, expenses, office supplies, events, and administrative procedures',
            'it': 'Information Technology - handles technical support, software/hardware issues, security, and IT policies',
            'org': 'Organization - provides company information, policies, structure, and general organizational details',
            'employee': 'Employee Directory - looks up employee details, contact info, department, title, and reporting lines from the live HR database',
        }
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
    """
    Orchestrates all domain slave agents.
    The user never needs to know which agent to choose — this class decides.
    """

    def __init__(self):
        self._slaves: Dict[str, object] = {}   # lazy-loaded domain agents
        self._llm = None
        self._setup_llm()

    # ------------------------------------------------------------------
    # LLM setup (used for routing + synthesis)
    # ------------------------------------------------------------------

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama
            from app.agents.working.config import LLMConfig
            cfg = LLMConfig()
            self._llm = ChatOllama(
                base_url=cfg.base_url,
                model=cfg.model,
                temperature=0,          # deterministic routing
                num_predict=64,         # short reply needed for routing
            )
            print("[MasterAgent] LLM routing ready")
        except Exception as exc:
            print(f"[MasterAgent] LLM routing unavailable ({exc}); keyword routing active")

    # ------------------------------------------------------------------
    # Slave agent registry (lazy singleton per domain)
    # ------------------------------------------------------------------

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
                # Wrap plain function to match the agent interface
                class _OrgWrapper:
                    last_sources: List[str] = []
                    def process_query(self, q: str) -> str:
                        return _fn(q)
                agent = _OrgWrapper()

            if agent:
                self._slaves[domain] = agent
                print(f"[MasterAgent] Slave loaded: {domain}")
        except Exception as exc:
            print(f"[MasterAgent] Could not load slave '{domain}': {exc}")

        return agent

    # ------------------------------------------------------------------
    # Routing — LLM first, keyword fallback
    # ------------------------------------------------------------------

    def _route_llm(self, query: str) -> List[str]:
        if not self._llm:
            return []
        try:
            prompt = _ROUTING_PROMPT.format(query=query)
            response = self._llm.invoke(prompt)
            content = response.content.strip()
            match = re.search(r'\[.*?\]', content, re.DOTALL)
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
            return ['hr']  # HR is the most common catch-all for employee queries
        top_score = max(scores.values())
        # Include all domains within 50% of the top score (catches multi-domain queries)
        threshold = max(1, top_score // 2)
        ranked = sorted(scores.items(), key=lambda x: -x[1])
        selected = [d for d, s in ranked if s >= threshold][:3]
        print(f"[MasterAgent] Keyword routed → {selected}")
        return selected

    def _format_rag_response(self, chunks: List[dict]):
        """Extract answer text and structured sources from vector DB chunks."""
        sources = []
        answer_parts = []
    def _route(self, query: str) -> List[str]:
        domains = self._route_llm(query)
        if not domains:
            domains = self._route_keywords(query)
        return domains

        for i, chunk in enumerate(chunks, 1):
            text = chunk.get("chunk_text", "").strip()
            file_name = chunk.get("document_name", "Unknown source")
            source_url = chunk.get("source_url") or ""
            similarity = chunk.get("similarity", 0)
    # ------------------------------------------------------------------
    # Multi-domain synthesis
    # ------------------------------------------------------------------

            if text:
                answer_parts.append(text)
    def _synthesize(self, query: str, responses: Dict[str, str]) -> str:
        formatted = "\n\n".join(
            f"[{domain.upper()} Department]\n{resp}"
            for domain, resp in responses.items()
        )
        if self._llm:
            try:
                # Use higher token limit for synthesis
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

            sources.append({
                "index": i,
                "file_name": file_name,
                "source_url": source_url,
                "similarity": round(similarity * 100),
            })
        # Fallback: labelled sections
        parts = [f"**{domain.upper()}**\n\n{resp}" for domain, resp in responses.items()]
        return "\n\n---\n\n".join(parts)

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

        return "\n\n".join(answer_parts), sources
    def process_query(self, query: str) -> str:
        if not query or not query.strip():
            return "Please enter a question."

        # 1. Route
        domains = self._route(query)

        # 2. Call each slave agent
        responses: Dict[str, str] = {}
        all_sources: List[str] = []

        for domain in domains:
            slave = self._get_slave(domain)
            if not slave:
                continue
            try:
                resp = slave.process_query(query)
                responses[domain] = resp
                sources = getattr(slave, 'last_sources', [])
                all_sources.extend(s for s in sources if s)
            except Exception as exc:
                print(f"[MasterAgent] Slave '{domain}' error: {exc}")
    def process_query(self, query: str) -> Dict[str, Any]:
        """Route query, retrieve from vector DB, fall back to static agents."""
        agent, _ = router.route_query(query)
        analysis = self._analyze_query_complexity(query)

        if not responses:
            return (
                "I couldn't find relevant information for your query. "
                "Please reach out to the appropriate department directly."
            )

        # 3. Synthesize
        final = (
            list(responses.values())[0]
            if len(responses) == 1
            else self._synthesize(query, responses)
        )

        # 4. Append deduplicated sources
        unique_sources = list(dict.fromkeys(all_sources))
        if unique_sources:
            source_list = "\n".join(f"  • {s}" for s in unique_sources)
            final += f"\n\n---\n📄 **Sources**\n{source_list}"

        return final

        if analysis['is_urgent']:
            answer += "\n\n**URGENT** — If you need immediate assistance, contact the relevant department directly."

        return {"answer": answer, "sources": sources}
# ── Singleton + public entry point (used by chat.py) ────────────────────────
_master = MasterAgent()


def run_assistant(query: str) -> str:
    return _master.process_query(query)
def run_assistant(query: str) -> Dict[str, Any]:
    """Main entry point - supervisor agent coordinates all requests."""
    return supervisor.process_query(query)
