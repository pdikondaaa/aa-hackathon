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
import json
from typing import Optional

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor, Json, execute_values
from pgvector.psycopg2 import register_vector

from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)


class DocumentRepository:
    """All database interactions for the ingestion pipeline."""

    def __init__(self):
        self._conn = None

    # ─── Connection management ────────────────────────────────────────────────

    def _get_conn(self):
        if self._conn is None or self._conn.closed:
            logger.debug(
                f"Connecting to PostgreSQL: {settings.SQL_HOST}:{settings.SQL_PORT}/{settings.SQL_DB}"
            )
            self._conn = psycopg2.connect(settings.database_url)
            register_vector(self._conn)
        return self._conn

    def close(self):
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.debug("Database connection closed")

    # ─── Document operations ──────────────────────────────────────────────────

    def get_document_by_sharepoint_path(self, sharepoint_path: str) -> Optional[dict]:
        """Return the document row for a given SharePoint path, or None."""
        conn = self._get_conn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM documents WHERE sharepoint_path = %s",
                (sharepoint_path,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def upsert_document(self, doc: dict) -> str:
        """
        Insert a new document record or update an existing one (matched on sharepoint_path).
        Returns the UUID of the affected row.

        Expected keys in doc:
          file_name, file_path, sharepoint_path, source_url,
          checksum, file_size, file_type, source, last_modified
        """
        conn = self._get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (
                    file_name, file_path, sharepoint_path, source_url,
                    checksum, file_size, file_type, source, last_modified, updated_at
                )
                VALUES (
                    %(file_name)s, %(file_path)s, %(sharepoint_path)s, %(source_url)s,
                    %(checksum)s, %(file_size)s, %(file_type)s, %(source)s,
                    %(last_modified)s, NOW()
                )
                ON CONFLICT (sharepoint_path) DO UPDATE SET
                    file_name     = EXCLUDED.file_name,
                    file_path     = EXCLUDED.file_path,
                    source_url    = EXCLUDED.source_url,
                    checksum      = EXCLUDED.checksum,
                    file_size     = EXCLUDED.file_size,
                    file_type     = EXCLUDED.file_type,
                    last_modified = EXCLUDED.last_modified,
                    updated_at    = NOW()
                RETURNING id
                """,
                doc,
            )
            doc_id = str(cur.fetchone()[0])
            conn.commit()
        logger.debug(f"Upserted document {doc['file_name']} → id={doc_id}")
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
        Bulk-insert text chunks with their vector embeddings.

        Args:
            document_id: UUID string of the parent document row
            chunks:      list of text strings
            embeddings:  parallel list of float vectors (len must equal len(chunks))
            metadata:    JSONB dict stored on every chunk row (file_name, source_url, etc.)
        """
        if not chunks:
            return

        records = [
            (
                document_id,
                idx,
                text,
                np.array(emb, dtype=np.float32),
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
                    (document_id, chunk_index, chunk_text, embedding, metadata)
                VALUES %s
                """,
                records,
            )
            conn.commit()
        logger.info(
            f"Inserted {len(records)} chunks for document_id={document_id}"
        )

    # ─── Retrieval (used by runtime retriever service) ────────────────────────

    def similarity_search(self, query_embedding: list, top_k: int = 10) -> list:
        """
        Cosine similarity search over document_chunks.

        Returns a list of dicts:
          chunk_text, metadata, file_name, source_url, sharepoint_path, similarity
        """
        conn = self._get_conn()
        vec = np.array(query_embedding, dtype=np.float32)
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
                (vec, vec, top_k),
            )
            return [dict(row) for row in cur.fetchall()]
