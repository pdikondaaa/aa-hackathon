# Architecture Overview — AA-Hackathon Enterprise AI Platform

**Organization:** Aligned Automation  
**Platform:** AA-Hackathon Enterprise Assistant  
**Document Date:** 2026-06-07  
**Version:** 1.0  

---

## Purpose

This document provides the authoritative architectural reference for the AA-Hackathon Enterprise AI Platform. It covers all four C4 model levels, deployment topology, data flows, security boundaries, and Architecture Decision Records (ADRs).

---

## System Context (C4 Level 1)

The Enterprise Assistant is an internal AI platform used exclusively by Aligned Automation employees. It connects to corporate data systems (SharePoint, Zoho People), the Microsoft 365 ecosystem (Azure AD, Graph API), a self-hosted language model (Ollama), and an optional web search service (Tavily).

```mermaid
graph TB
    subgraph "Aligned Automation Internal Users"
        EMP["Employee\n(all staff)"]
        MGR["Manager\n(team leads)"]
        HR["HR Admin\n(hr_admin role)"]
        COO_USER["COO\n(coo role)"]
        SADMIN["Super Admin\n(super_admin role)"]
    end

    subgraph "Enterprise AI Platform"
        AA["AA-Hackathon\nEnterprise Assistant\nhackathon.alignedautomation.com"]
    end

    subgraph "External Systems"
        SP["Microsoft SharePoint\n(policy documents)"]
        ZOHO["Zoho People\n(HR data)"]
        AZAD["Azure Active Directory\n(identity provider)"]
        GRAPH["Microsoft Graph API\n(profile, forms, mail)"]
        OLLAMA["Ollama gpt-oss\nml01.alignedautomation.com:11434\n(language model)"]
        TAVILY["Tavily\n(optional web search)"]
    end

    EMP --> AA
    MGR --> AA
    HR --> AA
    COO_USER --> AA
    SADMIN --> AA

    AA --> SP
    AA --> ZOHO
    AA --> AZAD
    AA --> GRAPH
    AA --> OLLAMA
    AA --> TAVILY
```

---

## Container Diagram (C4 Level 2)

```mermaid
graph TD
    subgraph "Client Browser"
        WEBUI["Web UI\nReact 18.3.1 + Vite 5.4.0\nRedux Toolkit 2.12.0\nMSAL Browser 5.9.0\n:3000"]
    end

    subgraph "Docker Compose Network"
        API["API Gateway\nFastAPI + Uvicorn\nPython 3.11\n:8000"]
        PG["PostgreSQL 16 + pgvector\ndb: squadrons\n:5432"]
        REDIS["Redis 7\n(sessions, rate limit)\n:6379"]
    end

    subgraph "AI Infrastructure"
        OLLAMA_C["Ollama gpt-oss\nml01.alignedautomation.com\n:11434"]
        EMBED_C["HuggingFace\nSentence Transformers\nall-MiniLM-L6-v2\n(in-process)"]
        FAISS_C["FAISS Index\n(in-process memory)"]
    end

    subgraph "Background Jobs"
        SPJOB["SharePoint Ingestion Job\napps/jobs/sharepoint_ingestion/\n(manual cron)"]
    end

    subgraph "External Services"
        SP_E["SharePoint\n(Azure AD App Creds)"]
        ZOHO_E["Zoho People DB\n(read-only PostgreSQL)"]
        GRAPH_E["Microsoft Graph API"]
        AZAD_E["Azure AD / JWKS endpoint"]
        TAVILY_E["Tavily API"]
    end

    WEBUI -- "HTTPS + SSE" --> API
    WEBUI -- "MSAL OAuth2 / PKCE" --> AZAD_E
    API -- "psycopg2 + ThreadedPool(1,8)" --> PG
    API -- "redis-py" --> REDIS
    API -- "HTTP REST" --> OLLAMA_C
    API -- "in-process" --> EMBED_C
    API -- "in-process" --> FAISS_C
    API -- "JWKS fetch" --> AZAD_E
    API -- "Graph API REST" --> GRAPH_E
    API -- "PostgreSQL read replica" --> ZOHO_E
    API -- "REST API" --> TAVILY_E
    SPJOB -- "SharePoint REST" --> SP_E
    SPJOB -- "in-process embed" --> EMBED_C
    SPJOB -- "psycopg2" --> PG
```

---

## Component Diagram (C4 Level 3) — API Gateway

