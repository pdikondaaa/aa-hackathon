# Glossary — AA-Hackathon Enterprise AI Platform

**Organization:** Aligned Automation  
**Platform:** AA-Hackathon Enterprise Assistant  
**Document Date:** 2026-06-07  
**Version:** 1.0  

---

## Purpose

This glossary defines all technical, business, AI/ML, domain, and integration terms used in the AA-Hackathon Enterprise AI Platform documentation. Terms are organized alphabetically. Related acronyms are collected in the Acronym Dictionary at the end of the document.

---

## Term Definitions

### A

**Access Token** — A short-lived cryptographic token (JWT) issued by Azure Active Directory after a successful login. Sent in the `Authorization: Bearer` header with every API request. Expires after 1 hour; MSAL silently refreshes it using a refresh token.

**Agent** — A specialized AI component responsible for a specific business domain. The "deep retrieval" agents (HR, IT, Admin, Finance, PMO, Org) inherit from `BaseDeepAgent` and follow a retrieve-then-generate pattern. Other agents (Funny, Quick) are lightweight and call the LLM directly without inheriting `BaseDeepAgent`. Still others (Document, Allocation, MS Forms) are plain classes with no LLM-retrieval pipeline, and some (Employee, Attendance, Escalation, License) are plain Python functions wrapped in adapter classes for dispatch. There is no single shared `BaseAgent` parent class across all agents.

**Agent Marketplace** — A planned Phase 2 feature enabling third-party or department-built agents to be registered and activated in the platform through a versioned plugin contract.

**nomic-embed-text-v1.5** — The HuggingFace Sentence Transformers model used for generating 768-dimensional semantic embeddings. Used by the RAG pipeline for both document ingestion and query encoding. Lightweight, fast, and well-suited for domain-specific similarity tasks.

**Allocation Board** — A frontend module showing resource allocation across employees and projects. Allows managers and admins to view and update project staffing percentages.

**Alembic** — A Python database migration tool for SQLAlchemy. Identified in technical debt as the target migration framework to replace manual SQL scripts. Tracks schema version history as migration files.

**Attendance** — Records of employee check-in and check-out times, daily work hours, and presence status. Sourced from Zoho People. Accessible via the Attendance Agent and `GET /api/attendance`.

**Attrition Risk** — A Phase 3 predictive analytics metric: a machine learning model score (0–1) estimating the probability that an employee will leave Aligned Automation within 30/60/90 days. Inputs include tenure, leave patterns, performance ratings, and engagement signals.

**Audit Log** — A record in the `audit_logs` PostgreSQL table capturing admin actions, write operations, PII access events, and escalation state changes. Required for compliance and forensic investigation.

**Azure Active Directory (Azure AD)** — Microsoft's cloud identity provider. Used by Aligned Automation for employee identity management, single sign-on (SSO), and OAuth2 token issuance. The platform validates all JWTs against Azure AD's JWKS endpoint.

**Azure Function** — A serverless compute service in Microsoft Azure. Planned for Phase 1 to replace the manual SharePoint ingestion cron job: an Azure Function will be triggered by a SharePoint webhook to perform event-driven document re-embedding.

---

### B

**BaseDeepAgent** — The real shared base class (`agents/working/base_deep_agent.py`), inherited only by the six "deep retrieval" agents: HR, IT, Admin, Finance, PMO, and Org. It implements the retrieve-then-generate pipeline: query pgvector first, fall back to a local FAISS/keyword knowledge base only if pgvector returns nothing, then make a single LLM call with guardrail text injected. Not all agents in the platform inherit from it — see **Agent**.

**BM25** — Best Match 25. A probabilistic keyword-based document ranking algorithm commonly used in full-text search engines. Scores documents based on term frequency and inverse document frequency (TF-IDF variant). Planned for hybrid search in Phase 1 alongside pgvector semantic search.

