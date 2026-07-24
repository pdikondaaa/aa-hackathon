# Use Cases Specification
## AURA — AI-Powered Enterprise Assistant Platform
### Aligned Automation Internal Operations

**Document Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Active

---

## Use Case Diagram

```mermaid
graph TD
    subgraph "Employee"
        E[Employee]
    end

    subgraph "Manager"
        M[Manager]
    end

    subgraph "HR Admin"
        HRA[HR Admin]
    end

    subgraph "IT Admin"
        ITA[IT Admin]
    end

    subgraph "COO"
        COO[COO]
    end

    subgraph "AURA System"
        UC001[UC-001 Query Leave Balance]
        UC002[UC-002 Leave Application Guide]
        UC003[UC-003 Check Attendance]
        UC004[UC-004 View Team Attendance]
        UC005[UC-005 Look Up Colleague]
        UC006[UC-006 Request HR Document]
        UC007[UC-007 Draft IT Escalation Email]
        UC008[UC-008 Raise IT Escalation]
        UC009[UC-009 View All Escalations]
        UC010[UC-010 Complete Onboarding]
        UC011[UC-011 HR Policy Lookup]
        UC012[UC-012 Create Microsoft Form]
        UC013[UC-013 View Analytics Dashboard]
        UC014[UC-014 View COO Analytics]
        UC015[UC-015 Give Response Feedback]
        UC016[UC-016 View Project Allocation]
        UC017[UC-017 Company Announcement]
        UC018[UC-018 VPN Troubleshooting]
        UC019[UC-019 Travel Request Guidance]
        UC020[UC-020 General Company Query]
    end

    E --> UC001 & UC002 & UC003 & UC005 & UC006 & UC007 & UC008 & UC010 & UC011 & UC012 & UC015 & UC017 & UC018 & UC019 & UC020
    M --> UC004 & UC016
    HRA --> UC013
    ITA --> UC009
    COO --> UC014
```

---

## UC-001 — Employee Queries Leave Balance

**Primary Actor:** Employee (any role)  
**Goal:** Find out how many days of annual/sick/casual leave are available without contacting HR.  
**Priority:** P0  
**Business Value:** Eliminates the most common HR inquiry; saves 5-10 minutes per employee per query.

**Preconditions:**
- Employee is authenticated via Azure AD SSO
- HRAgent has access to leave policy documents in pgvector
- Leave policy documents have been ingested from SharePoint

**Main Success Flow:**
1. Employee opens AURA chat and types "How many annual leaves do I have?"
2. MasterAgent keyword scorer detects `leave` keyword and routes to `hr` domain
3. HRAgent embeds query using `nomic-embed-text-v1.5` and queries pgvector for `top_k=10` chunks
4. pgvector returns leave policy chunks with similarity scores
5. HRAgent constructs LLM prompt with policy context and HR personality
6. Ollama LLM generates response citing the leave policy document
7. Response streams back token-by-token via SSE with source citation (SharePoint URL)
8. Employee sees complete answer: leave types, days allowed, carry-forward rules

**Alternative Flows:**
- A1. pgvector returns empty result: HRAgent retries with simplified query; if still empty, falls back to FAISS local KB
- A2. Ollama unavailable: FAISS retrieval only, response quality reduced but functional; health endpoint shows degraded
- A3. Query is too specific ("How many leaves do I have left this month?"): HRAgent responds that actual balance is in Zoho People and provides portal link

**Postconditions:**
- Message and response saved to conversations/messages tables
- Source URL(s) appended to response
- Conversation available in Sidebar history

---

## UC-002 — Employee Gets Leave Application Guidance

**Primary Actor:** Employee  
**Goal:** Apply for leave through the correct portal without searching for the URL.  
**Priority:** P0  
**Business Value:** Zero HR touchpoints for leave application; immediate self-service.

**Preconditions:**
- Employee authenticated
- Apply-leave fast-path regex pattern active in MasterAgent

