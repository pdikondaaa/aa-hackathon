# User Stories
## AURA — AI-Powered Enterprise Assistant Platform
### Aligned Automation Internal Operations

**Document Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Active

---

## Overview

This document contains 40+ user stories organized by domain. Each story follows the format: "As a [role], I want [action], so that [benefit]." Stories include 3–5 acceptance criteria, priority (P0/P1/P2), and story point estimate (Fibonacci: 1, 2, 3, 5, 8, 13).

**Roles used:**
- `employee` — any authenticated Aligned Automation employee
- `manager` — team lead or above with direct reports
- `hr_admin` — HR business partner or HR administrator
- `it_admin` — IT support analyst or IT administrator
- `admin` — platform administrator
- `coo` — Chief Operating Officer or executive

---

## HR Stories (US-HR-001 through US-HR-010)

### US-HR-001 — Leave Type Inquiry
**Story:** As an employee, I want to ask AURA what types of leaves are available, so that I know my entitlements without emailing HR.

**Priority:** P0 | **Story Points:** 3

**Acceptance Criteria:**
1. Query "What leave types are available?" returns a structured list of all leave types (annual, sick, casual, maternity, paternity, POSH, bereavement, etc.)
2. Each leave type includes the number of days allowed per year
3. Response cites the Leave Policy document from SharePoint
4. Response streams via SSE with first token in <1 second
5. Source link to Leave Policy SharePoint document appears below the response

---

### US-HR-002 — Leave Application Guide
**Story:** As an employee, I want AURA to guide me to apply for leave, so that I can complete the application without knowing the Zoho People portal URL.

**Priority:** P0 | **Story Points:** 1

**Acceptance Criteria:**
1. Query "I want to apply for leave" triggers the fast-path response (no LLM call)
2. Response includes a styled blue "Apply Leave on Zoho People" button
3. Button links to the correct Zoho People leave application URL
4. Response delivered in <200ms
5. The button opens in a new tab

---

### US-HR-003 — Payroll Questions
**Story:** As an employee, I want to ask AURA about payroll schedules and salary slip access, so that I don't have to wait for HR's response to routine payroll queries.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "When is salary credited?" returns accurate payroll date from ingested HR policy
2. "How do I access my salary slip?" returns HROne portal instructions
3. Another employee's salary query is blocked by guardrail with explanation
4. Own salary balance is redirected to HROne with portal link
5. Response cites HR policy document source

---

### US-HR-004 — Benefits Information
**Story:** As an employee, I want to ask AURA about my insurance and health benefits, so that I can understand my coverage without reading lengthy policy PDFs.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. GHI query returns coverage amount, dependents eligibility, and claim process
2. Practo benefit query returns enrollment steps and benefit value
3. IL TakeCare query returns policy summary and claim helpline
4. PF contribution query returns employer/employee contribution percentages
5. All responses cite the specific benefit policy document

---

### US-HR-005 — Policy Search
**Story:** As an employee, I want to search for any HR policy by asking AURA in natural language, so that I can find policy information without browsing SharePoint.

**Priority:** P0 | **Story Points:** 5

**Acceptance Criteria:**
1. "What is the WFH policy?" returns accurate WFH terms from ingested policy
2. "What is the attendance policy?" returns clock-in requirements, grace period, etc.
3. "What is the notice period?" returns role/grade-specific notice requirements
4. Policy responses cite document name inline ("Per the WFH Policy, ...")
5. When policy not found in pgvector, FAISS fallback provides general answer with disclaimer

---

### US-HR-006 — Document Generation
**Story:** As an employee, I want to request HR documents like experience letters or bonafide certificates via AURA chat, so that I can get official documents without visiting the HR office.

**Priority:** P0 | **Story Points:** 8

**Acceptance Criteria:**
1. "I need an experience letter" starts the DocumentAgent multi-turn collection flow
2. Agent collects all required fields one at a time with clear prompts
3. After all fields collected, LLM generates a properly formatted professional letter
4. Generated document is accessible in DocumentsPage for download
5. Off-topic message during collection cancels session with notification and handles the new query correctly
6. All 11 document types (loan_proof, experience_letter, employment_verification, offer_letter, relieving_letter, address_proof, bonafide, internship_certificate, promotion_letter, noc, confirmation_letter) are triggerable

---

### US-HR-007 — TDS and Form 16 Queries
**Story:** As an employee, I want to ask AURA about TDS declarations and Form 16, so that I understand my tax obligations without emailing the finance team.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "How do I submit TDS declaration?" returns step-by-step guide for ZOHO finance submission
2. "When is Form 16 issued?" returns accurate timeline from ingested finance policy
3. "How do I save on income tax?" returns investment declaration process
4. Response routes to finance domain (not HR) for tax-specific queries
5. Finance policy document cited in response

