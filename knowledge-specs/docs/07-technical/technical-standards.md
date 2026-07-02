# Technical Standards — AA-Hackathon Enterprise AI Platform

**Organization:** Aligned Automation  
**Project:** AA-Hackathon Enterprise AI Platform  
**Version:** 1.0  
**Last Updated:** 2026-06-07  
**Owner:** Platform Engineering  

---

## 1. Purpose and Scope

This document defines the authoritative technical standards for the AA-Hackathon Enterprise AI Platform. All engineers contributing to this platform must adhere to these standards. Deviations require explicit approval from the platform lead and must be documented in the technical debt register.

These standards govern the full stack: backend services, AI/ML pipeline, vector search, frontend application, infrastructure, and deployment.

---

## 2. Architecture Principles

### 2.1 Core Principles

1. **Separation of Concerns** — Each service, module, and layer has a single well-defined responsibility. Business logic lives in service layers, not controllers or route handlers.

2. **Async-First** — All I/O operations (database, HTTP, file) must use async/await patterns. Blocking synchronous calls inside async contexts are strictly prohibited. Use `asyncio.to_thread()` for unavoidable blocking operations.

3. **Stateless API** — The FastAPI backend is stateless. Session state is not stored server-side. Authentication state is embedded in JWT tokens. Conversation state is stored in PostgreSQL.

4. **Security by Default** — Authentication is required on all API endpoints except `/api/health` and `/api/docs`. No secrets are stored in code or version control. PII is detected and redacted before storage.

5. **Observability** — Every request, error, and significant event is logged in structured JSON format. Logs include request IDs for tracing. Errors are never silently swallowed.

6. **Graceful Degradation** — If pgvector is unavailable, fall back to FAISS local index. If Ollama is unavailable, return a clear error rather than hanging. The platform continues to operate in degraded mode.

7. **Idempotency** — Document ingestion operations are idempotent. Re-running the SharePoint ingestion job produces the same result as running it once on unchanged data.

8. **Soft Delete** — Records are never hard-deleted through application logic. The `is_deleted` flag is set to `true`. Physical deletion is handled by scheduled cleanup jobs per the retention policy.

---

## 3. Approved Technology Stack

### 3.1 Backend

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| Language | Python | 3.11 | Stable LTS, async support, ML ecosystem |
| Web Framework | FastAPI | Latest stable | Async-native, Pydantic integration, auto-docs |
| ASGI Server | Uvicorn | Latest stable | High-performance async server for FastAPI |
| AI Orchestration | LangChain | Latest stable | `langchain-huggingface`, `langchain-ollama`, `langchain-groq`, `langchain-anthropic`, `langchain-community`, `langchain-text-splitters` are genuinely used for prompt templates, LCEL chains, document loaders, and text splitting. **`langgraph` is listed in `requirements.txt` but has zero imports anywhere in `apps/api-gateway` — it is an unused/aspirational dependency, not part of the live orchestration.** |
| LLM Runtime | **Configurable: Anthropic Claude → Groq → Ollama**, in that priority order | Selected by env flags (`USE_Claude_API_Key`, `USE_Groq_API_Key`, `Use_Ollama_LLM`) in `app/agents/working/config.py` | Ollama (self-hosted) is the default/fallback provider, not the exclusive one — Claude or Groq can be active depending on configuration |
| LLM Model (Ollama path) | `gpt-oss` at `ml01.alignedautomation.com:11434` | As deployed | Used only when Ollama is the selected provider |
| LLM Model (Claude path) | `claude-sonnet-4-6` (default) | Configurable via `CLAUDE_MODEL` | Used when `USE_Claude_API_Key` is set |
| LLM Model (Groq path) | `llama3-70b-8192` (default) | Configurable via `GROQ_MODEL` | Used when `USE_Groq_API_Key` is set |
| Embedding Model | `nomic-ai/nomic-embed-text-v1.5` | 768-dim | Loaded via `langchain_huggingface.HuggingFaceEmbeddings` (`model_kwargs={"trust_remote_code": True}`) — used identically at query time (`app/rag/retriever.py`) and at ingestion time (`apps/jobs/sharepoint_ingestion/embeddings/embedder.py`). This is **not** `all-MiniLM-L6-v2` / 384-dim, and there is no separate Ollama-based embedding path. |
| Database | PostgreSQL | 16 | Stable, pgvector support |
| Vector Extension | pgvector | Latest | Native vector similarity in Postgres |
| Local Vector | FAISS (`faiss-cpu`) | Latest | Per-domain local fallback knowledge base (`app/agents/working/knowledge_base.py`), consulted only when pgvector returns zero results for a query — not a global mirror of the pgvector corpus, and not used anywhere in the ingestion pipeline |
| Auth Library | python-jose | Latest | JWT RS256 validation against Azure AD JWKS. MSAL is never imported in `apps/api-gateway` — MSAL is frontend-only (login) and, separately, `apps/jobs/sharepoint_ingestion` uses Python `msal` for its own app-only Graph auth |
| HTTP Client | httpx | Latest | Async HTTP (`aiohttp` is not in `requirements.txt`) |
| DB Driver | psycopg2-binary | Latest | PostgreSQL driver, `RealDictCursor`. **No ORM (no SQLAlchemy, no Alembic) — all data access is raw parameterized SQL.** |