```mermaid
graph TD
    subgraph "API Gateway — apps/api-gateway/"
        ROUTER["FastAPI Router\n(main.py)"]
        JWTV["JWT Validator\n(auth/jwt_validator.py)"]
        AUTHCTX["User Context\n(auth/user_context.py)"]
        MASTER["MasterAgent\n(agents/supervisor_agent.py)"]

        subgraph "Domain Agents (13)"
            HR_A["HR Agent"]
            IT_A["IT Agent"]
            ADMIN_A["Admin Agent"]
            PMO_A["PMO Agent"]
            FIN_A["Finance Agent"]
            ORG_A["Org Agent"]
            EMP_A["Employee Agent"]
            ATT_A["Attendance Agent"]
            DOC_A["Document Agent"]
            EMAIL_A["Email Agent"]
            ESC_A["Escalation Agent"]
            QUICK_A["Quick Agent"]
            FUNNY_A["Funny Agent"]
        end

        RAG["RAG Retriever\n(rag/retriever.py)"]
        MEM["Memory System\n(memory/client.py\n+ md_store.py\n+ db_tool.py\n+ enrichment.py)"]
        GUARD["Guardrails\n(PII + prompt injection)"]

        subgraph "Controllers (15)"
            CHATCTRL["Chat Controller"]
            CONVCTRL["Conversations Controller"]
            MSGCTRL["Messages Controller"]
            FBCTRL["Feedback Controller"]
            ESCCTRL["Escalations Controller"]
            ATTCTRL["Attendance Controller"]
            PROFCTRL["Profile Controller"]
            DOCCTRL["Documents Controller"]
            EMAILCTRL["Email Controller"]
            FRMCTRL["Forms Controller"]
            ALLOCCTRL["Allocation Controller"]
            PIICTRL["PII Controller"]
            COOCTL["COO Analytics Controller"]
            HLTHCTRL["Health Controller"]
            DBGCTRL["Debug Controller"]
        end

        subgraph "Services (10)"
            DBSVC["DB Service\n(db_config.py)"]
            ASDBSVC["Async DB Service\n(async_db_config.py)"]
            AUTHSVC["Auth Service\n(auth_handler.py)"]
        end
    end

    ROUTER --> JWTV
    JWTV --> AUTHCTX
    ROUTER --> CHATCTRL
    CHATCTRL --> MASTER
    MASTER --> HR_A
    MASTER --> IT_A
    MASTER --> ADMIN_A
    MASTER --> PMO_A
    MASTER --> FIN_A
    MASTER --> ORG_A
    MASTER --> EMP_A
    MASTER --> ATT_A
    MASTER --> DOC_A
    MASTER --> EMAIL_A
    MASTER --> ESC_A
    MASTER --> QUICK_A
    MASTER --> FUNNY_A
    HR_A --> RAG
    HR_A --> MEM
    CHATCTRL --> GUARD
    RAG --> DBSVC
    AUTHSVC --> JWTV
```

---

## Deployment Topology

### Development / Staging — Docker Compose

| Service | Image | Port | Purpose |
|---|---|---|---|
| api | Custom Python 3.11 Dockerfile | 8000 | FastAPI + Uvicorn |
| postgres | postgres:16 + pgvector | 5432 | Primary database |
| redis | redis:7-alpine | 6379 | Cache + sessions |

All services run on a shared Docker bridge network. Environment variables injected via `.env` file (never committed to git).

### Production — AKS (Target)

| Workload | Replicas | Resources |
|---|---|---|
| api-gateway | 2–4 (HPA) | 2 CPU, 4GB RAM |
| postgres | 1 (StatefulSet) + read replica | 4 CPU, 8GB RAM |
| redis | 1 (or Redis Cluster) | 1 CPU, 2GB RAM |

Ollama runs on a dedicated GPU node (`ml01.alignedautomation.com`) — not containerized in Docker Compose. The API Gateway calls it over HTTP.

---

## Data Flow — Query Lifecycle

```mermaid
sequenceDiagram
    participant Browser
    participant MSAL
    participant API as API Gateway
    participant JWT as JWT Validator
    participant Master as MasterAgent
    participant Agent as Domain Agent
    participant RAG as RAG Retriever
    participant PG as PostgreSQL+pgvector
    participant Ollama
    participant SSE as SSE Handler

    Browser->>MSAL: Login (PKCE flow)
    MSAL-->>Browser: Access token (JWT)
    Browser->>API: POST /api/chat {message, token}
    API->>JWT: Validate token (sig, exp, audience)
    JWT-->>API: User context (role, employee_id)
    API->>Master: Route(message, user_context)
    Master-->>Agent: Dispatch to domain agent
    Agent->>RAG: retrieve(query, top_k=5)
    RAG->>PG: SELECT ... ORDER BY embedding <=> $1 LIMIT 20
    PG-->>RAG: document chunks
    RAG-->>Agent: top-5 chunks + citations
    Agent->>Ollama: POST /api/generate {prompt, context, stream:true}
    Ollama-->>SSE: token stream
    SSE-->>Browser: data: {"type":"token","content":"..."}
    Agent->>PG: INSERT messages (role=assistant, content)
```