**Bonafide Certificate** — A formal employment certificate confirming that an individual is a current employee of Aligned Automation. Generated on-demand by the Document Agent.

---

### C

**Chunk** — A fixed-size segment of a larger document, produced during the ingestion process. SharePoint documents are split into overlapping chunks (e.g., 1000 characters with 200-character overlap) before embedding. Each chunk is stored as a row in `document_chunks` with its vector embedding.

**Citation** — A reference to the source document(s) used by the RAG pipeline to answer a query. Includes document title, section, excerpt, SharePoint URL, and last modified date. Surfaced in the UI below assistant messages.

**COO Dashboard** — A role-restricted analytics dashboard visible only to users with the `coo` or `super_admin` role. Shows department-level query distribution, escalation trends, active users, and aggregate platform health.

**Context Window** — The maximum number of tokens an LLM can process in a single call. The Ollama gpt-oss model is configured with `num_ctx=2048`. All retrieved document chunks, conversation history, and system prompt must fit within this window.

**Conversation** — A named session containing a chronological sequence of user and assistant messages. Stored in the `conversations` table. Each user can have multiple conversations. Conversations persist across sessions.

**Cosine Similarity** — The similarity metric used by pgvector to compare vector embeddings. Computed as the dot product of two normalized vectors. Range: -1 (opposite) to 1 (identical). The platform uses the `<=>` pgvector operator for cosine distance (`1 - cosine_similarity`).

**Cross-Encoder** — A neural model that jointly encodes a query and a document chunk and outputs a relevance score. Used in the Phase 1 re-ranking skill to re-score the top-20 hybrid search candidates. More precise than bi-encoder (embedding) similarity but computationally heavier.

---

### D

**Document Agent** — The domain agent responsible for generating formal documents: NOC certificates, experience letters, bonafide certificates, and WFH policy acknowledgements. Combines employee context from Zoho People with Ollama-generated content, output as PDF.

**Document Chunk** — See Chunk. The unit of storage in the `document_chunks` table. Each row contains: chunk_id, document_id, chunk_text, embedding (vector[768]), chunk_index, source_metadata.

**Docker Compose** — The container orchestration tool used for local and staging deployments. Defines three services: api, postgres, redis. Single command startup: `docker compose up`.

---

### E

**Embedding** — A dense numerical vector representation of text. Produced by the HuggingFace `nomic-embed-text-v1.5` model. A 768-dimensional float array where semantically similar texts produce vectors with high cosine similarity.

**Employee Agent** — The domain agent serving employee self-service queries: personal profile, document requests, onboarding status, and general employee-specific questions.

**Escalation** — A formal issue report created when a query cannot be resolved by the AI assistant or requires human intervention. Stored in the `escalations` table with priority (low/medium/high/critical), status (open/in_progress/resolved/closed), category (HR/IT/Admin/Finance), and SLA deadline.

**Escalation Agent** — The domain agent that creates, tracks, and manages escalations from conversation context. Automatically determines escalation priority from query urgency signals.

**Experience Letter** — A formal employment document confirming an employee's designation, tenure, and responsibilities at Aligned Automation. Generated by the Document Agent.

---

### F

**FAISS** — Facebook AI Similarity Search. An open-source C++/Python library for efficient similarity search over dense vectors. In this platform it is used only as a **local, per-domain** fallback knowledge base (`agents/working/knowledge_base.py`), built from local document folders for each deep-retrieval agent — it is a smaller, separate corpus from the pgvector database, not a mirror of it, and is consulted only when a pgvector query returns zero results.

**Fast-Path Routing** — An optimization in the MasterAgent that matches query keywords against a domain keyword dictionary before invoking the LLM for agent selection. Reduces latency and LLM token cost for simple, obvious queries (e.g., "good morning" → Quick Agent, "leave balance" → HR Agent).

**FastAPI** — The Python web framework used for the API Gateway. Provides async route handling, Pydantic request/response validation, auto-generated OpenAPI documentation at `/docs`, and dependency injection for auth middleware.

