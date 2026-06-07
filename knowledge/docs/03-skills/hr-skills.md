# HR Skills — AA-Hackathon Enterprise AI Platform

## 1. Purpose

This document defines all HR domain skills available on the platform. Each skill is specified using the full template from [skills-framework.md](./skills-framework.md).

HR skills are primarily served by **HRAgent** (`hr_agent.py`), with specialized routing to **DocumentAgent**, **EscalationAgent**, and **AttendanceAgent** for specific intents.

---

## 2. Skill: hr-leave-inquiry

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-leave-inquiry` |
| **Skill Name** | Leave Balance & Types Inquiry |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | HRAgent |
| **Minimum Role** | employee |
| **Trigger Type** | keyword-routing |
| **Latency SLA** | < 5s |
| **Streaming** | Yes |

**Business Purpose:** Employees often do not know their leave entitlements, types, or policies. This skill answers leave-related questions from company policy documents indexed in pgvector.

**Intent Phrases:**
- "What is my leave balance?"
- "How many casual leaves do I get?"
- "What are the types of leaves available?"
- "Can I carry forward my annual leave?"
- "What is the maternity leave policy?"
- "How do I encash leave?"
- "Is sick leave paid?"

**Inputs:**
| Name | Type | Required | Source | Description |
|------|------|----------|--------|-------------|
| query | string | Yes | user | Natural language leave question |
| user_id | UUID | Yes | JWT context | Authenticated user |

**Outputs:**
```
Format: HTML
Fields:
  - answer: HTML string with leave policy details
  - sources: [{document_name, source_url, similarity}]
  - note: "For your actual balance, check Zoho People"
```

**Retrieval Strategy:** pgvector cosine search on HR policy document chunks. Adaptive retry if first search returns < 3 results. FAISS fallback if pgvector unavailable.

**Fallback Strategy:**
1. Adaptive query simplification + pgvector retry
2. FAISS local knowledge base
3. Static response: "For leave balance, please check Zoho People at [link]. For policy questions, contact hr@alignedautomation.com"

**Examples:**

*Example 1:*
- Input: "How many annual leaves do I have?"
- Output: HTML explaining 18 annual leaves per year, accrual policy, carry-forward rules, sourced from HR Leave Policy PDF

*Example 2:*
- Input: "What is the paternity leave policy?"
- Output: HTML explaining 15 days paternity leave, eligibility (married male employees), documentation required

*Example 3:*
- Input: "Can I take leave without pay?"
- Output: HTML explaining LWP policy, approval requirements, payroll impact

---

## 3. Skill: hr-leave-apply-guide

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-leave-apply-guide` |
| **Skill Name** | Leave Application Guide |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | HRAgent (via MasterAgent fast-path) |
| **Minimum Role** | employee |
| **Trigger Type** | regex-fastpath |
| **Latency SLA** | < 500ms |
| **Streaming** | No |

**Business Purpose:** Leave applications are processed in Zoho People. The platform redirects employees to the correct portal with instructions, eliminating repeated "how do I apply for leave?" queries.

**Fast-Path Regex:** `r'apply.{0,20}leave|leave.{0,20}apply|request.{0,20}leave|take.{0,10}leave'`

**Intent Phrases:**
- "How do I apply for leave?"
- "I want to apply for leave"
- "Apply for casual leave"
- "Take leave for 3 days"

**Output:**
```html
<div>
  <p>To apply for leave, please visit <a href="https://people.zoho.com">Zoho People</a>.</p>
  <ol>
    <li>Log in with your company credentials</li>
    <li>Go to <strong>Leave</strong> → <strong>Apply Leave</strong></li>
    <li>Select leave type, dates, and reason</li>
    <li>Submit for manager approval</li>
  </ol>
  <p>Need help? Contact <a href="mailto:hr@alignedautomation.com">HR</a>.</p>
</div>
```

---

