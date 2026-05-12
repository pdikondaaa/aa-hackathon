"""
Runtime retriever — queries PostgreSQL + pgvector for semantically similar chunks.

This is the ONLY data source used by LangGraph agents and API endpoints at query time.
SharePoint is never contacted here. Documents are pre-ingested by the scheduled job
at jobs/sharepoint_ingestion/.

Usage:
    from app.rag.retriever import retrieve_chunks

    results = retrieve_chunks("What is the leave policy?", top_k=10)
    # returns: [{"chunk_text": ..., "file_name": ..., "source_url": ..., "similarity": ...}, ...]
"""
import os
from functools import lru_cache
from typing import Optional
from urllib.parse import quote_plus

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

# ── Configuration (reads from environment / .env) ─────────────────────────────
_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
_DB_HOST = os.getenv("SQL_HOST", "localhost")
_DB_PORT = os.getenv("SQL_PORT", "5432")
_DB_USER = os.getenv("SQL_USERNAME", "")
_DB_PWD  = os.getenv("SQL_PWD", "")
_DB_NAME = os.getenv("SQL_DB", "aura_db")
_DB_URL  = f"postgresql://{quote_plus(_DB_USER)}:{quote_plus(_DB_PWD)}@{_DB_HOST}:{_DB_PORT}/{_DB_NAME}"


@lru_cache(maxsize=1)
def _get_embedder() -> HuggingFaceEmbeddings:
    """Lazily load and cache the embedding model (loaded once per process)."""
    return HuggingFaceEmbeddings(model_name=_EMBEDDING_MODEL)


def _get_db_conn():
    conn = psycopg2.connect(_DB_URL)
    register_vector(conn)
    return conn


# ── Public API ────────────────────────────────────────────────────────────────

def retrieve_chunks(query: str, top_k: int = 10) -> list:
    """
    Embed the query and return the top_k most similar document chunks
    from PostgreSQL using cosine distance (pgvector).

    Args:
        query:  Natural-language question from the user.
        top_k:  Number of chunks to return (default 10).

    Returns:
        List of dicts with keys:
            chunk_text     — raw text of the chunk
            file_name      — original filename (e.g. HR_Policy.pdf)
            source_url     — SharePoint web URL for deep-linking
            sharepoint_path— SharePoint-relative path
            metadata       — JSONB dict stored at ingestion time
            similarity     — cosine similarity score (0–1)
    """
    query_vec = np.array(_get_embedder().embed_query(query), dtype=np.float32)

    conn = _get_db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    dc.chunk_text,
                    dc.metadata,
                    d.file_name,
                    d.source_url,
                    d.sharepoint_path,
                    1 - (dc.embedding <=> %s::vector) AS similarity
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                ORDER BY dc.embedding <=> %s::vector
                LIMIT %s
                """,
                (query_vec, query_vec, top_k),
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def retrieve_context_text(query: str, top_k: int = 10) -> str:
    """
    Convenience wrapper — returns retrieved chunks joined as a single context string,
    ready to be injected into an LLM prompt.
    """
    chunks = retrieve_chunks(query, top_k=top_k)
    return "\n\n".join(c["chunk_text"] for c in chunks)