### 3.2 Frontend

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| UI Framework | React | 18.3.1 | Industry standard, hooks-based. Single-page app — no React Router; navigation is a plain `activeNav` state switch in `App.jsx` |
| Build Tool | Vite | 5.4.0 | Fast HMR, modern ESM |
| State Management | Local `useState`/`useEffect` + `localStorage` | — | Redux Toolkit, react-redux, redux, and redux-thunk are listed in `package.json` but are **not used anywhere** in the code (no `<Provider>`, no imports of any Redux API) |
| Auth Client | MSAL Browser | 5.9.0 | Azure AD SSO, PKCE redirect flow — frontend only. The backend never imports MSAL; it validates the resulting JWT itself via `python-jose` |
| Charting | Recharts | 3.8.1 | React-native charts |
| PDF Export | jsPDF | 4.2.1 | Client-side PDF generation |

### 3.3 Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| Containerization | Docker | The `api` service is containerized via `deployments/docker/docker-compose.yml` |
| Orchestration | Docker Compose | Exactly **three** services are defined: `api`, `postgres` (`pgvector/pgvector:pg16`), and `redis`. The file is minimal — no health checks, no named volumes, no resource limits, no Nginx, no Kubernetes/AKS manifests exist anywhere in this repository |
| Database Image | pgvector/pgvector:pg16 | Official pgvector image |
| Cache | Redis | **Defined in `docker-compose.yml` but currently unused by any application code** — no `redis` client library is in `requirements.txt` and no code connects to it. Treat as vestigial infrastructure, not an active session/cache/rate-limit store |

---

## 4. Technology Stack Diagram

```mermaid
graph TD
    subgraph Client["Browser Client"]
        React["React 18.3.1\nVite 5.4.0\nlocal useState/localStorage (no Redux)"]
        MSAL["MSAL Browser 5.9.0\nAzure AD Auth"]
        Recharts["Recharts 3.8.1\nAnalytics Charts"]
    end

    subgraph API["API Gateway (Docker :8000)"]
        FastAPI["FastAPI + Uvicorn\nPython 3.11"]
        Auth["JWT Auth Middleware\npython-jose RS256 (no MSAL on backend)"]
        LangChain["LangChain (LCEL chains)\nlanggraph in requirements.txt but unused"]
        RAG["RAG Pipeline\nRetriever + Generator"]
        Embedder["HuggingFace Embedder\nnomic-embed-text-v1.5 768-dim"]
    end

    subgraph Storage["Storage Layer (Docker)"]
        PG["PostgreSQL 16\nhackathon.alignedautomation.com\ndb=squadrons"]
        PGV["pgvector Extension\nvector(768) cosine <=>"]
        FAISS["FAISS Local\nPer-domain fallback KB\n(used only when pgvector returns 0 hits)"]
        Redis["Redis\nDefined in compose, unused by app code"]
    end

    subgraph AI["LLM Providers (priority order)"]
        Claude["Anthropic Claude\nclaude-sonnet-4-6"]
        Groq["Groq\nllama3-70b-8192"]
        Ollama["Ollama (default/fallback)\nml01.alignedautomation.com:11434\nmodel=gpt-oss"]
    end

    subgraph Identity["Identity"]
        AzureAD["Azure AD\nJWT RS256 JWKS"]
    end

    subgraph Ingestion["Ingestion Job (apps/jobs/sharepoint_ingestion)"]
        SPIngestion["main.py\npurges + fully re-ingests each run"]
        SPGraph["connectors/sharepoint.py\nGraph API + msal (primary, live)"]
        SPScrape["connectors/sharepoint_web_scraper.py\nPlaywright (Phase 2, disabled by default)"]
    end

    React --> FastAPI
    MSAL --> AzureAD
    FastAPI --> Auth
    Auth --> AzureAD
    FastAPI --> LangChain
    LangChain --> Claude
    LangChain --> Groq
    LangChain --> Ollama
    LangChain --> RAG
    RAG --> Embedder
    RAG --> PG
    PG --> PGV
    RAG -. "fallback on 0 results" .-> FAISS
    FastAPI -. "defined but unused" .-> Redis
    SPIngestion --> SPGraph
    SPIngestion -. "disabled by default" .-> SPScrape
    SPIngestion --> PG
    SPIngestion --> Embedder
```

