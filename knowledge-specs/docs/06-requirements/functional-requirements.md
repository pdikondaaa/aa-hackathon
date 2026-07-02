# Functional Requirements Specification
## AURA — AI-Powered Enterprise Assistant Platform
### Aligned Automation Internal Operations

**Document Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Active

---

## Overview

This document specifies all functional requirements for the AURA platform, organized by domain. Each requirement includes a unique ID, title, description, priority (P0/P1/P2), and acceptance criteria.

- **P0:** Must be met at launch. System is not shippable without these.
- **P1:** High-value features that should be present in v1.0.
- **P2:** Nice-to-have enhancements that can slip to v1.1.

---

## Domain 1: Chat (FR-CHAT-001 through FR-CHAT-010)

### FR-CHAT-001 — Server-Sent Events Streaming Chat
**Priority:** P0  
**Description:** The platform must stream AI responses token-by-token via Server-Sent Events (SSE) so the user sees the answer building in real time rather than waiting for a complete response. The `POST /api/chat/stream` endpoint returns `Content-Type: text/event-stream` with `data: {"content": "<html-chunk>"}` events terminated by `data: [DONE]`. The `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers must be set to prevent proxy buffering.  
**Acceptance Criteria:**
- First SSE chunk arrives within 1 second of request submission
- Each chunk contains valid JSON with a `content` key
- Stream terminates with `data: [DONE]` event
- UI renders HTML chunks incrementally (no page flicker)
- Streaming gracefully handles disconnected clients without server crash

### FR-CHAT-002 — Non-Streaming Chat Endpoint
**Priority:** P1  
**Description:** A `POST /api/chat` endpoint returns the full response as a JSON object `{"answer": "...", "user_email": "...", "user_id": "..."}` for clients that cannot consume SSE. Both endpoints require JWT authentication via `Depends(get_current_user)`.  
**Acceptance Criteria:**
- Returns HTTP 200 with complete answer on success
- Returns HTTP 401 when JWT is missing or invalid
- Returns HTTP 500 with error detail on agent failure
- Response JSON includes `answer`, `user_email`, and `user_id`

### FR-CHAT-003 — Fast-Path Response for Leave Application
**Priority:** P0  
**Description:** When the user's message matches the apply-leave pattern (regex: `apply.*leave`, `request.*leave`, `submit.*leave`, `take.*leave`, etc.), the system bypasses LLM routing and immediately returns a pre-formatted HTML response with a styled button linking to the Zoho People leave application URL. This must resolve in <200ms.  
**Acceptance Criteria:**
- Pattern detection is case-insensitive and handles phrase variants
- Response contains a clickable link to `https://people.zoho.com/...applyleave`
- Response arrives before any LLM call is made
- Latency <200ms from request receipt

### FR-CHAT-004 — Fast-Path for Greeting Messages
**Priority:** P0  
**Description:** Pure greeting messages (single or two-word greetings: "hi", "hello", "good morning", "thank you") return a static AURA introduction menu listing all capability domains without invoking the LLM. Messages longer than two words ("hello can you help with X") fall through to normal routing.  
**Acceptance Criteria:**
- Single-word greetings return introduction menu in <100ms
- Two-word canonical greetings return introduction menu
- "Hello, what is my leave balance?" routes to HR agent (not greeting)
- Introduction menu lists HR, IT, Admin, Finance, PMO, Employee Directory, Attendance domains

### FR-CHAT-005 — Multi-Agent Routing via MasterAgent
**Priority:** P0  
**Description:** The `MasterAgent` (supervisor_agent.py) routes every query through a deterministic pipeline: (1) check for active document session, (2) escalation keyword, (3) Microsoft Forms pattern, (4) email draft pattern, (5) attendance pattern, (6) employee pattern, (7) document pattern, (8) greeting/conversational check, (9) keyword scoring fallback. LLM routing via Ollama is available but not the primary path for performance reasons.  
**Acceptance Criteria:**
- Each stage is tested independently
- Routing decision is logged with domain name and routing method
- Fallback to QuickAgent when no keyword match
- Document session persists across turns and is cancelled on off-topic input with notification to user

