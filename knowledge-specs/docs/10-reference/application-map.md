# Application Map — AURA (AA-Hackathon Enterprise Assistant)

**Organization:** Aligned Automation
**Platform:** AURA (in-app name), AA-Hackathon Enterprise Assistant (project/repo codename)
**Document Date:** 2026-07-02
**Version:** 2.0 — Corrected against live codebase

> This is the file-level technical companion to [`folder-structure.md`](folder-structure.md) (plain-English tour) and [`architecture-overview.md`](architecture-overview.md) (system diagrams). Where this document lists a file, it exists in the repository as named — fabricated files from earlier drafts (`Header.jsx`, `ConversationList.jsx`, `ChatInput.jsx`, `FeedbackModal.jsx`, `EscalationPanel.jsx`, `ProfileCard.jsx`, a shared `DocumentPanel.jsx`, `LoadingSpinner.jsx`, `MessageList.jsx`/`MessageItem.jsx`, `msalConfig.js`, `routeConfig.js`, `chartConfig.js` as such) have been removed.

---

## Repository Structure Overview

```mermaid
graph TD
    ROOT["aa-hackathon/"]
    ROOT --> APPS["apps/"]
    ROOT --> INTEGRATIONS["integrations/"]
    ROOT --> DEPLOYMENTS["deployments/"]
    ROOT --> KNOWLEDGE["knowledge-specs/"]

    APPS --> APIGW["api-gateway/\n(FastAPI backend, app title \"AURA\")"]
    APPS --> WEBUI["web-ui/\n(React frontend, package name \"aura-ui\")"]
    APPS --> JOBS["jobs/\n(background ingestion + data-load scripts)"]

    APIGW --> APP["app/"]
    APP --> API_DIR["api/\n(auth, config, controllers, models, services, repositories, onboarding.py)"]
    APP --> AGENTS_DIR["agents/\n(supervisor + domain agents)"]
    APP --> RAG_DIR["rag/\n(retriever.py — pgvector only)"]
    APP --> MEMORY_DIR["memory/"]
    APP --> UTILS_DIR["utils/"]

    WEBUI --> SRC["src/"]
    SRC --> COMPONENTS_DIR["components/"]
    SRC --> MODULES_DIR["modules/ (8)"]
    SRC --> CONFIG_DIR["config/"]
    SRC --> SERVICES_DIR["services/ (api.js)"]
    SRC --> UTILS_FE["utils/"]

    INTEGRATIONS --> SP_INT["sharepoint/client.py\n(older/shared connector)"]
    DEPLOYMENTS --> DOCKER_DIR["docker/docker-compose.yml\n(3 services: api, postgres, redis)"]
    JOBS --> SP_JOB["sharepoint_ingestion/"]
    JOBS --> DATA_FILES["Data_Files/ (CSV loads)"]
```

---

## Backend Map — `apps/api-gateway/`

### Entry Point

| File | Purpose |
|---|---|
| `app/main.py` | FastAPI application, title literally `"AURA"`. CORS middleware with `allow_origins=["*"]`. Registers **26 routers** at the top of the file. The `form_builder_controller` router import is accidentally duplicated three times in the source — a minor sloppiness, not a functional bug. |

### Authentication — `app/api/auth/`

| File | Purpose |
|---|---|
| `auth_handler.py` | A FastAPI `Depends` dependency (`get_current_user`) that validates the Authorization header, calls `jwt_validator`, and injects user context into route handlers. |
| `jwt_validator.py` | Validates the Azure AD JWT: RS256 signature verified against JWKS fetched from `https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys`; checks issuer against both v1 (`sts.windows.net`) and v2 (`login.microsoftonline.com`) formats; checks audience and expiry. Uses `python-jose`, **not** `msal` — MSAL is never imported anywhere under `apps/api-gateway`. |
| `user_context.py` | Authenticated user context built from decoded JWT claims. |
| `auth_config.py` | Requires `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` from environment; raises `RuntimeError` at startup if either is missing. |

### Configuration — `app/api/config/`