**Main Success Flow:**
1. Employee types "I want to apply for leave" or "How do I apply for leave?"
2. MasterAgent's `_APPLY_LEAVE_RE` regex matches the message before any routing
3. Fast-path returns pre-formatted HTML response with styled button
4. Response includes explanation and a blue `Apply Leave on Zoho People` button
5. Response delivered in <200ms (no LLM call)
6. Employee clicks button, opens Zoho People leave application in new tab

**Alternative Flows:**
- A1. "What are the leave types?" — does NOT match apply-leave regex; routes to HRAgent for policy explanation

**Postconditions:**
- Fast-path response saved to conversation
- Employee directed to correct portal

---

## UC-003 — Employee Checks Own Attendance

**Primary Actor:** Employee  
**Goal:** View own check-in and check-out times for the current and previous month.  
**Priority:** P1  
**Business Value:** Self-service attendance view reduces HR/manager queries about attendance records.

**Preconditions:**
- Employee authenticated
- Employee exists in Zoho People database
- Attendance records exist in AURA attendance table

**Main Success Flow:**
1. Employee asks "Show my attendance" or navigates to attendance section
2. AttendanceAgent's `_ATT_PATTERNS` regex matches the query
3. MasterAgent routes to `attendance` domain
4. AttendanceAgent calls `GET /api/attendance/me` via attendance_service
5. Attendance service resolves employee name from Zoho People using authenticated email
6. Service queries AURA attendance table for current and prior month records
7. AttendanceAgent formats response as HTML table: date, check-in, check-out, working hours
8. Response displayed in chat with monthly summary

**Alternative Flows:**
- A1. Employee not found in Zoho People: `ValueError` raised; AttendanceAgent returns "Your attendance record could not be found. Please contact HR."
- A2. No attendance records for the month: Returns empty table with informational message

**Postconditions:**
- Attendance records displayed
- Response saved to conversation

---

## UC-004 — Manager Views Team Attendance

**Primary Actor:** Manager (manager or above role)  
**Goal:** Check attendance records for a specific team member.  
**Priority:** P1  
**Business Value:** Managers can monitor team punctuality without contacting HR or IT for reports.

**Preconditions:**
- Manager authenticated with manager role or above
- Target employee exists in Zoho People
- Manager has appropriate RBAC permission

**Main Success Flow:**
1. Manager types "Show Yogesh Chandan attendance for April 2026"
2. AttendanceAgent pattern `\b\w+\s+\w+\s+attendance\b` matches
3. MasterAgent routes to `attendance` domain
4. AttendanceAgent calls `GET /api/attendance/reportee?name=Yogesh Chandan&month=2026-04`
5. Attendance service resolves employee from Zoho People by name
6. Service queries AURA attendance table for specified employee and month
7. Results formatted as structured HTML table and streamed to manager

**Alternative Flows:**
- A1. Employee name ambiguous (multiple matches): Returns list of matching employees for clarification
- A2. Manager role not confirmed: RBAC check returns HTTP 403; chat shows "You don't have permission to view other employees' attendance."
- A3. Month not specified: Defaults to current month; response notes assumption

**Postconditions:**
- Attendance data displayed for specified employee and month
- Manager interaction logged in audit_logs

---

## UC-005 — Employee Looks Up Colleague

**Primary Actor:** Employee  
**Goal:** Find a colleague's contact details or profile information quickly.  
**Priority:** P1  
**Business Value:** Replaces manual SharePoint people search; saves 3-5 minutes per lookup.

**Preconditions:**
- Employee authenticated
- Target colleague exists in Zoho People (`people.vb_employees` view)

**Main Success Flow:**
1. Employee types "Who is Jane Wilson?" or "What is Maithili Joshi's email?"
2. EmployeeAgent's `_EMP_PATTERNS` (regex `\bwho\s+is\s+\w` or `email\s+of\s+[a-z]`) matches
3. MasterAgent routes to `employee` domain
4. EmployeeAgent queries Zoho People DB by name (case-insensitive ILIKE)
5. Profile returned: name, designation, department, mobile, work phone, email, manager, DOJ
6. Formatted profile card displayed in chat

