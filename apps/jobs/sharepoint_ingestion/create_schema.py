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
import csv
import datetime

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import psycopg2
import openpyxl
from config.settings import settings
from utils.logging_config import get_logger

_DATA_DIR = os.path.join(_HERE, "data")
_ATTENDANCE_PATH = os.path.join(_DATA_DIR, "attendance.xlsx")

logger = get_logger("create_schema")

_SCHEMA_SQL = """
-- =========================================================
-- AURA ENTERPRISE AI ASSISTANT PLATFORM
-- PostgreSQL + pgvector Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;


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


-- =========================================================
-- TABLE: employee_details
-- =========================================================
CREATE TABLE IF NOT EXISTS employee_details (
    id                      BIGSERIAL PRIMARY KEY,
    employee_id             TEXT,
    name                    TEXT,
    date_of_birth           TEXT,
    joining_date            TIMESTAMP,
    location                TEXT,
    employee_type           TEXT,
    status_active_inactive  TEXT,
    gender                  TEXT,
    designation             TEXT,
    email                   TEXT,
    reporting_manager       TEXT,
    functional_manager      TEXT,
    function                TEXT,
    past_experience         BIGINT,
    aa_experience           DOUBLE PRECISION,
    total_experience_years  DOUBLE PRECISION,
    exp_group               TEXT,
    relieving_date          TEXT,
    active_details          TEXT,
    lwd                     TEXT,
    subfunction             TEXT,
    skill_set_board         TEXT,
    primary_skills          TEXT,
    skill_last_updated      TEXT,
    subitems                TEXT,
    added_time              TEXT,
    modified_user           TEXT,
    modified_time           TEXT,
    jun_exp                 TEXT,
    unique_id               TEXT
);


-- =========================================================
-- TABLE: project_details
-- =========================================================
CREATE TABLE IF NOT EXISTS project_details (
    _row_id                     BIGSERIAL PRIMARY KEY,
    project_name                TEXT,
    sub_project                 TEXT,
    old_project_name            TEXT,
    project_lead                TEXT,
    delivery_manager            TEXT,
    project_status              TEXT,
    billing                     TEXT,
    cost_center                 TEXT,
    client_master               TEXT,
    project_start_date          TEXT,
    project_end_date            TEXT,
    sow_name                    TEXT,
    sow_start_date              TEXT,
    sow_end_date                TEXT,
    remarks                     TEXT,
    project_type                TEXT,
    managed_services_staff_org  TEXT,
    lyb_type                    TEXT,
    has_paid_leave              TEXT,
    yearly_hours                TEXT,
    per_day_hours               TEXT,
    invoice_approver            TEXT,
    modified_user               TEXT,
    modified_time               TIMESTAMP,
    added_time                  TIMESTAMP,
    added_user                  TEXT,
    id                          TEXT
);


-- =========================================================
-- TABLE: allocation_details
-- =========================================================
CREATE TABLE IF NOT EXISTS allocation_details (
    id                              BIGSERIAL PRIMARY KEY,
    zoho_record_id                  TEXT,
    employee_id                     TEXT,
    name                            TEXT,
    project_name                    TEXT,
    alias_id                        TEXT,
    sub_project                     TEXT,
    project_lead                    TEXT,
    delivery_manager                TEXT,
    completion_status               TEXT,
    efforts_pct                     BIGINT,
    billability_pct                 BIGINT,
    remarks                         TEXT,
    status_active_inactive          TEXT,
    function                        TEXT,
    subfunction                     TEXT,
    sow_name                        TEXT,
    reporting_manager               TEXT,
    functional_manager              TEXT,
    client_master                   TEXT,
    project_status                  TEXT,
    active_details                  TEXT,
    lwd                             TEXT,
    billing                         TEXT,
    project_type                    TEXT,
    efforts_ft                      BIGINT,
    billability_ft                  BIGINT,
    allocation_date                 TIMESTAMP,
    dell_badge_id                   TEXT,
    dell_id_status                  TEXT,
    hsk_key_status                  TEXT,
    calculated_project_multiselect  DOUBLE PRECISION,
    added_user                      TEXT,
    added_time                      TIMESTAMP,
    modified_time                   TIMESTAMP,
    modified_user                   TEXT
);


-- =========================================================
-- TABLE: allocation_role_map
-- Maps employee designation → allocation board role.
-- =========================================================
CREATE TABLE IF NOT EXISTS allocation_role_map (
    id          BIGSERIAL PRIMARY KEY,
    designation VARCHAR(255) NOT NULL,
    role        VARCHAR(50)  NOT NULL
                CHECK (role IN ('executive','business_lead','functional_lead','team_lead','employee','admin')),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT allocation_role_map_designation_key UNIQUE (designation)
);

CREATE INDEX IF NOT EXISTS idx_alloc_role_desig ON allocation_role_map(designation);


-- =========================================================
-- NCL: NO-CODE / LOW-CODE PLATFORM
-- Form Builder · Workflow Engine · Rule Engine · Chat Integration
-- All tables prefixed with ncl_ to avoid naming collisions.
-- =========================================================


-- =========================================================
-- TABLE: ncl_form_definitions
-- Master record for every form created by administrators.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_definitions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL UNIQUE,
    description         TEXT,
    category            VARCHAR(100),
    -- lifecycle: draft | published | archived
    status              VARCHAR(50)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
    version             INT          NOT NULL DEFAULT 1,
    -- discovery metadata used by slash-command search
    tags                TEXT[],
    keywords            TEXT[],
    alias               VARCHAR(255),
    icon                VARCHAR(100),
    -- form-level UX settings: submit_label, width, theme, success_message, etc.
    settings            JSONB        NOT NULL DEFAULT '{{}}',
    -- empty array = visible to all roles
    allowed_roles       TEXT[],
    created_by_user_id  VARCHAR(255) NOT NULL,
    created_by_email    VARCHAR(255) NOT NULL,
    updated_by_user_id  VARCHAR(255),
    updated_by_email    VARCHAR(255),
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_forms_status   ON ncl_form_definitions (status);
CREATE INDEX IF NOT EXISTS idx_ncl_forms_slug     ON ncl_form_definitions (slug);
CREATE INDEX IF NOT EXISTS idx_ncl_forms_category ON ncl_form_definitions (category);
CREATE INDEX IF NOT EXISTS idx_ncl_forms_creator  ON ncl_form_definitions (created_by_email);


-- =========================================================
-- TABLE: ncl_form_sections
-- Logical layout sections within a form.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_sections (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id     UUID         NOT NULL REFERENCES ncl_form_definitions (id) ON DELETE CASCADE,
    title       VARCHAR(255),
    description TEXT,
    order_index INT          NOT NULL DEFAULT 0,
    collapsed   BOOLEAN      NOT NULL DEFAULT FALSE,
    -- e.g. [{{"field": "dept", "operator": "eq", "value": "HR"}}]
    conditions  JSONB        NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_sections_form ON ncl_form_sections (form_id);


-- =========================================================
-- TABLE: ncl_form_fields
-- Individual field definitions within a form.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_fields (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id           UUID         NOT NULL REFERENCES ncl_form_definitions (id) ON DELETE CASCADE,
    section_id        UUID         REFERENCES ncl_form_sections (id) ON DELETE SET NULL,
    -- field_type: text | textarea | number | email | phone | url | date | datetime
    --   time | dropdown | radio | checkbox | toggle | file | signature
    --   richtext | rating | slider | heading | paragraph | divider | hidden
    field_type        VARCHAR(100) NOT NULL,
    label             VARCHAR(500) NOT NULL,
    name              VARCHAR(255) NOT NULL,
    placeholder       TEXT,
    help_text         TEXT,
    default_value     TEXT,
    required          BOOLEAN      NOT NULL DEFAULT FALSE,
    read_only         BOOLEAN      NOT NULL DEFAULT FALSE,
    hidden            BOOLEAN      NOT NULL DEFAULT FALSE,
    order_index       INT          NOT NULL DEFAULT 0,
    -- full | half | third | quarter
    width             VARCHAR(50)  NOT NULL DEFAULT 'full',
    -- [{{"label": "Option A", "value": "a"}}]
    options           JSONB        NOT NULL DEFAULT '[]',
    -- min, max, minLength, maxLength, pattern, customMessage
    validation_rules  JSONB        NOT NULL DEFAULT '{{}}',
    -- [{{"when": {{"field": "x", "op": "eq", "value": "y"}}, "then": {{"action": "show"}}}}]
    conditional_logic JSONB        NOT NULL DEFAULT '[]',
    -- JS-style expression for calculated fields
    formula           TEXT,
    style             JSONB        NOT NULL DEFAULT '{{}}',
    metadata          JSONB        NOT NULL DEFAULT '{{}}',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_fields_form    ON ncl_form_fields (form_id);
CREATE INDEX IF NOT EXISTS idx_ncl_fields_section ON ncl_form_fields (section_id);
CREATE INDEX IF NOT EXISTS idx_ncl_fields_order   ON ncl_form_fields (form_id, order_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ncl_fields_name_per_form ON ncl_form_fields (form_id, name);


-- =========================================================
-- TABLE: ncl_form_versions
-- Immutable snapshots taken every time a form is published.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_versions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID         NOT NULL REFERENCES ncl_form_definitions (id) ON DELETE CASCADE,
    version             INT          NOT NULL,
    snapshot            JSONB        NOT NULL,
    change_notes        TEXT,
    created_by_user_id  VARCHAR(255) NOT NULL,
    created_by_email    VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (form_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ncl_versions_form ON ncl_form_versions (form_id);


-- =========================================================
-- TABLE: ncl_form_roles
-- Per-form role-based access control matrix.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_roles (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id               UUID         NOT NULL REFERENCES ncl_form_definitions (id) ON DELETE CASCADE,
    role_name             VARCHAR(100) NOT NULL,
    can_submit            BOOLEAN      NOT NULL DEFAULT TRUE,
    can_view_own          BOOLEAN      NOT NULL DEFAULT TRUE,
    can_view_all          BOOLEAN      NOT NULL DEFAULT FALSE,
    can_edit_submissions  BOOLEAN      NOT NULL DEFAULT FALSE,
    can_approve           BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (form_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_ncl_roles_form ON ncl_form_roles (form_id);


-- =========================================================
-- TABLE: ncl_form_submissions
-- Every submitted instance of a form.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_submissions (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id               UUID         NOT NULL REFERENCES ncl_form_definitions (id),
    form_version          INT          NOT NULL DEFAULT 1,
    submitted_by_user_id  VARCHAR(255) NOT NULL,
    submitted_by_email    VARCHAR(255) NOT NULL,
    submitted_by_name     VARCHAR(255),
    -- submitted | in_review | approved | rejected | withdrawn
    status                VARCHAR(50)  NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'in_review', 'approved', 'rejected', 'withdrawn')),
    -- key-value map: {{field_name: value}}
    data                  JSONB        NOT NULL DEFAULT '{{}}',
    -- source (chat | form_page), conversation_id, pre_filled, etc.
    metadata              JSONB        NOT NULL DEFAULT '{{}}',
    reviewed_by_user_id   VARCHAR(255),
    reviewed_by_email     VARCHAR(255),
    reviewed_at           TIMESTAMPTZ,
    review_notes          TEXT,
    ip_address            VARCHAR(50),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_subs_form       ON ncl_form_submissions (form_id);
CREATE INDEX IF NOT EXISTS idx_ncl_subs_submitter  ON ncl_form_submissions (submitted_by_email);
CREATE INDEX IF NOT EXISTS idx_ncl_subs_status     ON ncl_form_submissions (status);
CREATE INDEX IF NOT EXISTS idx_ncl_subs_created    ON ncl_form_submissions (created_at DESC);


-- =========================================================
-- TABLE: ncl_workflow_definitions
-- Blueprint for an automation workflow attached to a form.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_workflow_definitions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID         REFERENCES ncl_form_definitions (id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    -- on_submit | on_status_change | manual
    trigger_event       VARCHAR(100) NOT NULL DEFAULT 'on_submit',
    trigger_conditions  JSONB        NOT NULL DEFAULT '{{}}',
    -- [{{"id": "s1", "type": "approval", "name": "Manager Approval", "config": {{...}}}}]
    -- step types: approval | email | webhook | api_call | condition | notification | delay
    steps               JSONB        NOT NULL DEFAULT '[]',
    status              VARCHAR(50)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_by_user_id  VARCHAR(255) NOT NULL,
    created_by_email    VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_wf_defs_form   ON ncl_workflow_definitions (form_id);
CREATE INDEX IF NOT EXISTS idx_ncl_wf_defs_status ON ncl_workflow_definitions (status);


-- =========================================================
-- TABLE: ncl_workflow_instances
-- A running or completed execution of a workflow definition.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_workflow_instances (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_def_id    UUID         NOT NULL REFERENCES ncl_workflow_definitions (id),
    submission_id      UUID         REFERENCES ncl_form_submissions (id),
    -- running | waiting_approval | completed | failed | cancelled
    status             VARCHAR(50)  NOT NULL DEFAULT 'running',
    current_step_index INT          NOT NULL DEFAULT 0,
    context            JSONB        NOT NULL DEFAULT '{{}}',
    error_message      TEXT,
    started_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ncl_wf_inst_def        ON ncl_workflow_instances (workflow_def_id);
CREATE INDEX IF NOT EXISTS idx_ncl_wf_inst_submission ON ncl_workflow_instances (submission_id);
CREATE INDEX IF NOT EXISTS idx_ncl_wf_inst_status     ON ncl_workflow_instances (status);


-- =========================================================
-- TABLE: ncl_workflow_step_logs
-- Per-step execution record for a workflow instance.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_workflow_step_logs (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id          UUID         NOT NULL REFERENCES ncl_workflow_instances (id) ON DELETE CASCADE,
    step_index           INT          NOT NULL,
    step_type            VARCHAR(100) NOT NULL,
    step_name            VARCHAR(255),
    -- pending | running | completed | failed | skipped | waiting
    status               VARCHAR(50)  NOT NULL DEFAULT 'pending',
    input_data           JSONB        NOT NULL DEFAULT '{{}}',
    output_data          JSONB        NOT NULL DEFAULT '{{}}',
    error_message        TEXT,
    executed_by_user_id  VARCHAR(255),
    executed_by_email    VARCHAR(255),
    started_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ncl_step_logs_instance ON ncl_workflow_step_logs (instance_id);


-- =========================================================
-- TABLE: ncl_rule_definitions
-- Business rules for forms (visibility, validation,
-- calculation, notification).
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_rule_definitions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID         NOT NULL REFERENCES ncl_form_definitions (id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    -- visibility | validation | calculation | notification
    rule_type       VARCHAR(100) NOT NULL,
    trigger_fields  TEXT[],
    -- [{{"logic": "AND", "conditions": [{{"field": "x", "op": "gt", "value": 5}}]}}]
    conditions      JSONB        NOT NULL DEFAULT '[]',
    -- [{{"action": "show", "target": "field_name"}}, {{"action": "set_value", "target": "total", "expr": "qty * price"}}]
    actions         JSONB        NOT NULL DEFAULT '[]',
    priority        INT          NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_rules_form   ON ncl_rule_definitions (form_id);
CREATE INDEX IF NOT EXISTS idx_ncl_rules_type   ON ncl_rule_definitions (rule_type);
CREATE INDEX IF NOT EXISTS idx_ncl_rules_active ON ncl_rule_definitions (is_active);


-- =========================================================
-- TABLE: ncl_form_templates
-- Reusable starter templates for the form designer.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_form_templates (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100),
    description         TEXT,
    thumbnail_url       TEXT,
    -- full form definition: {{sections, fields, settings}}
    definition          JSONB        NOT NULL,
    is_system           BOOLEAN      NOT NULL DEFAULT FALSE,
    usage_count         INT          NOT NULL DEFAULT 0,
    tags                TEXT[],
    created_by_user_id  VARCHAR(255),
    created_by_email    VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_templates_category  ON ncl_form_templates (category);
CREATE INDEX IF NOT EXISTS idx_ncl_templates_is_system ON ncl_form_templates (is_system);


-- =========================================================
-- TABLE: ncl_audit_logs
-- Immutable audit trail for all NCL platform actions.
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_audit_logs (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ncl_form_definitions | ncl_form_submissions | ncl_workflow_instances | etc.
    entity_type   VARCHAR(100) NOT NULL,
    entity_id     UUID         NOT NULL,
    -- created | updated | deleted | published | archived |
    -- submitted | approved | rejected | withdrawn | step_executed
    action        VARCHAR(100) NOT NULL,
    actor_user_id VARCHAR(255) NOT NULL,
    actor_email   VARCHAR(255) NOT NULL,
    -- {{"before": {{...}}, "after": {{...}}}}
    changes       JSONB        NOT NULL DEFAULT '{{}}',
    ip_address    VARCHAR(50),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_audit_entity ON ncl_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ncl_audit_actor  ON ncl_audit_logs (actor_email);
CREATE INDEX IF NOT EXISTS idx_ncl_audit_action ON ncl_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_ncl_audit_time   ON ncl_audit_logs (created_at DESC);


-- =========================================================
-- TABLE: ncl_slash_commands
-- Admin-configurable slash (/) commands for the chat UI.
-- type = 'form'  → opens the linked published form in a panel
-- type = 'url'   → opens the configured URL in a new browser tab
-- =========================================================
CREATE TABLE IF NOT EXISTS ncl_slash_commands (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- the keyword users type after "/" (e.g. "parking", "leave", "hr-portal")
    command             VARCHAR(100) NOT NULL UNIQUE,
    label               VARCHAR(255) NOT NULL,
    description         TEXT,
    -- 'form' | 'url' | 'builtin'
    type                VARCHAR(20)  NOT NULL DEFAULT 'form'
                        CHECK (type IN ('form', 'url', 'builtin')),
    -- only set when type = 'form'
    form_id             UUID         REFERENCES ncl_form_definitions (id) ON DELETE SET NULL,
    -- only set when type = 'url'
    url                 TEXT,
    icon                VARCHAR(100),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    order_index         INT          NOT NULL DEFAULT 0,
    created_by_user_id  VARCHAR(255),
    created_by_email    VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ncl_slash_cmd_active  ON ncl_slash_commands (is_active);
CREATE INDEX IF NOT EXISTS idx_ncl_slash_cmd_order   ON ncl_slash_commands (order_index);

-- Migration: add url column for slash commands of type='url' (safe on existing tables)
ALTER TABLE ncl_slash_commands ADD COLUMN IF NOT EXISTS url TEXT;

-- Migration: add action column for slash commands of type='builtin' (safe on existing tables)
ALTER TABLE ncl_slash_commands ADD COLUMN IF NOT EXISTS action VARCHAR(100);

-- Migration: extend type check constraint to include 'builtin'
ALTER TABLE ncl_slash_commands DROP CONSTRAINT IF EXISTS ncl_slash_commands_type_check;
ALTER TABLE ncl_slash_commands ADD CONSTRAINT ncl_slash_commands_type_check CHECK (type IN ('form', 'url', 'builtin'));
""".format(dim=settings.EMBEDDING_DIMENSION)


