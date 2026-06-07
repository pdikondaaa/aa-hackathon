# API Design Standards — AA-Hackathon Enterprise AI Platform

**Organization:** Aligned Automation  
**Project:** AA-Hackathon Enterprise AI Platform  
**Version:** 1.0  
**Last Updated:** 2026-06-07  
**Owner:** Platform Engineering  

---

## 1. Purpose

This document defines the API design standards for the AA-Hackathon Enterprise AI Platform. All API endpoints exposed by the FastAPI backend must conform to these standards. The standards ensure consistency, security, predictability, and ease of integration for the React frontend and any future API consumers.

---

## 2. API Design Principles

1. **Resource-Based URLs** — URLs identify resources (nouns), not actions (verbs). Actions are expressed via HTTP methods.
2. **Consistent Prefix** — All API routes are prefixed with `/api/`. Internal auto-docs at `/docs` and `/redoc`.
3. **Consistent Response Envelope** — All responses use a standard wrapper with `data`, `message`, and `status` fields.
4. **Predictable Error Format** — All errors use the same structure with a machine-readable `error` code.
5. **Authentication on All Routes** — Every route except `/api/health` requires a valid Azure AD JWT Bearer token.
6. **Idempotency** — GET requests are always safe and idempotent. PUT requests are idempotent. POST requests create new resources or trigger actions.
7. **Stateless** — No server-side session state. All state required by the request must be in the request itself (JWT token, request body, query params).

---

## 3. API Request Flow

```mermaid
sequenceDiagram
    participant Browser as React Browser
    participant MSAL as MSAL Auth
    participant API as FastAPI Backend
    participant Auth as JWT Middleware
    participant AzureAD as Azure AD JWKS
    participant DB as PostgreSQL
    participant Ollama as Ollama LLM

    Browser->>MSAL: Acquire token silently
    MSAL-->>Browser: JWT access token (RS256)
    Browser->>API: POST /api/chat/stream\nAuthorization: Bearer {jwt}
    API->>Auth: Validate JWT
    Auth->>AzureAD: Fetch JWKS public keys
    AzureAD-->>Auth: RSA public keys
    Auth->>Auth: Verify RS256 signature\nExtract claims (oid, email, name)
    Auth-->>API: User claims dict
    API->>DB: Fetch conversation history
    DB-->>API: Message records (RealDictCursor)
    API->>DB: Similarity search (pgvector <=>)
    DB-->>API: Top-k document chunks
    API->>Ollama: POST /api/generate (stream=true)
    Ollama-->>API: Streaming token chunks
    API-->>Browser: SSE stream\ndata: {"content": "..."}\n\n
    API-->>Browser: data: [DONE]\n\n
```

---

## 4. URL Structure

### 4.1 Resource Naming

- Plural nouns for collections: `/api/conversations`, `/api/documents`
- Singular for singleton resources: `/api/health`
- Nested resources for hierarchy: `/api/conversations/{id}/messages`
- Actions as sub-resources when needed: `/api/documents/{id}/reindex`

### 4.2 URL Parameter Types

| Parameter Type | Location | Example |
|---------------|----------|---------|
| Resource identifier | Path | `/api/conversations/{conversation_id}` |
| Filters | Query string | `/api/conversations?status=active` |
| Pagination | Query string | `/api/conversations?page=1&limit=20` |
| Request body | JSON body | `{"content": "...", "conversation_id": "..."}` |

### 4.3 Path Parameter Conventions

- All IDs are UUIDs: `{conversation_id}`, `{document_id}`, `{message_id}`
- No nested IDs more than 2 levels deep
- Path parameters use snake_case

---

## 5. HTTP Methods

| Method | Semantics | Idempotent | Safe | Body |
|--------|-----------|-----------|------|------|
| GET | Read resource(s) | Yes | Yes | No |
| POST | Create resource or trigger action | No | No | Yes |
| PUT | Replace/update resource | Yes | No | Yes |
| PATCH | Partial update | No | No | Yes |
| DELETE | Soft-delete resource (sets `is_deleted=true`) | Yes | No | No |

### 5.1 DELETE Semantics

DELETE never physically removes records. It sets `is_deleted = true` on the record. Physical deletion is handled by the scheduled cleanup job per the retention policy.

```sql
-- What DELETE /api/conversations/{id} executes
UPDATE conversations
SET is_deleted = true, updated_at = NOW()
WHERE id = %s AND user_id = %s;
```

---

## 6. Request Format

### 6.1 Headers