**Alternative Flows:**
- A1. No employee found by name: "I couldn't find an employee named [name] in the directory. Please check the spelling."
- A2. Multiple employees with same first name: Returns all matches with disambiguating info (department, last name)
- A3. Another employee's salary queried ("What is Jane's salary?"): Tier-2 guardrail blocks; returns polite redirect

**Postconditions:**
- Profile information displayed (excluding salary/sensitive PII per guardrails)
- Lookup logged for analytics

---

## UC-006 — Employee Requests HR Document

**Primary Actor:** Employee  
**Goal:** Generate a professional experience letter without visiting HR in person or sending email.  
**Priority:** P0  
**Business Value:** HR saves 15-30 minutes per document request; employee gets instant generation.

**Preconditions:**
- Employee authenticated
- DocumentAgent active and Ollama LLM available
- Document type exists in `DOCUMENT_TYPES` catalog

**Main Success Flow:**
1. Employee types "I need an experience letter"
2. MasterAgent's `_DOC_PATTERNS` regex matches document intent
3. MasterAgent routes to `document` domain
4. DocumentAgent identifies document type as `experience_letter`
5. DocumentAgent checks for active session — none exists; starts new session
6. DocumentAgent asks for first required field: "Please provide your Employee Full Name"
7. Employee replies: "Arjun Mehta"
8. DocumentAgent stores field, asks next: "Please provide Date of Joining"
9. Employee replies: "2023-06-15"
10. Process continues for all 8 required fields (joining_date, last_working_date, designation, department, company_name, reporting_manager, signatory_name)
11. After all fields collected, DocumentAgent calls Ollama LLM with document generation prompt
12. LLM generates formatted experience letter (HTML)
13. Document displayed in chat; session cleared
14. Employee can view/download from DocumentsPage

**Alternative Flows:**
- A1. Employee goes off-topic during field collection ("What's the VPN password?"): MasterAgent cancels session, notifies user ("Your document session has been cancelled. Start a new request any time."), routes VPN query to ITAgent
- A2. Ollama unavailable: Returns error "Document generation is temporarily unavailable. Please try again later."
- A3. Employee provides ambiguous field value: DocumentAgent confirms with follow-up question

**Postconditions:**
- Document generated and stored in documents table
- Multi-turn session cleared from in-memory store
- Document available in DocumentsPage

---

## UC-007 — Employee Drafts IT Escalation Email

**Primary Actor:** Employee  
**Goal:** Get a professionally drafted email to IT support without spending time on email composition.  
**Priority:** P1  
**Business Value:** Reduces email composition time from 10 minutes to <30 seconds; ensures proper tone and completeness.

**Preconditions:**
- Employee authenticated
- EmailAgent active and Ollama LLM available
- Email drafting intent detected

**Main Success Flow:**
1. Employee types "Draft an email to IT about my VPN not working"
2. MasterAgent's `_EMAIL_DRAFT_RE` regex matches `draft.*email`
3. MasterAgent returns sentinel `__EMAIL_DRAFT_INTENT__`
4. Frontend ChatWindow detects sentinel and calls `POST /api/email-agent/from-chat` with query context
5. EmailAgent (`email_agent.py`) calls Ollama to generate email: To (IT support), Subject, Body
6. Frontend EmailAgentPage displays drafted email with editable fields
7. Employee reviews and edits draft
8. Employee clicks "Send" — mailto link opens Outlook with pre-filled To, Subject, Body

**Alternative Flows:**
- A1. Ollama unavailable: Returns "Unable to draft email. Please compose manually and send to it@alignedautomation.com."
- A2. Employee saves draft for later: Email saved in conversation context for reference

**Postconditions:**
- Email draft displayed in EmailAgentPage
- Employee can send or discard

---