| File | Purpose |
|---|---|
| `db_config.py` | A `psycopg2` connection to PostgreSQL (specific pool-size parameters are not asserted here as fact beyond what's verifiable in the source). |
| `async_db_config.py` | Async database configuration counterpart. |

### Models — `app/api/models/`

Only **four** Pydantic model files exist under `app/api/models/`:

| File | Purpose |
|---|---|
| `attendance_model.py` | Attendance-related request/response schemas. |
| `communications_model.py` | Announcement/event/RSVP schemas. |
| `escalation_model.py` | Escalation request/response schemas. |
| `form_builder_model.py` | Schemas for the no-code form/workflow builder ("NCL"). |

Most controllers validate ad hoc with inline Pydantic classes or plain dict payloads rather than a dedicated model file — do not assume a model file exists for every controller.

### Controllers — `app/api/controllers/` (20 files) + `app/api/onboarding.py`

| File | Path prefix | Endpoints (approx.) |
|---|---|---|
| `onboarding.py` *(lives in `app/api/`, not `controllers/`)* | `/api/onboarding` | `GET /employee`, `GET /peers` |
| `chat_controller.py` | `/api` | `POST /chat`, `POST /chat/stream` |
| `conversations_controller.py` | `/api/conversations` | `GET`, `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `messages_controller.py` | `/api/conversations/{id}/messages`, `/api/messages/{id}` | Send / regenerate / list under conversations; get + two POST actions + get under `/api/messages/{id}` |
| `feedback_controller.py` | `/api/messages/{id}/feedback`, `/api/conversations/{id}/feedback`, `/api/feedback/{id}`, `/api/admin/feedback` | POST feedback, GET feedback for a conversation, PATCH/DELETE a feedback entry, GET admin view |
| `escalations_controller.py` | `/api/escalations`, `/api/admin/escalations` | POST/GET escalations, GET/PATCH `/{id}`, GET admin view |
| `pii_controller.py` | `/api/admin/pii` | Rules CRUD, `rules/test`, `logs`, `logs/{id}/review`, `analytics` — 8 endpoints |
| `allocation_controller.py` | `/api/allocation` | `GET /filters`, `GET /board`, `GET /employee/{id}`, `POST /ask`, `GET /my-role` |
| `email_controller.py` | `/api/email-agent` | 3 POST endpoints: `refine`, `from-chat`, `it-ticket/send` |
| `attendance_controller.py` | `/api/attendance` | `GET /me`, `GET /team` (reportee view) |
| `profile_controller.py` | `/api/users` | 3 GET endpoints: `me`, `birthdays/today`, `anniversaries/today` |
| `documents_controller.py` | `/api/documents` | `GET` (list generated documents) |
| `coo_analytics_controller.py` | `/api/coo-analytics` | `GET /dashboard`, `GET /raw-records`, `GET /filters` |
| `forms_controller.py` | `/api/ms-forms` | `POST /create` |
| `communications_controller.py` | `/api/communications` (public), `/api/admin/communications` (admin) | Public: 5 endpoints (active announcements, dismiss, events, RSVP, calendar-adjacent). Admin: 8 endpoints (announcements + events CRUD) |
| `graph_calendar_controller.py` | `/api/communications` | `GET /shared-calendar` (Microsoft Graph) |
| `parking_controller.py` | `/api/parking` | `GET/POST /request`, `POST /deactivate` |
| `skills_controller.py` | `/api/skills` | `GET /analytics` |
| `form_builder_controller.py` | `/api/ncl` (public), `/api/admin/ncl` (admin) | **~45 endpoints — the largest controller in the codebase.** Covers form CRUD, fields, versions, roles, submissions, workflows, rules, templates, slash-commands, audit logs, AI form-design chat |
| `health_controller.py` | `/health` | `GET ""`, `GET /db` |
| `debug_controller.py` | — | `GET /api/test`, `GET /api/debug/agents` |

### Services — `app/api/services/` (17 files, all raw `psycopg2` SQL, no ORM)

`allocation_service.py`, `attendance_service.py`, `chat_service.py`, `communications_service.py`, `conversations_service.py`, `coo_analytics_service.py`, `escalations_service.py`, `feedback_service.py`, `form_builder_ai_service.py`, `form_builder_service.py`, `messages_service.py`, `parking_service.py`, `pii_service.py`, `rule_engine_service.py`, `skills_service.py`, `slash_command_service.py`, `user_service.py`, `workflow_engine_service.py`.

There is no SQLAlchemy, no ORM layer, and no query builder — every service issues parameterized SQL directly via `psycopg2`.

### Repositories — `app/api/repositories/`

Exists as a folder but is effectively empty — contains only `__init__.py`. Do not describe a repository layer as an active architectural pattern in this codebase.

### Agents — `app/agents/`

| File / directory | Purpose |
|---|---|
| `supervisor_agent.py` | MasterAgent / router. Two live routing tiers (regex fast-paths, then `DOMAIN_KEYWORDS` keyword scoring, defaulting to `QuickAgent`). A `_route_llm()` method exists but is **dead code** — never called. |
| `org_agent.py` | `OrgDeepAgent` — org/company info, a `BaseDeepAgent` subclass with no local document folders. |
| `escalation_agent.py` | Escalation creation/management (plain functions). |
| `document_agent.py` | Multi-turn document generation (plain class), see Document Generation section below. |
| `email_agent.py` | Email draft composition (plain class). |
| `ms_forms_agent.py` | Creates Microsoft Forms via Graph API (plain class, no LLM). |
| `allocation_agent.py` | PMO allocation board data + `ask_aura()` LLM Q&A (plain class). |
| `license_agent.py` | AI tool license lookups against a separate set of `squadrons` tables (`ai_claude_users`, `ai_figma_users`, `ai_lovable_users`, `ai_m365_copilot_users`). |
| `parking_config.py` | Static Fountainhead parking-rate data — not an agent, used by the Admin agent. |
| `guardrails.py` | `check_input()` — single function covering jailbreak/harmful/security static blocks, distress-signal LLM response, and org-scope-violation LLM redirect. Exports `GENERIC_GUARDRAIL`/`ORG_GUARDRAIL` text injected into every `BaseDeepAgent` prompt. |
| `agents/employee/` | `employee_agent.py`, `attendance_agent.py`, `config.py` — plain functions, wrapped in small adapter classes inside `supervisor_agent.py` for dispatch. |
| `agents/working/base_deep_agent.py` | The real `BaseDeepAgent`: embed + query pgvector (primary) → fall back to local FAISS/keyword knowledge base only if pgvector returns nothing → single LCEL `prompt \| llm \| StrOutputParser` call with guardrail text injected, self-verification, inline citation. Optional Tavily web search can be layered in when configured — it is one optional supplement, not a fourth parallel source. |
| `agents/working/hr_agent.py`, `it_agent.py`, `admin_agent.py`, `finance_agent.py`, `pmo_agent.py` | `BaseDeepAgent` subclasses, one per domain. |
| `agents/working/funny_agent.py`, `quick_agent.py` | Lightweight direct-LLM-call agents — do **not** inherit `BaseDeepAgent` despite mirroring its interface. |
| `agents/working/knowledge_base.py` | Local, per-domain FAISS/keyword fallback built from local document folders — a **separate, smaller corpus** from the pgvector data, consulted only when pgvector returns zero results. |
| `agents/working/personalities.py` | Per-agent tone/personality prompt text. |
| `agents/working/config.py` | `create_llm()` — provider selection: Claude (Anthropic, `claude-sonnet-4-6` default) → Groq (`llama3-70b-8192` default) → Ollama (`gpt-oss` @ `ml01.alignedautomation.com:11434`, default/fallback), controlled by `USE_Claude_API_Key` / `USE_Groq_API_Key` / `Use_Ollama_LLM`. |
| `agents/working/tools/tavily_search.py` | Optional Tavily web-search tool. |

### RAG — `app/rag/`

| File | Purpose |
|---|---|
| `retriever.py` | The **only** data source consulted at query time is pgvector — confirmed by the file's own docstring ("SharePoint is never contacted here"). Embeds the query with `HuggingFaceEmbeddings`, model `nomic-embed-text-v1.5` (768 dimensions — **not** `all-MiniLM-L6-v2`/384). Raw SQL join of `document_chunks` + `documents`, pgvector cosine-distance operator `<=>`, `ivfflat` index with `probes=10`. |

### Memory — `app/memory/`

| File | Purpose |
|---|---|
| `client.py` | `MemoryClient.get_context()` — the single entry point. Assembles context (capped at 5000 characters) from preferences + conversation + history + collective-intelligence + DB-context. |
| `complexity.py` | `classify()` returns `"simple"` or `"deep"` based on query length/regex heuristics. |
| `md_store.py` | Flat markdown files per user, stored under `var/memory`, written atomically. |
| `db_tool.py` | Fetches DB-backed context, only invoked for `"deep"`-classified queries. |
| `enrichment.py` | Updates `post_history.md` / `conversation_memory.md` after each response. |
| `config.py` | Memory-system paths; `AURA_MEMORY_DIR` env var overrides the default location. |

### Utils — `app/utils/`

| File | Purpose |
|---|---|
| `logging_config.py` | Python logging configuration. |

---

## Frontend Map — `apps/web-ui/src/` (package.json name: `aura-ui`)

### Entry Points

| File | Purpose |
|---|---|
| `main.jsx` | MSAL bootstrap and redirect handling, then renders `<App />`. **No Redux `<Provider>` anywhere** — `@reduxjs/toolkit`, `react-redux`, `redux`, and `redux-thunk` are listed in `package.json` but have zero imports in the codebase. |
| `App.jsx` | Root shell. **No React Router** — `react-router` is not a dependency and is not imported. Navigation is a plain `activeNav` string state driving a large if/else-if conditional-render chain. Shell order: `TopBar` → `AnnouncementBanner` → `AnnouncementOverlay` → app-layout (`Sidebar` + main content + optional `RightPanel`) → persistent `EscalationDrawer` / `FormsDrawer` / `ParkingDrawer` overlays + conditional `FormChatPanel`. |

### Components — `src/components/` (shared building blocks used directly by the app shell)

| File | Purpose |
|---|---|
| `ChatWindow.jsx` | Main chat UI container — message send, SSE stream reading, stop, loading state. |
| `TopBar.jsx`, `Sidebar.jsx`, `RightPanel.jsx` | Overall page frame. |
| `LoginPage.jsx` | "Sign in with Microsoft" screen. |
| `MessageBubble.jsx` | Single chat message — role, markdown content, timestamp, citations, feedback buttons, document download. *(Not "MessageItem" or "MessageList" — those files do not exist.)* |
| `AdminPage.jsx`, `QuickLinksAdmin.jsx` | Admin-only settings screens. |
| `AllocationBoard.jsx` | Resource allocation table/chart. |
| `AnnouncementBanner.jsx`, `AnnouncementOverlay.jsx` | Announcement banner strip and welcome pop-up. |
| `AttendancePage.jsx` | Personal/team attendance view. |
| `CommunicationsAdmin.jsx`, `CommunicationsPage.jsx`, `CommunicationsWidget.jsx` | Announcements/events admin editor, viewer, and home-screen widget. |
| `DocumentsPage.jsx` | Library of previously generated HR documents. |
| `EmailAgentPage.jsx` | Standalone email-drafting tool. |
| `EscalationDrawer.jsx`, `FormsDrawer.jsx`, `ParkingDrawer.jsx` | Persistent slide-in overlay panels. |
| `PersonalNotes.jsx` | Private, per-user notes editor (client-side only). |

No `Header.jsx`, `ConversationList.jsx`, `ChatInput.jsx`, `FeedbackModal.jsx`, `EscalationPanel.jsx`, `ProfileCard.jsx`, shared `DocumentPanel.jsx`, `LoadingSpinner.jsx`, `MessageList.jsx`, or `MessageItem.jsx` exist in this directory — these appeared in earlier drafts of this documentation and were fabricated.

### Modules — `src/modules/` (8 modules)

Each module is roughly `index.js` + `pages/` + `components/` + `services/` (some also have `hooks/`/`constants/`).

| Module | Real component names / notes | Live or mock? |
|---|---|---|
| `analytics/` | 10 real chart components: `ActiveUsersAreaChart`, `DailyLineChart`, `DateRangeFilter`, `OverviewCards`, `PeakHoursBarChart`, `QueryPieChart`, `RecentActivities`, `SuccessFailedChart`, `TabsBarChart`, `TopQueriesTable` | **Mock data only** — `analyticsApi.js` returns hardcoded constants with a fake delay, not wired to any backend endpoint |
| `coo-analytics/` | `COODashboard.jsx` | Real — calls `/api/coo-analytics/dashboard`, `/filters`, `/raw-records` |
| `pmo-hub/` | `PMODashboard.jsx` | **Entirely mock** — hardcoded fictional project data, zero API calls |
| `skill-hub/` | `SkillRadarDashboard.jsx` | Real — calls `/api/skills/analytics` |
| `feedback/` | `FeedbackPage`, `FeedbackAdmin` | **localStorage only**, not backend-persisted (distinct from per-message thumbs up/down, which *is* persisted) |
| `parking-assistant/` | Thin API wrapper only | Real — the visible UI lives in `components/ParkingDrawer.jsx` |
| `onboarding-guidance/` | 8 steps in order: welcome, profile, it-access, policy, induction, team, documents, all-set | Real — calls `/api/onboarding/employee` and `/peers`. Contains several **orphaned/dead files**: `ChecklistPanel.jsx`, `DocumentPanel.jsx`, `HRNotes.jsx`, `TimelinePanel.jsx`, `TrainingGrid.jsx`, `WelcomeHeader.jsx`, `useOnboardingState.js` — not imported anywhere, reference constants that don't exist, would crash if used |
| `form-builder/` | Largest module — `FormBuilderAdmin`, `FormDesignerPage`, `SlashCommandAdmin`, `SubmissionsAdmin`, `DynamicFormRenderer`, `FormChatPanel`, `WorkflowDesigner`, `AiFormDesigner`; ~40 API functions | Real — full no-code form/workflow builder ("NCL" naming) |

### Configuration — `src/config/`

| File | Purpose |
|---|---|
| `apiConfig.js` | **Mostly dead/unused** — defines an endpoints map that nobody imports. The real API layer hardcodes its own paths in `services/api.js`. |
| `authConfig.js` | Real MSAL config: `clientId`/`tenantId` from `VITE_AZURE_CLIENT_ID`/`VITE_AZURE_TENANT_ID`, `redirectUri = origin + '/project-aura/'`, scope sets for login/graph/planner/calendar/mail. |
| `chatConfig.js` | Theme + nav array. Several nav items (analytics, feedback, cooAnalytics, myNotes) are commented out of the live sidebar array — reachable only via the admin submenu. |
| `parkingConfig.js` | Parking-related static config. |
| `quickLinksConfig.js` | localStorage-backed quick-links config. |
| `userConfig.js` | Client-side RBAC table. `isUserAuthorized()` is hardcoded to always return `true` — access is open to all org members; only role/permission level, not access itself, varies per user. |
| `API_QUICK_REFERENCE.js` | **Stale/aspirational** — describes functions like `getLeaves`, `requestLeave`, `getPayroll`, `getITTickets`, `apiGet`, `apiPost` that **do not exist** anywhere in the codebase; only `askBot` from its example list is real. Flag this file as inaccurate, not a source of truth. |

There is no `msalConfig.js`, `routeConfig.js`, or `chartConfig.js`-as-a-Recharts-theme file under this exact naming — the real MSAL config is `authConfig.js`, and there is no route config since there is no router.

### Services — `src/services/`

| File | Purpose |
|---|---|
| `api.js` | Custom `HTTPClient` wrapping `fetch`. Base URL `/aura-api` in dev (Vite-proxied) or `VITE_API_URL` in prod. Injects an Azure AD bearer token via `msalInstance.acquireTokenSilent` on every call. |

### Utils — `src/utils/`

| File | Purpose |
|---|---|
| `authService.js` | All MSAL/Graph glue: login, profile enrichment, Planner tasks, Calendar events, `sendMail` via Graph — these Graph calls go **directly to `graph.microsoft.com`**, not through the AURA backend. |
| `autocorrect.js` | Hardcoded typo-correction dictionary. |
| `documentDownload.js` | `jsPDF`-based PDF generation + `window.print()` fallback, used specifically for AI-generated HR documents — `jsPDF` is not used for anything else. |
| `markdown.js` | Minimal custom markdown renderer, used only for static/config content — explicitly not used for rendering arbitrary user input. |

### Build Configuration

`vite.config.js`: base path `/project-aura/`; dev server proxies both `/aura-api` and `/api` to `http://localhost:8000`; `envDir` points to the monorepo root, so the frontend shares a single `.env` file with the rest of the repo.

**Confirmed dependencies actually in use:** React 18.3.1, Vite 5.4.0, MSAL Browser 5.9.0, Recharts 3.8.1, jsPDF 4.2.1. **Confirmed unused:** `@reduxjs/toolkit`, `react-redux`, `redux`, `redux-thunk` (zero imports, no `<Provider>`). No Tailwind or other CSS framework — one global `styles.css` (~7,900 lines) plus inline styles, and Font Awesome icons loaded externally (not an npm dependency).

---

## Integration Map — `integrations/`

| File | Purpose |
|---|---|
| `sharepoint/client.py` | An older/shared SharePoint connector, separate from the ingestion job's own connector code under `apps/jobs/sharepoint_ingestion/connectors/`. |

---

## Jobs Map — `apps/jobs/`

| File | Purpose |
|---|---|
| `sharepoint_ingestion/main.py` | Orchestrates a full ingestion run. Each run **purges all existing documents/chunks** (`db.purge_all()`) then does a full re-ingest — not a purely incremental process at the database level, even though per-file NEW/CHANGED/UNCHANGED/DELETED classification still happens during the run. |
| `sharepoint_ingestion/connectors/sharepoint.py` | Primary connector. Uses Microsoft Graph API with `msal.ConfidentialClientApplication` app-only auth — real MSAL usage, but scoped to this ingestion job, not the API gateway. |
| `sharepoint_ingestion/connectors/sharepoint_web_scraper.py` | A second connector using Playwright browser automation for "Phase 2" (site pages + SharePoint lists). **Disabled by default** via `SCRAPE_PAGES_ENABLED`/`SCRAPE_LISTS_ENABLED` env flags (both default `false`) and explicitly commented out in `main.py`. |
| `sharepoint_ingestion/config/settings.py` | Chunking is section-aware pre-split (ALL-CAPS headings, numbered sections, `[Slide N]` for PPTX, `[Sheet: X]` for XLSX) then `RecursiveCharacterTextSplitter` with `CHUNK_SIZE=1000` characters, `CHUNK_OVERLAP=200` characters — **not** 500/50 tokens. |
| `sharepoint_ingestion/create_schema.py` | Standalone DDL script creating the core document/chat schema. |
| `sharepoint_ingestion/create_communications_schema.py` | Standalone DDL script creating the announcements/events/RSVP schema. |
| `Data_Files/` | CSV exports (employee records, AI tool license lists, project/allocation data) loaded into the database by loader scripts. |
| `run_all_ingestion.py` | Runs the ingestion jobs in sequence. |

---

## Configuration Map — `apps/web-ui/src/config/`

See the Frontend Map section above for the authoritative, per-file description. In summary: `apiConfig.js` (dead), `authConfig.js` (real MSAL config), `chatConfig.js` (theme + nav), `parkingConfig.js`, `quickLinksConfig.js` (localStorage-backed), `userConfig.js` (client RBAC table, `isUserAuthorized()` always `true`), `API_QUICK_REFERENCE.js` (stale/inaccurate).

---

## Infrastructure Map — `deployments/docker/`

| File | Purpose |
|---|---|
| `docker-compose.yml` | Exactly **three services**: `api` (`build: ../../apps/api-gateway`, port `8000:8000`), `postgres` (`pgvector/pgvector:pg16`, `POSTGRES_PASSWORD` env only), `redis` (`image: redis`, no configuration). Minimal file — no explicit health checks, no volume declarations, no resource limits, no Nginx. |

Manual SQL migration files (separate from the DDL scripts above) live in `apps/api-gateway/migrations/`: `add_parking_option.sql`, `create_parking_requests.sql`.

---

## Environment Variables Reference

| Variable | Service | Purpose |
|---|---|---|
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | API | Azure AD JWT validation (backend); `RuntimeError` at startup if missing |
| `USE_Claude_API_Key` / `USE_Groq_API_Key` / `Use_Ollama_LLM` | API | Selects the active LLM provider, priority Claude > Groq > Ollama |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | API | Anthropic API key / model (default `claude-sonnet-4-6`) |
| `GROQ_API_KEY` / `GROQ_MODEL` | API | Groq API key / model (default `llama3-70b-8192`) |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | API | `http://ml01.alignedautomation.com:11434` / `gpt-oss` |
| `TAVILY_API_KEY` | API | Optional web search |
| `AURA_MEMORY_DIR` | API | Overrides the default location of `memory/md_store.py` flat-file storage |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` (or `SQL_*` aliases) | API | PostgreSQL connection; defaults to `hackathon.alignedautomation.com` / `squadrons` |
| `SHAREPOINT_*` | Ingestion job | SharePoint app credentials and site URL |
| `SCRAPE_PAGES_ENABLED` / `SCRAPE_LISTS_ENABLED` | Ingestion job | Enable the Playwright-based "Phase 2" scraper connector (both default `false`) |
| `VITE_API_URL` | Web UI | Backend API URL used in production builds (dev uses the Vite proxy instead) |
| `VITE_AZURE_CLIENT_ID` / `VITE_AZURE_TENANT_ID` | Web UI | MSAL configuration (frontend) |
