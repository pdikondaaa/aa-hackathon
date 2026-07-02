# AURA (AA-Hackathon Enterprise Assistant) — Master Specification

**Organization:** Aligned Automation
**Product name (in-app):** AURA — "Aligned Unified Resource Assistant"
**Project / repo codename:** AA-Hackathon
**Version:** 1.1 — Corrected against live codebase
**Last Updated:** 2026-07-02
**Status:** Active Development

> **New here?** Start with [`00-foundation/platform-overview-plain-english.md`](00-foundation/platform-overview-plain-english.md) for a jargon-free explanation, then [`10-reference/folder-structure.md`](10-reference/folder-structure.md) to see where everything lives in the repository.

> **Accuracy note (2026-07-02):** This specification set was audited against the actual source code (`apps/api-gateway`, `apps/web-ui`, `apps/jobs`). Several figures that circulated in earlier drafts — the embedding model/dimension, chunk size, "3-tier routing," a fixed 13-agent roster, and an "Ollama-only" LLM policy — did not match the code and have been corrected throughout this document and the linked pages. Where a document elsewhere in `knowledge-specs/` still shows an old figure, treat this README and the `10-reference/` pages as authoritative.

---

## Platform Identity

**AURA** is an enterprise-grade AI platform built by **Aligned Automation**. It is not a chatbot. It is a multi-agent, domain-aware, retrieval-augmented AI system that serves as a unified self-service interface for employees across HR, IT, Administration, PMO, Finance, and several operational areas (parking, communications, skills tracking, and a no-code form/workflow builder).

The platform replaces fragmented, manual, and email-driven workflows with a single conversational interface that can answer policy questions, generate HR documents, route escalations, track attendance, analyze organizational data, manage parking requests, publish company announcements, and support onboarding — all through a secure, authenticated session backed by Azure Active Directory.

---

## Vision

> Build an enterprise AI platform — not a chatbot — that gives every employee instant, accurate, and context-aware access to organizational knowledge and services.

The platform serves these organizational domains:

| Domain | Scope |
|--------|-------|
| Human Resources | Policy, attendance, document generation, onboarding |
| Information Technology | IT access, asset queries, support guidance |
| Administration | Facilities, travel, parking |
| PMO / Allocation | Project allocation board, resource utilization |
| Organization | Org info, directory, skills analytics, announcements & events |
| Platform / No-Code | Metadata-driven forms, approval workflows, chat slash-commands |

---

## Problem Statement

Employees at Aligned Automation previously lacked a unified self-service interface for HR policy lookup, IT guidance, administrative document generation, attendance tracking, onboarding, and organizational knowledge retrieval from SharePoint and Zoho People. The result was high email volume to HR/IT, delayed responses, inconsistent policy interpretation, and poor employee experience. AURA addresses this with a single conversational entry point. See [`00-foundation/problem-statement.md`](00-foundation/problem-statement.md) for the full analysis.

---