---

## Security Architecture

### Authentication Boundary

All API endpoints (except `/api/health`) require a valid Azure AD JWT. The JWT Validator checks:
- Token signature against JWKS endpoint (`login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys`)
- Token expiry (`exp` claim)
- Audience (`aud` claim must match AAD App client ID)
- Issuer (`iss` claim must match AAD tenant)

### RBAC Enforcement

| Role | Access Level |
|---|---|
| employee | Own data, chat, documents (self) |
| manager | Own data + direct reports |
| hr_admin | All HR data, escalation admin, feedback admin |
| it_admin | IT-specific admin views |
| admin | Platform administration |
| coo | COO analytics dashboard, all department aggregates |
| super_admin | Full platform access |

### TLS

All external traffic: HTTPS via Nginx reverse proxy with TLS termination. Internal Docker network: plain HTTP (trusted network boundary).

### Secrets Management

All credentials (Azure AD client secret, Zoho DB password, Ollama endpoint, Tavily API key) are stored in `.env` files injected at container start. Production target: Azure Key Vault with MSI.

---

## Architecture Decision Records

### ADR-001: Why Ollama Self-Hosted?

**Decision:** Use Ollama running gpt-oss model on ml01.alignedautomation.com rather than Azure OpenAI or Anthropic Claude API.

**Rationale:**
- **Data sovereignty:** Employee HR queries contain sensitive personal data. Self-hosted LLM ensures data never leaves the Aligned Automation network.
- **Cost:** No per-token billing. Fixed infrastructure cost for ml01.
- **Control:** Model version, temperature, and context window controlled without API provider changes.
- **Latency:** No internet round-trip for generation — ml01 is on the internal network.

**Trade-offs:** Model capability may lag frontier models. No automatic model updates. Requires GPU maintenance.

---

### ADR-002: Why pgvector Over Pinecone or Qdrant?

**Decision:** Store document embeddings in PostgreSQL 16 with the pgvector extension rather than a dedicated vector database.

**Rationale:**
- **Operational simplicity:** One database service instead of two. No additional managed service cost.
- **JOIN capability:** Document metadata (title, source, created_at) lives in the same database as vector embeddings. JOIN queries are trivial.
- **Transactions:** Vector insert and metadata insert are atomic within a PostgreSQL transaction.
- **Existing expertise:** Team already manages PostgreSQL. No new operational skillset needed.

**Trade-offs:** Not optimized for very large scale (>100M vectors). HNSW index rebuild required for major embedding model changes.

---

### ADR-003: Why FAISS as Fallback?

**Decision:** Maintain a FAISS in-memory index as fallback when pgvector queries fail.

**Rationale:**
- **Zero-latency:** FAISS queries execute in <5ms in-process, no network I/O.
- **Availability:** RAG pipeline remains functional even during PostgreSQL connectivity issues.
- **Simplicity:** FAISS requires no external service — it is a Python library.

**Trade-offs:** Index is rebuilt at every API Gateway restart. Not persistent across deployments. May be slightly stale compared to pgvector.

---

### ADR-004: Why FastAPI?

**Decision:** Use FastAPI + Uvicorn as the API framework rather than Django REST Framework or Flask.

**Rationale:**
- **Async support:** Native asyncio for non-blocking SSE streaming and concurrent requests.
- **Pydantic validation:** Request and response models validated automatically.
- **Auto-documentation:** OpenAPI docs at `/docs` generated without additional work.
- **Performance:** Uvicorn ASGI server handles high concurrency for SSE connections.

---

### ADR-005: Why LangChain?

**Decision:** Use LangChain + LangChain-Ollama for agent abstractions and LLM integration.

**Rationale:**
- **Streaming support:** LangChain's Ollama integration supports token-level streaming natively.
- **Prompt management:** PromptTemplate and ChatPromptTemplate provide structured prompt composition.
- **Ecosystem:** Rich set of document loaders, text splitters, and retriever abstractions for RAG.
- **Ollama integration:** LangChain-Ollama provides a clean interface to the self-hosted Ollama endpoint.

**Trade-offs:** LangChain abstractions add indirection. Complex LangChain Expression Language (LCEL) chains can be hard to debug. Phase 1 will introduce LangGraph for state machine orchestration.

---

## Architecture Review Process

1. **Quarterly architecture review:** Platform Engineering team reviews ADRs, identifies new debt, updates roadmap.
2. **ADR creation trigger:** Any change affecting: database schema, external integrations, authentication flow, or LLM model requires a new ADR.
3. **ADR format:** Context → Decision → Rationale → Trade-offs → Review date.
4. **Review participants:** Backend Lead, ML Lead, Security representative, COO sponsor.