---

## 5. Prohibited Practices

The following are explicitly prohibited and will cause pull request rejection:

| Prohibited | Reason | Alternative |
|-----------|--------|-------------|
| Synchronous blocking I/O in async context | Blocks event loop, kills performance | `asyncio.to_thread()` or async alternative |
| ORM (SQLAlchemy models) for data access | Project uses raw SQL with psycopg2 for control | Raw SQL with parameterized queries |
| Secrets in source code or `.env` committed to git | Security breach risk | Environment variables, `.env` in `.gitignore` |
| Client-side secrets (API keys, tokens in JS) | Exposed to browser, easily exfiltrated | Backend proxy pattern |
| Markdown formatting in AI responses | LLM markdown is not rendered in chat UI — HTML only | Instruct model to output HTML or plain text |
| Bare `except:` clauses | Catches system exceptions, masks errors | `except SpecificException as e:` |
| String interpolation in SQL queries | SQL injection vulnerability | Parameterized queries with `%s` placeholders |
| `console.log` in production frontend | Performance, information disclosure | Remove before PR, use structured logging |
| Class components in React | Legacy pattern, inconsistent with codebase | Functional components with hooks |
| Direct DOM manipulation in React | Bypasses React reconciliation | State and refs |
| Hardcoded URLs in frontend | Breaks environment switching | `apiConfig.js` constants |

---

## 6. Version Management

### 6.1 Python Dependencies

- All Python dependencies listed in `apps/api-gateway/requirements.txt`
- Pin major and minor versions: `fastapi==0.111.0` not `fastapi>=0.111`
- Update dependencies in a dedicated PR with testing
- Security patches applied within 48 hours of CVE disclosure
- Use `pip-audit` to scan for vulnerabilities in CI

### 6.2 Node.js Dependencies

- All frontend dependencies in `apps/web-ui/package.json`
- Lock file (`package-lock.json`) committed to version control
- `npm audit` run on every build
- Major version upgrades require explicit approval and migration testing

### 6.3 Docker Images

- All images use explicit tags, never `latest` in production
- Base images: `python:3.11-slim`, `node:20-alpine`, `pgvector/pgvector:pg16`
- Image digests stored for reproducible builds
- Vulnerability scanning with `docker scout` before production deploy

---

## 7. Environment Configuration (12-Factor App)

### 7.1 Configuration Source Hierarchy

1. Environment variables (highest priority)
2. `.env` file in project root (local dev only, never committed)
3. Default values in `config.py` (non-sensitive defaults only)