## Technology Stack (verified against code)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18.3.1, Vite 5.4.0 | Single-page app — **no React Router**; navigation is a plain `activeNav` state switch in `App.jsx`. |
| Frontend state | Local `useState`/`useEffect` + `localStorage` | Redux Toolkit, react-redux, redux, and redux-thunk are listed in `package.json` but are **not used anywhere** in the code (no `<Provider>`, no imports of any Redux API). |
| Auth (frontend) | MSAL Browser 5.9.0 | Azure AD SSO, PKCE redirect flow. |
| Charts | Recharts 3.8.1 | Used in Analytics, COO Analytics, Allocation Board, PMO Hub, Skill Hub. |
| Client-side PDF | jsPDF 4.2.1 | Generates downloadable PDFs for AI-generated HR documents only. |
| Backend framework | FastAPI + Uvicorn, Python | App title in code is literally `"AURA"`. |
| Backend data access | Raw SQL via `psycopg2` | No ORM (no SQLAlchemy models). Schema is created by standalone DDL scripts, not a migration framework. |
| AI orchestration | LangChain (actively used) | `langchain-huggingface`, `langchain-ollama`, `langchain-groq`, `langchain-anthropic`, `langchain-community`, `langchain-text-splitters` — used for prompt templates, LCEL chains, document loaders, and text splitting. `langgraph` is listed in `requirements.txt` but **no import of it exists anywhere in the codebase** — it is an unused/aspirational dependency, not part of the live orchestration. |
| LLM runtime | **Configurable: Anthropic Claude → Groq → Ollama**, in that priority order | Selected at startup by env flags (`USE_Claude_API_Key`, `USE_Groq_API_Key`, `Use_Ollama_LLM`) in `app/agents/working/config.py`. Ollama (`gpt-oss` at `ml01.alignedautomation.com:11434`) is the **default/fallback**, not the exclusive provider — Claude (`claude-sonnet-4-6`) or Groq (`llama3-70b-8192`) can be the active provider depending on configuration. Any document that describes the platform as "self-hosted-LLM-only" is describing one possible configuration, not a hard architectural constraint. |
| Embeddings | **`nomic-embed-text-v1.5`, 768 dimensions** | Used both at query time (`app/rag/retriever.py`) and at ingestion time (`apps/jobs/sharepoint_ingestion`). This is **not** `all-MiniLM-L6-v2` / 384 dimensions, despite that figure appearing in older drafts of this documentation set. |
| Vector store | PostgreSQL + `pgvector` | The **sole** data source for RAG at query time. `retriever.py`'s own docstring states SharePoint/FAISS are never contacted from that code path. |
| Local fallback index | FAISS (per-domain, local only) | Built by `app/agents/working/knowledge_base.py` from local document folders for each domain agent (HR, IT, Admin, Finance, PMO). Used only as a fallback **when pgvector returns nothing** — it is not a global mirror of the pgvector corpus. |
| Database | PostgreSQL (`pgvector/pgvector:pg16` image) | Database name `squadrons`, default host `hackathon.alignedautomation.com` in code defaults. ~30 tables (see [`10-reference/architecture-overview.md`](10-reference/architecture-overview.md)). |
| Identity | Azure Active Directory | Backend validates the AAD-issued JWT itself using `python-jose` (RS256 + JWKS) — **MSAL is not used on the backend**, only in the React frontend. |
| Document ingestion | SharePoint ingestion pipeline | Section-aware chunking then `RecursiveCharacterTextSplitter`, **1000-character chunks with 200-character overlap** (not 500/50 tokens). Primary connector uses Microsoft Graph API with app-only MSAL auth; a second Playwright-based scraper connector exists for site pages/lists but is disabled by default. |
| HR data | Zoho People PostgreSQL replica | Read-only. |
| Web search | Tavily API | Optional supplement, called from domain agents when configured. |
| Deployment | Docker Compose | Three services defined: `api`, `postgres` (pgvector image), `redis`. **Redis is defined in `docker-compose.yml` but is not used by any application code** — no `redis` client library is in `requirements.txt` and no code connects to it. Treat it as currently vestigial infrastructure, not an active cache/session store. |

---

## Platform Architecture Overview

The platform is orchestrated by the **MasterAgent** (`apps/api-gateway/app/agents/supervisor_agent.py`), which routes each query to the right handler.

### Actual Routing Logic (not a clean "3-tier" design)

Earlier documentation described a clean regex → LLM → keyword three-tier router. The real `_route()` method evaluates, in order:

1. Whether the user has an active multi-turn document-generation session (routes straight back to `DocumentAgent`)
2. An escalation keyword check
3. Several regex fast-paths, in sequence: Microsoft Forms intent, email-draft intent, attendance query, employee-directory query, document-request query (plus apply-leave and name-query regexes checked even earlier in the pipeline)
4. A greeting / small-talk fast-path
5. A keyword-scoring fallback against a `DOMAIN_KEYWORDS` dictionary, defaulting to the general-purpose `QuickAgent` if no domain scores above zero