## UC-008 — Employee Raises IT Escalation

**Primary Actor:** Employee  
**Goal:** Formally log an IT issue that requires human attention with full context.  
**Priority:** P0  
**Business Value:** Structured escalation ensures no issue is lost; IT team receives full context.

**Preconditions:**
- Employee authenticated
- Escalation issue not resolvable by ITAgent
- Employee elects to escalate

**Main Success Flow:**
1. Employee types "I need to escalate my VPN issue" or ITAgent suggests escalation after failed resolution
2. MasterAgent detects `escalat` keyword (highest-priority check) and routes to `escalation`
3. EscalationAgent provides guidance and/or frontend opens EscalationDrawer
4. Employee fills EscalationDrawer form: type=IT, subject="VPN not connecting", reason (details), priority=HIGH
5. Employee clicks "Submit" — `POST /api/escalations` called with conversation_id and message_id
6. Escalation saved to escalations table with status=OPEN
7. Confirmation shown in chat; escalation ID returned

**Alternative Flows:**
- A1. Employee doesn't fill required fields: Form validation prevents submission with field-level error messages
- A2. Escalation creation fails (DB error): HTTP 500 returned; error displayed in drawer

**Postconditions:**
- Escalation record in database with status=OPEN
- Escalation linked to originating conversation and message
- Escalation visible in employee's escalation list

---

## UC-009 — IT Admin Views All Escalations

**Primary Actor:** IT Admin  
**Goal:** Review all open IT escalations, update status, and resolve issues.  
**Priority:** P1  
**Business Value:** Centralized escalation management replaces email/spreadsheet tracking.

**Preconditions:**
- IT Admin authenticated with admin role
- Escalations exist in escalations table

**Main Success Flow:**
1. IT Admin navigates to admin escalation view or queries `GET /api/admin/escalations?type=IT&status=OPEN`
2. RBAC check confirms admin role — HTTP 200 returned
3. All IT escalations listed with: user email, subject, reason, priority, status, created_at
4. Admin selects escalation with HIGH priority
5. Admin views conversation context (linked via conversation_id)
6. Admin resolves issue and calls `PATCH /api/escalations/{id}/status` with `status=RESOLVED` and resolution notes
7. Status updated; timestamp and admin user ID recorded

**Alternative Flows:**
- A1. Non-admin user calls `/api/admin/escalations`: HTTP 403 returned
- A2. Filter returns no results: Empty list with "No escalations matching your filters"

**Postconditions:**
- Escalation status updated to RESOLVED
- Resolution notes and resolver identity saved
- Employee can see updated status in their escalation view

---

## UC-010 — New Employee Completes Onboarding

**Primary Actor:** New Employee (Day 1)  
**Goal:** Complete all 8 onboarding steps to become operational and compliant.  
**Priority:** P0  
**Business Value:** Structured onboarding reduces confusion and HR intervention on Day 1; ensures all steps completed.

**Preconditions:**
- New employee authenticated (Aligned Automation account created by IT)
- Employee exists in Zoho People DB
- Onboarding portal configured with 8 steps

**Main Success Flow:**
1. Employee logs in; onboarding module detected as first-login experience
2. Onboarding step 1: Profile review — employee verifies profile via `GET /api/onboarding/profile`
3. Step 2: IT access setup — instructions for email, VPN, OneDrive; links to IT self-service
4. Step 3: Practo health enrollment — instructions and enrollment link
5. Step 4: HROne registration — payroll portal setup instructions
6. Step 5: Leave policy reading — AURA HRAgent displays leave policy summary
7. Step 6: First day checklist — equipment verification, team introduction, buddy assignment
8. Step 7: Team introduction — org chart, reporting manager, team members lookup via EmployeeAgent
9. Step 8: Compliance training — links to mandatory training modules
10. Completion recorded; HR team notified; completion badge shown to employee

**Alternative Flows:**
- A1. Employee skips a step: Step marked as "skipped", HR notified; employee can return and complete later
- A2. Profile data missing in Zoho People: Step 1 shows partial profile with instructions to contact HR