## 4. Skill: hr-payroll-inquiry

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-payroll-inquiry` |
| **Skill Name** | Payroll & Salary Inquiry |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | HRAgent |
| **Minimum Role** | employee |
| **Trigger Type** | keyword-routing |
| **Latency SLA** | < 5s |

**Business Purpose:** Employees have questions about salary structure, components, deductions, and payroll schedules. This skill answers from company payroll policy documents.

**Intent Phrases:**
- "How is my salary calculated?"
- "What is HRA?"
- "When is salary credited?"
- "What deductions are made from my salary?"
- "What is the pay structure?"
- "How is PF calculated?"

**Important Constraint:** This skill answers POLICY questions only. It does NOT expose individual salary figures (access to Zoho Finance is restricted).

**Retrieval Strategy:** pgvector search on HR payroll policy documents from SharePoint.

**Fallback:** hr@alignedautomation.com

---

## 5. Skill: hr-tax-inquiry

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-tax-inquiry` |
| **Skill Name** | Tax & TDS Inquiry |
| **Domain** | HR / Finance |
| **Status** | active |
| **Owning Agent** | HRAgent (general) / FinanceAgent (detailed) |
| **Minimum Role** | employee |
| **Trigger Type** | keyword-routing |
| **Latency SLA** | < 5s |

**Intent Phrases:**
- "How is TDS calculated?"
- "When will I get Form 16?"
- "What is Section 80C?"
- "Tax saving investments for salaried employees"
- "How to submit investment declaration?"

**Retrieval Strategy:** pgvector search on tax policy and payroll documents. Finance domain keywords route deeper queries to FinanceAgent.

---

## 6. Skill: hr-benefit-inquiry

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-benefit-inquiry` |
| **Skill Name** | Employee Benefits Inquiry |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | HRAgent |
| **Minimum Role** | employee |
| **Trigger Type** | keyword-routing |
| **Latency SLA** | < 5s |

**Intent Phrases:**
- "What health insurance do we have?"
- "How much PF does the company contribute?"
- "Am I eligible for gratuity?"
- "Tell me about NPS scheme"
- "What is the group mediclaim coverage?"

**Benefits covered:**
- Group health insurance (employee + family coverage)
- Provident Fund (12% employee + 12% employer)
- Gratuity (15 days × years of service, after 5 years)
- NPS (National Pension System, optional)

---

## 7. Skill: hr-policy-lookup

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-policy-lookup` |
| **Skill Name** | HR Policy Search |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | HRAgent |
| **Minimum Role** | employee |
| **Trigger Type** | keyword-routing |
| **Latency SLA** | < 5s |
| **Streaming** | Yes |

**Business Purpose:** HR policies are stored in SharePoint and indexed in pgvector. Employees can ask any policy question and get an answer sourced from the official document.

**Intent Phrases:**
- "What is the WFH policy?"
- "Code of conduct policy"
- "Anti-harassment policy"
- "Probation period policy"
- "Performance appraisal process"
- "Transfer policy"

**Retrieval Strategy:** pgvector cosine search → FAISS fallback → link to SharePoint document library.

**Source Citation:** Response includes `source_url` pointing to the SharePoint document.

---

## 8. Skill: hr-document-generate

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-document-generate` |
| **Skill Name** | HR Document Generation |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | DocumentAgent |
| **Minimum Role** | employee |
| **Trigger Type** | regex-fastpath |
| **Latency SLA** | < 15s total (multi-turn) |
| **Streaming** | Yes (per turn) |

**Business Purpose:** Employees frequently need official HR letters and certificates. This skill conducts a guided multi-turn conversation to collect required information and generates the document.

**Supported Document Types (11):**
1. Loan Proof / Employment Verification
2. Experience Letter
3. Offer Letter
4. Relieving Letter
5. NOC (No Objection Certificate)
6. Bonafide Certificate
7. Promotion Letter
8. Address Proof
9. Internship Certificate
10. Confirmation Letter (post-probation)
11. ID Card Request

**Intent Phrases:**
- "I need an experience letter"
- "Generate loan proof letter"
- "Employment certificate for bank"
- "I need a NOC letter"
- "Bonafide certificate"

**Multi-turn Session Flow:**
1. Detect document type from initial request
2. Ask for required fields (name, employee ID, purpose, date range, etc.)
3. Confirm fields with user
4. Generate document via Ollama
5. Save to DB, return download link

**API:** `POST /api/documents/generate` → `GET /api/documents/{id}/download`

---

## 9. Skill: hr-onboarding-guidance

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-onboarding-guidance` |
| **Skill Name** | Onboarding Portal |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | OnboardingService |
| **Minimum Role** | employee |
| **Trigger Type** | explicit-api |
| **Latency SLA** | < 2s |

