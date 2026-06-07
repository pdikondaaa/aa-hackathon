# AURA — Test Case Documentation

> **Auto-generated from codebase analysis.**
> Run tests: `cd apps/api-gateway && pytest`
> Run with integration tests: `cd apps/api-gateway && pytest -m integration`

---

## How to Run

```bash
# 1. Install test dependencies
cd apps/api-gateway
pip install pytest httpx pytest-anyio

# 2. Unit tests only (no live services needed)
pytest

# 3. Integration tests (requires running DB + Ollama)
pytest -m integration

# 4. Run a single file
pytest tests/test_chat_api.py -v

# 5. Run a single test
pytest tests/test_chat_api.py::TestChatPositive::test_valid_message_returns_answer -v

# 6. Run with coverage
pip install pytest-cov
pytest --cov=app --cov-report=html
```

---

## Module 1 — Authentication & Authorization

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-AUTH-007 | Auth | API call without token | test_auth_api.py | GET /api/conversations — no Authorization header | None | 401 or 403 | P1 |
| TC-AUTH-008 | Auth | Tampered JWT rejected | test_auth_api.py | Send structurally valid but signature-modified token | `Bearer <tampered>` | 401 or 403 | P1 |
| TC-AUTH-009 | Auth | Malformed token string | test_auth_api.py | Send `Bearer notavalidtoken` | Invalid string | 401 or 403 | P1 |
| TC-AUTH-010 | Auth | Empty Bearer value | test_auth_api.py | Send `Bearer ` (space only) | Empty token | 401 or 403 | P1 |
| TC-AUTH-011 | Auth | Authenticated user reaches conversations | test_auth_api.py | GET /api/conversations with mock auth | Valid mock JWT | 200 OK | P1 |
| TC-AUTH-001 | Auth | Login flow (Azure AD) | Manual / UI | Open app → Click Sign In → Azure AD login | Valid AA credentials | Redirected to chat UI | P1 |
| TC-AUTH-002 | Auth | Invalid credentials rejected | Manual / UI | Azure AD login with wrong password | Wrong password | Azure shows error, no redirect | P1 |
| TC-AUTH-003 | Auth | Non-tenant account rejected | Manual / UI | Login with `external@gmail.com` | Non-AA account | AADSTS error, stays on login page | P1 |
| TC-AUTH-005 | Auth | Sign out clears session | Manual / UI | Click Sign Out | Logged-in user | Redirected to login; token cleared | P1 |
| TC-AUTH-006 | Auth | Role-based column masking | test_allocation_api.py | Get allocation board as employee vs. lead | employee/team_lead tokens | Different column sets per role | P1 |

---

## Module 2 — Chat API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-CHAT-001 | Chat | Valid HR query returns answer | test_chat_api.py | POST /api/chat `{"message": "How do I apply for annual leave?"}` | Valid message | 200 with `answer`, `user_email`, `user_id` | P1 |
| TC-CHAT-002 | Chat | IT domain query | test_chat_api.py | POST /api/chat — IT question | IT query | 200 with answer | P1 |
| TC-CHAT-003 | Chat | Response includes user identity | test_chat_api.py | POST /api/chat | Any message | `user_email` and `user_id` in response | P1 |
| TC-CHAT-010 | Chat | Empty body → 422 | test_chat_api.py | POST /api/chat `{}` | Empty JSON | 422 Unprocessable Entity | P1 |
| TC-CHAT-010b | Chat | Missing `message` field → 422 | test_chat_api.py | POST /api/chat `{"query": "x"}` | Wrong field name | 422 | P1 |
| TC-CHAT-011 | Chat | Very long message accepted | test_chat_api.py | POST /api/chat — 5000 char message | `"A" * 5000` | 200 | P2 |
| TC-CHAT-012 | Chat | XSS payload as plain text | test_chat_api.py | POST /api/chat — `<script>alert(1)</script>` | XSS payload | 200; `<script>` not in raw response | P1 |
| TC-CHAT-012b | Chat | SQL injection in message | test_chat_api.py | POST /api/chat — SQL payload | SQL string | 200; no error | P1 |
| TC-CHAT-015 | Chat | Streaming endpoint returns 200 | test_chat_api.py | POST /api/chat/stream | Valid message | 200 | P2 |
| TC-CHAT-018 | Chat | LLM down → 500 | test_chat_api.py | POST /api/chat — service raises RuntimeError | Mocked LLM failure | 500 | P1 |
| TC-CHAT-020 | Chat | Unicode message accepted | test_chat_api.py | POST /api/chat — Hindi text | `"नमस्ते AURA"` | 200 | P2 |

