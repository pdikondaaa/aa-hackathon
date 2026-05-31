# AGENTS.md — AURA (Aligned Unified Resource Assistant)

AI-powered internal assistant for Aligned Automation employees. Chat interface backed by multi-agent RAG pipeline over company documents.

## Folder Structure

```
apps/
  api-gateway/          # FastAPI backend (Python). Entrypoint: app/main.py
  web-ui/               # React+Vite frontend. Entrypoint: src/main.jsx -> App.jsx
  jobs/
    sharepoint_ingestion/  # Batch job: SharePoint -> extract -> chunk -> embed -> pgvector
  var/
    memory/{user_id}/   # Per-user conversation memory (markdown files)
    wiki/               # Knowledge wiki (entities, concepts, synthesis)
integrations/
  sharepoint/client.py  # STUB only — real integration is in apps/jobs/sharepoint_ingestion/connectors/
knowledge/
  ingestion/loaders.py  # STUB only — real loaders are in apps/jobs/sharepoint_ingestion/extractors/
deployments/
  docker/docker-compose.yml  # api + postgres (pgvector) + redis
```

**Stubs warning:** `integrations/sharepoint/` and `knowledge/ingestion/` are placeholder stubs. The real implementations live under `apps/jobs/sharepoint_ingestion/`.

## Dev Commands

```bash
# Backend (from apps/api-gateway/)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (from apps/web-ui/)
npm install
npm run dev          # Vite dev server, default port 5174

# Docker (all services)
docker compose -f deployments/docker/docker-compose.yml up --build
```

No test runner is configured globally. Test files exist (`test_agents.py`, `tests/`) but there is no `pytest.ini` or test script — run `pytest` manually from `apps/api-gateway/`.

## Environment

Root `.env` is loaded by both backend and frontend. Copy `.env.example` to `.env`.

Key groups:
- **Azure AD:** `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` — auth for API + web-ui
- **SharePoint:** `SHAREPOINT_CLIENT_ID/SECRET/TENANT_NAME/SITE_PATH` — ingestion job credentials
- **PostgreSQL:** `SQL_HOST/PORT/USERNAME/PWD/DB`, `DATABASE_URL` — main AURA database (pgvector)
- **Zoho People DB:** `ZOHO_DB_*` — employee directory, attendance, read-only reporting view
- **Ollama:** `OLLAMA_BASE_URL` (default `localhost:11434`), `OLLAMA_MODEL` (`gpt-oss`), `OLLAMA_EMBED_MODEL` (`nomic-embed-text`)
- **Vite:** frontend env vars must be `VITE_` prefixed (`VITE_API_URL`, `VITE_AZURE_*`)

## Architecture & Data Flow

```
SharePoint Docs ──> Ingestion Job ──> PostgreSQL+pgvector
                                           |
User ──> Web UI (React) ──> API Gateway ──> MasterAgent ──> Domain Agents ──> RAG Retriever ──> pgvector
              |                  |                                                  |
         Azure AD MSAL      Zoho People DB                                    Ollama LLM
```

### Agent Routing (MasterAgent in `app/agents/supervisor_agent.py`)

1. Fast-path: greetings and leave-application return static responses
2. Guardrails: jailbreak, distress, org-scope checks (`app/agents/guardrails.py`)
3. Escalation substring check (`'escalat' in query`) — only hard-coded shortcut kept, unambiguous and safety-critical
4. Combined intent + domain LLM routing (single Ollama call classifies intent AND picks domain):
   - `casual` intent -> **funny** agent (no DB, no RAG — Ollama-only response)
   - `knowledge`/`action`/`data_lookup` intent -> routed domain agent
   - `unclear` intent with no confident domain -> disambiguation response asking user to clarify
5. Heuristic casual fallback: if LLM is unavailable, a lightweight keyword check detects jokes/small-talk
6. **No regex pre-classifiers, no keyword fallback** — all routing decisions (except escalation) are made by the LLM. If no route is found, the user gets a disambiguation menu instead of being silently routed to HR
7. Domain agents: **hr**, **it**, **admin**, **pmo**, **finance**, **org**, **employee**, **attendance**, **document**, **escalation**, **funny**
8. Knowledge-seeking agents do RAG via `app/rag/retriever.py` (pgvector cosine similarity) with a strict similarity threshold — chunks below 0.15 are discarded, not force-fed to the LLM

### RAG Retriever (`app/rag/retriever.py`)

- Embeds queries with Ollama `nomic-embed-text`
- Queries pgvector for top-k similar chunks
- Returns: `chunk_text`, `document_name`, `source_url`, `similarity_score`

## API Endpoints & Return Values

All routes are prefixed `/api/` unless noted. Auth is Azure AD JWT (bearer token).

