"""
Base class for all domain deep agents.

Pipeline (single LLM call per query):
  1. Understand intent + retrieve from pgvector
  2. Adaptive retry: if pgvector returns nothing, simplify the query and retry once
  3. Supplement with local KB (FAISS/keyword)
  4. Generate: intent-aware prompt instructs LLM to understand, answer, self-verify
     and cite sources inline — all in one generation pass

self.last_sources is populated after every process_query() call.
"""
import os
from typing import List, Optional, Tuple

from .config import DeepAgentConfig
from .knowledge_base import KnowledgeBase
from app.agents.working.tools.tavily_search import tavily_search, is_tavily_available
from app.agents.guardrails import GENERIC_GUARDRAIL, ORG_GUARDRAIL

try:
    from app.memory import MemoryClient as _MemoryClient
    _memory_client = _MemoryClient()
except Exception:
    _memory_client = None

_AGENTS_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_ROOT = os.path.join(_AGENTS_DIR, "data")

# ── Agent prompt ──────────────────────────────────────────────────────────────

_AGENT_SYSTEM = """{personality}

{generic_guardrail}

{org_guardrail}

---
**Company context (prefer this when it covers the question):**
{context}
---

**Output rules (follow strictly):**
- Write a direct, helpful answer -- no section labels, no reasoning steps, no preamble.
- Prefer the company context above; quote exact values (days, percentages, deadlines, portal names) when present.
- Use numbered lists for step-by-step processes; bullet points for factual lists.
- Cite the document name inline when useful: e.g. "Per the Leave Policy, annual leave is 18 days."
- If the company context does not cover the question, you may still help using general professional knowledge -- but flag it clearly ("Generally, ...") so the user knows it's not policy.
- Only say "I don't have that information. Please contact {fallback_contact}." when the question requires information only a specific team can provide (e.g. exact personal account balances, individual approvals).
"""

_AGENT_HUMAN = """{query}"""