### 7.2 Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SQL_HOST` | PostgreSQL hostname | `hackathon.alignedautomation.com` |
| `SQL_PORT` | PostgreSQL port | `5432` |
| `SQL_DATABASE` | Database name | `squadrons` |
| `SQL_USER` | Database user | `admin` |
| `SQL_PASSWORD` | Database password | _(secret)_ |
| `USE_Claude_API_Key` / `USE_Groq_API_Key` / `Use_Ollama_LLM` | Selects the active LLM provider (Claude > Groq > Ollama priority) | `true` / `false` |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | Anthropic API key and model | `claude-sonnet-4-6` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq API key and model | `llama3-70b-8192` |
| `OLLAMA_BASE_URL` | Ollama server URL (default/fallback provider) | `http://ml01.alignedautomation.com:11434` |
| `OLLAMA_MODEL` | Model name | `gpt-oss` |
| `AZURE_TENANT_ID` | Azure AD tenant ID | _(GUID)_ |
| `AZURE_CLIENT_ID` | App registration client ID | _(GUID)_ |
| `SHAREPOINT_CLIENT_ID` | SharePoint app client ID | _(GUID)_ |
| `SHAREPOINT_CLIENT_SECRET` | SharePoint app secret | _(secret)_ |
| `SHAREPOINT_TENANT_ID` | SharePoint tenant | _(GUID)_ |
| `SHAREPOINT_SITE_URL` | SharePoint site URL | `https://org.sharepoint.com/sites/...` |
| `EMBEDDING_MODEL` | Embedding model name | `nomic-embed-text-v1.5` |
| `EMBEDDING_DIM` | Embedding dimension | `768` |

### 7.3 Secret Management Rules

- `.env` files added to `.gitignore` — never committed
- Secrets rotated every 90 days
- No secrets in Docker image layers (use `--secret` flag or env injection at runtime)
- Service account credentials stored in secure vault (future: Azure Key Vault)

---

## 8. Error Handling Patterns

### 8.1 Backend Error Hierarchy

```
ApplicationError (base)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── NotFoundError (404)
├── ValidationError (422)
├── DatabaseError (500)
├── LLMError (500/503)
└── EmbeddingError (500)
```

### 8.2 Error Response Format

All API errors return:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {},
  "request_id": "uuid-for-tracing"
}
```

### 8.3 Logging on Errors

All exceptions at ERROR level with full stack trace, request context, and user ID (never user content in logs — PII risk).

---

## 9. Logging Standards

- Logging configured in `apps/api-gateway/app/logging_config.py`
- Format: structured JSON via Python `logging` with `python-json-logger`
- Log levels: DEBUG (dev), INFO (staging/prod), WARNING for degraded states, ERROR for exceptions
- Every log entry includes: `timestamp`, `level`, `service`, `request_id`, `user_id` (oid only), `message`
- Never log: message content, PII, JWT tokens, passwords, file contents
- Logs written to stdout, captured by Docker container runtime
- Log rotation handled by container runtime or syslog

---

## 10. Testing Standards

| Test Type | Tool | Location | Minimum Coverage |
|-----------|------|----------|-----------------|
| Unit tests | pytest | `tests/unit/` | 80% for service layer |
| Integration tests | pytest + testcontainers | `tests/integration/` | All API endpoints |
| Frontend unit | Vitest | `apps/web-ui/src/__tests__/` | Key components |
| E2E | Playwright | `tests/e2e/` | Critical flows |
| Load testing | Locust | `tests/load/` | Before major releases |

All tests must pass before merging to `main`. Test database uses isolated schema or Docker container.

---

## 11. Technical Debt Policy

Technical debt is tracked in the project backlog with the label `tech-debt`. Each item must include:

1. Description of the deviation from standards
2. Reason for the deviation (time constraint, external dependency, etc.)
3. Estimated effort to resolve
4. Target resolution sprint

Current known technical debt:
- No Alembic migration tool (manual SQL scripts in use) — resolve in Q3 2026
- FAISS index not persisted across restarts in some environments — tracked
- Rate limiting not yet implemented on API endpoints — tracked

---

## 12. Technology Governance Process

New technologies must go through the following process before being added to the approved stack:

1. **Proposal** — Engineer submits a technology proposal doc with justification, alternatives considered, security review, licensing check
2. **Proof of Concept** — Two-sprint PoC in a feature branch
3. **Security Review** — Platform lead reviews for supply chain risk, licensing, data handling
4. **Approval** — Sign-off from platform lead
5. **Standards Update** — This document updated, team notified

Technologies under evaluation:
- Azure Functions (for event-driven SharePoint ingestion)
- Alembic (for database migrations)
- pgBouncer (for connection pooling at scale)
- LlamaIndex (alternative to LangChain for RAG)