A `_route_llm()` method exists in the same file to do LLM-based intent classification, but **it is never called** — it is dead code. In practice there are two live routing tiers (regex fast-paths, then keyword scoring), not three, and there is no LLM-based classification step in the current build.

### Domain Agents

Only some agents are true retrieval agents; others are thin functional wrappers. This distinction matters for anyone extending the platform:

| Agent | File | Type | Notes |
|-------|------|------|-------|
| MasterAgent | `agents/supervisor_agent.py` | Orchestrator | Routing, session state, dispatch |
| HRAgent | `agents/working/hr_agent.py` | `BaseDeepAgent` subclass | pgvector RAG + local FAISS/keyword fallback |
| ITAgent | `agents/working/it_agent.py` | `BaseDeepAgent` subclass | Same pipeline, IT domain |
| AdminAgent | `agents/working/admin_agent.py` | `BaseDeepAgent` subclass | Also injects static parking-rate context |
| FinanceAgent | `agents/working/finance_agent.py` | `BaseDeepAgent` subclass | |
| PMOAgent | `agents/working/pmo_agent.py` | `BaseDeepAgent` subclass | |
| OrgDeepAgent | `agents/org_agent.py` | `BaseDeepAgent` subclass | Company info, no local data folders |
| FunnyAgent | `agents/working/funny_agent.py` | Lightweight, direct LLM call | Does **not** inherit `BaseDeepAgent` despite mirroring its interface |
| QuickAgent | `agents/working/quick_agent.py` | Lightweight, direct LLM call | Fast conversational fallback; also the default when routing finds no domain match |
| DocumentAgent | `agents/document_agent.py` | Plain class | Stateful multi-turn document generation (in-memory sessions) |
| AllocationAgent | `agents/allocation_agent.py` | Plain class | PMO allocation board data + `ask_aura()` LLM Q&A |
| MSFormsAgent | `agents/ms_forms_agent.py` | Plain class | REST client for Microsoft Forms, no LLM |
| Employee / Attendance / Escalation / License agents | `agents/employee/*.py`, `agents/escalation_agent.py`, `agents/license_agent.py` | Plain functions | Wrapped in small adapter classes inside `supervisor_agent.py` for dispatch |

`BaseDeepAgent` (`agents/working/base_deep_agent.py`) pipeline: embed and query pgvector → if nothing found, fall back to the agent's local FAISS-or-keyword knowledge base → single LLM generation call with the two-tier guardrail text injected into the prompt, self-verification, and inline citation. This is a **conditional fallback chain**, not a parallel `asyncio.gather` across four sources as earlier drafts described.

### Guardrails (`agents/guardrails.py`)

A single `check_input()` function evaluates, in order: jailbreak patterns → harmful-content patterns → security-threat patterns (all three are static, immediate blocks) → distress signals (routes to an LLM-generated empathetic response) → organizational-scope violations such as asking about another employee's salary or PII, legal advice, or competitor intelligence (routes to an LLM-generated contextual redirect).

---

## Feature Areas Beyond the Original 13-Agent Model

The platform has grown well beyond HR/IT/Admin/PMO/Finance/Org chat. The following are full feature areas with their own backend controllers/services and frontend modules, and should be treated as first-class parts of the platform, not side notes:

| Feature area | Backend | Frontend |
|---|---|---|
| Parking requests | `parking_controller.py`, `parking_service.py`, `parking_requests` table | `ParkingDrawer.jsx`, `modules/parking-assistant/` |
| Org communications (announcements + events + RSVP) | `communications_controller.py` (public + admin), `communications_service.py` | `CommunicationsPage.jsx`, `CommunicationsAdmin.jsx`, `CommunicationsWidget.jsx`, `AnnouncementBanner.jsx`, `AnnouncementOverlay.jsx` |
| Shared calendar | `graph_calendar_controller.py` (Microsoft Graph) | Surfaced in `CommunicationsPage.jsx` and `RightPanel.jsx` |
| Skills analytics | `skills_controller.py`, `skills_service.py` | `modules/skill-hub/` (real, backend-driven) |
| AI tool license tracking | `license_agent.py` (separate `squadrons` DB tables: `ai_claude_users`, `ai_figma_users`, `ai_lovable_users`, `ai_m365_copilot_users`) | Surfaced via chat only |
| No-code form builder & workflow engine ("NCL") | `form_builder_controller.py` (public + admin, **~45 endpoints — the single largest controller in the codebase**), `form_builder_service.py`, `form_builder_ai_service.py`, `rule_engine_service.py`, `workflow_engine_service.py`, `slash_command_service.py` | `modules/form-builder/` — designer, renderer, workflow builder, slash-command admin, AI-assisted form chat |
| PMO allocation board | `allocation_controller.py`, `allocation_service.py` | `AllocationBoard.jsx` (real data + an embedded mock COO view) |
| COO analytics | `coo_analytics_controller.py`, `coo_analytics_service.py` | `modules/coo-analytics/` (real, backend-driven) |
| Chatbot usage analytics | — | `modules/analytics/` — **currently mock data only**; `analyticsApi.js` explicitly returns hardcoded constants and is not wired to a backend endpoint |
| PMO project/risk dashboard | — | `modules/pmo-hub/` — **currently entirely hardcoded mock data**, no API calls at all |
| In-app feedback (surveys) | — | `modules/feedback/` — **localStorage-only**, distinct from per-message thumbs-up/down (which is backend-persisted via `/api/messages/{id}/feedback`) |

Two mock-data modules (`analytics`, `pmo-hub`) and one localStorage-only module (`feedback`) currently present a UI that looks live but is not connected to real data. If this documentation is used to plan a demo or a stakeholder review, call this out explicitly rather than presenting the numbers as real.

---

## Document Generation (12 types, not 11)

`DocumentAgent` (`agents/document_agent.py`) defines `DOCUMENT_TYPES` with **12** entries, plus a free-text `custom` mode:

loan_proof · experience_letter · employment_verification · offer_letter · relieving_letter · address_proof · bonafide · internship_certificate · promotion_letter · noc · confirmation_letter · id_card_request · *(custom)*

Sessions are held in memory per user (30-minute timeout) — they are **not** persisted to the database. Only 8 of the 12 types have a hardcoded template fallback if the LLM call returns empty; the rest fall back to a generic field-dump template.

---

## Data Architecture

### Database (PostgreSQL + pgvector, `squadrons` database)

Schema is created by standalone DDL scripts — `apps/jobs/sharepoint_ingestion/create_schema.py` and `create_communications_schema.py` — plus two manual SQL files in `apps/api-gateway/migrations/`. There is **no ORM and no Alembic**; all access is raw parameterized SQL via `psycopg2`.

Representative tables (see [`10-reference/architecture-overview.md`](10-reference/architecture-overview.md) for the full list of ~30): `users`, `conversations`, `messages`, `message_citations`, `feedback`, `documents`, `document_chunks`, `escalation_records`, `audit_logs`, `pii_redaction_rules`, `pii_redaction_logs`, `employee_details`, `allocation_details`, `allocation_role_map`, `parking_requests`, `org_announcements`, `org_events`, `org_event_rsvps`, and the `ncl_*` family of ~13 tables backing the no-code form builder and workflow engine.

### Retrieval

- **Store:** PostgreSQL + `pgvector`, cosine distance (`<=>`), `ivfflat` index with `probes = 10`
- **Embedding model:** `nomic-embed-text-v1.5`, 768 dimensions (query-time and ingestion-time — same model)
- **Chunking:** section-aware pre-split (headings, `[Slide N]`, `[Sheet: X]` markers) then `RecursiveCharacterTextSplitter`, 1000 characters / 200 overlap
- **Ingestion source:** `apps/jobs/sharepoint_ingestion`, via Microsoft Graph API (app-only MSAL auth). Each run **purges and fully re-ingests** all documents — it is not an incremental-only process at the database level, even though per-file NEW/CHANGED/UNCHANGED/DELETED classification still occurs during the run.