### FR-CHAT-006 — Conversation History in Context
**Priority:** P1  
**Description:** When processing a chat message, the platform retrieves previous messages in the current conversation and passes them as `conversation_history` to agents that support it. This enables contextual follow-up ("What about the IT policy?") without re-stating the topic.  
**Acceptance Criteria:**
- `conversation_history` passed to agents that accept it
- History includes at minimum the last 10 messages
- History does not include system messages or internal metadata
- Agents use history for pronoun resolution and topic continuity

### FR-CHAT-007 — Message Regeneration
**Priority:** P1  
**Description:** Users can request regeneration of any AI message in a conversation. The system re-processes the original user message and replaces the existing assistant message content in the database.  
**Acceptance Criteria:**
- `POST /api/conversations/{id}/messages/{msg_id}/regenerate` succeeds
- Regenerated content replaces the prior assistant message
- Original user message is unchanged
- Regeneration count is tracked in the messages table

### FR-CHAT-008 — Source Citation in Responses
**Priority:** P1  
**Description:** When an agent retrieves content from pgvector (SharePoint documents), the `source_url` values from chunk metadata are appended to the response as a formatted HTML source list with clickable links and human-readable labels (file name without extension).  
**Acceptance Criteria:**
- Sources section appears below main response with a separator
- Each source is a clickable link opening in a new tab
- Duplicate URLs are deduplicated
- Label is the file name without extension (e.g., "Leave Policy" not the full URL)