**Postconditions:**
- All 8 steps marked complete in onboarding DB
- HR notified of completion
- Employee's onboarding status visible in HR analytics

---

## UC-011 — Employee Asks HR Policy Question

**Primary Actor:** Employee  
**Goal:** Get an accurate answer to an HR policy question (e.g., WFH policy, POSH) without waiting for HR email.  
**Priority:** P0  
**Business Value:** Fastest self-service path for policy questions; sources cited for trust.

**Preconditions:**
- Employee authenticated
- Policy document ingested into pgvector from SharePoint

**Main Success Flow:**
1. Employee asks "What is the WFH policy?"
2. MasterAgent keyword scorer detects `wfh policy` and routes to `hr`
3. HRAgent embeds query: `nomic-embed-text-v1.5`, 768-dim
4. pgvector cosine similarity search returns top 10 WFH policy chunks
5. LLM generates response with exact policy details: WFH days allowed, approval process, equipment requirements
6. Response includes inline citation "Per the WFH Policy, employees may work from home up to 2 days per week..."
7. Source section appended: link to SharePoint WFH Policy document

**Alternative Flows:**
- A1. Query about personal WFH exception: HRAgent acknowledges and directs to manager approval process
- A2. Policy document not ingested yet: pgvector returns empty; FAISS KB provides general answer with disclaimer

**Postconditions:**
- Policy information delivered with source citation
- Message and response saved to conversation

---

## UC-012 — Employee Creates Microsoft Form

**Primary Actor:** Employee  
**Goal:** Create a survey or feedback form quickly without opening Microsoft Forms manually.  
**Priority:** P1  
**Business Value:** Reduces form creation time; enables HR/admin to collect structured feedback without manual form building.

**Preconditions:**
- Employee authenticated with Microsoft account (Graph API Forms permission)
- FormsDrawer available in AURA UI

**Main Success Flow:**
1. Employee types "Create an employee satisfaction survey"
2. MasterAgent's `_MS_FORMS_RE` regex matches (before LLM routing)
3. MasterAgent returns sentinel `__MS_FORMS_INTENT__`
4. ChatWindow displays confirmation; FormsDrawer opens in right panel
5. Employee fills form: title "Employee Satisfaction Survey", description, 5 questions (4 multiple choice, 1 text)
6. Employee clicks "Create Form" — `POST /api/forms/create` called with Microsoft Graph API
7. Graph API creates form in employee's Microsoft account
8. Form URL returned and displayed in drawer
9. Employee shares URL with team

**Alternative Flows:**
- A1. Graph API permissions not granted: Returns "Microsoft Forms creation requires admin consent. Please contact IT to grant Forms.ReadWrite.All permission."
- A2. Network timeout: Retry once; if failed, display error with manual Forms link

**Postconditions:**
- Microsoft Form created in employee's account
- Form URL stored in conversation response
- Form accessible via employee's Microsoft Forms portal

---

## UC-013 — HR Admin Views Analytics Dashboard

**Primary Actor:** HR Admin  
**Goal:** Understand how employees are using AURA and identify knowledge gaps.  
**Priority:** P1  
**Business Value:** Data-driven insights for HR to improve knowledge base coverage and identify process gaps.

**Preconditions:**
- HR Admin authenticated with admin role
- Analytics module populated with real data (conversations, messages, feedback)

**Main Success Flow:**
1. HR Admin navigates to Analytics module
2. RBAC check confirms admin role
3. Dashboard loads 10 chart components with default 30-day date range
4. Admin observes: HR domain has highest query volume (45%), followed by IT (25%)
5. Admin filters to last 7 days — all charts update
6. Admin reviews feedback analytics: 78% positive, 12% negative for HR agent
7. Admin drills into negative feedback to identify weak policy areas
8. Admin reviews document generation counts by type: experience_letter most common (40%)
9. Admin shares insights with HR team for SharePoint knowledge base updates