### Chat & Conversations
| Endpoint | Method | Returns |
|---|---|---|
| `/api/chat` | POST | `{answer, user_email, user_id}` |
| `/api/chat/stream` | POST | SSE token stream |
| `/api/conversations` | GET | `{data: [{id, title, created_at, updated_at}], total, page, limit}` |
| `/api/conversations` | POST | `{id, title, created_at, updated_at}` |
| `/api/conversations/{id}/messages` | POST | `{id, conversation_id, role, content, status, created_at}` |
| `/api/conversations/{id}/messages` | GET | `{data: [MessageOut], total, page, limit}` |
| `/api/messages/{id}/citations` | GET | `[{chunk_id, chunk_index, chunk_content, document_id, document_title, source_url}]` |
| `/api/messages/{id}/feedback` | POST | `{id, message_id, user_id, rating, category, comment, created_at}` |

### Escalations
| Endpoint | Method | Returns |
|---|---|---|
| `/api/escalations` | POST | `EscalationRecord` (hr/it/admin escalation) |
| `/api/escalations` | GET | Paginated user escalations |
| `/api/escalations/forms/{type}` | GET | Dynamic form schema for hr/it/admin |
| `/api/admin/escalations` | GET | All escalations (admin queue) |

### Documents, Email, Allocation
| Endpoint | Method | Returns |
|---|---|---|
| `/api/documents` | GET | Paginated documents with derived category |
| `/api/email-agent/refine` | POST | `{refined_subject, refined_body}` |
| `/api/email-agent/from-chat` | POST | `{to, refined_subject, refined_body}` |
| `/api/allocation/board` | GET | Role-scoped allocation board data |
| `/api/allocation/ask` | POST | `{answer}` — NL Q&A over allocation data |
| `/api/allocation/my-role` | GET | `{email, designation, role}` |

### User & Onboarding
| Endpoint | Method | Returns |
|---|---|---|
| `/api/users/me` | GET | Full employee profile (Zoho People) |
| `/api/users/birthdays/today` | GET | `{birthdays: [...]}` |
| `/api/users/anniversaries/today` | GET | `{anniversaries: [...]}` |
| `/api/onboarding/employee` | GET | Onboarding profile from Zoho |
| `/api/onboarding/peers` | GET | Colleagues with same reporting manager |

### Admin & Health
| Endpoint | Method | Returns |
|---|---|---|
| `/api/admin/pii/rules` | GET/POST | PII detection rules |
| `/api/admin/pii/analytics` | GET | PII heatmap and false-positive rate |
| `/health` | GET | `{service: "up"}` |

## Frontend-to-Backend Correspondence

| UI Component | Nav ID | Backend Endpoints |
|---|---|---|
| `ChatWindow` | `aiAssistant` | `/api/chat`, `/api/conversations/*`, `/api/messages/*` |
| `DocumentsPage` | `documents` | `/api/documents` |
| `AllocationBoard` | `allocationBoard` | `/api/allocation/board`, `/api/allocation/ask`, `/api/allocation/my-role` |
| `EmailAgentPage` | `emailAgent` | `/api/email-agent/refine`, `/api/email-agent/from-chat` |
| `OnboardingGuidancePage` | `onboardingGuidance` | `/api/onboarding/employee`, `/api/onboarding/peers` |
| `EscalationDrawer` | (drawer overlay) | `/api/escalations`, `/api/escalations/forms/{type}` |
| `Sidebar` | (always visible) | `/api/conversations` (list, delete) |
| `RightPanel` | (always visible) | `/api/users/birthdays/today`, `/api/users/anniversaries/today` |
| `MessageBubble` | (chat child) | `/api/messages/{id}/feedback` |
| `LoginPage` / App init | — | `/api/users/me`, `/api/allocation/my-role` |

Data sources: Chat answers come from pgvector RAG + Ollama LLM. User profiles and attendance come from Zoho People DB. Allocation data comes from PostgreSQL `employee_details`/`allocation` tables.

## Key Quirks

- **Frontend auth whitelist:** `apps/web-ui/src/config/userConfig.js` contains a hardcoded authorized users list checked after Azure AD login.
- **Conversation memory** is stored as markdown files in `apps/var/memory/{user_id}/`, not in PostgreSQL.
- **Agent routing** uses a single LLM call for combined intent+domain classification. No regex pre-classifiers, no keyword fallback — unresolvable queries get a disambiguation menu. Adding a new agent requires updating `_VALID_DOMAINS` and the routing prompt in `supervisor_agent.py`.
- **Two DB connections:** AURA PostgreSQL (documents, conversations, escalations, allocations) and Zoho People PostgreSQL (read-only employee data). Different env vars for each.
- **Docker compose** starts 3 services: `api` (port 8000), `postgres` (pgvector:pg16), `redis`. The web-ui is not dockerized in the compose file — run separately with `npm run dev`.
- **No CI/CD** workflows exist in the repo.
- **No linter/formatter** config exists. No `pyproject.toml`, `setup.py`, or `eslint` config.