class BaseDeepAgent:
    _DATA_FOLDERS: List[str] = []
    _PERSONALITY: str = ""
    _FALLBACK_CONTACT: str = "your department contact"

    def __init__(self, config: Optional[DeepAgentConfig] = None):
        self._config = config or DeepAgentConfig()
        self._kb = KnowledgeBase(
            data_folders=self._DATA_FOLDERS,
            kb_config=self._config.knowledge_base,
            emb_config=self._config.embeddings,
        )
        self._llm = None
        self._chain = None
        self._mode = "keyword"
        self.last_sources: List[str] = []
        self._setup_llm()

    @property
    def mode(self) -> str:
        return self._mode

    def process_query(self, query: str, user_id: str = "", **_) -> str:
        self.last_sources = []
        if self._mode == "llm":
            return self._llm_query(query, user_id=user_id)
        return self._keyword_query(query)

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def _setup_llm(self):
        try:
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            from .config import build_chat_llm

            llm, url, model = build_chat_llm(self._config.llm)
            if llm is None:
                print(f"[{self.__class__.__name__}] All Ollama endpoints unreachable — keyword fallback")
                self._mode = "keyword"
                return

            prompt = ChatPromptTemplate.from_messages([
                ("system", _AGENT_SYSTEM),
                ("human", _AGENT_HUMAN),
            ])
            self._llm = llm
            self._chain = prompt | self._llm | StrOutputParser()
            self._mode = "llm"
            print(f"[{self.__class__.__name__}] mode=llm | endpoint={url} | model={model}")

        except Exception as exc:
            print(f"[{self.__class__.__name__}] LLM setup failed ({exc}) -- keyword fallback")
            self._mode = "keyword"

    # ------------------------------------------------------------------
    # pgvector retrieval
    # ------------------------------------------------------------------

    # Lowered from 0.25 -- many valid policy chunks score in the 0.10-0.25 band.
    _SIMILARITY_THRESHOLD = 0.10
    _DEFAULT_TOP_K = 10

    def _retrieve_pgvector(self, query: str, top_k: int = None) -> Tuple[str, List[str]]:
        if top_k is None:
            top_k = self._DEFAULT_TOP_K
        try:
            from app.rag.retriever import retrieve_chunks
            chunks = retrieve_chunks(query, top_k=top_k)
            if not chunks:
                print(f"[{self.__class__.__name__}] pgvector: 0 chunks for {query[:60]!r}")
                return "", []

            scores = [round(c.get("similarity") or 0, 3) for c in chunks]
            print(f"[{self.__class__.__name__}] pgvector hit={len(chunks)} scores={scores[:5]} threshold={self._SIMILARITY_THRESHOLD}")

            relevant = [c for c in chunks if (c.get("similarity") or 0) >= self._SIMILARITY_THRESHOLD]
            if not relevant:
                # Keep top 3 even below threshold -- weak context beats nothing.
                relevant = chunks[:3]
                print(f"[{self.__class__.__name__}] all below threshold; keeping top {len(relevant)}")

            context = "\n\n".join(
                f"[{c.get('document_name', 'Company Document')}]\n{c['chunk_text']}"
                for c in relevant if c.get("chunk_text")
            )
            sources = []
            for c in relevant:
                doc_name = c.get("document_name", "")
                url = c.get("source_url", "")
                if doc_name and url:
                    sources.append(f"[{doc_name}]({url})")
                elif doc_name:
                    sources.append(doc_name)
            return context, sources
        except Exception as exc:
            print(f"[{self.__class__.__name__}] pgvector error ({exc})")
            return "", []

    def _simplified_query(self, query: str) -> str:
        skip = {'what', 'when', 'where', 'how', 'why', 'who', 'is', 'are', 'can',
                'the', 'a', 'an', 'do', 'does', 'i', 'my', 'me', 'for', 'to', 'of'}
        words = [w for w in query.lower().split() if w not in skip and len(w) > 2]
        simplified = " ".join(words[:6])
        return simplified if simplified and simplified != query.lower() else ""

    # ------------------------------------------------------------------
    # Tier 1 -- LCEL chain
    # ------------------------------------------------------------------

    def _llm_query(self, query: str, user_id: str = "") -> str:
        try:
            # Primary pgvector search
            pg_context, pg_sources = self._retrieve_pgvector(query)

            # Retry with simplified query when nothing came back
            if not pg_context:
                simplified = self._simplified_query(query)
                if simplified:
                    pg_context, pg_sources = self._retrieve_pgvector(simplified, top_k=6)

            self.last_sources = list(dict.fromkeys(s for s in pg_sources if s))

            # Supplementary: local KB
            docs = self._kb.retrieve(query)
            for d in docs:
                src = d.metadata.get("source", "")
                if src and src not in self.last_sources:
                    self.last_sources.append(src)
            local_context = "\n\n".join(
                f"[{d.metadata.get('source', '')}]\n{d.page_content}" for d in docs
            )

            # Per-user memory context (preferences + conversation history)
            memory_context = ""
            if user_id and _memory_client:
                try:
                    memory_context = _memory_client.get_context(user_id, query)
                except Exception:
                    pass

            # Optional web search
            web_context = tavily_search(query) if is_tavily_available() else ""

            context_parts = [p for p in [memory_context, pg_context, local_context] if p]
            if web_context:
                context_parts.append(f"[Web]\n{web_context}")

            if not context_parts:
                # No context at all -- let the LLM try with its own knowledge.
                full_context = (
                    "(No matching company documents found. Answer using your role knowledge "
                    "and flag clearly when guidance is general rather than policy-specific.)"
                )
            else:
                full_context = "\n\n".join(context_parts)

            print(
                f"[{self.__class__.__name__}] context_len={len(full_context)} "
                f"sources={len(self.last_sources)} memory={'on' if memory_context else 'off'}"
            )

            result = self._chain.invoke({
                "personality": self._PERSONALITY,
                "generic_guardrail": GENERIC_GUARDRAIL,
                "org_guardrail": ORG_GUARDRAIL,
                "context": full_context,
                "query": query,
                "fallback_contact": self._FALLBACK_CONTACT,
            })
            return result.strip() if result else f"I don't have information on that topic. Please contact {self._FALLBACK_CONTACT}."

        except Exception as exc:
            print(f"[{self.__class__.__name__}] LLM chain error: {exc}")
            return self._keyword_query(query)

    # ------------------------------------------------------------------
    # Tier 2 — No-LLM fallback: format retrieved chunks as readable prose
    # ------------------------------------------------------------------

    def _keyword_query(self, query: str) -> str:
        pg_context, pg_sources = self._retrieve_pgvector(query, top_k=6)
        self.last_sources = list(dict.fromkeys(s for s in pg_sources if s))

        web_context = tavily_search(query) if is_tavily_available() else ""

        if pg_context:
            return self._prose(pg_context, web_context)

        docs = self._kb.retrieve(query)
        for d in docs:
            src = d.metadata.get("source", "")
            if src and src not in self.last_sources:
                self.last_sources.append(src)
        if docs:
            return self._prose(
                "\n\n".join(d.page_content for d in docs[:3]), web_context
            )

        if web_context:
            return f"{web_context}\n\nFor more details, contact {self._FALLBACK_CONTACT}."

        return f"I don't have information on that topic. Please contact {self._FALLBACK_CONTACT}."

    def _prose(self, context: str, web_context: str = "") -> str:
        """Format retrieved chunks grouped by document name."""
        sections: List[Tuple[str, str]] = []
        current_doc, current_lines = "", []
        for raw in context.split("\n"):
            line = raw.strip()
            if line.startswith("[") and line.endswith("]"):
                if current_lines:
                    sections.append((current_doc, " ".join(current_lines)))
                current_doc, current_lines = line[1:-1], []
            elif line:
                current_lines.append(line)
        if current_lines:
            sections.append((current_doc, " ".join(current_lines)))

        parts = []
        for doc_name, content in sections:
            header = f"**{doc_name}**\n" if doc_name else ""
            parts.append(f"{header}{content}")

        result = "\n\n".join(parts) if parts else context
        if web_context:
            result += f"\n\n**Additional context:**\n{web_context}"
        result += f"\n\nFor more details, contact {self._FALLBACK_CONTACT}."
        return result