**Feedback** — A 1–5 star rating (with optional comment) that employees can submit on any assistant message. Stored in the `feedback` table. Used to track agent quality and RAG precision in the analytics dashboard.

**Finance Agent** — The domain agent handling payroll and finance queries: TDS deductions, Form 16 explanations, gratuity calculation, PF and NPS contributions, reimbursement policy, and payslip information. Reads Zoho People and SharePoint policy documents.

**Form 16** — A tax certificate issued by an employer to an employee in India, summarizing salary paid and TDS deducted during the financial year. Required for income tax filing. Finance Agent can explain Form 16 details.

**Funny Agent** — A personality agent that responds to humor requests, office jokes, and casual conversation. Adds a human-friendly tone to the platform. Routed to for greetings and non-work queries.

---

### G

**Gratuity** — A statutory retirement benefit in India paid to employees who have completed 5 or more years of continuous service. Calculated as: (Last Drawn Salary × 15 × Years of Service) / 26. The Finance Agent can calculate and explain gratuity eligibility.

**Guardrails** — The platform's safety layer. Detects and handles: prompt injection attempts (user input designed to override the system prompt), PII in incoming messages (logged to pii_events), and inappropriate or off-topic requests. Runs before agent invocation.

---

### H

**Hallucination** — A phenomenon where an LLM generates plausible-sounding but factually incorrect information. Mitigated in the platform by grounding responses in RAG-retrieved documents and enforcing a similarity threshold before trusting retrieved context.

**HNSW** — Hierarchical Navigable Small World. A graph-based approximate nearest-neighbor (ANN) index algorithm. Used by pgvector for efficient similarity search on large vector datasets. Offers better query performance than IVFFlat at the cost of higher memory usage.

**HR Agent** — The domain agent for Human Resources queries: leave policies, maternity/paternity leave, leave balance, health insurance, ESOP, benefits, and general HR policy. Uses RAG over SharePoint HR documents and Zoho People live data.

**Hybrid Search** — A Phase 1 planned retrieval strategy combining BM25 keyword scoring and pgvector cosine similarity. Results are merged using Reciprocal Rank Fusion (RRF) and re-ranked by a cross-encoder model.

---

### I

**IT Agent** — The domain agent for Information Technology queries: VPN troubleshooting, software access requests, hardware issues, IT policy, and asset queries.

**IVFFlat** — Inverted File with Flat storage. An approximate nearest-neighbor index type in pgvector. Partitions vectors into clusters (lists) for faster search at the cost of recall. Alternative to HNSW. Lower memory, slower query than HNSW for large datasets.

---

### J

**JWT (JSON Web Token)** — A signed token format used for authentication. The platform issues and validates Azure AD JWTs. Payload contains: sub (user object ID), email, roles, exp (expiry), aud (audience), iss (issuer).

**JWKS (JSON Web Key Set)** — A set of public keys published by Azure AD at a well-known endpoint. The JWT Validator fetches and caches the JWKS to verify JWT signatures without storing private keys.

---

### K

**Keyword Routing** — See Fast-Path Routing.

**Knowledge Gap** — A query category where the RAG retriever returns no results above the similarity threshold, indicating the SharePoint knowledge base does not contain relevant content. Phase 3 skill `knowledge-gap-detection` identifies and reports these gaps to the content team.

**Knowledge Graph** — A Phase 2 planned data structure that overlays semantic relationships over document chunks: topic clusters, document relationships, and entity connections. Enables richer analytics (topic heatmap, knowledge gap visualization) and improved retrieval.

---

### L

**LangChain** — An open-source Python framework for building LLM applications. Used in the AA-Hackathon platform for: Ollama integration (LangChain-Ollama), prompt template management, document loaders, text splitters, and retriever abstractions.

**LangGraph** — A LangChain extension for building stateful, graph-based LLM workflows. It is listed in `requirements.txt` but **has zero imports anywhere in the codebase today** — it is an aspirational dependency for a planned future migration, not something currently used by the MasterAgent router.