# PK column to exclude from INSERT (auto-generated by BIGSERIAL)
_CSV_TABLES = {
    "employee_details":  "id",
    "project_details":   "_row_id",
    "allocation_details": "id",
    "allocation_role_map": "id",
}

# Columns that need Python-side type coercion (CSV values are all strings)
_COLUMN_TYPES: dict[str, dict[str, str]] = {
    "employee_details": {
        "past_experience": "int",
        "aa_experience": "float",
        "total_experience_years": "float",
        "joining_date": "timestamp",
    },
    "project_details": {
        "modified_time": "timestamp",
        "added_time": "timestamp",
    },
    "allocation_details": {
        "efforts_pct": "int",
        "billability_pct": "int",
        "efforts_ft": "int",
        "billability_ft": "int",
        "calculated_project_multiselect": "float",
        "allocation_date": "timestamp",
        "added_time": "timestamp",
        "modified_time": "timestamp",
    },
    "allocation_role_map": {
        "created_at": "timestamp",
        "updated_at": "timestamp",
    },
}


def _coerce_csv_value(value: str, col_type: str):
    if value == "" or value is None:
        return None
    if col_type == "int":
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    if col_type == "float":
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    if col_type == "timestamp":
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None
    return value


def _import_csv_data(conn):
    """Insert CSV rows into tables; skips tables that already have data."""
    for table_name, pk_col in _CSV_TABLES.items():
        csv_path = os.path.join(_DATA_DIR, f"{table_name}.csv")
        if not os.path.exists(csv_path):
            logger.warning(f"CSV not found: {csv_path} — skipping")
            continue

        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table_name}")
            if cur.fetchone()[0] > 0:
                logger.info(f"Table '{table_name}' already has data — skipping import")
                continue

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            logger.info(f"CSV '{csv_path}' is empty — skipping")
            continue

        col_types = _COLUMN_TYPES.get(table_name, {})
        col_names = [c for c in rows[0].keys() if c != pk_col]
        placeholders = ", ".join(["%s"] * len(col_names))
        insert_sql = (
            f"INSERT INTO {table_name} ({', '.join(col_names)}) "
            f"VALUES ({placeholders})"
        )

        inserted = 0
        with conn.cursor() as cur:
            for row in rows:
                values = [
                    _coerce_csv_value(row[col], col_types.get(col, "text"))
                    for col in col_names
                ]
                if all(v is None for v in values):
                    continue
                cur.execute(insert_sql, values)
                inserted += 1

        logger.info(f"Imported {inserted} rows into '{table_name}'")