---

### US-HR-008 — Onboarding Checklist
**Story:** As a new employee, I want to access an interactive onboarding checklist on Day 1, so that I know exactly what to do and don't miss any steps.

**Priority:** P0 | **Story Points:** 8

**Acceptance Criteria:**
1. Onboarding portal accessible on first login
2. All 8 steps are displayed with titles, descriptions, and HR notes
3. Each step has a clear completion mechanism
4. Progress is saved between sessions
5. HR is notified when all 8 steps are marked complete
6. Steps link to correct portals (Zoho People, HROne, Practo) where applicable

---

### US-HR-009 — Performance Appraisal Policy
**Story:** As an employee, I want to ask about the performance appraisal process and timeline, so that I can prepare effectively without waiting for annual HR communications.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "When is the appraisal cycle?" returns accurate dates from HR policy
2. "How are appraisals conducted?" returns the process steps
3. "What is the increment policy?" returns the increments framework
4. Response cites HR performance policy document
5. If appraisal cycle not in knowledge base, suggests contacting HR manager

---

### US-HR-010 — HR Escalation
**Story:** As an employee, I want to escalate a sensitive HR issue via AURA, so that it is formally logged with full context and reaches the right HR person.

**Priority:** P0 | **Story Points:** 5

**Acceptance Criteria:**
1. "I need to escalate an HR issue" triggers escalation path
2. EscalationDrawer opens with type=HR pre-selected
3. Employee completes subject, reason, priority fields
4. Submission saves escalation to DB linked to current conversation
5. Employee receives escalation ID for tracking
6. HR Admin can view the escalation in `/api/admin/escalations`

---

## IT Stories (US-IT-001 through US-IT-008)

### US-IT-001 — VPN Troubleshooting Help
**Story:** As an employee, I want to ask AURA for VPN help, so that I can resolve connectivity issues without waiting for an IT ticket response.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "My VPN is not connecting" returns step-by-step troubleshooting
2. Steps cover: internet check, client reinstall, credential reset, MFA verification
3. Response cites IT policy/VPN guide document
4. Agent suggests escalation if issue persists after 5 steps
5. Response streams via SSE

---

### US-IT-002 — Password Reset Guide
**Story:** As an employee, I want to ask AURA how to reset my password, so that I can regain access quickly without calling the IT helpdesk.

**Priority:** P1 | **Story Points:** 2

**Acceptance Criteria:**
1. "How do I reset my password?" returns self-service reset link
2. Response includes steps for Azure AD password reset
3. If account locked, provides IT helpdesk contact
4. Response delivered in <3 seconds

---

### US-IT-003 — Access Request Guidance
**Story:** As an employee, I want to ask AURA how to request software or system access, so that I know the correct process and required approvals.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "How do I request access to [system]?" returns the access request process
2. Approval chain explained (manager + IT approval for most systems)
3. Agent offers to open EmailAgent to draft a formal access request email
4. Response cites IT access policy document

---

### US-IT-004 — Hardware Request
**Story:** As an employee, I want to ask AURA how to request a new laptop or monitor, so that I can start the procurement process without searching for the right form.

**Priority:** P1 | **Story Points:** 2

**Acceptance Criteria:**
1. "How do I get a new laptop?" returns hardware request process
2. Approval chain (manager → IT → procurement) explained
3. Estimated delivery timeline provided
4. IT contact for urgent requests provided

---

### US-IT-005 — Software Installation Request
**Story:** As an employee, I want to ask AURA about installing software on my work machine, so that I know whether I can install it myself or need IT approval.

**Priority:** P1 | **Story Points:** 2

**Acceptance Criteria:**
1. "Can I install [software] on my laptop?" returns approved software list guidance
2. Self-service installations listed for pre-approved tools
3. Non-approved software triggers request process explanation
4. IT contact provided for urgent software needs

---

### US-IT-006 — Security Incident Reporting
**Story:** As an employee, I want to ask AURA how to report a phishing email or security incident, so that I can act quickly without knowing who to contact.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "I received a suspicious email" returns phishing reporting steps
2. Security team email and phone contact provided
3. Do-not-click and do-not-forward instructions included
4. Urgency communicated clearly for critical incidents
5. Response does not trigger harmful/security threat guardrail (employee reporting is legitimate)

---