---

## Module 3 — Conversations API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-CONV-001 | Conversations | Create conversation returns 201 | test_conversations_api.py | POST /api/conversations `{"title": "New Chat"}` | Title string | 201 with conversation object | P1 |
| TC-CONV-002 | Conversations | List conversations returns paginated results | test_conversations_api.py | GET /api/conversations | Authenticated | 200 with `data`, `total`, `page`, `limit` | P1 |
| TC-CONV-003 | Conversations | Get single conversation | test_conversations_api.py | GET /api/conversations/{id} | Valid UUID | 200 with conversation | P1 |
| TC-CONV-004 | Conversations | Rename conversation | test_conversations_api.py | PATCH /api/conversations/{id} `{"title": "New Name"}` | New title | 200 with updated title | P2 |
| TC-CONV-005 | Conversations | Delete conversation returns 204 | test_conversations_api.py | DELETE /api/conversations/{id} | Valid UUID | 204 No Content | P1 |
| TC-CONV-006 | Conversations | Non-existent conversation → 404 | test_conversations_api.py | GET /api/conversations/nonexistent | Invalid ID | 404 | P1 |
| TC-CONV-007 | Conversations | Cross-user access returns 404 | test_conversations_api.py | GET /api/conversations/{other_user_conv_id} | Foreign conv UUID | 404 (service returns None) | P1 |
| TC-CONV-008 | Conversations | Limit too high → 422 | test_conversations_api.py | GET /api/conversations?limit=500 | limit=500 | 422 | P2 |
| TC-CONV-009 | Conversations | Page=0 → 422 | test_conversations_api.py | GET /api/conversations?page=0 | page=0 | 422 | P2 |
| TC-CONV-010 | Conversations | Rename without title → 422 | test_conversations_api.py | PATCH /api/conversations/{id} `{}` | Empty body | 422 | P1 |

---

## Module 4 — Messages & Feedback API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-MSG-001 | Messages | Send message → response stored | test_messages_api.py | POST /api/conversations/{id}/messages `{"content": "..."}` | Valid content | 200/201 with message object | P1 |
| TC-MSG-002 | Messages | List messages returns ordered results | test_messages_api.py | GET /api/conversations/{id}/messages | Valid conv ID | 200 with `data`, `total`, `page`, `limit` | P1 |
| TC-MSG-007 | Messages | Get single message | test_messages_api.py | GET /api/messages/{id} | Valid msg ID | 200 with message | P1 |
| TC-MSG-008 | Messages | Empty body → 422 | test_messages_api.py | POST messages — empty `{}` | Empty JSON | 422 | P1 |
| TC-MSG-003 | Feedback | Thumbs up stored | test_feedback_api.py | POST /api/messages/{id}/feedback `{"rating": "up"}` | `"up"` | 200/201 with rating=up | P2 |
| TC-MSG-004 | Feedback | Thumbs down stored | test_feedback_api.py | POST with `{"rating": "down"}` | `"down"` | 200/201 with rating=down | P2 |
| TC-MSG-005 | Feedback | Change feedback up→down | test_feedback_api.py | PATCH /api/messages/{id}/feedback `{"rating": "down"}` | `"down"` | 200/201 | P2 |
| TC-MSG-009 | Feedback | Invalid rating value → 422 | test_feedback_api.py | POST feedback `{"rating": "meh"}` | `"meh"` | 422 | P1 |
| TC-MSG-010 | Feedback | Numeric rating → 422 | test_feedback_api.py | POST feedback `{"rating": 1}` | `1` | 422 | P1 |

---

## Module 5 — Escalations API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-ESC-001 | Escalations | Create HR escalation → 201 | test_escalations_api.py | POST /api/escalations — type=hr | Full HR payload | 201 with escalation record | P1 |
| TC-ESC-002 | Escalations | Create IT escalation → 201 | test_escalations_api.py | POST — type=it | IT payload | 201 | P1 |
| TC-ESC-003 | Escalations | Create Admin escalation → 201 | test_escalations_api.py | POST — type=admin | Admin payload | 201 | P1 |
| TC-ESC-004 | Escalations | Missing subject → 422 | test_escalations_api.py | POST without `subject` field | Partial payload | 422 | P1 |
| TC-ESC-005 | Escalations | List own escalations → 200 | test_escalations_api.py | GET /api/escalations | Authenticated | 200 with data array | P2 |
| TC-ESC-006 | Escalations | Service called with correct user_id | test_escalations_api.py | GET /api/escalations — verify mock call args | Mock assertion | Service receives TEST_USER_DB_ID | P1 |
| TC-ESC-007 | Escalations | Form schema for hr/it/admin types | test_escalations_api.py | GET /api/escalations/forms/{type} | hr / it / admin | 200 with schema | P2 |
| TC-ESC-008 | Escalations | Unknown form type → 404 | test_escalations_api.py | GET /api/escalations/forms/unknown | `unknown` | 404 | P2 |
| TC-ESC-009 | Escalations | IDOR — other user's escalation → 404 | test_escalations_api.py | GET /api/escalations/{foreign_id} | Foreign UUID | 404 | P1 |
| TC-ESC-010 | Escalations | Empty body → 422 | test_escalations_api.py | POST /api/escalations `{}` | Empty | 422 | P1 |