**Alternative Flows:**
- A1. Date range returns no data: Charts show "No data for selected period" with empty state
- A2. Non-admin accesses analytics URL: HTTP 403; redirect to chat home

**Postconditions:**
- Analytics data consumed by HR Admin
- Knowledge base gaps identified for improvement

---

## UC-014 — COO Views COO Analytics

**Primary Actor:** COO (executive role)  
**Goal:** Review platform adoption metrics and AURA ROI at executive level.  
**Priority:** P1  
**Business Value:** Quantifies AURA investment return; drives decisions on knowledge base expansion.

**Preconditions:**
- COO authenticated with executive role (ANALYTICS_ROLES)
- `coo_analytics_service.py` has computed metrics from production data

**Main Success Flow:**
1. COO navigates to COO Dashboard
2. RBAC check confirms executive/COO role via `ANALYTICS_ROLES`
3. `GET /api/coo-analytics/metrics` returns: total_users, MAU, DAU, total_conversations, agent_adoption breakdown, satisfaction_score, escalation_resolution_rate
4. Dashboard displays key metrics in card format + trend charts
5. COO reviews: 247 MAU (83% of workforce), satisfaction score 81%, IT escalation resolution 94%
6. COO shares dashboard screenshot in board meeting to demonstrate AURA ROI

**Alternative Flows:**
- A1. Non-executive role accesses COO dashboard URL: HTTP 403; redirect to main analytics or chat
- A2. Metrics endpoint slow (>2s): Spinner shown; partial data loaded progressively

**Postconditions:**
- Executive metrics reviewed
- No data modification

---

## UC-015 — Employee Gives Feedback on AI Response

**Primary Actor:** Employee  
**Goal:** Signal to the platform whether an AI response was helpful or not.  
**Priority:** P1  
**Business Value:** Feedback data drives model quality improvement and identifies under-performing agents.

**Preconditions:**
- Employee authenticated
- AI response message exists (message_id present)

**Main Success Flow:**
1. Employee reads AURA's response about GHI insurance coverage
2. Response is accurate — employee clicks thumbs up on MessageBubble
3. `POST /api/messages/{id}/feedback` called with `value=1`
4. Feedback saved to feedback table: message_id, user_id, value=1, created_at
5. Thumbs up button highlighted; thumbs down disabled
6. Employee can change feedback by clicking thumbs down — value updated to -1

**Alternative Flows:**
- A1. Employee clicks same feedback again: Feedback retracted (value=0)
- A2. Feedback submission fails: Silent retry; if failed, thumbs indicator reverts

**Postconditions:**
- Feedback record in DB with value=1 or -1
- Aggregate feedback metrics updated for analytics

---

## UC-016 — Employee Views Project Allocation

**Primary Actor:** Manager / Executive (PMO roles)  
**Goal:** View current resource allocation across projects for planning purposes.  
**Priority:** P1  
**Business Value:** Single-pane allocation view reduces need for separate PMO tool access.

**Preconditions:**
- User authenticated with PMO-relevant role (business_lead or above for full view)
- Allocation data populated in AURA allocation tables

**Main Success Flow:**
1. Manager navigates to AllocationBoard component
2. RBAC check: executive, business_lead, functional_lead see full board; team_lead sees own team; employee sees own allocation
3. `GET /api/allocation/projects` returns project list with allocation percentages
4. AllocationBoard renders visual board with team members, projects, and allocation %
5. Manager identifies over-allocated team member and plans rebalancing

**Alternative Flows:**
- A1. Employee-level user: Sees only their own project allocation
- A2. No allocation data: Empty board with "No allocation data available. Contact your PMO."

**Postconditions:**
- Allocation data reviewed
- No data modification (view-only)

---

## UC-017 — HR Generates Company-Wide Announcement Response