### FR-CHAT-009 — Guardrail Enforcement Before Routing
**Priority:** P0  
**Description:** Every user message passes through `check_input(query)` before any routing or agent call. Jailbreak, security threat, and harmful content patterns return static rejection responses without LLM involvement. Distress signals trigger an LLM empathetic response. Organizational scope violations (asking another employee's salary, legal advice) trigger an LLM contextual redirect.  
**Acceptance Criteria:**
- Jailbreak patterns blocked with static response, no LLM call
- Harmful content blocked with static response, no LLM call
- Distress patterns return empathetic LLM response within 10s
- Org-scope violations return polite redirect within 10s
- Blocked queries logged in audit_logs table

### FR-CHAT-010 — User Name Fast-Path
**Priority:** P1  
**Description:** When the user asks "what is my name?" or equivalent, the system returns the name from the authenticated JWT token without any DB or LLM call. Response is instantaneous.  
**Acceptance Criteria:**
- Pattern detection covers "what is my name", "tell me my name", "my full name"
- Response uses `user_name` from SSO token, not DB
- Latency <50ms
- Falls back gracefully when `user_name` is empty

---

## Domain 2: Authentication (FR-AUTH-001 through FR-AUTH-005)

### FR-AUTH-001 — Azure AD SSO Login via MSAL
**Priority:** P0  
**Description:** Users authenticate using Microsoft MSAL.js in SPA mode. The application registers with Azure AD using `clientId` and `tenantId` from environment variables. On login, MSAL redirects to `login.microsoftonline.com` and returns an ID token. Scopes: `openid`, `profile`, `email`, `User.Read`. Redirect URI is `window.location.origin` and must match the Azure Portal SPA configuration.  
**Acceptance Criteria:**
- Unauthenticated users are redirected to Microsoft login
- Post-login redirect returns user to the originating page
- ID token contains `name`, `email`/`preferred_username`, and `oid` claims
- Login works without admin consent for standard scopes
- MFA is enforced via Azure Conditional Access (no code change required)

### FR-AUTH-002 — JWT Validation on API Endpoints
**Priority:** P0  
**Description:** Every protected API endpoint uses `Depends(get_current_user)` which validates the Bearer JWT. The validator checks RS256 signature using Azure AD JWKS endpoint, verifies `exp`, `aud`, and `iss` claims. Invalid tokens return HTTP 401. The validator is implemented in `auth_handler.py`.  
**Acceptance Criteria:**
- Missing Authorization header returns HTTP 401
- Expired token returns HTTP 401
- Invalid signature returns HTTP 401
- Valid token extracts `user_id`, `email`, and `name` from claims
- JWKS keys are cached with appropriate TTL to avoid per-request fetches

### FR-AUTH-003 — Role-Based Access Control
**Priority:** P0  
**Description:** The RBAC system (userConfig.js frontend, backed by JWT claims backend) enforces role-based feature access. Roles: `admin`, `hr`, `it`, `org`, `user`. Admins can access all agents and the admin panel. HR role accesses hr agent. IT role accesses it agent. Regular `user` role accesses general chat only. The COO dashboard is restricted to `executive` and above (ANALYTICS_ROLES).  
**Acceptance Criteria:**
- `admin` role can access admin panel and all agents
- `user` role cannot access admin panel
- COO dashboard returns HTTP 403 for non-executive roles
- RBAC is enforced server-side, not only client-side
- Role check failures return HTTP 403 with descriptive error

### FR-AUTH-004 — Token Refresh and Session Management
**Priority:** P1  
**Description:** MSAL handles silent token refresh automatically. Session storage is used as the cache location (`cacheLocation: 'sessionStorage'`). When a token expires during an active session, MSAL silently acquires a new token before the next API call.  
**Acceptance Criteria:**
- Expired tokens are refreshed without user interaction
- Refresh failure prompts re-authentication
- Session does not persist across browser tabs (sessionStorage)
- Token is not logged or exposed in client-side console

### FR-AUTH-005 — Graph API Enrichment
**Priority:** P2  
**Description:** After login, the frontend optionally calls Microsoft Graph (`/v1.0/me`) with `User.Read` scope to enrich the user profile with `department` and `jobTitle`. Falls back to ID token data if Graph call fails or consent is not granted.  
**Acceptance Criteria:**
- Graph call succeeds for tenants with User.Read consent
- Department and jobTitle display in user profile when available
- Platform remains fully functional without Graph enrichment
- Graph call does not block initial page load

---

## Domain 3: HR (FR-HR-001 through FR-HR-010)

### FR-HR-001 — Leave Policy Inquiry
**Priority:** P0  
**Description:** HRAgent retrieves leave policy information from pgvector by embedding the query and performing cosine similarity search over `document_chunks`. Policy documents ingested from SharePoint include annual leave, sick leave, maternity/paternity, POSH, WFH policy, and more. The LLM synthesizes a response citing the source document name.  
**Acceptance Criteria:**
- Leave balance type queries return policy details within 5 seconds
- Response cites source document name inline
- Response quotes exact values (days, percentages, deadlines) from policy
- When policy does not cover the question, response flags it with "Generally..."
- Fallback contact is `hr@alignedautomation.com`

### FR-HR-002 — Leave Application Redirect
**Priority:** P0  
**Description:** Any message matching leave application intent (see FR-CHAT-003) immediately returns a response with a styled button linking to Zoho People leave application. This is a supervisor-level fast-path — HRAgent is not invoked.  
**Acceptance Criteria:**
- Button links to `https://people.zoho.com/alignedautomationservices/zp#leavetracker/mydata/applyleave`
- Response includes context explaining Zoho People is the correct portal
- Response includes the button within 200ms

### FR-HR-003 — Payroll Query Handling
**Priority:** P1  
**Description:** HRAgent answers questions about payroll schedule, salary slip access via HROne, PF/EPF, gratuity, and income tax declarations. Actual salary amounts are blocked by Tier-2 guardrails (no inter-employee salary disclosure).  
**Acceptance Criteria:**
- Payroll schedule queries answered from ingested HR documents
- Salary slip access queries redirect to HROne portal
- Another employee's salary query returns guardrail block response
- Own salary query (if in document) answered from policy context

### FR-HR-004 — Benefits Information
**Priority:** P1  
**Description:** HRAgent answers questions about GHI (Group Health Insurance), Practo health benefits, IL TakeCare insurance, PF contribution, gratuity eligibility, and referral bonus policy from SharePoint-ingested documents.  
**Acceptance Criteria:**
- GHI coverage query answered with accurate policy details
- Practo benefit query answered with enrollment instructions
- IL TakeCare query answered with policy summary
- Referral bonus query answered with eligibility and amounts

### FR-HR-005 — HR Policy Lookup via pgvector RAG
**Priority:** P0  
**Description:** All HR queries use the two-stage RAG pipeline: (1) embed query using `nomic-embed-text-v1.5` (768-dim), (2) cosine similarity search via `pgvector` with `top_k=10`, (3) supplement with local FAISS/keyword KB if pgvector returns empty, (4) single LLM generation with retrieved context. Retry: if pgvector returns no results, simplify the query and retry once.  
**Acceptance Criteria:**
- Retrieval returns ≥1 chunk for common policy queries
- Adaptive retry on empty result before LLM generation
- FAISS fallback activates when pgvector pool unavailable
- Generated response cites `file_name` from chunk metadata

### FR-HR-006 — HR Document Generation
**Priority:** P0  
**Description:** Employees can request generation of 11 HR document types via DocumentAgent. The agent identifies the document type from the query, collects required fields through multi-turn conversation, then calls the Ollama LLM to generate a professional document. Session state is maintained in-memory keyed by `user_email`. Document types: loan_proof, experience_letter, employment_verification, offer_letter, relieving_letter, address_proof, bonafide, internship_certificate, promotion_letter, noc, confirmation_letter.  
**Acceptance Criteria:**
- All 11 document types recognized from natural language queries
- Multi-turn collection asks for each required field one at a time
- Generated document follows professional corporate letter format
- Session is cleared after generation or on off-topic input
- Off-topic input during collection cancels session with user notification

### FR-HR-007 — Onboarding Guidance Portal
**Priority:** P0  
**Description:** The onboarding module provides an 8-step guided experience for new employees. Steps cover profile setup, IT access, HR enrollment (Zoho People, HROne, Practo), policy reading, first-day checklist, and team introduction. Progress is tracked per employee. HR notes are displayed for each step.  
**Acceptance Criteria:**
- All 8 steps accessible and navigable
- HR notes visible per step
- Progress persists across sessions (stored in DB)
- Each step has clear completion criteria
- Completion event notifies HR team

### FR-HR-008 — Attendance Correction Query
**Priority:** P1  
**Description:** HRAgent handles attendance correction/regularization policy questions from SharePoint documents. Directs employees to the correct portal or process for submitting correction requests.  
**Acceptance Criteria:**
- Attendance correction policy retrieved from pgvector
- Response includes portal link or process steps
- Manager approval workflow described accurately

### FR-HR-009 — POSH and Grievance Policy
**Priority:** P1  
**Description:** HRAgent provides information about the POSH (Prevention of Sexual Harassment) policy, grievance redressal process, and IC (Internal Complaints Committee) contact. Responses are handled sensitively with referral to HR.  
**Acceptance Criteria:**
- POSH policy retrieved from SharePoint documents
- Response includes IC contact details
- Escalation path to HR is clear
- Distress guardrail applies if personal distress detected

### FR-HR-010 — Resignation and Notice Period
**Priority:** P1  
**Description:** HRAgent answers questions about notice period requirements by role/grade, resignation process, exit interview, full and final settlement, and relieving letter issuance timeline.  
**Acceptance Criteria:**
- Notice period retrieved accurately per policy
- Resignation process steps described
- Exit process timeline accurate
- Relieving letter generation available via DocumentAgent (cross-link)

---

## Domain 4: IT (FR-IT-001 through FR-IT-008)

### FR-IT-001 — IT Troubleshooting Guidance
**Priority:** P0  
**Description:** ITAgent answers questions about VPN setup, MFA enrollment, password reset procedures, Outlook configuration, OneDrive sync issues, WiFi access, and Polycom device usage from SharePoint-ingested IT policy documents.  
**Acceptance Criteria:**
- VPN setup query returns step-by-step instructions
- Password reset query returns self-service portal link
- MFA enrollment query returns enrollment steps
- Responses cite IT policy document source

### FR-IT-002 — Access Request Guidance
**Priority:** P1  
**Description:** ITAgent provides guidance on how to request software access, system permissions, and VPN access. For requests requiring approval, the agent provides the email draft template or escalation path.  
**Acceptance Criteria:**
- Software access request process explained
- VPN access request process explained
- Agent offers to open Email Agent for formal request

### FR-IT-003 — IT Policy Retrieval
**Priority:** P1  
**Description:** ITAgent retrieves IT policies including antivirus requirements, acceptable use policy, data backup policy, remote work IT requirements, and device policy from pgvector.  
**Acceptance Criteria:**
- Antivirus policy query answered accurately
- Acceptable use policy retrieved and summarized
- Data backup policy details provided

### FR-IT-004 — Security Incident Reporting
**Priority:** P1  
**Description:** ITAgent provides guidance on how to report security incidents, phishing attempts, and data breaches. Provides the IT security team contact and escalation steps.  
**Acceptance Criteria:**
- Phishing reporting process described
- Security team contact provided
- Urgency communicated clearly for critical incidents

### FR-IT-005 — Hardware Request Guidance
**Priority:** P1  
**Description:** ITAgent explains the hardware request process for new laptops, monitors, peripherals, and accessories, including the approval chain and procurement timeline.  
**Acceptance Criteria:**
- Hardware request process documented in response
- Approval chain explained
- Estimated timeline provided

### FR-IT-006 — Software Installation Support
**Priority:** P1  
**Description:** ITAgent answers questions about approved software list, how to request installation of unlisted software, and self-service installation for pre-approved tools.  
**Acceptance Criteria:**
- Approved software list mentioned or linked
- Unapproved software request process explained
- Self-service installation steps provided where applicable

### FR-IT-007 — IT Escalation Routing
**Priority:** P0  
**Description:** When an IT query cannot be resolved by the agent, or the user explicitly requests escalation, the agent prompts the user to use the EscalationDrawer. Escalation carries `escalation_type=IT`, pre-filled subject and reason from the conversation context.  
**Acceptance Criteria:**
- Out-of-scope IT queries offer escalation path
- Escalation form pre-filled with IT type and context
- User can escalate from chat without repeating context

### FR-IT-008 — VPN Connectivity Troubleshooting
**Priority:** P1  
**Description:** ITAgent provides VPN-specific troubleshooting steps covering connection failures, authentication errors, split tunneling configuration, and performance issues.  
**Acceptance Criteria:**
- Step-by-step VPN troubleshooting returned
- Common error codes explained
- Escalation path provided for persistent issues

---

## Domain 5: Admin (FR-ADMIN-001 through FR-ADMIN-006)

### FR-ADMIN-001 — Travel Policy and Booking
**Priority:** P1  
**Description:** AdminAgent answers questions about travel booking policy, approved vendors (ORIX, Cabman), hotel booking process, flight booking approval, visa letter requests, and travel reimbursement procedures.  
**Acceptance Criteria:**
- Travel policy retrieved from pgvector
- Approved vendor list provided
- Reimbursement process steps described
- Visa letter request process explained

### FR-ADMIN-002 — Cab and Transport Booking
**Priority:** P1  
**Description:** AdminAgent provides information about cab booking via ORIX and Cabman, booking deadlines, cancellation policies, and late-night transport arrangements.  
**Acceptance Criteria:**
- Cab booking portal links provided
- Booking deadline policy stated
- Cancellation process described

### FR-ADMIN-003 — Facility Booking
**Priority:** P1  
**Description:** AdminAgent handles meeting room booking, parking request, and office facility queries including the Fountainhead facility management contact.  
**Acceptance Criteria:**
- Meeting room booking process explained
- Parking request process described
- Facility contact (Fountainhead) provided

### FR-ADMIN-004 — Microsoft Forms Creation
**Priority:** P1  
**Description:** When a user requests creation of a Microsoft Form, survey, or questionnaire, the MasterAgent detects the intent and returns a sentinel (`__MS_FORMS_INTENT__`) that triggers the FormsDrawer in the UI. The FormsDrawer collects form title, description, and questions, then calls `POST /api/forms/create` which uses Microsoft Graph API on behalf of the authenticated user.  
**Acceptance Criteria:**
- Forms creation intent detected via regex patterns
- FormsDrawer opens automatically on detection
- Form creation calls Graph API with delegated permissions
- Created form URL returned to user
- Error handling for Graph API failures

### FR-ADMIN-005 — Office Supply Requests
**Priority:** P2  
**Description:** AdminAgent provides guidance on office supply request process, approved suppliers, and approval workflow.  
**Acceptance Criteria:**
- Supply request process explained
- Approved supplier list provided
- Approval chain described

### FR-ADMIN-006 — Admin Escalation
**Priority:** P1  
**Description:** Unresolved admin queries can be escalated via the EscalationDrawer with `escalation_type=ADMIN`, pre-filled with conversation context.  
**Acceptance Criteria:**
- Admin escalation type available in EscalationDrawer
- Context pre-filled from conversation
- Escalation saved to escalations table

---

## Domain 6: Org (FR-ORG-001 through FR-ORG-005)

### FR-ORG-001 — Company Information and Values
**Priority:** P1  
**Description:** OrgDeepAgent answers questions about Aligned Automation's mission, vision, values, culture, leadership team, and organizational structure from ingested SharePoint documents.  
**Acceptance Criteria:**
- Mission and vision retrieved from documents
- Leadership information retrieved accurately
- Company history and values described

### FR-ORG-002 — Announcements
**Priority:** P1  
**Description:** OrgDeepAgent retrieves recent company announcements and communications from ingested SharePoint content.  
**Acceptance Criteria:**
- Announcements retrieved by recency where possible
- Announcement content displayed accurately
- Source document cited

### FR-ORG-003 — Org Chart Information
**Priority:** P1  
**Description:** Org chart queries are partially handled by OrgDeepAgent (structure overview) and EmployeeAgent (specific reporting relationships).  
**Acceptance Criteria:**
- Department structure described at high level
- Specific manager queries routed to EmployeeAgent
- Cross-agent routing does not confuse user

### FR-ORG-004 — Quick Links
**Priority:** P2  
**Description:** The Quick Links panel (`quickLinksConfig.js`) provides configurable shortcuts to frequently accessed portals: Zoho People, HROne, SharePoint, Outlook, OneDrive, Practo.  
**Acceptance Criteria:**
- All configured links render in the right panel
- Links open in new tabs
- Configuration can be updated without code changes to core platform

### FR-ORG-005 — Diversity and Inclusion Policy
**Priority:** P2  
**Description:** OrgDeepAgent retrieves D&I policy information including equal opportunity, POSH, and inclusive workplace guidelines.  
**Acceptance Criteria:**
- D&I policy retrieved from SharePoint documents
- POSH references link to HRAgent for detailed policy
- IC committee contact provided

---

## Domain 7: Employee (FR-EMP-001 through FR-EMP-006)

### FR-EMP-001 — Employee Directory Search
**Priority:** P1  
**Description:** EmployeeAgent searches the Zoho People database view (`people.vb_employees`) by name, department, designation, or skill. Returns profile card with name, designation, department, mobile, work phone, reporting manager, date of joining, and skill set.  
**Acceptance Criteria:**
- Name search returns matching employee(s) with profile card
- Department queries return headcount and member list
- Skill search returns employees with matching skill set
- "Who is [name]?" pattern recognized and resolved

### FR-EMP-002 — Employee Self-Profile
**Priority:** P1  
**Description:** "Who am I?", "my designation", "my manager", "my mobile", "my department" queries resolved from the Zoho People database using the authenticated user's email. The `GET /api/profile` endpoint returns the profile JSON.  
**Acceptance Criteria:**
- Self-profile query resolved without specifying name
- All profile fields returned: designation, department, manager, grade, level
- Profile data sourced from Zoho People, not JWT token alone

### FR-EMP-003 — Attendance Self-Service
**Priority:** P1  
**Description:** `GET /api/attendance/me` returns current and prior month attendance records for the authenticated user. Records include check-in time, check-out time, working hours, date, and status. Employee name is resolved from Zoho People by email before querying attendance records.  
**Acceptance Criteria:**
- Returns current month and last month records
- Check-in, check-out, and working hours included per day
- Employee not found in Zoho People returns HTTP 404
- Response schema matches `AttendanceOut` model

### FR-EMP-004 — Manager Reportee Attendance
**Priority:** P1  
**Description:** Managers can view attendance for their direct reports via `GET /api/attendance/reportee?name={employeeName}` or by asking "show Yogesh Chandan attendance for April 2026". Requires manager-level role or above.  
**Acceptance Criteria:**
- Reportee attendance query recognized by attendance pre-classifier
- Manager can specify employee name and month
- Access control prevents non-managers from viewing others' attendance
- Records formatted identically to self-attendance

### FR-EMP-005 — Colleague Lookup
**Priority:** P1  
**Description:** EmployeeAgent resolves colleague queries using patterns like "who is Jane?", "email of Prashant Dikonda", "phone number of Maithili Joshi", "employees in the engineering department".  
**Acceptance Criteria:**
- Name-based lookup works for first name, last name, or full name
- Contact details (email, mobile, work phone) returned
- Department listing returns all active employees in that department
- Results respect PII guardrails (salary not disclosed)

### FR-EMP-006 — Birthday and Anniversary Lookup
**Priority:** P2  
**Description:** EmployeeAgent can answer "who has a birthday this month?" or "who is joining their work anniversary?" queries from Zoho People data.  
**Acceptance Criteria:**
- Birthday lookup returns names and dates for current month
- Work anniversary lookup returns employees with DOJ in current month
- Queries work for any specified month

---

## Domain 8: Escalation (FR-ESC-001 through FR-ESC-005)

### FR-ESC-001 — Escalation Creation
**Priority:** P0  
**Description:** `POST /api/escalations` creates a new escalation record. Fields: `escalation_type` (HR/IT/Admin/Finance/PMO), `subject`, `reason`, `priority` (LOW/MEDIUM/HIGH/CRITICAL), `form_payload` (JSON), `conversation_id`, `message_id`. The escalation is linked to the authenticated user and stored in the escalations table.  
**Acceptance Criteria:**
- All required fields validated before insertion
- Returns HTTP 201 with the created `EscalationRecord`
- `conversation_id` and `message_id` linkage preserved
- `priority` defaults to MEDIUM if not specified
- Creation timestamp stored in UTC

### FR-ESC-002 — Escalation Tracking (User View)
**Priority:** P0  
**Description:** `GET /api/escalations` returns a paginated list of the authenticated user's escalations. Supports filtering by status and pagination (page, limit, max 100 per page).  
**Acceptance Criteria:**
- Returns only escalations belonging to the authenticated user
- Pagination works correctly (page, limit, total count)
- Status filter works (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- Results sorted by creation date descending

### FR-ESC-003 — Escalation Detail View
**Priority:** P1  
**Description:** `GET /api/escalations/{id}` returns the full escalation record including status history, resolution notes, and associated conversation context.  
**Acceptance Criteria:**
- Returns HTTP 404 if escalation not found
- Returns HTTP 403 if escalation belongs to another user (non-admin)
- Full form_payload JSON returned
- Status and timestamps accurate

### FR-ESC-004 — Admin Escalation View
**Priority:** P1  
**Description:** `GET /api/admin/escalations` returns all escalations across all users. Restricted to admin and COO roles. Supports filtering by type, status, priority, and date range.  
**Acceptance Criteria:**
- Returns HTTP 403 for non-admin users
- All escalation types visible to admin
- Filter combinations work correctly
- Response includes user email and name for each escalation

### FR-ESC-005 — SLA Tracking and Status Updates
**Priority:** P1  
**Description:** Admin can update escalation status via `PATCH /api/escalations/{id}/status`. Status transitions: OPEN → IN_PROGRESS → RESOLVED → CLOSED. Resolution notes can be added. SLA breach detection based on priority and creation time.  
**Acceptance Criteria:**
- Status transitions validated (cannot go backward except to OPEN)
- Resolution notes saved with timestamp and admin user ID
- CRITICAL priority SLA = 4 hours; HIGH = 8 hours; MEDIUM = 24 hours; LOW = 72 hours
- SLA breach flag visible in admin view

---

## Domain 9: Analytics (FR-ANA-001 through FR-ANA-006)

### FR-ANA-001 — Analytics Overview Dashboard
**Priority:** P1  
**Description:** Admin analytics dashboard displays 10 Recharts chart components covering: total conversations, messages per day, active users, agent usage distribution, query domain breakdown, feedback score trend, escalation volume, document generation counts, peak usage hours, and conversation length distribution.  
**Acceptance Criteria:**
- Dashboard loads with real data (no mock/placeholder)
- Date range filter (7/30/90 days) updates all charts
- Charts render correctly in Chrome, Edge, Firefox
- Admin role required; HTTP 403 for others

### FR-ANA-002 — COO Analytics Dashboard
**Priority:** P1  
**Description:** `GET /api/coo-analytics/metrics` returns executive-level metrics: total users, MAU, DAU, total conversations, agent adoption breakdown, satisfaction score, escalation resolution rate, and knowledge base coverage. Restricted to COO and executive roles (ANALYTICS_ROLES).  
**Acceptance Criteria:**
- Endpoint restricted to executive roles
- All metric fields populated from real data
- Response latency <2 seconds
- COO dashboard in UI shows metrics in card and chart format

### FR-ANA-003 — Feedback Analytics
**Priority:** P1  
**Description:** Feedback data (values: -1, 0, 1) is aggregated and displayed as thumbs up/down counts, positive ratio trend, and per-agent feedback breakdown in the analytics dashboard.  
**Acceptance Criteria:**
- Feedback ratio = positive / (positive + negative)
- Per-agent breakdown shows which agents get best/worst ratings
- Trend over date range is chart-rendered
- Admin can view individual feedback records

### FR-ANA-004 — Query Pattern Analysis
**Priority:** P2  
**Description:** Analytics shows top query categories, most frequent question types per agent, and unanswered query (fallback to QuickAgent) rate.  
**Acceptance Criteria:**
- Top 10 query categories by volume shown
- QuickAgent fallback rate visible as percentage
- Trends over time shown on line chart

### FR-ANA-005 — User Activity Metrics
**Priority:** P1  
**Description:** Analytics dashboard shows daily active users, new users, and session length distribution to measure platform adoption.  
**Acceptance Criteria:**
- DAU chart shows correct unique user count per day
- New user trend shows registration growth
- Session length bucketed into <1min, 1-5min, 5-15min, >15min

### FR-ANA-006 — Document Generation Analytics
**Priority:** P2  
**Description:** Analytics shows document generation counts by type (experience_letter, loan_proof, etc.), success vs abandoned session rates, and average field collection turns.  
**Acceptance Criteria:**
- Per-type generation count accurate
- Abandoned session rate = sessions with no document generated / total sessions started
- Average turns per document type shown

---

## Domain 10: Knowledge Management (FR-KM-001 through FR-KM-005)

### FR-KM-001 — SharePoint Document Ingestion
**Priority:** P0  
**Description:** The SharePoint ingestion job (`jobs/sharepoint_ingestion/`) connects to SharePoint Online, lists documents in configured library paths, downloads changed or new documents, and triggers the embedding pipeline. Documents are identified by their SharePoint item ID and modification timestamp to avoid re-ingesting unchanged content.  
**Acceptance Criteria:**
- New documents detected and ingested within one job run
- Changed documents (newer modification timestamp) re-ingested
- Deleted documents soft-deleted in document_chunks table
- Job can run on schedule without manual intervention

### FR-KM-002 — Text Chunking
**Priority:** P0  
**Description:** Ingested documents are chunked into 1000-character segments with 200-character overlap using a recursive text splitter. Each chunk stores `file_name`, `source_url`, `chunk_index`, and `chunk_text`.  
**Acceptance Criteria:**
- Chunk size 1000 characters with 50 token overlap
- Each chunk linked to parent document
- Source URL preserved for citation
- Chunk index maintained for ordering

### FR-KM-003 — Embedding Generation
**Priority:** P0  
**Description:** Each chunk is embedded using `nomic-embed-text-v1.5` (768-dimensional vectors) via LangChain HuggingFace embeddings. Embeddings are stored in the `document_chunks.embedding` column typed as `vector(768)`.  
**Acceptance Criteria:**
- Embedding model: `nomic-embed-text-v1.5`, 768 dimensions
- Embedding stored as pgvector `vector(768)` type
- Embedding generation completes without truncation for 1000-character chunks
- Model loaded once per process via `@lru_cache`

### FR-KM-004 — pgvector Similarity Search
**Priority:** P0  
**Description:** The retriever (`rag/retriever.py`) performs cosine similarity search using pgvector's `<=>` operator. Connection pool: min=1, max=8 threads. Query embedding generated at runtime using the same model as ingestion. `top_k` defaults to 10. Results include `chunk_text`, `file_name`, `source_url`, and `similarity` score.  
**Acceptance Criteria:**
- Query embedding uses identical model to ingestion embedding
- Cosine similarity returns correctly ranked results
- Connection pool thread-safe under concurrent requests
- Results include all required metadata fields

### FR-KM-005 — FAISS Local Fallback
**Priority:** P1  
**Description:** BaseDeepAgent maintains a FAISS/keyword local knowledge base (KnowledgeBase class) as a fallback when pgvector returns no results or the connection pool is exhausted. Local KB covers the most critical policy documents per agent.  
**Acceptance Criteria:**
- FAISS fallback activates when pgvector returns empty result set
- Fallback result quality acceptable for common queries
- Fallback does not cause additional latency beyond 500ms
- Fallback activation logged for monitoring