**Leave Balance** — The number of days remaining in each leave type (casual, sick, earned, etc.) for an employee. Sourced from Zoho People. Accessible via the HR Agent or Attendance Agent.

**LLM (Large Language Model)** — A neural network trained on large text corpora, capable of understanding and generating natural language. The platform's LLM provider is **configurable**, selected in priority order — Anthropic Claude, then Groq, then Ollama (`gpt-oss`, the default/fallback) — by environment flags. It is not exclusively Ollama.

---

### M

**MasterAgent** — The orchestrating agent (also called Supervisor Agent) in `supervisor_agent.py`. Receives every query, evaluates a sequence of regex fast-paths (forms, email, attendance, employee lookup, documents, greetings), then falls back to keyword scoring against a domain-keyword dictionary, and dispatches to the appropriate agent. A method for LLM-based classification (`_route_llm()`) exists in the file but is **never called** — it is dead code, not an active routing tier.

**Memory System** — The platform's context management layer (in `app/memory/`). Maintains in-session conversation context (md_store.py) and optionally persists context across sessions (db_tool.py). Provides personalized context enrichment (enrichment.py).

**Microsoft Graph API** — Microsoft's unified REST API for Microsoft 365 services. Used by the platform for: reading user profile, creating Microsoft Forms, and (Phase 1) sending emails via Mail.Send.

**Microsoft Forms** — A Microsoft 365 survey and form creation tool. The platform can create Forms on behalf of HR admins via the Graph API and return the form URL for distribution.

**MSAL (Microsoft Authentication Library)** — The client-side library (MSAL Browser 5.9.0) used in the React frontend for Azure AD authentication. Handles PKCE OAuth2 flow, token acquisition, silent refresh, and logout.

**Multi-Tenant** — A Phase 2 capability where the platform isolates knowledge bases and conversation data per department or client group, enabling use by multiple organizational units from a single platform deployment.

---

### N

**NOC Certificate (No Objection Certificate)** — A formal letter from Aligned Automation confirming that the company has no objection to an employee's stated purpose (e.g., applying for a bank loan, travelling abroad). Generated by the Document Agent.

**NPS (National Pension System)** — A government-sponsored pension savings scheme in India. Employers may contribute to NPS on behalf of employees. The Finance Agent can explain NPS contribution rules and tax benefits.

**num_ctx** — The Ollama model configuration parameter controlling the maximum context window size in tokens. Set to 2048 in the platform. Determines how much conversation history and retrieved content can be included in a single LLM call.

**num_predict** — The Ollama parameter controlling the maximum number of tokens the model will generate in a response. Set to 800 in the platform. Balances response completeness with generation time.

---

### O

**Ollama** — An open-source framework for running LLM models locally. The platform can run the `gpt-oss` model via Ollama at `ml01.alignedautomation.com:11434` — this is the **default/fallback** LLM provider, used when Claude and Groq are not enabled via configuration (see **LLM**).

**Onboarding Portal** — An 8-step guided onboarding experience (welcome, profile, it-access, policy, induction, team, documents, all-set) for new Aligned Automation employees. Powered by the `onboarding-guidance/` frontend module and the backend endpoints `GET /api/onboarding/employee` and `GET /api/onboarding/peers`.

**OpenTelemetry** — An open-source observability framework for distributed traces, metrics, and logs. Planned for Phase 1 to add structured tracing to the FastAPI application, covering JWT validation, agent routing, RAG retrieval, and Ollama calls.

**Org Agent** — The domain agent for organizational directory queries: reporting structures, department lists, contact information, and org chart navigation. Reads Zoho People's organizational hierarchy data.

---

### P

**Personality** — The set of behavioral traits and communication style configured via the system prompt for each agent. For example, the Funny Agent has a casual, humorous personality while the HR Agent is formal and policy-accurate.