### US-IT-007 — IT Policy Lookup
**Story:** As an employee, I want to ask AURA about IT policies like acceptable use or data backup, so that I understand my obligations without reading lengthy IT policy documents.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What is the acceptable use policy?" returns key policy points
2. "What are the data backup requirements?" returns backup policy summary
3. "What can I install on my work machine?" returns software policy
4. Policy document cited in response
5. Full policy document linked via SharePoint URL

---

### US-IT-008 — IT Escalation
**Story:** As an employee, I want to escalate an unresolved IT issue, so that it is formally tracked and resolved by the IT team.

**Priority:** P0 | **Story Points:** 5

**Acceptance Criteria:**
1. "I need to escalate my IT issue" opens EscalationDrawer with type=IT
2. Subject and reason fields available for employee to describe issue
3. Priority selection: LOW / MEDIUM / HIGH / CRITICAL
4. Escalation linked to current conversation (message context preserved)
5. IT Admin can view in admin escalation view filtered by type=IT
6. Employee receives escalation ID for tracking

---

## Admin Stories (US-ADMIN-001 through US-ADMIN-006)

### US-ADMIN-001 — Travel Policy Lookup
**Story:** As an employee, I want to ask AURA about the travel policy, so that I know the reimbursement limits and approved vendors before booking travel.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What is the travel policy?" returns approved vendors (ORIX, Cabman), booking process, and reimbursement limits
2. Flight and hotel booking approval process explained
3. Advance booking requirements stated
4. Response cites admin travel policy document

---

### US-ADMIN-002 — Cab Booking Guidance
**Story:** As an employee, I want to ask AURA about booking a cab for a client visit, so that I use the correct vendor and process.

**Priority:** P1 | **Story Points:** 2

**Acceptance Criteria:**
1. "How do I book a cab?" returns ORIX and Cabman portal links
2. 24-hour advance booking requirement stated
3. Late-night transport arrangement process explained
4. Cancellation policy described

---

### US-ADMIN-003 — Parking Request
**Story:** As an employee, I want to ask AURA about parking facilities at the office, so that I know the process for getting a parking pass.

**Priority:** P2 | **Story Points:** 2

**Acceptance Criteria:**
1. Parking request process returned accurately
2. Facilities team (Fountainhead) contact provided
3. Waiting list process explained if parking full

---

### US-ADMIN-004 — Facility Booking
**Story:** As an employee, I want to ask AURA how to book a meeting room, so that I can reserve space for client meetings without contacting the admin team.

**Priority:** P1 | **Story Points:** 2

**Acceptance Criteria:**
1. Meeting room booking process returned
2. Booking portal or contact provided
3. Capacity and AV equipment information included
4. Fountainhead facility management contact provided

---

### US-ADMIN-005 — Microsoft Forms Creation
**Story:** As an HR admin, I want to create a Microsoft Form via AURA, so that I can quickly build surveys without manually navigating Microsoft Forms.

**Priority:** P1 | **Story Points:** 8

**Acceptance Criteria:**
1. "Create an employee satisfaction survey" triggers FormsDrawer
2. FormsDrawer allows form title, description, and up to 10 questions
3. Question types available: text, multiple choice, rating
4. "Create Form" button calls Graph API and creates the form
5. Form URL returned to user in drawer and chat
6. Created form accessible in user's Microsoft Forms portal

---

### US-ADMIN-006 — Admin Escalation
**Story:** As an employee, I want to escalate an unresolved admin issue, so that the admin team handles it with full context.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. Admin escalation type available in EscalationDrawer
2. Escalation linked to originating conversation
3. Admin can view in admin escalation view
4. Status tracking available

---

## Org Stories (US-ORG-001 through US-ORG-004)

### US-ORG-001 — Company Information
**Story:** As a new employee, I want to ask AURA about Aligned Automation's mission, values, and history, so that I understand the company culture.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What is Aligned Automation's mission?" returns mission statement from SharePoint
2. "What are the company values?" returns values list
3. "Tell me about Aligned Automation" returns company overview
4. Response cites company profile document
5. OrgDeepAgent handles the query

---

### US-ORG-002 — Org Chart
**Story:** As an employee, I want to ask AURA about the company's org structure, so that I understand reporting lines and department hierarchy.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What is the org structure?" returns high-level department hierarchy
2. Specific manager queries routed to EmployeeAgent
3. Response distinguishes between company-level structure (OrgAgent) and individual profiles (EmployeeAgent)
4. Source document cited

---

### US-ORG-003 — Company Announcements
**Story:** As an employee, I want to ask AURA about recent company announcements, so that I can stay informed without searching email archives.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What was the announcement about remote work?" returns announcement summary if ingested
2. If announcement not ingested, directs to company Teams channel
3. Source SharePoint document cited
4. Response includes date of announcement where available

