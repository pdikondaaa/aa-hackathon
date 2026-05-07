import os
from typing import List

from langchain_core.documents import Document
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter  # langchain <0.2 fallback

from .config import KnowledgeBaseConfig, EmbeddingsConfig


class KnowledgeBase:
    """
    RAG knowledge base backed by FAISS + Ollama embeddings.

    Startup order:
      1. Try FAISS + OllamaEmbeddings  (full semantic search)
      2. Fall back to keyword/BM25-style search if embeddings are unavailable
    """

    def __init__(self, data_file: str, kb_config: KnowledgeBaseConfig, emb_config: EmbeddingsConfig):
        self._kb_config = kb_config
        self._emb_config = emb_config
        self._vectorstore = None
        self._raw_docs: List[Document] = []
        self._mode = "keyword"

        self._raw_docs = self._load_and_split(data_file)
        self._try_build_faiss()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def retrieve(self, query: str) -> List[Document]:
        if self._mode == "faiss" and self._vectorstore:
            return self._vectorstore.similarity_search(query, k=self._kb_config.top_k)
        return self._keyword_search(query)

    def as_retriever(self):
        """Return a LangChain-compatible retriever (FAISS only; None if unavailable)."""
        if self._mode == "faiss" and self._vectorstore:
            return self._vectorstore.as_retriever(search_kwargs={"k": self._kb_config.top_k})
        return None

    @property
    def mode(self) -> str:
        return self._mode

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_and_split(self, data_file: str) -> List[Document]:
        with open(data_file, "r", encoding="utf-8") as f:
            content = f.read()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._kb_config.chunk_size,
            chunk_overlap=self._kb_config.chunk_overlap,
            separators=["\n\n", "\n", ".", "!", "?", " ", ""],
        )
        doc = Document(page_content=content, metadata={"source": data_file})
        chunks = splitter.split_documents([doc])
        print(f"[KnowledgeBase] Loaded {len(chunks)} chunks from {os.path.basename(data_file)}")
        return chunks

    def _try_build_faiss(self):
        try:
            from langchain_ollama import OllamaEmbeddings
            from langchain_community.vectorstores import FAISS

            embeddings = OllamaEmbeddings(
                base_url=self._emb_config.base_url,
                model=self._emb_config.model,
            )
            self._vectorstore = FAISS.from_documents(self._raw_docs, embeddings)
            self._mode = "faiss"
            print(f"[KnowledgeBase] FAISS ready — embedding model: {self._emb_config.model}")
        except Exception as exc:
            print(f"[KnowledgeBase] FAISS unavailable ({exc}); using keyword fallback")
            self._mode = "keyword"

    def _keyword_search(self, query: str) -> List[Document]:
        query_tokens = set(query.lower().split())
        scored = []
        for doc in self._raw_docs:
            doc_tokens = set(doc.page_content.lower().split())
            overlap = len(query_tokens & doc_tokens)
            if overlap:
                scored.append((overlap, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored[: self._kb_config.top_k]]
