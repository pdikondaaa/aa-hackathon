import os
from typing import Optional

from .config import DeepAgentConfig
from .knowledge_base import KnowledgeBase
from .personalities import HR_PERSONALITY

_DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "hr_policies.txt")


class HRDeepAgent:
    """
    HR assistant powered by LangChain + Ollama + RAG.

    Three-tier execution strategy (most capable → simplest):
      1. RAG chain  — FAISS retriever + ChatOllama + stuffed prompt
      2. LLM + manual context — ChatOllama with keyword-retrieved context
      3. Keyword fallback — plain text search, no LLM (always available)
    """

    def __init__(self, config: Optional[DeepAgentConfig] = None):
        self._config = config or DeepAgentConfig()
        self._kb = KnowledgeBase(
            data_file=_DATA_FILE,
            kb_config=self._config.knowledge_base,
            emb_config=self._config.embeddings,
        )
        self._llm = None
        self._chain = None
        self._mode = "keyword"

        self._setup_llm()

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def process_query(self, query: str) -> str:
        """Route query through the best available execution tier."""
        if self._mode == "rag":
            return self._rag_query(query)
        if self._mode == "llm":
            return self._llm_query(query)
        return self._keyword_query(query)

    @property
    def mode(self) -> str:
        """Active execution mode: 'rag' | 'llm' | 'keyword'"""
        return self._mode

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
                system_prompt = HR_PERSONALITY + "\n\n**Relevant HR Policy Context:**\n{context}"
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input}"),
                ])
                doc_chain = create_stuff_documents_chain(self._llm, prompt)
                self._chain = create_retrieval_chain(retriever, doc_chain)
                self._mode = "rag"
            else:
                self._mode = "llm"

            print(f"[HRDeepAgent] Ready | mode={self._mode} | model={self._config.llm.model}")

        except ImportError as exc:
            print(f"[HRDeepAgent] LangChain/Ollama not available ({exc}) — keyword fallback active")
            self._mode = "keyword"

    # ------------------------------------------------------------------
    # Execution tiers
    # ------------------------------------------------------------------

    def _rag_query(self, query: str) -> str:
        try:
            result = self._chain.invoke({"input": query})
            answer = result.get("answer", "")
            if answer:
                return answer
        except Exception as exc:
            print(f"[HRDeepAgent] RAG chain error ({exc}); falling back to LLM tier")
        return self._llm_query(query)

    def _llm_query(self, query: str) -> str:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            docs = self._kb.retrieve(query)
            context = "\n\n".join(doc.page_content for doc in docs)
            messages = [
                SystemMessage(content=HR_PERSONALITY + f"\n\n**Relevant HR Policy Context:**\n{context}"),
                HumanMessage(content=query),
            ]
            response = self._llm.invoke(messages)
            return response.content
        except Exception as exc:
            print(f"[HRDeepAgent] LLM error ({exc}); falling back to keyword tier")
        return self._keyword_query(query)

    def _keyword_query(self, query: str) -> str:
        docs = self._kb.retrieve(query)
        if not docs:
            return (
                f"I couldn't find specific HR information for: '{query}'. "
                "Please contact HR directly at hr@company.com or call +1-800-HR-HELP."
            )
        lines = []
        for doc in docs:
            for line in doc.page_content.split("\n"):
                stripped = line.strip()
                if stripped:
                    lines.append(stripped)

        response = f"Based on our HR policies:\n\n"
        response += "\n".join(f"• {line}" for line in lines[:12])
        response += "\n\nFor more details contact hr@company.com or call +1-800-HR-HELP."
        return response