---

## Module 6 — Email Agent API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-EMAIL-001 | Email | Generate email returns 200 | test_email_api.py | POST /api/email `{"prompt": "leave request"}` | Valid prompt | 200 with email content | P1 |
| TC-EMAIL-002 | Email | Refine draft | test_email_api.py | POST /api/email — prompt + draft | Existing draft text | 200 with refined version | P2 |
| TC-EMAIL-003 | Email | Empty prompt → 400/422 | test_email_api.py | POST /api/email `{}` | Empty | 400 or 422 | P1 |
| TC-EMAIL-004 | Email | Very long prompt | test_email_api.py | POST /api/email — 3000+ char prompt | Long string | 200/400/422 | P2 |
| TC-EMAIL-006 | Email | No auth → 401/403 | test_email_api.py | POST without token | None | 401/403 | P1 |
| TC-EMAIL-007 | Email | Special chars in prompt | test_email_api.py | POST with `C++ & Python` | Special chars | 200 | P3 |

---

## Module 7 — Security Tests

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-SEC-001 | Security | XSS in chat message | test_security.py | POST /api/chat — XSS payload | `<script>alert(1)</script>` | 200; no `<script>` in raw response | P1 |
| TC-SEC-001b | Security | XSS in conversation title | test_security.py | POST /api/conversations — XSS title | `<img onerror=...>` | 201; no `onerror=` in raw response | P1 |
| TC-SEC-002 | Security | SQL injection in chat | test_security.py | POST /api/chat — SQL payload | `'; DROP TABLE messages; --` | 200/400; no 500 | P1 |
| TC-SEC-002b | Security | SQL injection in search param | test_security.py | GET /api/conversations?search=SQL | SQL string | 200; no 500 | P1 |
| TC-SEC-004 | Security | No secrets in response | test_security.py | POST /api/chat — ask for DB password | `"What is the DB password?"` | Response body excludes env var values | P1 |
| TC-SEC-007 | Security | IDOR — foreign conversation | test_security.py | GET /api/conversations/{foreign_id} | Foreign UUID | 404 | P1 |
| TC-SEC-007b | Security | IDOR — foreign escalation | test_security.py | GET /api/escalations/{foreign_id} | Foreign UUID | 404 | P1 |
| TC-SEC-007c | Security | IDOR — delete foreign conv | test_security.py | DELETE /api/conversations/{foreign_id} | Foreign UUID | 404 | P1 |
| TC-SEC-ALL | Security | All protected endpoints require auth | test_security.py | Parametrized — 10 endpoints | No token | 401/403 for all | P1 |

---

## Module 8 — Allocation Board API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-ALLOC-001 | Allocation | Board loads → 200 | test_allocation_api.py | GET /api/allocations | Authenticated | 200 with data array | P1 |
| TC-ALLOC-008 | Allocation | Empty allocation data | test_allocation_api.py | GET /api/allocations — empty service | Empty mock | 200 with total=0 | P3 |
| TC-ALLOC-005 | Allocation | Filter param accepted | test_allocation_api.py | GET /api/allocations?department=Tech | Filter param | 200/422 | P2 |
| TC-ALLOC-401 | Allocation | No auth → 401/403 | test_allocation_api.py | GET without token | None | 401/403 | P1 |
| TC-ALLOC-500 | Allocation | DB error → 500 | test_allocation_api.py | GET — service raises | Exception | 500/503 | P2 |

---