# ---------------------------------------------------------------------------
# Excel helpers (used for attendance.xlsx and any future Excel-based sources)
# ---------------------------------------------------------------------------

def _to_snake_case(name: str) -> str:
    if not name or not str(name).strip():
        return ""
    name = str(name).strip()
    name = name.replace('%', '_pct')
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    name = re.sub(r'_+', '_', name)
    return name.strip('_').lower()


def _infer_pg_type(values: list) -> str:
    detected = None
    for v in values:
        if v is None or v == "":
            continue
        if isinstance(v, bool):
            t = "BOOLEAN"
        elif isinstance(v, datetime.datetime):
            t = "TIMESTAMP"
        elif isinstance(v, int):
            t = "BIGINT"
        elif isinstance(v, float):
            t = "DOUBLE PRECISION"
        else:
            return "TEXT"
        if detected is None:
            detected = t
        elif detected != t:
            return "TEXT"
    return detected or "TEXT"


def _read_excel_sheet(wb, sheet_name: str):
    """Return (col_map, data_rows); col_map is list of (snake_name, col_index)."""
    ws = wb[sheet_name]
    rows = list(ws.rows)
    if not rows:
        return [], []
    col_map, seen = [], set()
    for i, cell in enumerate(rows[0]):
        snake = _to_snake_case(cell.value) if cell.value is not None else ""
        if not snake:
            continue
        unique, suffix = snake, 2
        while unique in seen:
            unique = f"{snake}_{suffix}"
            suffix += 1
        seen.add(unique)
        col_map.append((unique, i))
    return col_map, rows[1:]