```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

For SSE streaming endpoints:
```http
Accept: text/event-stream
Cache-Control: no-cache
```

### 6.2 Request Body

JSON body with snake_case field names. Boolean fields as `true`/`false`. Dates as ISO 8601 strings.

```json
{
  "content": "What is the leave policy for new joiners?",
  "conversation_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "context": "HR"
}
```

---

## 7. Response Format

### 7.1 Success Response Envelope

All successful responses (2xx) use this envelope:

```json
{
  "data": { ... },
  "message": "Conversation created successfully",
  "status": "success"
}
```

For list responses:

```json
{
  "data": [ ... ],
  "message": "Conversations retrieved",
  "status": "success",
  "total": 47,
  "page": 1,
  "limit": 20
}
```

### 7.2 HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, PATCH, DELETE |
| 201 | Created | Successful POST that creates a resource |
| 204 | No Content | Successful DELETE with no body |
| 400 | Bad Request | Malformed request, missing required fields |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Valid token but insufficient permission |
| 404 | Not Found | Resource does not exist or is soft-deleted |
| 422 | Unprocessable Entity | Pydantic validation error |
| 429 | Too Many Requests | Rate limit exceeded (future) |
| 500 | Internal Server Error | Unhandled server exception |
| 503 | Service Unavailable | Ollama or database unreachable |

### 7.3 Error Response Format

```json
{
  "error": "CONVERSATION_NOT_FOUND",
  "message": "Conversation with ID 3fa85f64 does not exist or has been deleted.",
  "details": {
    "conversation_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  },
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Machine-readable `error` codes are UPPER_SNAKE_CASE strings. The `message` is human-readable. `details` contains additional context for debugging. `request_id` maps to the server-side log entry.

---

## 8. Authentication

### 8.1 Token Format

Azure AD issues RS256 JWT tokens. The frontend obtains tokens via MSAL Browser and injects them into every API call.

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii4uLiJ9.eyJvaWQiOiJ1c2VyLW9pZCIsInByZWZlcnJlZF91c2VybmFtZSI6InVzZXJAYWxpZ25lZGF1dG9tYXRpb24uY29tIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.signature
```

### 8.2 JWT Claims Used

| Claim | Field | Usage |
|-------|-------|-------|
| `oid` | Object ID | Primary user identifier stored in DB |
| `preferred_username` | Email address | Display, Zoho lookup |
| `name` | Display name | UI display |
| `exp` | Expiry | Token validation |

### 8.3 Token Validation Process

1. Extract `Authorization: Bearer {token}` header
2. Fetch JWKS from Azure AD endpoint (cached with 1-hour TTL)
3. Verify RS256 signature using matching public key (by `kid`)
4. Verify `exp` claim — reject expired tokens with 401
5. Verify `aud` claim matches configured client ID
6. Return claims dict to route handler via `Depends(get_current_user)`

### 8.4 Public Endpoints (No Auth Required)

- `GET /api/health` — Health check for load balancer / monitoring
- `GET /docs` — FastAPI auto-generated Swagger UI
- `GET /redoc` — FastAPI ReDoc documentation

---

## 9. Pagination

All list endpoints support pagination via query parameters.

### 9.1 Request Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | — | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Records per page |

### 9.2 Response Fields

```json
{
  "data": [ ... ],
  "status": "success",
  "message": "Messages retrieved",
  "total": 156,
  "page": 2,
  "limit": 20,
  "pages": 8
}
```

### 9.3 SQL Pagination Pattern

```sql
SELECT * FROM messages
WHERE conversation_id = %s AND is_deleted = false
ORDER BY created_at ASC
LIMIT %s OFFSET %s;
-- OFFSET = (page - 1) * limit
```

---

## 10. SSE Streaming

Chat responses are streamed via Server-Sent Events (SSE) for real-time token delivery.

### 10.1 SSE Endpoint Pattern

```http
POST /api/chat/stream
Content-Type: application/json
Authorization: Bearer {token}

{
  "content": "What is the annual leave policy?",
  "conversation_id": "uuid"
}
```

Response:
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### 10.2 SSE Event Format

Each chunk:
```
data: {"content": "The annual leave policy", "type": "chunk"}\n\n
```

Sources event (after last chunk):
```
data: {"sources": [{"document_name": "Leave Policy 2026.pdf", "source_url": "https://...", "similarity": 0.87}], "type": "sources"}\n\n
```

Completion signal:
```
data: [DONE]\n\n
```

Error event:
```
data: {"error": "LLM_UNAVAILABLE", "message": "AI service temporarily unavailable", "type": "error"}\n\n
```

### 10.3 FastAPI SSE Implementation Pattern

```python
from fastapi.responses import StreamingResponse

@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
) -> StreamingResponse:
    return StreamingResponse(
        generate_stream(body, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
```

---

## 11. CORS Configuration

CORS is configured in `apps/api-gateway/app/main.py`. The allowed origins include the React frontend domain and localhost for development.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # from environment variable
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

The `ALLOWED_ORIGINS` env var contains comma-separated domains. Never use `allow_origins=["*"]` in production.

---

## 12. Complete API Route Catalog

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | `/api/health` | None | System health check — db, ollama, pgvector status |
| 2 | GET | `/api/conversations` | Bearer | List user's conversations (paginated) |
| 3 | POST | `/api/conversations` | Bearer | Create new conversation |
| 4 | GET | `/api/conversations/{id}` | Bearer | Get single conversation detail |
| 5 | PUT | `/api/conversations/{id}` | Bearer | Update conversation title |
| 6 | DELETE | `/api/conversations/{id}` | Bearer | Soft-delete conversation |
| 7 | GET | `/api/conversations/{id}/messages` | Bearer | Get messages in conversation (paginated) |
| 8 | POST | `/api/chat` | Bearer | Send message, receive full response (non-streaming) |
| 9 | POST | `/api/chat/stream` | Bearer | Send message, receive SSE streamed response |
| 10 | POST | `/api/feedback` | Bearer | Submit thumbs up/down feedback on a message |
| 11 | GET | `/api/feedback` | Bearer | List feedback (admin/analytics use) |
| 12 | POST | `/api/escalations` | Bearer | Submit a new escalation/help request |
| 13 | GET | `/api/escalations` | Bearer | List escalations (admin view) |
| 14 | GET | `/api/escalations/{id}` | Bearer | Get single escalation detail |
| 15 | PUT | `/api/escalations/{id}/status` | Bearer | Update escalation status |
| 16 | GET | `/api/documents` | Bearer | List ingested documents (paginated) |
| 17 | GET | `/api/documents/{id}` | Bearer | Get single document metadata |
| 18 | DELETE | `/api/documents/{id}` | Bearer | Soft-delete document and its chunks |
| 19 | POST | `/api/documents/{id}/reindex` | Bearer | Trigger re-embedding of a document |
| 20 | GET | `/api/analytics/summary` | Bearer | Dashboard summary metrics |
| 21 | GET | `/api/analytics/usage` | Bearer | Usage over time (for Recharts) |
| 22 | GET | `/api/analytics/feedback` | Bearer | Feedback trends |
| 23 | GET | `/api/analytics/topics` | Bearer | Top query topics/categories |
| 24 | GET | `/api/user/profile` | Bearer | Current user profile from Azure AD + Zoho |
| 25 | GET | `/api/audit-logs` | Bearer | Audit log entries (admin) |
| 26 | POST | `/api/ingestion/trigger` | Bearer | Manually trigger SharePoint ingestion job |
| 27 | GET | `/api/ingestion/status` | Bearer | Last ingestion job status and stats |

---

## 13. Versioning Strategy

Current state: no version prefix (all routes are `/api/...`).

Future state (v2+ breaking changes): introduce `/api/v1/` prefix and maintain backward compatibility for one version cycle (minimum 6 months deprecation notice).

Version negotiation: `Accept: application/vnd.aa-platform.v1+json` header approach considered as alternative to URL versioning.

---

## 14. Rate Limiting (Future)

Rate limiting not yet implemented. Planned:
- 100 requests per minute per user (by JWT `oid` claim)
- 10 streaming requests per minute per user
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- 429 response with `Retry-After` header on limit exceeded

Implementation: Redis-backed sliding window counter.

---

## 15. API Auto-Documentation

FastAPI generates interactive API documentation automatically:

- **Swagger UI**: `GET /docs` — Interactive API explorer, try endpoints with auth
- **ReDoc**: `GET /redoc` — Alternative documentation format
- **OpenAPI JSON**: `GET /openapi.json` — Machine-readable OpenAPI 3.0 spec

All Pydantic models automatically appear in the schema definitions. Route docstrings appear as endpoint descriptions. Example values can be set via `schema_extra` in Pydantic model Config.

---

## 16. Health Check Specification

`GET /api/health` returns component-level health status:

```json
{
  "status": "healthy",
  "components": {
    "database": {
      "status": "healthy",
      "latency_ms": 3
    },
    "pgvector": {
      "status": "healthy",
      "extension_version": "0.7.0"
    },
    "ollama": {
      "status": "healthy",
      "model": "gpt-oss",
      "latency_ms": 45
    }
  },
  "version": "1.0.0",
  "timestamp": "2026-06-07T10:30:00Z"
}
```

If any component is unhealthy, overall `status` is `"degraded"` or `"unhealthy"`. HTTP status code remains 200 so load balancers can read the body, but the body status field indicates degradation.