---

### US-ORG-004 — Quick Links
**Story:** As an employee, I want quick-access links to frequently used portals in the AURA sidebar, so that I don't need to bookmark them separately.

**Priority:** P2 | **Story Points:** 2

**Acceptance Criteria:**
1. Quick links panel visible in RightPanel
2. Configured links: Zoho People, HROne, SharePoint, Outlook Web, OneDrive, Practo
3. Each link opens in new tab
4. Links render on all supported browsers
5. Configuration updates without code changes to platform core

---

## Employee Self-Service Stories (US-EMP-001 through US-EMP-006)

### US-EMP-001 — My Profile
**Story:** As an employee, I want to ask AURA about my own profile details, so that I can quickly verify my designation and manager without opening Zoho People.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. "What is my designation?" returns designation from Zoho People
2. "Who is my manager?" returns reporting manager name and email
3. "What department am I in?" returns department name
4. "What is my employee ID?" returns employee ID
5. Self-profile uses authenticated email to resolve, not JWT claims alone

---

### US-EMP-002 — My Attendance
**Story:** As an employee, I want to check my attendance records for this month and last month via AURA, so that I can verify my working hours without logging into a separate attendance system.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. "Show my attendance" returns current and previous month records
2. Each day shows: date, check-in time, check-out time, total working hours
3. Summary shows total days present, absent, late arrivals
4. Data sourced from AURA attendance table via Zoho People name resolution
5. Employee not found in Zoho People returns clear error message

---

### US-EMP-003 — Employee Lookup
**Story:** As an employee, I want to look up any colleague's contact details via AURA chat, so that I can reach them without asking around or searching directory.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. "Who is Prashant Dikonda?" returns full profile card
2. "Email of Maithili Joshi?" returns email address
3. "Mobile number of Amol Metkari?" returns mobile number
4. Profile includes: name, designation, department, email, mobile, work phone, manager, DOJ
5. Salary and PII guardrails applied (salary not disclosed)

---

### US-EMP-004 — Colleague Search
**Story:** As a manager, I want to search for employees by department or skill, so that I can find the right person for a project or collaboration.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. "Who works in the Engineering department?" returns all active employees in that department
2. "Employees with Python skills?" returns employees matching skill set
3. "How many employees are in Finance?" returns accurate headcount
4. Results include names, designations, and emails
5. Search is case-insensitive

---

### US-EMP-005 — Meeting Lookup
**Story:** As an employee, I want to ask AURA about my upcoming meetings, so that I can get a quick agenda without opening my calendar.

**Priority:** P2 | **Story Points:** 5

**Acceptance Criteria:**
1. Calendar read permission (Calendars.ReadBasic) granted via Azure Portal
2. "What are my meetings today?" returns today's meetings with title, time, location
3. Response shows start/end time, meeting title, and location
4. Event body not included (Calendars.ReadBasic scope limitation)
5. Graceful fallback if calendar permission not granted

---

### US-EMP-006 — Birthday Lookup
**Story:** As an employee, I want to ask AURA who has a birthday this month, so that I can wish my colleagues without tracking dates manually.

**Priority:** P2 | **Story Points:** 3

**Acceptance Criteria:**
1. "Who has a birthday this month?" returns names and dates
2. Work anniversaries queryable: "Who is having a work anniversary in June?"
3. Results from Zoho People date_of_birth and date_of_joining fields
4. No birthdate stored in AURA — queried from Zoho People on demand

---

## Analytics Stories (US-ANA-001 through US-ANA-004)

### US-ANA-001 — Admin Analytics Dashboard
**Story:** As an HR admin, I want to view the AURA analytics dashboard, so that I can understand usage patterns and identify knowledge gaps.

**Priority:** P1 | **Story Points:** 8

**Acceptance Criteria:**
1. Admin role required; non-admin gets HTTP 403
2. Dashboard loads with 10 chart types populated from real data
3. Date range filter (7/30/90 days) updates all charts simultaneously
4. Charts include: conversations per day, agent domain breakdown, feedback trend, escalation volume, document generation counts
5. Data is accurate to within 24 hours (not real-time)

---

### US-ANA-002 — COO Metrics Dashboard
**Story:** As the COO, I want to view executive-level AURA adoption metrics, so that I can measure the ROI of the AI platform investment.

**Priority:** P1 | **Story Points:** 8