**Primary Actor:** HR Admin / Employee  
**Goal:** Get information about a company announcement through AURA rather than searching email.  
**Priority:** P1  
**Business Value:** Reduces information scatter; gives employees one place to ask about announcements.

**Preconditions:**
- Announcement documents ingested into pgvector from SharePoint
- OrgDeepAgent active

**Main Success Flow:**
1. Employee asks "What was the company announcement about the new remote work policy?"
2. MasterAgent keyword scorer matches `company`, `announcement` → routes to `org`
3. OrgDeepAgent queries pgvector for announcement-related chunks
4. LLM generates summary of the announcement with key points
5. Source link to SharePoint announcement document provided

**Alternative Flows:**
- A1. Announcement not yet ingested: "I don't have that announcement in my knowledge base. Please check the company SharePoint or Teams channel."

**Postconditions:**
- Announcement summary provided with source citation

---

## UC-018 — Employee Troubleshoots VPN

**Primary Actor:** Employee  
**Goal:** Resolve VPN connectivity issue without logging an IT ticket.  
**Priority:** P1  
**Business Value:** Reduces IT L1 ticket volume; resolves common VPN issues self-service.

**Preconditions:**
- Employee authenticated
- IT policy documents with VPN instructions ingested into pgvector

**Main Success Flow:**
1. Employee types "My VPN is not connecting"
2. MasterAgent keyword scorer matches `vpn` → routes to `it`
3. ITAgent retrieves VPN troubleshooting chunks from pgvector
4. LLM generates step-by-step troubleshooting: check internet, reinstall client, reset credentials, check MFA
5. Steps streamed to employee
6. If issue persists, agent suggests raising escalation via EscalationDrawer

**Alternative Flows:**
- A1. Employee resolves issue after step 3: Gives thumbs up feedback
- A2. Issue requires IT intervention: Employee uses EscalationDrawer (UC-008)

**Postconditions:**
- VPN troubleshooting steps delivered
- Employee either resolved or escalated

---

## UC-019 — Admin Creates Travel Request Guidance

**Primary Actor:** Employee  
**Goal:** Understand the travel booking process and approved vendors without contacting admin team.  
**Priority:** P1  
**Business Value:** Reduces admin team queries for routine travel policy questions.

**Preconditions:**
- Employee authenticated
- Admin travel policy documents ingested into pgvector

**Main Success Flow:**
1. Employee types "How do I book a cab for client visit?"
2. MasterAgent keyword scorer matches `cab`, `booking` → routes to `admin`
3. AdminAgent retrieves travel/cab policy from pgvector
4. LLM generates response: ORIX and Cabman are approved vendors; provide booking portal links; 24-hour advance notice required
5. Response includes reimbursement claim process for out-of-policy situations

**Alternative Flows:**
- A1. Policy doesn't cover specific scenario: AdminAgent provides general guidance and escalation path to admin team

**Postconditions:**
- Travel policy guidance delivered
- Employee directed to correct vendor/portal

---

## UC-020 — Employee Asks General Company Question

**Primary Actor:** Employee  
**Goal:** Get an answer to a general question when it doesn't map to a specific domain.  
**Priority:** P2  
**Business Value:** Ensures no query goes completely unanswered; QuickAgent provides best-effort response.

**Preconditions:**
- Employee authenticated
- Query does not match any domain keyword list

**Main Success Flow:**
1. Employee types "What are some good practices for remote meetings?"
2. MasterAgent keyword scorer finds no domain match (score=0 for all domains)
3. MasterAgent routes to `general` (QuickAgent)
4. QuickAgent uses Ollama LLM with company context to provide general professional advice
5. Response includes disclaimer if information is general knowledge rather than company policy

**Alternative Flows:**
- A1. Query is conversational ("how are you?"): MasterAgent detects conversational pattern, routes to `general`, QuickAgent responds with personality
- A2. QuickAgent's response is not useful: Employee can use thumbs down feedback; conversation escalated

**Postconditions:**
- General response delivered
- Query logged for future routing analysis (may identify need for new domain agent)