---

## Current Implementation Status

### Confirmed Implemented and Live
- MasterAgent routing (regex fast-paths + keyword scoring; no live LLM classification tier)
- `BaseDeepAgent` pipeline (pgvector primary, local FAISS/keyword fallback, single LLM call)
- Azure AD SSO via MSAL (frontend) + JWT validation via python-jose (backend)
- HR, IT, Admin, Finance, PMO, Org domain agents (RAG-grounded)
- Document generation (12 types, in-memory sessions)
- Escalation management, per-message feedback, conversation history
- Attendance queries (Zoho People, read-only)
- Employee directory / profile lookup
- Email drafting (Ollama/Claude/Groq-generated, no send from backend — frontend builds a `mailto:` link; a Graph `sendMail` path also exists in the frontend `authService.js`)
- Microsoft Forms creation via Graph API
- Parking request management (Fountainhead)
- Org communications: announcements, events, RSVP, shared calendar
- Skills analytics dashboard (real data)
- COO analytics dashboard (real data)
- PMO allocation board (real data)
- No-code form builder + workflow engine + slash commands (large, real subsystem)
- AI tool license tracking (Claude/Figma/Lovable/M365 Copilot seat data)
- 8-step onboarding guidance flow: welcome → profile → it-access → policy → induction → team → documents → all-set

### Present in Code but Not Live / Mock / Dead
- Chatbot usage analytics dashboard (`modules/analytics/`) — mock data only
- PMO project/risk dashboard (`modules/pmo-hub/`) — mock data only
- In-app survey feedback (`modules/feedback/`) — localStorage only, no backend
- `langgraph` dependency — listed, never imported
- `_route_llm()` in `supervisor_agent.py` — defined, never called
- Redis service in `docker-compose.yml` — defined, never used by app code
- Several onboarding component files (`ChecklistPanel`, `DocumentPanel`, `HRNotes`, `TimelinePanel`, `TrainingGrid`, `WelcomeHeader`, `useOnboardingState`) — orphaned leftovers, not imported anywhere, reference constants that no longer exist
- `apiConfig.js` on the frontend — a parallel, unused endpoint map; the real API layer (`services/api.js`) hardcodes its own paths
- `API_QUICK_REFERENCE.js` — stale example file describing functions (`getLeaves`, `requestLeave`, `getPayroll`, etc.) that do not exist in the codebase

---

## Documentation Structure

This repository contains the specification framework for AURA under `knowledge-specs/docs/`.

| Section | Path | Description |
|---------|------|-------------|
| 00 — Foundation | `00-foundation/` | Vision, problem statement, business objectives, scope, success metrics, **plain-English overview** |
| 01 — Governance | `01-governance/` | Governance model, access control, compliance, security, AI/prompt governance |
| 02 — Ontology | `02-ontology/` | Domain taxonomy, entity model |
| 03 — Skills | `03-skills/` | Skills framework and catalog by domain |
| 04 — Agents | `04-agents/` | Agent framework, per-domain agent specs, orchestrator |
| 05 — Platform | `05-platform/` | Orchestrator, RAG architecture, memory, guardrails, evaluation |
| 06 — Requirements | `06-requirements/` | Product/functional/non-functional requirements, feature catalog, user stories |
| 07 — Technical | `07-technical/` | Coding, API, database, frontend, deployment, vector standards |
| 08 — Data | `08-data/` | Chunking, indexing, metadata, retention, vector schema, SharePoint ingestion |
| 09 — Roadmap | `09-roadmap/` | Current state, target state, future agents/skills, technical debt |
| 10 — Reference | `10-reference/` | Architecture overview, application map, component inventory, glossary, API catalog, **folder structure** |