def _create_tables_from_excel(
    conn,
    excel_path: str,
    table_name_override: str | None = None,
    skip_sheets: list[str] | None = None,
):
    """Create table(s) from an Excel workbook (idempotent, adds missing columns)."""
    skip = set(skip_sheets or [])
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    try:
        for sheet_name in wb.sheetnames:
            if sheet_name in skip:
                continue
            table_name = table_name_override or _to_snake_case(sheet_name)
            col_map, data_rows = _read_excel_sheet(wb, sheet_name)
            if not col_map:
                continue

            col_values = {s: [] for s, _ in col_map}
            for row in data_rows[:50]:
                cells = [c.value for c in row]
                for s, idx in col_map:
                    if idx < len(cells):
                        col_values[s].append(cells[idx])

            col_types = {s: _infer_pg_type(col_values[s]) for s, _ in col_map}
            pk = "_row_id" if "id" in {s for s, _ in col_map} else "id"
            col_defs = ",\n    ".join(f"{s} {col_types[s]}" for s, _ in col_map)
            create_sql = (
                f"CREATE TABLE IF NOT EXISTS {table_name} (\n"
                f"    {pk} BIGSERIAL PRIMARY KEY,\n"
                f"    {col_defs}\n"
                f");"
            )
            with conn.cursor() as cur:
                cur.execute(create_sql)
                logger.info(f"Table '{table_name}' created or already exists")
                for s, _ in col_map:
                    cur.execute(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = %s AND column_name = %s",
                        (table_name, s),
                    )
                    if not cur.fetchone():
                        cur.execute(
                            f"ALTER TABLE {table_name} "
                            f"ADD COLUMN IF NOT EXISTS {s} {col_types[s]}"
                        )
                        logger.info(f"Added column '{s}' to '{table_name}'")
    finally:
        wb.close()


