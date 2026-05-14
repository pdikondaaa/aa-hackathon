"""
Base class for all domain deep agents.
Each domain agent subclasses this, supplying its data folders, personality,
and fallback contact — all execution logic lives here.
"""
import os
from typing import List, Optional, Tuple

from .config import DeepAgentConfig
from .knowledge_base import KnowledgeBase
from app.agents.working.tools.tavily_search import tavily_search, is_tavily_available
from app.agents.guardrails import GENERIC_GUARDRAIL, ORG_GUARDRAIL

_AGENTS_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_ROOT = os.path.join(_AGENTS_DIR, "data")


class BaseDeepAgent:
    """
    Two-tier execution:
      1. LLM  — pgvector DB embeddings (primary) + local KB (supplementary) + ChatOllama
      2. Keyword — pgvector chunks formatted as readable prose, no LLM

    After every process_query() call, self.last_sources holds the list
    of document filenames/URLs that were used to build the answer.
    """

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
        self._mode = "keyword"
        self.last_sources: List[str] = []
        self._setup_llm()

    @property
    def mode(self) -> str:
        return self._mode

    def process_query(self, query: str) -> str:
        self.last_sources = []
        if self._mode == "llm":
            return self._llm_query(query)
        return self._keyword_query(query)

    # ------------------------------------------------------------------
    # pgvector retrieval helper
    # ------------------------------------------------------------------

    def _retrieve_pgvector(self, query: str, top_k: int = 5) -> Tuple[str, List[str]]:
        """Query the PostgreSQL/pgvector DB. Returns (context_text, source_names)."""
        try:
            from app.rag.retriever import retrieve_chunks
            chunks = retrieve_chunks(query, top_k=top_k)
            if not chunks:
                return "", []
            context = "\n\n".join(
                f"[{c.get('document_name', 'Company Document')}]\n{c['chunk_text']}"
                for c in chunks if c.get("chunk_text")
            )
            sources = [
                c.get("source_url") or c.get("document_name", "")
                for c in chunks if c.get("source_url") or c.get("document_name")
            ]
            return context, sources
        except Exception as exc:
            print(f"[{self.__class__.__name__}] pgvector retrieval error ({exc})")
            return "", []

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama

            self._llm = ChatOllama(
                base_url=self._config.llm.base_url,
                model=self._config.llm.model,
                temperature=self._config.llm.temperature,
                num_predict=self._config.llm.max_tokens,
            )
            self._mode = "llm"
            print(f"[{self.__class__.__name__}] mode=llm | model={self._config.llm.model}")

        except Exception as exc:
            print(f"[{self.__class__.__name__}] LLM setup failed ({exc}) — keyword fallback")
            self._mode = "keyword"

    # ------------------------------------------------------------------
    # Tier 1 — LLM + pgvector (primary) + local KB (supplementary)
    # ------------------------------------------------------------------

    def _llm_query(self, query: str) -> str:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            # pgvector is primary — always query DB embeddings first
            pg_context, pg_sources = self._retrieve_pgvector(query, top_k=8)
            self.last_sources = list(dict.fromkeys(s for s in pg_sources if s))

            # local KB as supplementary context
            docs = self._kb.retrieve(query)
            for d in docs:
                src = d.metadata.get("source", "")
                if src and src not in self.last_sources:
                    self.last_sources.append(src)
            local_context = "\n\n".join(
                f"[{d.metadata.get('source', '')}]\n{d.page_content}" for d in docs
            )

            web_context = tavily_search(query) if is_tavily_available() else ""

            # pgvector always listed first so LLM sees it as authoritative
            context_parts = [p for p in [pg_context, local_context] if p]
            full_context = "\n\n".join(context_parts)
            if web_context:
                full_context += f"\n\n[Live web context — use only if above is insufficient]\n{web_context}"

            if not full_context:
                return self._keyword_query(query)

            system_content = (
                self._PERSONALITY
                + f"\n\n{GENERIC_GUARDRAIL}\n\n{ORG_GUARDRAIL}"
                + f"\n\n**Context:**\n{full_context}"
            )
            messages = [
                SystemMessage(content=system_content),
                HumanMessage(content=query),
            ]
            return self._llm.invoke(messages).content
        except Exception as exc:
            print(f"[{self.__class__.__name__}] LLM error ({exc}); falling back to keyword tier")
        return self._keyword_query(query)

    # ------------------------------------------------------------------
    # Tier 2 — Keyword fallback (no LLM: format pgvector chunks as prose)
    # ------------------------------------------------------------------

    def _keyword_query(self, query: str) -> str:
        pg_context, pg_sources = self._retrieve_pgvector(query, top_k=8)
        self.last_sources = list(dict.fromkeys(s for s in pg_sources if s))

        web_context = tavily_search(query) if is_tavily_available() else ""

        if pg_context:
            return self._format_pg_as_prose(pg_context, web_context)

        # last resort: local KB keyword search
        docs = self._kb.retrieve(query)
        for d in docs:
            src = d.metadata.get("source", "")
            if src and src not in self.last_sources:
                self.last_sources.append(src)
        if docs:
            local_text = "\n\n".join(d.page_content for d in docs[:3])
            return self._format_pg_as_prose(local_text, web_context)

        if web_context:
            return f"{web_context}\n\nFor more details, contact {self._FALLBACK_CONTACT}."

        return (
            f"I couldn't find specific information for your query. "
            f"Please contact {self._FALLBACK_CONTACT}."
        )

    def _format_pg_as_prose(self, context: str, web_context: str = "") -> str:
        """Group pgvector chunks by document name and return readable paragraphs."""
        sections: List[tuple] = []
        current_doc = ""
        current_lines: List[str] = []

        for raw_line in context.split("\n"):
            line = raw_line.strip()
            if line.startswith("[") and line.endswith("]"):
                if current_lines:
                    sections.append((current_doc, " ".join(current_lines)))
                current_doc = line[1:-1]
                current_lines = []
            elif line:
                current_lines.append(line)

        if current_lines:
            sections.append((current_doc, " ".join(current_lines)))

        if not sections:
            return context

        parts = []
        for doc_name, content in sections:
            header = f"**{doc_name}**\n" if doc_name else ""
            parts.append(f"{header}{content}")

        result = "\n\n".join(parts)
        if web_context:
            result += f"\n\n**Additional Information:**\n{web_context}"
        result += f"\n\nFor more details, contact {self._FALLBACK_CONTACT}."
        return result
