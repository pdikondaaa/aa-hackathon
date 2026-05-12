"""
PostgreSQL + pgvector data access layer for the ingestion job.

Responsibilities:
- Upsert document records (with checksum tracking for incremental sync)
- Delete stale chunks before re-ingesting a changed document
- Bulk-insert new chunks with their vector embeddings
- Expose similarity_search() for use by the runtime retriever service

Tables used:
  documents        — one row per SharePoint file, tracks checksum + metadata
  document_chunks  — one row per text chunk, stores chunk text + embedding vector
"""
import re
from typing import Optional

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor, Json, execute_values
from pgvector.psycopg2 import register_vector

from config.settings import settings
from utils.hashing import compute_sha256
from utils.logging_config import get_logger

logger = get_logger(__name__)

# Always connect to the 'aura' database regardless of SQL_DB env override
_AURA_URL = re.sub(r'/[^/?#]+(\?.*)?$', r'/aura\1', settings.database_url)


class DocumentRepository:
    """All database interactions for the ingestion pipeline."""

    def __init__(self):
        self._conn = None

    # ─── Connection management ────────────────────────────────────────────────

    def _get_conn(self):
        if self._conn is None or self._conn.closed:
            logger.debug(
                f"Connecting to PostgreSQL: {settings.SQL_HOST}:{settings.SQL_PORT}/aura"
            )
            self._conn = psycopg2.connect(_AURA_URL)
            register_vector(self._conn)
        return self._conn

    def close(self):
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.debug("Database connection closed")

    # ─── Document operations ──────────────────────────────────────────────────

    def get_document_by_source_path(self, source_path: str) -> Optional[dict]:
        """Return the document row for a given source path, or None."""
        conn = self._get_conn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM documents WHERE source_path = %s",
                (source_path,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def upsert_document(self, doc: dict) -> str:
        """
        Insert a new document record or update an existing one (matched on source_path).
        Returns the UUID of the affected row.

        Expected keys in doc:
          source_system, document_name, source_path, document_type,
          checksum, visibility, tags (dict), last_modified
        """
        conn = self._get_conn()
        doc_copy = dict(doc)
        doc_copy["tags"] = Json(doc_copy.get("tags") or {})
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (
                    source_system, document_name, source_path, document_type,
                    checksum, visibility, tags, last_modified, indexed_at, status, updated_at
                )
                VALUES (
                    %(source_system)s, %(document_name)s, %(source_path)s, %(document_type)s,
                    %(checksum)s, %(visibility)s, %(tags)s,
                    %(last_modified)s, NOW(), 'indexed', NOW()
                )
                ON CONFLICT (source_path) DO UPDATE SET
                    document_name = EXCLUDED.document_name,
                    document_type = EXCLUDED.document_type,
                    checksum      = EXCLUDED.checksum,
                    tags          = EXCLUDED.tags,
                    last_modified = EXCLUDED.last_modified,
                    indexed_at    = NOW(),
                    status        = 'indexed',
                    updated_at    = NOW()
                RETURNING id
                """,
                doc_copy,
            )
            doc_id = str(cur.fetchone()[0])
            conn.commit()
        logger.debug(f"Upserted document {doc['document_name']} → id={doc_id}")
        return doc_id

    # ─── Chunk operations ─────────────────────────────────────────────────────

    def delete_document_chunks(self, document_id: str):
        """Remove all existing chunks for a document (called before re-ingestion)."""
        conn = self._get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM document_chunks WHERE document_id = %s",
                (document_id,),
            )
            deleted = cur.rowcount
            conn.commit()
        logger.debug(f"Deleted {deleted} stale chunks for document_id={document_id}")

    def insert_chunks(
        self,
        document_id: str,
        chunks: list,
        embeddings: list,
        metadata: dict,
    ):
        """
        Bulk-upsert text chunks with their vector embeddings.

        Args:
            document_id: UUID string of the parent document row
            chunks:      list of text strings
            embeddings:  parallel list of float vectors (len must equal len(chunks))
            metadata:    JSONB dict stored on every chunk row
        """
        if not chunks:
            return

        records = [
            (
                document_id,
                idx,
                compute_sha256(text.encode("utf-8")),
                text,
                np.array(emb, dtype=np.float32),
                settings.EMBEDDING_MODEL,
                Json(metadata),
            )
            for idx, (text, emb) in enumerate(zip(chunks, embeddings))
        ]

        conn = self._get_conn()
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO document_chunks
                    (document_id, chunk_index, chunk_hash, chunk_text,
                     embedding, embedding_model, metadata)
                VALUES %s
                ON CONFLICT (document_id, chunk_index) DO UPDATE SET
                    chunk_hash      = EXCLUDED.chunk_hash,
                    chunk_text      = EXCLUDED.chunk_text,
                    embedding       = EXCLUDED.embedding,
                    embedding_model = EXCLUDED.embedding_model,
                    metadata        = EXCLUDED.metadata
                """,
                records,
            )
            conn.commit()
        logger.info(f"Inserted {len(records)} chunks for document_id={document_id}")

    # ─── Retrieval (used by runtime retriever service) ────────────────────────

    def similarity_search(self, query_embedding: list, top_k: int = 10) -> list:
        """
        Cosine similarity search over document_chunks.

        Returns a list of dicts:
          chunk_text, metadata, document_name, source_path, source_url, similarity
        """
        conn = self._get_conn()
        vec = np.array(query_embedding, dtype=np.float32)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    dc.chunk_text,
                    dc.metadata,
                    d.document_name,
                    d.source_path,
                    d.tags->>'source_url'   AS source_url,
                    1 - (dc.embedding <=> %s::vector) AS similarity
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                ORDER BY dc.embedding <=> %s::vector
                LIMIT %s
                """,
                (vec, vec, top_k),
            )
            return [dict(row) for row in cur.fetchall()]