**PF (Provident Fund)** — The Employees' Provident Fund (EPF) in India. Both employee and employer contribute 12% of basic salary. The Finance Agent can explain PF rules, withdrawal conditions, and tax treatment.

**pgvector** — A PostgreSQL extension that adds a native vector data type (`vector(n)`) and similarity search operators (`<=>`, `<->`, `<#>`). Used to store 768-dimensional embeddings in the `document_chunks` table and execute cosine similarity queries.

**PII (Personally Identifiable Information)** — Data that can identify an individual: name, email, phone number, Aadhaar number, PAN, bank account details. The platform detects PII in conversation messages and logs events to `pii_events`. Phase 1 target: auto-redact PII from LLM responses.

**PMO (Project Management Office)** — The organizational unit that governs project management standards, timelines, and resource allocation. The PMO Agent handles project status queries, milestone tracking, and resource utilization.

**Predictive Analytics Agent** — A Phase 3 planned agent that provides ML-powered insights: attrition risk scoring, leave pattern forecasting, engagement scoring, and headcount projection.

**Prompt Injection** — An adversarial technique where a user includes instructions in their chat message designed to override the system prompt or make the LLM behave unexpectedly. The Guardrails layer detects and blocks common prompt injection patterns.

**psycopg2** — The Python PostgreSQL adapter used by the platform for all database access — there is no ORM (no SQLAlchemy, no Alembic). All queries use parameterized statements to prevent SQL injection.

**PWA (Progressive Web App)** — A web application that can be installed on mobile devices and used offline. Phase 2 target: make the React frontend installable as a PWA with push notification support.

---

### Q

**Quick Agent** — A lightweight agent that handles simple, fast queries: greetings, name lookups, and one-line factual questions. Routed to by the fast-path keyword router for queries not requiring RAG or LLM reasoning.

---

### R

**RAG (Retrieval-Augmented Generation)** — An AI technique that combines vector-based document retrieval with LLM text generation. When a user asks a question, the RAG pipeline retrieves the most semantically similar document chunks from the knowledge base, and the LLM generates an answer grounded in those chunks. Prevents hallucination by providing factual context.

**RBAC (Role-Based Access Control)** — Access control mechanism where permissions are assigned to roles, and users are assigned roles. The platform defines 7 roles: employee, manager, hr_admin, it_admin, admin, coo, super_admin. Enforced at the controller layer.

**Re-Ranking** — A Phase 1 planned step in the retrieval pipeline where a cross-encoder model re-scores the top-20 hybrid search candidates to produce a more precise top-5 ranking before context assembly.

**Redis** — An in-memory data store. It is defined as a service in `docker-compose.yml` but is **not currently used by any application code** — there is no Redis client library in the backend's dependencies and no code connects to it. Any use for session caching or rate limiting is aspirational/future, not current state.

**Retrieval** — The first stage of the RAG pipeline. The user's query is embedded using nomic-embed-text-v1.5, and the resulting vector is compared against stored chunk embeddings in pgvector (or FAISS as fallback) to find the most semantically similar chunks.

---

### S

**Sentence Transformers** — The HuggingFace library providing pre-trained transformer models for generating sentence-level embeddings. The platform uses the `nomic-embed-text-v1.5` model for 768-dimensional embeddings.

**SharePoint** — Microsoft's enterprise document management and collaboration platform. Aligned Automation stores HR policies, IT guides, and admin documents in SharePoint. The platform ingests these documents via the SharePoint Ingestion Job and makes them searchable via RAG.

**Similarity Threshold** — A configurable minimum cosine similarity score required for a retrieved chunk to be included in the LLM context. Chunks below the threshold are discarded to avoid including irrelevant content that could mislead the LLM.

**SSE (Server-Sent Events)** — A browser-native HTTP protocol for server-to-client streaming. The platform's `/api/chat/stream` endpoint uses SSE to stream LLM-generated tokens to the browser in real time. Each event is a JSON payload prefixed with `data: `.