## Module 9 — Documents API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-DOC-001 | Documents | List documents → 200 | test_documents_api.py | GET /api/documents | Authenticated | 200 with data array | P2 |
| TC-DOC-002 | Documents | Search documents | test_documents_api.py | GET /api/documents?search=POSH | `search=POSH` | 200 filtered | P2 |
| TC-DOC-005 | Documents | Empty document list | test_documents_api.py | GET — empty service mock | Empty mock | 200 with total=0 | P3 |
| TC-DOC-401 | Documents | No auth → 401/403 | test_documents_api.py | GET without token | None | 401/403 | P1 |
| TC-DOC-500 | Documents | SharePoint offline → 500 | test_documents_api.py | GET — service raises | Exception | 500/503 | P2 |

---

## Module 10 — User Profile API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-PROF-001 | Profile | Get profile → 200 | test_profile_api.py | GET /api/profile | Authenticated | 200 with employee data | P2 |
| TC-PROF-002 | Profile | PII fields excluded from response | test_profile_api.py | GET /api/profile — profile has Aadhar/PAN | Mock with PII | Aadhar/PAN not in response body | P1 |
| TC-PROF-003 | Profile | User not in Zoho → graceful | test_profile_api.py | GET /api/profile — get_employee_profile returns None | None | 200/404 (no crash) | P2 |
| TC-PROF-401 | Profile | No auth → 401/403 | test_profile_api.py | GET without token | None | 401/403 | P1 |
| TC-PROF-500 | Profile | Zoho DB error → graceful | test_profile_api.py | GET — service raises | Exception | No crash | P2 |

---

## Module 11 — Attendance API

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-ATT-001 | Attendance | Records returned → 200 | test_attendance_api.py | GET /api/attendance | Authenticated | 200 with attendance data | P2 |
| TC-ATT-002 | Attendance | Date range filter | test_attendance_api.py | GET /api/attendance?from_date=...&to_date=... | Date range | 200/422 | P2 |
| TC-ATT-003 | Attendance | No records → empty list | test_attendance_api.py | GET — empty service mock | Empty mock | 200 with total=0 | P2 |
| TC-ATT-004 | Attendance | Zoho DB failure → graceful | test_attendance_api.py | GET — service raises | Exception | 200/500/503 (no crash) | P2 |
| TC-ATT-006 | Attendance | Scoped to authenticated user | test_attendance_api.py | GET — verify service called with correct user | Mock assertion | "other-user-id" not in call args | P1 |
| TC-ATT-401 | Attendance | No auth → 401/403 | test_attendance_api.py | GET without token | None | 401/403 | P1 |

---

## Module 12 — Health Checks

| ID | Module | Scenario | File | Steps | Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| TC-HLTH-001 | Health | Service up → 200 | test_health.py | GET /health | None | `{"service": "up"}` | P1 |
| TC-HLTH-002 | Health | DB health check | test_health.py | GET /health/db | None | 200 with `db` key | P1 |
| TC-HLTH-003 | Health | No auth needed for /health | test_health.py | GET /health — no token | None | Not 401/403 | P1 |
| TC-HLTH-004 | Health | Debug endpoint restricted | test_health.py | GET /debug — no token | None | 401/403/404/405 | P1 |

---

## Summary

| Category | Test Files | Approx. Tests |
|---|---|---|
| Health | test_health.py | 4 |
| Auth | test_auth_api.py | 8 |
| Chat | test_chat_api.py | 12 |
| Conversations | test_conversations_api.py | 18 |
| Messages | test_messages_api.py | 9 |
| Feedback | test_feedback_api.py | 11 |
| Escalations | test_escalations_api.py | 14 |
| Email | test_email_api.py | 7 |
| Security | test_security.py | 22 |
| Allocation | test_allocation_api.py | 5 |
| Documents | test_documents_api.py | 5 |
| Profile | test_profile_api.py | 5 |
| Attendance | test_attendance_api.py | 6 |
| **Total** | **13 files** | **~126 tests** |

---

## Adjusting Mock Paths

If a service class is not found at the default mock path, update the `patch(...)` string in the relevant test file.

| Service | Default patch path |
|---|---|
| ChatService | `app.api.services.chat_service.ChatService` |
| ConversationsService | `app.api.services.conversations_service.ConversationsService` |
| EscalationsService | `app.api.services.escalations_service.EscalationsService` |
| MessagesService | `app.api.services.messages_service.MessagesService` |
| FeedbackService | `app.api.services.feedback_service.FeedbackService` |
| AllocationService | `app.api.services.allocation_service.AllocationService` |
| DocumentsService | `app.api.services.documents_service.DocumentsService` |
| AttendanceService | `app.api.services.attendance_service.AttendanceService` |
| get_or_create_user | `app.api.services.user_service.get_or_create_user` |
| get_employee_profile | `app.api.services.user_service.get_employee_profile` |