**Business Purpose:** New employees complete a structured 8-step onboarding process through the OnboardingGuidancePage.jsx module.

**8 Onboarding Steps:**
1. **Welcome** — Platform intro, capabilities, first actions
2. **Profile** — Complete employee profile in Zoho + Azure AD
3. **Team** — Meet team members, reporting manager, org chart
4. **IT Access** — Laptop, accounts, VPN, Microsoft 365, required tools
5. **Documents** — Submit ID proof, address proof, education certs, bank details
6. **Policy** — Acknowledge code of conduct, anti-harassment, data privacy
7. **Induction** — Complete mandatory induction training modules
8. **All Set** — Completion confirmation, HR notification

**API:** `GET /api/onboarding/steps`

---

## 10. Skill: hr-escalation

| Field | Value |
|-------|-------|
| **Skill ID** | `hr-escalation` |
| **Skill Name** | HR Issue Escalation |
| **Domain** | HR / Escalation |
| **Status** | active |
| **Owning Agent** | EscalationAgent |
| **Minimum Role** | employee |
| **Trigger Type** | regex-fastpath |
| **Latency SLA** | < 1s (form display) |

**Intent Phrases:**
- "I want to escalate an HR issue"
- "Raise a grievance"
- "HR complaint"
- "File a complaint against my manager"

**Output:** Opens EscalationDrawer.jsx with form pre-populated with type=HR.
Records to `escalations` table with `escalation_type='HR'`.
Fallback contact: hr@alignedautomation.com

---

## 11. Skill: attendance-lookup

| Field | Value |
|-------|-------|
| **Skill ID** | `attendance-lookup` |
| **Skill Name** | Attendance Records |
| **Domain** | HR |
| **Status** | active |
| **Owning Agent** | AttendanceAgent |
| **Minimum Role** | employee |
| **Trigger Type** | regex-fastpath |
| **Latency SLA** | < 3s |

**Business Purpose:** Employees and managers query attendance data from Zoho People.

**Intent Phrases:**
- "My attendance this month"
- "Check my attendance"
- "How many days was I present in May?"
- "My team's attendance" (manager only)
- "Reportee attendance" (manager only)

**Data Source:** Zoho People DB (`ZOHO_DB` connection, read-only)
**API:** `GET /api/attendance`, `GET /api/attendance/reportee?reportee_email=X`

**Calculated Fields:**
- Total working days in period
- Days present (full + half)
- Total hours worked
- Status per day: full-day (>6hrs), half-day (3-6hrs), absent (<3hrs)

---

## 12. Governance

| Activity | Owner | Frequency |
|----------|-------|-----------|
| Policy document updates in SharePoint | HR Team | As needed |
| SharePoint ingestion re-run | Engineering | Weekly or on change |
| Benchmark query evaluation | AI Platform | Bi-weekly |
| Leave/payroll policy version review | HR + Engineering | Per policy change |
| Document template updates | HR Team | Per change |

---

## 13. Cross-References

- [HR Agent](../04-agents/hr-agent.md)
- [Document Agent](../04-agents/document-agent.md)
- [Escalation Agent](../04-agents/escalation-agent.md)
- [HR Domain Ontology](../02-ontology/hr-domain.md)
- [SharePoint Ingestion](../08-data/sharepoint-ingestion.md)