**Supervisor Agent** — See MasterAgent.

**System Prompt** — The initial instruction given to the LLM before the user's message. Each domain agent has a customized system prompt defining its role, personality, response format, and constraints (e.g., "Do not speculate beyond the provided policy documents").

---

### T

**Tavily** — An optional web search API integration. When enabled, agents can augment their responses with live web search results for queries that are not covered by the SharePoint knowledge base. Disabled by default.

**TDS (Tax Deducted at Source)** — A mechanism by which employers in India deduct income tax from employee salaries before payment and remit it to the government. The Finance Agent can explain TDS slabs, deductions, and how to view TDS certificates.

**Temperature** — An LLM hyperparameter controlling response randomness. Set to `0.1` for the Ollama gpt-oss model in the platform, producing deterministic, factual responses rather than creative/varied outputs.

**Token** — The basic unit of text processed by an LLM. Approximately 0.75 words per token in English. The platform's LLM is configured with `num_ctx=2048` (context) and `num_predict=800` (max output tokens).

---

### U

**Uvicorn** — An ASGI web server for Python. Serves the FastAPI application. Handles concurrent connections, async request processing, and SSE streaming. Configured with workers determined by the `WEB_CONCURRENCY` env variable.

---

### V

**Vector** — A fixed-length array of floating-point numbers representing the semantic meaning of a piece of text. The platform uses 768-dimensional vectors produced by nomic-embed-text-v1.5. Stored in the `vector(768)` column in the `document_chunks` table.

---

### W

**WFH Policy** — Work From Home Policy. One of the document types the Document Agent can generate: a formal acknowledgement letter for an employee's WFH arrangement.

---

### Z

**Zoho People** — Aligned Automation's HR Information System (HRIS). Contains employee profiles, attendance records, leave balances, org structure, and payroll data. Accessed by the platform via a read-only PostgreSQL connection to the Zoho People database replica.

---

## Acronym Dictionary

| Acronym | Full Form |
|---|---|
| AAD | Azure Active Directory |
| AKS | Azure Kubernetes Service |
| ANN | Approximate Nearest Neighbor |
| API | Application Programming Interface |
| ASGI | Asynchronous Server Gateway Interface |
| BM25 | Best Match 25 (ranking function) |
| COO | Chief Operating Officer |
| CORS | Cross-Origin Resource Sharing |
| CRUD | Create, Read, Update, Delete |
| DB | Database |
| EPF | Employees' Provident Fund |
| ESOP | Employee Stock Option Plan |
| FAISS | Facebook AI Similarity Search |
| GDPR | General Data Protection Regulation |
| HRIS | Human Resources Information System |
| HNSW | Hierarchical Navigable Small World |
| HR | Human Resources |
| IT | Information Technology |
| ITR | Income Tax Return |
| JWT | JSON Web Token |
| JWKS | JSON Web Key Set |
| LLM | Large Language Model |
| MSAL | Microsoft Authentication Library |
| NDA | Non-Disclosure Agreement |
| NOC | No Objection Certificate |
| NPS | National Pension System |
| ORM | Object-Relational Mapping |
| PAN | Permanent Account Number (India) |
| PF | Provident Fund |
| PII | Personally Identifiable Information |
| PKCE | Proof Key for Code Exchange |
| PMO | Project Management Office |
| PWA | Progressive Web App |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| RRF | Reciprocal Rank Fusion |
| SHAP | SHapley Additive exPlanations |
| SLA | Service Level Agreement |
| SME | Subject Matter Expert |
| SOC 2 | Service Organization Control 2 |
| SSE | Server-Sent Events |
| SSO | Single Sign-On |
| TDS | Tax Deducted at Source |
| TF-IDF | Term Frequency-Inverse Document Frequency |
| TLS | Transport Layer Security |
| WAF | Web Application Firewall |
| WFH | Work From Home |