---

## Governance Model

The platform operates under a structured governance model separating concerns across three layers:

**Platform Governance** — Decisions about the platform's scope, agent behavior, domain coverage, and LLM configuration. Owned by the platform team.

**Data Governance** — Decisions about what data is ingested, how it is chunked, what metadata is stored, and how PII is handled. Governed by HR and IT stakeholders.

**Access Governance** — Decisions about who can access what through the platform. Note: the frontend's `userConfig.js` currently has `isUserAuthorized()` hardcoded to always return `true` — access is open to all organization members by design, with only role/permission level (not access itself) varying per user. Any documentation implying hard access denial at the frontend layer should be corrected to reflect this.

---

## Contribution Guidelines

### Specification Changes
1. Open a specification PR with the proposed change under `knowledge-specs/docs/`
2. Verify the claim against the actual code before merging — this documentation set was previously allowed to drift significantly from the implementation; treat every factual claim (file paths, table names, model names, dimensions) as needing a code citation
3. Get approval from at least one platform team member

### Implementation Changes
1. Reference the specification section your implementation addresses
2. Ensure new API endpoints are reflected in `10-reference/architecture-overview.md` and `10-reference/application-map.md`
3. Ensure new document types are added to the Document Generation section above
4. Run the test suite (`apps/api-gateway/tests/`) before submitting a PR

### Branch Strategy
- `main` — production-ready specification and code
- `develop-*` — active development branches

---

## Quick Reference

### Key File Locations

| Component | Path |
|-----------|------|
| MasterAgent | `apps/api-gateway/app/agents/supervisor_agent.py` |
| BaseDeepAgent | `apps/api-gateway/app/agents/working/base_deep_agent.py` |
| LLM provider selection | `apps/api-gateway/app/agents/working/config.py` (`create_llm()`) |
| Guardrails | `apps/api-gateway/app/agents/guardrails.py` |
| SharePoint Ingestion | `apps/jobs/sharepoint_ingestion/` |
| Frontend Entry | `apps/web-ui/src/main.jsx` |
| Frontend Shell | `apps/web-ui/src/App.jsx` |
| ChatWindow | `apps/web-ui/src/components/ChatWindow.jsx` |
| Feature Modules | `apps/web-ui/src/modules/` |
| Backend Controllers | `apps/api-gateway/app/api/controllers/` |
| DB Schema | `apps/jobs/sharepoint_ingestion/create_schema.py`, `create_communications_schema.py` |

See [`10-reference/folder-structure.md`](10-reference/folder-structure.md) for the complete, annotated repository tree.

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `USE_Claude_API_Key` / `USE_Groq_API_Key` / `Use_Ollama_LLM` | Selects the active LLM provider (Claude > Groq > Ollama priority) |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Ollama endpoint (`ml01.alignedautomation.com:11434`) and model (`gpt-oss`) |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | Anthropic API key and model (default `claude-sonnet-4-6`) |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq API key and model (default `llama3-70b-8192`) |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` (or `SQL_*` aliases) | PostgreSQL connection (defaults to `hackathon.alignedautomation.com` / `squadrons`) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | Azure AD JWT validation (backend) |
| `VITE_AZURE_CLIENT_ID` / `VITE_AZURE_TENANT_ID` | MSAL configuration (frontend) |
| `SHAREPOINT_*` | SharePoint ingestion job credentials and site URL |
| `TAVILY_API_KEY` | Optional web search |

---

## Contact and Ownership

**Platform Owner:** Aligned Automation Engineering Team
**Repository:** aa-hackathon

---

*This document is the master specification for AURA (the AA-Hackathon Enterprise Assistant). It has been reconciled with the live codebase as of 2026-07-02. When another document in this specification set conflicts with this README or with `10-reference/`, treat this README and `10-reference/` as authoritative and update the conflicting document.*