**Acceptance Criteria:**
1. COO/executive role required; other roles get HTTP 403
2. Dashboard shows: total users, MAU, DAU, satisfaction score, escalation resolution rate
3. `GET /api/coo-analytics/metrics` responds in <2 seconds
4. Agent adoption breakdown shows usage % by domain (HR, IT, Admin, etc.)
5. All metrics sourced from real production data

---

### US-ANA-003 — Feedback Trend Analysis
**Story:** As an HR admin, I want to see feedback trends by agent domain, so that I can identify which agents are underperforming and need knowledge base improvement.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. Feedback analytics show positive/negative ratio by agent domain
2. Trend line shows feedback quality over selected date range
3. Agents with <60% positive feedback highlighted
4. Admin can drill into individual feedback records
5. Feedback values: 1 (positive), -1 (negative), 0 (neutral)

---

### US-ANA-004 — Query Pattern Analysis
**Story:** As a platform admin, I want to see the top query types and unanswered query rate, so that I can prioritize knowledge base expansion.

**Priority:** P2 | **Story Points:** 5

**Acceptance Criteria:**
1. Top 10 query categories shown by volume
2. QuickAgent fallback rate visible (% of queries with no domain match)
3. Trend over date range shown on line chart
4. Data helps identify which new SharePoint documents to ingest

---

## Platform Stories (US-PLAT-001 through US-PLAT-005)

### US-PLAT-001 — SSO Login
**Story:** As an employee, I want to log into AURA using my Aligned Automation Microsoft account, so that I don't need a separate username and password.

**Priority:** P0 | **Story Points:** 5

**Acceptance Criteria:**
1. Unauthenticated users redirected to Microsoft login page
2. Post-login redirected back to AURA with active session
3. MFA enforced via Azure Conditional Access (no additional code)
4. Session stored in sessionStorage (not shared across tabs)
5. Name and email populated from Azure AD ID token

---

### US-PLAT-002 — Conversation History
**Story:** As an employee, I want to see my previous AURA conversations in the sidebar, so that I can refer back to past answers without re-asking.

**Priority:** P1 | **Story Points:** 5

**Acceptance Criteria:**
1. Sidebar shows list of conversations sorted by last updated
2. Clicking conversation loads full message history
3. Conversations searchable by title in Sidebar
4. Conversation title editable (rename via PATCH /api/conversations/{id})
5. Conversations soft-deletable from sidebar (delete button)

---

### US-PLAT-003 — Feedback Submission
**Story:** As an employee, I want to give thumbs up or thumbs down on any AURA response, so that I can signal response quality and help improve the platform.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. Thumbs up/down buttons visible on every AI response in MessageBubble
2. Clicking thumbs up stores feedback value=1
3. Clicking thumbs down stores feedback value=-1
4. Clicking same button again retracts feedback (value=0)
5. Feedback UI updates immediately (optimistic update)

---

### US-PLAT-004 — Streaming Response
**Story:** As an employee, I want AI responses to stream word-by-word, so that I can start reading immediately rather than waiting for the full response.

**Priority:** P0 | **Story Points:** 5

**Acceptance Criteria:**
1. First visible text appears within 1 second of sending a message
2. Text builds progressively (not a single block load)
3. HTML formatting (bold, lists, links) renders correctly as stream arrives
4. Thinking phrases animate while waiting for first chunk
5. Stream handles disconnection gracefully (no browser console errors)

---

### US-PLAT-005 — Conversation Rename and Delete
**Story:** As an employee, I want to rename and delete conversations in AURA, so that I can keep my chat history organized.

**Priority:** P1 | **Story Points:** 3

**Acceptance Criteria:**
1. Rename: Double-click conversation title in Sidebar to edit
2. Rename: PATCH /api/conversations/{id} updates title in DB
3. Delete: Delete button/icon visible on hover in Sidebar
4. Delete: DELETE /api/conversations/{id} performs soft-delete (is_deleted=true)
5. Deleted conversation no longer appears in Sidebar list
6. Conversation history still accessible to admin for audit purposes

---

## Story Point Summary by Domain

| Domain | Stories | Total Points |
|--------|---------|-------------|
| HR | 10 | 44 |
| IT | 8 | 23 |
| Admin | 6 | 20 |
| Org | 4 | 11 |
| Employee Self-Service | 6 | 26 |
| Analytics | 4 | 26 |
| Platform | 5 | 21 |
| **Total** | **43** | **171** |

---

## Prioritization Summary

| Priority | Count | % of Total |
|----------|-------|-----------|
| P0 | 10 | 23% |
| P1 | 26 | 60% |
| P2 | 7 | 16% |

P0 stories represent the minimum viable product: core authentication, chat, HR policy lookup, document generation, escalation, onboarding, and SSO login.
