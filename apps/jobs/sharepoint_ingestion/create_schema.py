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
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import psycopg2
from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger("create_schema")

_SCHEMA_SQL = """
-- =========================================================
-- AURA ENTERPRISE AI ASSISTANT PLATFORM
-- PostgreSQL + pgvector Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;


-- ── Drop tables in reverse FK order so re-runs are idempotent ────────────────
DROP TABLE IF EXISTS pii_redaction_logs    CASCADE;
DROP TABLE IF EXISTS pii_redaction_rules   CASCADE;
DROP TABLE IF EXISTS audit_logs            CASCADE;
DROP TABLE IF EXISTS error_logs            CASCADE;
DROP TABLE IF EXISTS prompt_logs           CASCADE;
DROP TABLE IF EXISTS agent_routing_logs    CASCADE;
DROP TABLE IF EXISTS escalation_records    CASCADE;
DROP TABLE IF EXISTS document_chunks       CASCADE;
DROP TABLE IF EXISTS documents             CASCADE;
DROP TABLE IF EXISTS feedback              CASCADE;
DROP TABLE IF EXISTS messages              CASCADE;
DROP TABLE IF EXISTS conversations         CASCADE;
DROP TABLE IF EXISTS user_sessions         CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;


-- =========================================================
-- TABLE: users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    azure_oid   VARCHAR(255) UNIQUE,
    display_name VARCHAR(255),
    role        VARCHAR(50) NOT NULL DEFAULT 'user',
                -- user | admin | auditor
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);


-- =========================================================
-- TABLE: user_sessions
-- =========================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id    VARCHAR(255) UNIQUE NOT NULL,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    login_time    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user   ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);


-- =========================================================
-- TABLE: conversations
-- =========================================================
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(500),
    is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
                -- soft delete for compliance
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
    ON conversations(user_id, updated_at DESC)
    WHERE is_deleted = FALSE;


-- =========================================================
-- TABLE: messages
-- =========================================================
CREATE TABLE IF NOT EXISTS messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    parent_message_id UUID REFERENCES messages(id),
                -- for regenerations / branching
    role              VARCHAR(20) NOT NULL,
                -- user | assistant | system | tool
    content           TEXT NOT NULL,
    agent_name        VARCHAR(100),
    model_name        VARCHAR(100),
                -- which underlying LLM answered
    route_type        VARCHAR(50),
                -- rag | api | mixed
    confidence_score  NUMERIC(5,2),
    token_usage       INTEGER,
    response_time_ms  INTEGER,
    citations         JSONB,
    status            VARCHAR(30) NOT NULL DEFAULT 'complete',
                -- streaming | complete | failed | cancelled
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_messages_role
        CHECK (role IN ('user','assistant','system','tool'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent
    ON messages(parent_message_id);


-- =========================================================
-- TABLE: feedback
-- =========================================================
CREATE TABLE IF NOT EXISTS feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    rating      VARCHAR(10) NOT NULL,
                -- up | down
    category    VARCHAR(50),
                -- incorrect | incomplete | hallucination | harmful | formatting | other
    comment     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_feedback_rating CHECK (rating IN ('up','down')),
    CONSTRAINT uq_feedback_per_message UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_message ON feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating  ON feedback(rating, created_at DESC);


-- =========================================================
-- TABLE: documents
-- =========================================================
CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system   VARCHAR(100) NOT NULL,
                -- sharepoint | nexus
    document_name   TEXT NOT NULL,
    source_path     TEXT UNIQUE NOT NULL,
    document_type   VARCHAR(50),
                -- pdf | pptx | docx | xlsx
    checksum        VARCHAR(255),
    visibility      VARCHAR(50) NOT NULL DEFAULT 'all',
                -- all | hr | finance | it | restricted
    tags            JSONB,
    last_modified   TIMESTAMP,
    indexed_at      TIMESTAMP,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
                -- pending | indexed | failed
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_source_path ON documents(source_path);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_visibility  ON documents(visibility);


-- =========================================================
-- TABLE: document_chunks
-- =========================================================
CREATE TABLE IF NOT EXISTS document_chunks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index      INTEGER NOT NULL,
    chunk_hash       VARCHAR(255),
    chunk_text       TEXT NOT NULL,
    embedding        VECTOR({dim}),
    embedding_model  VARCHAR(100),
                -- e.g. text-embedding-3-small
    page_number      INTEGER,
    section_heading  TEXT,
    metadata         JSONB,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_chunk_per_doc UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc
    ON document_chunks(document_id);

-- Vector index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_vector
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- =========================================================
-- TABLE: escalation_records
-- =========================================================
CREATE TABLE IF NOT EXISTS escalation_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    conversation_id UUID REFERENCES conversations(id),
    message_id      UUID REFERENCES messages(id),
    escalation_type VARCHAR(100) NOT NULL,
                -- hr | admin | it
    subject         VARCHAR(500) NOT NULL,
    reason          TEXT,
    form_payload    JSONB,
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
                -- low | medium | high | critical
    status          VARCHAR(50) NOT NULL DEFAULT 'submitted',
                -- submitted | in_progress | resolved | closed
    assigned_team   VARCHAR(100),
    assigned_to     UUID REFERENCES users(id),
    resolved_at     TIMESTAMP,
    resolution_notes TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escalation_user      ON escalation_records(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_status    ON escalation_records(status);
CREATE INDEX IF NOT EXISTS idx_escalation_team      ON escalation_records(assigned_team);
CREATE INDEX IF NOT EXISTS idx_escalation_assignee  ON escalation_records(assigned_to);


-- =========================================================
-- TABLE: agent_routing_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS agent_routing_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    detected_intent   VARCHAR(255),
    selected_agent    VARCHAR(100),
    route_type        VARCHAR(50),
                -- rag | api | mixed
    confidence_score  NUMERIC(5,2),
    alternative_agents JSONB,
                -- runner-up scores for A/B analysis
    routing_latency_ms INTEGER,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routing_message ON agent_routing_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_routing_agent   ON agent_routing_logs(selected_agent);


-- =========================================================
-- TABLE: prompt_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS prompt_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    agent_name        VARCHAR(100),
    model_name        VARCHAR(100),
    prompt_template   TEXT,
    retrieved_context JSONB,
    final_prompt      TEXT,
    model_response    TEXT,
    latency_ms        INTEGER,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_logs_message ON prompt_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_agent   ON prompt_logs(agent_name, created_at DESC);


-- =========================================================
-- TABLE: error_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS error_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name   VARCHAR(255),
    error_type    VARCHAR(255),
    error_message TEXT,
    stack_trace   TEXT,
    payload       JSONB,
    user_id       UUID REFERENCES users(id),
    conversation_id UUID REFERENCES conversations(id),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_module ON error_logs(module_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type   ON error_logs(error_type);


-- =========================================================
-- TABLE: audit_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   VARCHAR(255),
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'success',
                -- success | failure
    metadata    JSONB,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);


-- =========================================================
-- TABLE: pii_redaction_rules
-- =========================================================
CREATE TABLE IF NOT EXISTS pii_redaction_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name         VARCHAR(100) NOT NULL,
    rule_version      INTEGER NOT NULL DEFAULT 1,
    pii_type          VARCHAR(50) NOT NULL,
                -- EMAIL | PHONE | PAN | AADHAAR | SSN | CREDIT_CARD
                -- PERSON_NAME | IP_ADDRESS | EMPLOYEE_ID | DOB | ADDRESS
    detection_method  VARCHAR(30) NOT NULL,
                -- REGEX | NER | LLM | DICTIONARY | CUSTOM
    pattern           TEXT,
    replacement_token VARCHAR(100) NOT NULL DEFAULT '[REDACTED]',
    severity          VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                -- LOW | MEDIUM | HIGH | CRITICAL
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    description       TEXT,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rule_name_version UNIQUE (rule_name, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_pii_rules_active ON pii_redaction_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_pii_rules_type   ON pii_redaction_rules(pii_type);


-- =========================================================
-- TABLE: pii_redaction_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS pii_redaction_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was scanned
    source_type       VARCHAR(30) NOT NULL,
                -- USER_PROMPT | MODEL_RESPONSE | RETRIEVED_CONTEXT
                -- DOCUMENT_CHUNK | ESCALATION_FORM | FEEDBACK_COMMENT
    source_table      VARCHAR(50),
    source_id         UUID,

    -- Conversation/user context
    user_id           UUID REFERENCES users(id),
    conversation_id   UUID REFERENCES conversations(id),
    message_id        UUID REFERENCES messages(id),

    -- What was caught
    rule_id           UUID NOT NULL REFERENCES pii_redaction_rules(id),
    pii_type          VARCHAR(50) NOT NULL,
    detection_method  VARCHAR(30) NOT NULL,
    match_count       INTEGER NOT NULL DEFAULT 1,

    -- Safe metadata only (NEVER the actual PII value)
    value_hash        VARCHAR(64),
    value_length      INTEGER,
    match_positions   JSONB,
    confidence_score  NUMERIC(5,2),

    -- What was done
    action_taken      VARCHAR(30) NOT NULL,
                -- REDACTED | MASKED | TOKENIZED | BLOCKED
                -- FLAGGED_ONLY | ALLOWED_BY_POLICY
    replacement_token VARCHAR(100),

    -- Review workflow
    is_false_positive BOOLEAN,
    reviewed_by       UUID REFERENCES users(id),
    reviewed_at       TIMESTAMP,
    review_notes      TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_logs_user
    ON pii_redaction_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_logs_conversation
    ON pii_redaction_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_message
    ON pii_redaction_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_source
    ON pii_redaction_logs(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_type_time
    ON pii_redaction_logs(pii_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_logs_rule
    ON pii_redaction_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_false_positive
    ON pii_redaction_logs(is_false_positive)
    WHERE is_false_positive IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pii_logs_action
    ON pii_redaction_logs(action_taken);
""".format(dim=settings.EMBEDDING_DIMENSION)


def create_schema():
    # ── Step 1: Create the 'aura' database if it doesn't exist ──────────────
    # CREATE DATABASE cannot run inside a transaction, so we connect to the
    # 'postgres' maintenance DB first, create 'aura', then reconnect.
    admin_url = re.sub(r'/[^/?#]+(\?.*)?$', r'/postgres\1', settings.database_url)

    logger.info("Ensuring database 'aura' exists...")
    admin_conn = psycopg2.connect(admin_url)
    admin_conn.autocommit = True
    try:
        with admin_conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = 'aura'")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE aura")
                logger.info("Database 'aura' created")
            else:
                logger.info("Database 'aura' already exists")
    finally:
        admin_conn.close()

    # ── Step 2: Connect to 'aura' and apply extensions + full schema ─────────
    aura_url = re.sub(r'/[^/?#]+(\?.*)?$', r'/aura\1', settings.database_url)
    logger.info(
        f"Connecting to {settings.SQL_HOST}:{settings.SQL_PORT}/aura "
        f"as {settings.SQL_USERNAME}"
    )
    conn = psycopg2.connect(aura_url)
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
