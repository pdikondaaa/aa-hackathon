# API Catalog — AURA (AA-Hackathon Enterprise Assistant)

**Organization:** Aligned Automation
**Platform:** AURA (in-app name), AA-Hackathon Enterprise Assistant (project/repo codename)
**Document Date:** 2026-07-02
**Version:** 2.0 — Corrected against live codebase

> **Accuracy note:** Earlier drafts of this catalog invented a "3-tier" rate-limiting policy backed by Redis, a specific error-code taxonomy, and example JSON payloads with fabricated field names and sample employee data. Redis is defined in `docker-compose.yml` but is **not used by any application code** (no Redis client library, no rate limiting implemented anywhere). This version lists only verified route paths, prefixes, and endpoint counts, and does not assert exact request/response JSON schemas beyond what is directly confirmed. See [`application-map.md`](application-map.md) for the corresponding file-level detail and [`../README.md`](../README.md) for platform-level context.

---

## Base URL

There is no single confirmed "public API base URL" documented in the code beyond how the app is served locally and in Docker Compose:

- **Local development:** the frontend (`apps/web-ui`) proxies `/aura-api` and `/api` to `http://localhost:8000` (see `vite.config.js`).
- **Docker Compose:** the `api` service listens on `8000:8000` with no reverse proxy or TLS termination configured in this repository.
- **Production:** the frontend reads `VITE_API_URL` to reach the backend; the exact production hostname is a deployment-time configuration value, not something hardcoded in this codebase (the `hackathon.alignedautomation.com` hostname that appears elsewhere in this documentation set is the **default database host** in `db_config.py`, not a confirmed public API URL — do not conflate the two).

---

## API Architecture

```mermaid
graph LR
    subgraph "Client"
        BROWSER["Browser (aura-ui)\nReact + MSAL"]
    end

    subgraph "API Gateway (FastAPI, title \"AURA\") :8000"
        CORS["CORS middleware\nallow_origins=[\"*\"]"]
        AUTH["JWT Validator\n(python-jose, RS256 via JWKS)"]
        ROUTER["FastAPI Router\n(26 routers registered in main.py)"]

        subgraph "Route Groups (21 route files)"
            CHAT_R["/api (chat, chat/stream)"]
            CONV_R["/api/conversations"]
            MSG_R["/api/conversations/{id}/messages, /api/messages/{id}"]
            FB_R["/api/messages/{id}/feedback, /api/feedback/{id}, /api/admin/feedback"]
            ESC_R["/api/escalations, /api/admin/escalations"]
            PII_R["/api/admin/pii"]
            ALLOC_R["/api/allocation"]
            EMAIL_R["/api/email-agent"]
            ATT_R["/api/attendance"]
            USR_R["/api/users"]
            DOC_R["/api/documents"]
            COO_R["/api/coo-analytics"]
            FORMS_R["/api/ms-forms"]
            COMM_R["/api/communications, /api/admin/communications"]
            PARK_R["/api/parking"]
            SKL_R["/api/skills"]
            NCL_R["/api/ncl, /api/admin/ncl (~45 endpoints)"]
            ONB_R["/api/onboarding"]
            HLTH_R["/health"]
            DBG_R["/api/test, /api/debug/agents"]
        end
    end

    BROWSER -- "Bearer <Azure AD JWT>" --> CORS
    CORS --> AUTH
    AUTH --> ROUTER
    ROUTER --> CHAT_R
    ROUTER --> CONV_R
    ROUTER --> MSG_R
```

**Not implemented:** there is no rate-limiting middleware anywhere in this codebase. `redis` is one of three `docker-compose.yml` services but no Python package in `requirements.txt` provides a Redis client and no code connects to it — any rate-limiting policy described elsewhere is aspirational, not current behavior.

---

## Authentication

All endpoints except the health checks (`GET /health`, `GET /health/db`) require a valid Azure AD Bearer token:

```
Authorization: Bearer <access_token>
```

The token is validated server-side by `app/api/auth/jwt_validator.py` using `python-jose` (RS256 signature verified against JWKS fetched from `https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys`, issuer checked against both v1 and v2 formats, audience, and expiry). Tokens are acquired client-side via MSAL Browser 5.9.0.

