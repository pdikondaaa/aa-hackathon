"""
One-time database schema initialisation for the AURA ingestion pipeline.

Run this script ONCE before executing the ingestion job for the first time,
or whenever the schema needs to be re-created on a fresh database.

Usage:
    cd jobs/sharepoint_ingestion
    python create_schema.py
"""
import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import psycopg2
from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger("create_schema")

_SCHEMA_SQL = """
-- ── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── documents ───────────────────────────────────────────────────────────────
-- One row per SharePoint file. Checksum enables incremental sync.
CREATE TABLE IF NOT EXISTS documents (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name       TEXT        NOT NULL,
    file_path       TEXT        NOT NULL,
    sharepoint_path TEXT        NOT NULL,
    source_url      TEXT,
    checksum        VARCHAR(64) NOT NULL,
    file_size       BIGINT,
    file_type       VARCHAR(20),
    source          TEXT        DEFAULT 'sharepoint',
    last_modified   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_documents_sharepoint_path UNIQUE (sharepoint_path)
);

-- ── document_chunks ──────────────────────────────────────────────────────────
-- One row per text chunk. Embedding column is a pgvector VECTOR type.
CREATE TABLE IF NOT EXISTS document_chunks (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID    NOT NULL
                        REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text  TEXT    NOT NULL,
    embedding   VECTOR({dim}),
    metadata    JSONB   DEFAULT '{{}}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- IVFFlat index for approximate nearest-neighbour cosine search.
-- Rebuild with higher `lists` value as the chunk count grows (rule of thumb: sqrt(rows)).
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documents_sharepoint_path
    ON documents (sharepoint_path);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id
    ON document_chunks (document_id);
""".format(dim=settings.EMBEDDING_DIMENSION)


def create_schema():
    logger.info(
        f"Connecting to {settings.SQL_HOST}:{settings.SQL_PORT}/{settings.SQL_DB} "
        f"as {settings.SQL_USERNAME}"
    )
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA_SQL)
        logger.info("Schema created / verified successfully")
    except Exception as exc:
        logger.error(f"Schema creation failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    create_schema()
