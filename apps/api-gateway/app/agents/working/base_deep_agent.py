"""
Base class for all domain deep agents.
Each domain agent subclasses this, supplying its data folders, personality,
and fallback contact — all execution logic lives here.
"""
import os
from typing import List, Optional

from .config import DeepAgentConfig
from .knowledge_base import KnowledgeBase
from app.agents.working.tools.tavily_search import tavily_search, is_tavily_available

_AGENTS_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_ROOT = os.path.join(_AGENTS_DIR, "data")


class BaseDeepAgent:
    """
    Three-tier execution (most capable → simplest):
      1. RAG   — FAISS retriever + ChatOllama
      2. LLM   — ChatOllama with manual context
      3. Keyword — plain text search, no LLM

    After every process_query() call, self.last_sources holds the list
    of document filenames that were actually used to build the answer.
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
        self._chain = None
        self._mode = "keyword"
        self.last_sources: List[str] = []
        self._setup_llm()

    @property
    def mode(self) -> str:
        return self._mode

    def process_query(self, query: str) -> str:
        self.last_sources = []
        if self._mode == "rag":
            return self._rag_query(query)
        if self._mode == "llm":
            return self._llm_query(query)
        return self._keyword_query(query)

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def _setup_llm(self):
        try:
            from langchain_ollama import ChatOllama
            from langchain_core.prompts import ChatPromptTemplate
            from langchain.chains.combine_documents import create_stuff_documents_chain
            from langchain.chains import create_retrieval_chain

            self._llm = ChatOllama(
                base_url=self._config.llm.base_url,
                model=self._config.llm.model,
                temperature=self._config.llm.temperature,
                num_predict=self._config.llm.max_tokens,
            )
            retriever = self._kb.as_retriever()
            if retriever:
                system_prompt = self._PERSONALITY + "\n\n**Context from company documents:**\n{context}"
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input}"),
                ])
                self._chain = create_retrieval_chain(
                    retriever, create_stuff_documents_chain(self._llm, prompt)
                )
                self._mode = "rag"
            else:
                self._mode = "llm"

            print(f"[{self.__class__.__name__}] mode={self._mode} | model={self._config.llm.model}")

        except ImportError as exc:
            print(f"[{self.__class__.__name__}] LangChain/Ollama unavailable ({exc}) — keyword fallback")
            self._mode = "keyword"

    # ------------------------------------------------------------------
    # Tier 1 — RAG
    # ------------------------------------------------------------------

    def _rag_query(self, query: str) -> str:
        try:
            web_context = tavily_search(query) if is_tavily_available() else ""
            input_query = f"{query}\n\n[Additional web context:\n{web_context}]" if web_context else query

            result = self._chain.invoke({"input": input_query})

            # Extract exact source documents used
            self.last_sources = list(dict.fromkeys(
                doc.metadata.get("source", "")
                for doc in result.get("context", [])
                if doc.metadata.get("source")
            ))

            answer = result.get("answer", "")
            if answer:
                return answer
        except Exception as exc:
            print(f"[{self.__class__.__name__}] RAG error ({exc}); falling back to LLM tier")
        return self._llm_query(query)

    # ------------------------------------------------------------------
    # Tier 2 — LLM + manual context
    # ------------------------------------------------------------------

    def _llm_query(self, query: str) -> str:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            docs = self._kb.retrieve(query)
            self.last_sources = list(dict.fromkeys(
                d.metadata.get("source", "") for d in docs if d.metadata.get("source")
            ))

            local_context = "\n\n".join(
                f"[{d.metadata.get('source', '')}]\n{d.page_content}" for d in docs
            )
            web_context = tavily_search(query) if is_tavily_available() else ""
            full_context = local_context
            if web_context:
                full_context += f"\n\n[Live web context — use only if doc context is insufficient]\n{web_context}"

            messages = [
                SystemMessage(content=self._PERSONALITY + f"\n\n**Context:**\n{full_context}"),
                HumanMessage(content=query),
            ]
            return self._llm.invoke(messages).content
        except Exception as exc:
            print(f"[{self.__class__.__name__}] LLM error ({exc}); falling back to keyword tier")
        return self._keyword_query(query)

    # ------------------------------------------------------------------
    # Tier 3 — Keyword fallback
    # ------------------------------------------------------------------

    def _keyword_query(self, query: str) -> str:
        docs = self._kb.retrieve(query)
        self.last_sources = list(dict.fromkeys(
            d.metadata.get("source", "") for d in docs if d.metadata.get("source")
        ))

        lines = [
            line.strip()
            for doc in docs
            for line in doc.page_content.split("\n")
            if line.strip()
        ]
        web_context = tavily_search(query) if is_tavily_available() else ""

        if not lines and not web_context:
            return (
                f"I couldn't find specific information for your query. "
                f"Please contact {self._FALLBACK_CONTACT}."
            )

        response = ""
        if lines:
            response += "Based on company documents:\n\n"
            response += "\n".join(f"• {line}" for line in lines[:12])

        if web_context:
            response += ("\n\n" if response else "") + f"**Additional web context:**\n\n{web_context}"

        response += f"\n\nFor more details, contact {self._FALLBACK_CONTACT}."
        return response