**Typical failure responses:**
- `401 Unauthorized` — missing, expired, or invalid token
- `403 Forbidden` — valid token but the route enforces an admin-only prefix (`/api/admin/*`) the caller doesn't satisfy

This catalog does not assert a complete, verified server-side role matrix beyond the `/api/admin/*` naming convention — see [`architecture-overview.md`](architecture-overview.md#access-control) for what is and isn't confirmed about access control.

---

## Error Responses

FastAPI's default `HTTPException` behavior returns:

```json
{ "detail": "Human-readable error message" }
```

An exhaustive, verified error-code taxonomy (specific `code` fields, `request_id` correlation IDs, etc.) is **not confirmed** across all 21 route files in this codebase, and earlier drafts of this document invented one. Treat any such structured error-code table as unverified unless checked directly against a specific controller's exception handlers.

---

## Chat Endpoints — `chat_controller.py` (prefix `/api`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | Synchronous chat — full response in one request |
| POST | `/api/chat/stream` | Server-Sent Events (SSE) streaming chat |

Both are dispatched through `supervisor_agent.py` (MasterAgent). Routing is two live tiers — regex fast-paths, then `DOMAIN_KEYWORDS` keyword scoring, defaulting to `QuickAgent` — not a three-tier LLM-classified pipeline (`_route_llm()` exists but is never called). See [`architecture-overview.md`](architecture-overview.md) for the full request lifecycle sequence diagram.

---

## Conversation Endpoints — `conversations_controller.py` (prefix `/api/conversations`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/conversations` | List conversations for the authenticated user |
| POST | `/api/conversations` | Create a new conversation |
| GET | `/api/conversations/{id}` | Get a single conversation |
| PATCH | `/api/conversations/{id}` | Update a conversation (e.g., rename) |
| DELETE | `/api/conversations/{id}` | Delete a conversation and its messages |

---

## Message Endpoints — `messages_controller.py`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/conversations/{id}/messages` | Send a new message in a conversation |
| POST | `/api/conversations/{id}/messages/regenerate` | Regenerate the assistant's last response |
| GET | `/api/conversations/{id}/messages` | List messages in a conversation |
| GET | `/api/messages/{id}` | Get a single message |
| POST | `/api/messages/{id}/...` | Two additional POST actions on a single message (exact sub-paths not independently re-verified beyond count in this pass) |
| GET | `/api/messages/{id}/...` | An additional GET action on a single message |

`messages_service.py` handles persistence for all of the above via raw `psycopg2` SQL.

---

## Feedback Endpoints — `feedback_controller.py`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/messages/{id}/feedback` | Submit feedback (e.g., thumbs up/down) for a specific message — this is the backend-persisted feedback path, distinct from the frontend `modules/feedback/` module which is localStorage-only |
| GET | `/api/conversations/{id}/feedback` | List feedback for a conversation |
| PATCH | `/api/feedback/{id}` | Update a feedback entry |
| DELETE | `/api/feedback/{id}` | Delete a feedback entry |
| GET | `/api/admin/feedback` | Admin view of all feedback |

---

## Escalation Endpoints — `escalations_controller.py`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/escalations` | Create a new escalation |
| GET | `/api/escalations` | List own escalations |
| GET | `/api/escalations/{id}` | Get a specific escalation |
| PATCH | `/api/escalations/{id}` | Update an escalation |
| GET | `/api/admin/escalations` | Admin view of all escalations |

`escalation_agent.py` and `escalations_service.py` back this controller; `agents/guardrails.py`'s escalation-keyword check can also route a chat message here directly from `supervisor_agent.py`.

---

## PII Endpoints — `pii_controller.py` (prefix `/api/admin/pii`, 8 endpoints)

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/pii/rules` (and `/{id}`) | PII redaction rules CRUD |
| POST | `/api/admin/pii/rules/test` | Test a redaction rule against sample text |
| GET | `/api/admin/pii/logs` | List PII redaction log entries |
| POST | `/api/admin/pii/logs/{id}/review` | Mark a log entry as reviewed |
| GET | `/api/admin/pii/analytics` | PII detection analytics summary |

Backed by `pii_service.py` and the `pii_redaction_rules`/`pii_redaction_logs` tables.

---

## Allocation Endpoints — `allocation_controller.py` (prefix `/api/allocation`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/allocation/filters` | Available filter options (project, role, etc.) |
| GET | `/api/allocation/board` | Allocation board data |
| GET | `/api/allocation/employee/{id}` | Allocation detail for one employee |
| POST | `/api/allocation/ask` | Natural-language Q&A over allocation data (`allocation_agent.py`'s `ask_aura()`) |
| GET | `/api/allocation/my-role` | Caller's own role in the allocation system |

Backed by `allocation_service.py`, reading `allocation_details`/`allocation_role_map` tables.

---

## Email Endpoints — `email_controller.py` (prefix `/api/email-agent`, 3 endpoints)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/email-agent/refine` | Refine/improve a draft email |
| POST | `/api/email-agent/from-chat` | Compose an email draft from conversation context |
| POST | `/api/email-agent/it-ticket/send` | Send an IT-ticket-related email |

`email_agent.py` composes the draft text via the active LLM provider; there is no generic backend "send email" path beyond the IT-ticket case — the frontend otherwise builds a `mailto:` link, and a separate Graph `sendMail` path exists client-side in `utils/authService.js` (calling Graph directly, not through this backend).

---

## Attendance Endpoints — `attendance_controller.py` (prefix `/api/attendance`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/attendance/me` | Own attendance records |
| GET | `/api/attendance/team` | Direct reports' attendance (manager view) |

Backed by `attendance_service.py`, sourced from the Zoho People read-only replica.

---

## Profile Endpoints — `profile_controller.py` (prefix `/api/users`, 3 endpoints)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users/me` | Authenticated user's own profile |
| GET | `/api/users/birthdays/today` | Employees with a birthday today |
| GET | `/api/users/anniversaries/today` | Employees with a work anniversary today |

Backed by `user_service.py`.

---

## Document Endpoints — `documents_controller.py` (prefix `/api/documents`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/documents` | List previously generated documents for the authenticated user |

Document generation itself is driven conversationally through `document_agent.py` (12 types + a free-text `custom` mode — see [`../README.md`](../README.md#document-generation-12-types-not-11)), not via a dedicated `POST /generate` REST endpoint in this controller. Sessions are in-memory only (30-minute timeout, keyed by user email) and are not persisted to the database.

---

## COO Analytics Endpoints — `coo_analytics_controller.py` (prefix `/api/coo-analytics`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/coo-analytics/dashboard` | Executive dashboard summary data |
| GET | `/api/coo-analytics/raw-records` | Underlying raw records behind the dashboard |
| GET | `/api/coo-analytics/filters` | Available filter options |

This is a **real, backend-driven** endpoint group — do not confuse it with `modules/analytics/` on the frontend, which is mock-data-only and calls no backend endpoint at all.

---

## Forms Endpoint — `forms_controller.py` (prefix `/api/ms-forms`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ms-forms/create` | Create a Microsoft Form via Graph API (`ms_forms_agent.py`) |

---

## Communications Endpoints — `communications_controller.py` + `graph_calendar_controller.py`

**Public router (`/api/communications`, 5 endpoints):**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/communications/...` | Active announcements |
| POST | `/api/communications/...` | Dismiss an announcement |
| GET | `/api/communications/...` | Events list |
| POST | `/api/communications/...` | RSVP to an event |
| GET | `/api/communications/shared-calendar` | Shared company calendar (via `graph_calendar_controller.py`, Microsoft Graph) |

**Admin router (`/api/admin/communications`, 8 endpoints):** full CRUD for announcements and events.

Backed by `communications_service.py` and the `org_announcements`, `org_announcement_dismissals`, `org_events`, `org_event_rsvps` tables.

---

## Parking Endpoints — `parking_controller.py` (prefix `/api/parking`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/parking/request` | Get own parking request(s) |
| POST | `/api/parking/request` | Submit a parking request |
| POST | `/api/parking/deactivate` | Deactivate an active parking request |

Backed by `parking_service.py` and the `parking_requests` table.

---

## Skills Endpoint — `skills_controller.py` (prefix `/api/skills`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/skills/analytics` | Company-wide skills analytics (real data, backs `modules/skill-hub/`) |

---

## No-Code Form Builder Endpoints — `form_builder_controller.py` (prefix `/api/ncl` + `/api/admin/ncl`, ~45 endpoints — the largest controller in the codebase)

Covers, across the public and admin routers: form definitions CRUD, sections/fields, versions, roles, submissions, workflow definitions/instances/step logs, rule definitions, templates, slash-commands, audit logs, and an AI form-design chat endpoint. Backed by `form_builder_service.py`, `form_builder_ai_service.py`, `rule_engine_service.py`, `workflow_engine_service.py`, and `slash_command_service.py`, against the 13 `ncl_*` tables (`ncl_form_definitions`, `ncl_form_sections`, `ncl_form_fields`, `ncl_form_versions`, `ncl_form_roles`, `ncl_form_submissions`, `ncl_workflow_definitions`, `ncl_workflow_instances`, `ncl_workflow_step_logs`, `ncl_rule_definitions`, `ncl_form_templates`, `ncl_audit_logs`, `ncl_slash_commands`).

Given the scale of this controller, this catalog intentionally does not attempt to enumerate all ~45 individual routes — consult the source directly for the authoritative, current list.

---

## Onboarding Endpoints — `app/api/onboarding.py` (prefix `/api/onboarding`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/onboarding/employee` | Onboarding data for the authenticated (new-hire) employee |
| GET | `/api/onboarding/peers` | Peer/team information relevant to onboarding |

The frontend's `modules/onboarding-guidance/` presents this as an 8-step flow (welcome → profile → it-access → policy → induction → team → documents → all-set) built on top of these two endpoints.

---

## System Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/health/db` | No | Database connectivity check |
| GET | `/api/test` | Unconfirmed | Debug controller test endpoint |
| GET | `/api/debug/agents` | Unconfirmed | Debug controller agent-introspection endpoint |

This catalog does not assert specific health-check response schemas (e.g., an Ollama-reachability or FAISS-index-size field) beyond what is directly confirmed, since the LLM provider and fallback index are configuration-dependent, not fixed.

---

## Endpoint Summary Table (by controller)

| Controller file | Prefix(es) | Approx. endpoint count |
|---|---|---|
| `chat_controller.py` | `/api` | 2 |
| `conversations_controller.py` | `/api/conversations` | 5 |
| `messages_controller.py` | `/api/conversations/{id}/messages`, `/api/messages/{id}` | ~7 |
| `feedback_controller.py` | `/api/messages/{id}/feedback`, `/api/feedback/{id}`, `/api/admin/feedback` | ~5 |
| `escalations_controller.py` | `/api/escalations`, `/api/admin/escalations` | ~5 |
| `pii_controller.py` | `/api/admin/pii` | 8 |
| `allocation_controller.py` | `/api/allocation` | 5 |
| `email_controller.py` | `/api/email-agent` | 3 |
| `attendance_controller.py` | `/api/attendance` | 2 |
| `profile_controller.py` | `/api/users` | 3 |
| `documents_controller.py` | `/api/documents` | 1 |
| `coo_analytics_controller.py` | `/api/coo-analytics` | 3 |
| `forms_controller.py` | `/api/ms-forms` | 1 |
| `communications_controller.py` | `/api/communications`, `/api/admin/communications` | 13 |
| `graph_calendar_controller.py` | `/api/communications` | 1 |
| `parking_controller.py` | `/api/parking` | 3 |
| `skills_controller.py` | `/api/skills` | 1 |
| `form_builder_controller.py` | `/api/ncl`, `/api/admin/ncl` | ~45 |
| `onboarding.py` | `/api/onboarding` | 2 |
| `health_controller.py` | `/health` | 2 |
| `debug_controller.py` | — | 2 |

**Total: 21 route files, ~110+ endpoints.** `main.py` registers 26 router objects (several controllers, such as `communications_controller.py` and `form_builder_controller.py`, define both a public and an admin `APIRouter`).

---

## Rate Limiting — Not Implemented

Earlier drafts of this document described a Redis-backed rate-limiting policy with per-role request limits and `X-RateLimit-*` headers. **None of that exists in the current codebase.** `redis` is defined in `docker-compose.yml` but has no client library in `requirements.txt` and is never imported by application code. If rate limiting is a real requirement, it should be tracked as a roadmap item (`09-roadmap/`) and clearly labeled as not-yet-implemented, not documented here as current behavior.