def _import_data_from_excel(
    conn,
    excel_path: str,
    table_name_override: str | None = None,
    skip_sheets: list[str] | None = None,
):
    """Insert Excel rows into table(s); skips tables that already have data."""
    skip = set(skip_sheets or [])
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    try:
        for sheet_name in wb.sheetnames:
            if sheet_name in skip:
                continue
            table_name = table_name_override or _to_snake_case(sheet_name)
            col_map, data_rows = _read_excel_sheet(wb, sheet_name)
            if not col_map:
                continue

            col_values = {s: [] for s, _ in col_map}
            for row in data_rows[:50]:
                cells = [c.value for c in row]
                for s, idx in col_map:
                    if idx < len(cells):
                        col_values[s].append(cells[idx])
            col_types = {s: _infer_pg_type(col_values[s]) for s, _ in col_map}

            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                if cur.fetchone()[0] > 0:
                    logger.info(f"Table '{table_name}' already has data — skipping import")
                    continue

                col_names = [s for s, _ in col_map]
                placeholders = ", ".join(["%s"] * len(col_names))
                insert_sql = (
                    f"INSERT INTO {table_name} ({', '.join(col_names)}) "
                    f"VALUES ({placeholders})"
                )
                inserted = 0
                for row in data_rows:
                    cells = [c.value for c in row]
                    values = [
                        None if (col_types[s] != "TEXT" and (cells[idx] if idx < len(cells) else None) == "")
                        else (cells[idx] if idx < len(cells) else None)
                        for s, idx in col_map
                    ]
                    if all(v is None for v in values):
                        continue
                    cur.execute(insert_sql, values)
                    inserted += 1
                logger.info(f"Imported {inserted} rows into '{table_name}'")
    finally:
        wb.close()


def create_schema():
    db_url = settings.database_url
    logger.info(
        f"Connecting to {settings.SQL_HOST}:{settings.SQL_PORT}/{settings.SQL_DB} "
        f"as {settings.SQL_USERNAME}"
    )

    # ── Step 1: Apply extensions + full schema ────────────────────────────────
    conn = psycopg2.connect(db_url)
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

    # ── Step 2: Import CSV seed data (idempotent) ────────────────────────────
    logger.info("Importing CSV seed data...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        _import_csv_data(conn)
        logger.info("CSV data import complete")
    except Exception as exc:
        logger.error(f"CSV data import failed: {exc}")
        raise
    finally:
        conn.close()

    # ── Step 3: Attendance table (attendance.xlsx) ───────────────────────────
    logger.info("Setting up attendance table...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        _create_tables_from_excel(
            conn, _ATTENDANCE_PATH,
            table_name_override="attendance",
            skip_sheets=["Info"],
        )
        _import_data_from_excel(
            conn, _ATTENDANCE_PATH,
            table_name_override="attendance",
            skip_sheets=["Info"],
        )
        logger.info("Attendance table ready")
    except Exception as exc:
        logger.error(f"Attendance table setup failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    create_schema()
