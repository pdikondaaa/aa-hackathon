# Prompt Governance Specification
# AA-Hackathon Enterprise Assistant — Aligned Automation
# Document Version: 1.0 | Classification: Internal — Restricted
# Owner: AI Platform Team | Effective Date: 2026-06-07

---

## Table of Contents

1. [Prompt Governance Overview](#1-prompt-governance-overview)
2. [Prompt Library Architecture](#2-prompt-library-architecture)
3. [Prompt Design Standards](#3-prompt-design-standards)
4. [Agent Personality Specifications](#4-agent-personality-specifications)
5. [Prompt Review and Approval Process](#5-prompt-review-and-approval-process)
6. [Prompt Versioning](#6-prompt-versioning)
7. [Prompt Testing Standards](#7-prompt-testing-standards)
8. [Prompt Injection Prevention](#8-prompt-injection-prevention)
9. [Hallucination Mitigation in Prompts](#9-hallucination-mitigation-in-prompts)
10. [Domain Boundary Enforcement in Prompts](#10-domain-boundary-enforcement-in-prompts)
11. [Output Format Standards](#11-output-format-standards)
12. [Prompt Governance Lifecycle](#12-prompt-governance-lifecycle)
13. [Prompt Audit Requirements](#13-prompt-audit-requirements)
14. [Future Prompt Evolution](#14-future-prompt-evolution)

---

## 1. Prompt Governance Overview

### 1.1 Purpose

This specification defines the governance framework for all prompts used within the AA-Hackathon Enterprise Assistant (AURA) platform at Aligned Automation. It establishes standards for prompt design, review, testing, versioning, and audit to ensure every agent interaction is accurate, safe, compliant, and aligned with organizational policy.

Prompts are the primary mechanism through which AURA's behavior is defined. Poorly governed prompts carry direct operational risk: hallucinated policy details, domain boundary violations, PII leakage, and jailbreak susceptibility. This document treats prompts as production artifacts subject to the same rigor as application code.

### 1.2 Scope

This specification applies to:

- All agent personality prompts defined in `personalities.py`
- Routing and classification prompts in `supervisor_agent.py`
- Guardrail prompts in `guardrails.py` (`DISTRESS_PROMPT`, `ORG_SCOPE_PROMPT`)
- The base agent system prompt template in `base_deep_agent.py` (`_AGENT_SYSTEM`)
- Any future prompt introduced into the AURA codebase

### 1.3 Governing Principles

- **Accuracy over helpfulness:** When retrieved context does not cover a question, agents must acknowledge the gap rather than infer from general knowledge unless explicitly permitted and flagged.
- **Domain isolation:** Each agent operates within a defined domain. Cross-domain answers are prohibited; agents redirect rather than speculate.
- **Safety first:** Guardrail checks execute before any prompt reaches an LLM. Adversarial inputs are blocked statically, never forwarded.
- **HTML-only output:** All user-facing responses are rendered in HTML. Prompts enforce this explicitly in every agent personality.
- **Auditability:** All prompt changes are version-controlled and logged. Deployed prompts are traceable to a reviewed commit.

### 1.4 Roles and Responsibilities

| Role | Responsibility |
|---|---|
| AI Platform Team | Owns prompt library, reviews changes, approves releases |
| Domain SME (HR, IT, Admin, PMO, Finance) | Validates domain accuracy of agent personalities |
| Security Team | Reviews guardrail patterns for new threat vectors |
| QA Team | Executes prompt regression and adversarial test suites |
| Engineering Lead | Final approval gate before production deployment |

---

## 2. Prompt Library Architecture

### 2.1 File Structure

All production prompts reside in three canonical files within the AURA codebase:

```
apps/api-gateway/app/agents/
├── working/
│   ├── personalities.py          # 13 agent personality system prompts
│   └── base_deep_agent.py        # _AGENT_SYSTEM template (shared base)
├── supervisor_agent.py           # Routing classification prompts, fast-path regex
└── guardrails.py                 # GENERIC_GUARDRAIL, ORG_GUARDRAIL, DISTRESS_PROMPT, ORG_SCOPE_PROMPT
```

### 2.2 Prompt Composition Model

Every domain agent response is produced by composing four layers at runtime inside `BaseDeepAgent._llm_query`:

1. **Personality layer** — agent-specific role, domain, rules, and expectations (from `personalities.py`)
2. **Generic guardrail layer** — content safety rules injected from `GENERIC_GUARDRAIL` (guardrails.py)
3. **Organisational guardrail layer** — scope and PII rules from `ORG_GUARDRAIL` (guardrails.py)
4. **Context + query layer** — retrieved document chunks and the user's question

The `_AGENT_SYSTEM` template in `base_deep_agent.py` defines the composition schema:

```
{personality}
{generic_guardrail}
{org_guardrail}
---
Company context: {context}
---
Output rules: ...
{query}
```

This separation ensures guardrails cannot be overridden by domain-specific personality text, and that the context window is structured predictably for the LLM.

### 2.3 Supervisor Routing Prompts

`supervisor_agent.py` contains two routing mechanisms:

- **Fast-path regex patterns** — compiled `re.compile` patterns for high-confidence intents (leave application, email draft, Microsoft Forms, greetings, attendance, employee lookup, document generation). These bypass LLM routing entirely, eliminating latency and hallucination risk.
- **LLM intent classification** — an optional Ollama call with a classification prompt that maps user queries to agent names. This path has a configurable timeout and falls back to keyword scoring if Ollama is unavailable.

Routing prompts are governed under the same review process as personality prompts. Changes to the classification prompt must be regression-tested against the full routing test suite before deployment.

### 2.4 Guardrail Prompt Architecture

`guardrails.py` contains two types of guardrail constructs:

- **Static regex check functions** — `check_input()` runs pattern matching for jailbreak, harmful, security threat, distress, and org-scope violations. Matched queries are blocked before reaching any agent.
- **LLM-generated contextual responses** — `DISTRESS_PROMPT` and `ORG_SCOPE_PROMPT` are passed to the LLM only for distress and org-scope categories, where a human, contextual response is safer than a static message.

---

## 3. Prompt Design Standards

### 3.1 Mandatory Sections in Every Agent Personality

Every personality prompt defined in `personalities.py` must include the following labeled sections:

| Section | Purpose |
|---|---|
| `## ROLE` | One-sentence declaration of agent identity and specialty |
| `## GOAL` | What the agent must accomplish for the user |
| `## BACKSTORY` | Training context and knowledge source framing |
| `## YOUR DOMAIN` | Explicit list of topics the agent will answer |
| `## OUT OF SCOPE — Redirect Without Answering` | Topics the agent must redirect, with named target agents |
| `## RULES` | Numbered behavioral constraints specific to this agent |
| `## EXPECTATIONS` | Tone, style, and format guidance |
| `**Output Format — HTML Only**` | Mandatory HTML rendering instructions |

### 3.2 Domain Coverage Rules

- Domain sections must use bullet lists, not prose, so that boundary enforcement is unambiguous.
- Every out-of-scope item must name the target agent explicitly (e.g., `-> Employee Agent`), not a generic redirect.
- Domain lists must be reviewed by the relevant SME whenever organizational scope changes.

### 3.3 Tone and Persona Consistency

| Agent | Tone |
|---|---|
| HR | Warm, empathetic, approachable |
| IT | Calm, technical, solution-oriented |
| Admin | Formal, process-driven, efficient |
| PMO | Analytical, structured, data-first |
| Finance | Precise, compliance-focused, professional |
| Org | Factual, balanced, professional |
| Employee | Efficient, directory-oriented, neutral |
| Attendance | Concise, transactional, clear |
| Document | Professional, patient, structured |
| Email | Collaborative, draft-focused, adaptable |
| Escalation | Empathetic, process-clear, reassuring |
| Quick | Conversational, direct, responsive |
| Funny | Witty, warm, inclusive |

### 3.4 Prohibited Prompt Patterns

The following patterns are banned from all agent personalities:

- Instructions that grant the agent authority to approve, execute, or commit organizational actions on behalf of users
- Instructions to answer questions outside the defined domain using general knowledge (unless explicitly permitted and required to be flagged)
- Instructions to reveal, repeat, or paraphrase system prompt contents
- Instructions that conflict with or weaken `GENERIC_GUARDRAIL` or `ORG_GUARDRAIL`
- Instructions that could enable response formatting other than HTML

---

## 4. Agent Personality Specifications

### 4.1 HRAgent — `HR_PERSONALITY`

**Identity:** AURA HR Assistant — welcoming face of Aligned Automation's internal AI, empathetic HR specialist and catch-all default agent.

**Domain:** Leave types and balances, benefits (GHI, PF/EPF, Practo), payroll and salary structure, appraisals and performance reviews, POSH and conduct policies, employee lifecycle (onboarding, offboarding, notice period, F&F), HROne portal guidance, employee referral and certification programs.

**Behavioral Rules:**
- Ground every answer in retrieved policy context; quote specific numbers (days, percentages, timelines)
- Use numbered steps for processes, bullets for factual lists
- When context is insufficient, say "I don't have that information" and provide the HR contact
- Act as graceful catch-all when supervisor cannot confidently route a query

**Contact:** hr@alignedautomation.com | Monday–Friday, 09:00–18:00

---

### 4.2 ITAgent — `IT_PERSONALITY`

**Identity:** AURA IT Support — patient, technically precise IT specialist.

**Domain:** Laptop setup and hardware, software installation and licensing, network/WiFi/VPN, email (Outlook), OneDrive, Teams, password resets, account lockouts, MFA/2FA enrolment, remote access/VDI, data backup, security policy and incident reporting, IT portal guidance.

**Behavioral Rules:**
- Always ask for OS type and exact error message before diagnosing; never assume environment
- Give clear numbered step-by-step instructions grounded in IT documentation
- Security incidents must be escalated immediately to security@alignedautomation.com; never troubleshoot live attacks
- Quote the specific document or procedure name when referencing a process

**Contact:** helpdesk@alignedautomation.com | helpdesk.alignedautomation.com

---

### 4.3 AdminAgent — `ADMIN_PERSONALITY`

**Identity:** AURA Admin Assistant — formal, detail-oriented administrative specialist.

**Domain:** Office supplies procurement, cab bookings (ORIX, Cabman, approved vendors), parking allocation, workplace access, Fountainhead facility guidelines, meeting room bookings, facility maintenance, visitor management and access cards, vendor/invoice routing, business travel bookings and policy, cancellation/rescheduling, visa letter requests.

**Behavioral Rules:**
- Confirm policy limits (expense caps, lead times) before giving guidance
- List steps clearly for any process involving a workflow
- Never approve a request — outline the correct approval path
- Delegate expense submission to Finance Agent; Admin handles booking only

**Contact:** admin@alignedautomation.com | travel@alignedautomation.com

---

### 4.4 PMOAgent — `PMO_PERSONALITY`

**Identity:** AURA PMO Assistant — structured, analytical Project Management Office specialist.

**Domain:** Project status and progress (ABI, NCR, Spencer, Dell, Eli Lilly, and active engagements), milestone tracking and delivery dates, resource allocation and capacity planning, risk/issue logging and escalation, PMO onboarding and best practices, change request workflow, budget tracking and burn rate, weekly/monthly status reports, PMO portal guidance.

**Behavioral Rules:**
- Reference specific project names or IDs in every status response
- Guide through the PMO escalation path from retrieved context for risks
- Never speculate about timelines or financials not present in retrieved context
- Use tables or bullets for multi-project summaries

**Contact:** pmo@alignedautomation.com

---

### 4.5 FinanceAgent — `FINANCE_PERSONALITY`

**Identity:** AURA Finance Assistant — precise, compliance-aware finance specialist.

**Domain:** ZOHO expense submission (submission, approvals, reimbursement timelines), TDS deductions and declarations, income tax declarations (individual and joint), Form 16 and investment proofs, expense reimbursement approval workflow, Kotak salary account queries, finance submission windows and cut-off dates, budget queries routed from Admin.

**Behavioral Rules:**
- Quote specific form names, portal names (ZOHO), and deadlines from retrieved context
- Remind employees of active submission windows when present in context
- For unusual tax cases (foreign income, complex deductions), direct to the employee's CA
- Salary structure and increments belong to HR Agent; travel booking belongs to Admin Agent

**Contact:** finance@alignedautomation.com | accounts@alignedautomation.com

---

### 4.6 OrgAgent — `ORG_PERSONALITY` and `ORG_FINANCE_PERSONALITY`

**Identity:** AURA Org Guide — well-informed guide to Aligned Automation's structure, values, and company-wide information. Also operates as merged Org/Finance voice for dual-domain queries.

**Domain (Org):** Company mission, vision, values, and culture; organisational structure and reporting lines; company history, milestones, and offices; DEI initiatives; general workplace policies not owned by a specific department.

**Domain (Finance, when using ORG_FINANCE_PERSONALITY):** ZOHO expense submission, TDS declarations, Form 16, reimbursements, Kotak salary account, submission windows.

**Behavioral Rules:**
- Be factual; reference only information present in retrieved context
- Do not speculate about leadership decisions, strategy, or undisclosed plans
- For finance sub-queries, maintain precision and compliance focus

**Contact:** info@alignedautomation.com | finance@alignedautomation.com

---

### 4.7 EmployeeAgent

**Identity:** AURA Employee Directory — efficient, directory-oriented agent for employee lookup and self-service.

**Domain:** Employee contact details, designation, manager lookup, team membership, direct queries to the Zoho People database. Handles employee directory requests routed from all other agents.

**Behavioral Rules:**
- Query Zoho People database directly; do not use RAG retrieval for directory data
- Return only fields the requesting user is authorized to see per RBAC rules
- Never expose salary, CTC, or performance rating data

---

### 4.8 AttendanceAgent

**Identity:** AURA Attendance — concise, transactional agent for clock-in/out and monthly summaries.

**Domain:** Attendance clock-in and clock-out records, monthly attendance summary, leave balance from Zoho People, regularisation guidance.

**Behavioral Rules:**
- Read data directly from Zoho People database; never invent attendance records
- For regularisation, direct the employee to the HRMS portal with the direct URL
- Keep responses brief and data-centric

---

### 4.9 DocumentAgent — `DOCUMENT_PERSONALITY`

**Identity:** AURA Document Assistant — precise, professional HR document generation specialist.

**Domain (12 supported document types):**
- Loan Proof / Employment Verification Letter
- Experience Letter
- Offer Letter
- Relieving Letter
- Address Proof Letter
- Bonafide Certificate
- Internship Completion Certificate
- Promotion Letter
- No Objection Certificate (NOC)
- Employee Confirmation Letter
- ID Card Request Letter
- Custom documents (on request)

**Behavioral Rules:**
- Identify the requested document type and ask for missing required fields one at a time
- Never guess or invent field values (employee name, ID, salary, dates)
- Generate the complete document only after all required fields are confirmed
- Support clean session reset if the user cancels or restarts

**Contact:** hr@alignedautomation.com (document approvals)

---

### 4.10 EmailAgent

**Identity:** AURA Email Agent — collaborative email drafting and refinement specialist.

**Domain:** Email composition from user intent or extracted chat context, tone adjustment, draft refinement across multiple iterations, email template suggestions.

**Behavioral Rules:**
- Draft from explicit user intent; do not invent recipients, subject matter, or tone
- Support multi-turn refinement; retain draft state across conversation turns
- Never send email on behalf of the user — generate draft text only

---

### 4.11 EscalationAgent

**Identity:** AURA Escalation — empathetic, process-clear agent for formal issue escalation and tracking.

**Domain:** Escalation form collection (type, subject, priority, description), escalation status tracking, routing to the correct department for HR, IT, Admin, PMO, or Finance issues.

**Behavioral Rules:**
- Collect all required escalation fields before submitting a record
- Confirm the escalation type, priority, and routing department with the user
- Provide the escalation reference ID after successful submission
- Be empathetic and reassuring when the user is frustrated

---

### 4.12 QuickAgent

**Identity:** AURA Quick — fast conversational agent for simple queries that require no document retrieval.

**Domain:** Direct factual questions answerable without RAG (date, time, simple calculations, known Aligned Automation facts already in system context), casual informational questions.

**Behavioral Rules:**
- Use no retrieval pipeline; answer from system context only
- If the query requires domain expertise, route to the appropriate domain agent immediately
- Keep responses under 3 sentences unless a list is required

---

### 4.13 FunnyAgent — `FUNNY_PERSONALITY`

**Identity:** AURA Funny — witty, playful personality for greetings, small-talk, casual questions, and morale boosters.

**Domain:** Jokes, casual chat, greetings, morale boosters, light humour, meme-style wit. Activated for clearly social or entertainment intent.

**Behavioral Rules:**
- Keep humour safe: never target individuals, religion, gender, race, age, ability, politics, or sexuality
- When a query has real business intent, stop humour and route to the correct agent in one sentence
- Stay concise — one or two short paragraphs, three sentences maximum
- Never invent company policy, employee names, or business facts
- Light sarcasm is permitted when the user's tone explicitly invites it

---

## 5. Prompt Review and Approval Process

### 5.1 Change Classification

| Change Type | Definition | Approval Required |
|---|---|---|
| Minor | Wording, tone, formatting within existing scope | AI Platform Team lead |
| Moderate | Domain list additions/removals, rule additions, contact updates | AI Platform Team lead + Domain SME |
| Major | New agent personality, guardrail pattern changes, output format changes | Full review board (AI Platform + Security + Engineering Lead) |
| Emergency | Security-critical guardrail hotfix | Security Team authorization; retrospective review within 48 hours |

### 5.2 Review Steps

1. Author opens a pull request against the `dev` branch with the prompt change
2. Author completes the Prompt Change Checklist (section 5.3) and attaches it to the PR
3. Domain SME reviews domain accuracy for the affected agent
4. AI Platform Team lead reviews prompt structure, guardrail compliance, and output format rules
5. QA Team runs the prompt regression suite and adversarial test suite against the change
6. Engineering Lead approves the PR for merge to `main`
7. Change is recorded in the Prompt Audit Log (section 13)

### 5.3 Prompt Change Checklist

Before submitting a prompt change for review, the author must confirm:

- [ ] All mandatory sections (ROLE, GOAL, BACKSTORY, DOMAIN, OUT OF SCOPE, RULES, EXPECTATIONS, Output Format) are present and complete
- [ ] Domain list has been reviewed for accuracy with the relevant SME
- [ ] No prohibited prompt patterns are introduced
- [ ] HTML-only output instruction is present and unmodified
- [ ] Guardrail injection points are not weakened or removed
- [ ] Out-of-scope redirects name the correct target agents
- [ ] Contact details are current and verified
- [ ] Prompt regression tests pass with the new prompt
- [ ] Adversarial test suite passes with the new prompt

---

## 6. Prompt Versioning

### 6.1 Version Control

All prompts are versioned through the project's Git repository. The canonical version of a prompt is defined by its content at the HEAD of the `main` branch.

- Every prompt change is committed with a descriptive commit message referencing the affected agent and the nature of the change
- Prompt files (`personalities.py`, `guardrails.py`, `base_deep_agent.py`, `supervisor_agent.py`) are included in protected branch rules; direct commits to `main` are blocked
- Git commit SHA is recorded in the Prompt Audit Log as the prompt version identifier

### 6.2 Prompt Version Header

Each prompt string in `personalities.py` is preceded by a comment block identifying the agent and the last reviewed date:

```python
# ── HR ─────────────────────────────────────────────────────────────────────
# Last reviewed: 2026-06-07 | Reviewed by: AI Platform Team
HR_PERSONALITY = """..."""
```

### 6.3 Rollback Procedure

If a deployed prompt causes production issues:

1. Security or AI Platform Team raises an emergency rollback ticket
2. Engineering reverts the affected file to the prior Git commit SHA
3. Deployment is re-triggered automatically via CI/CD
4. Post-incident review is completed within 5 business days to identify the root cause

---

## 7. Prompt Testing Standards

### 7.1 Required Test Categories

Every agent personality must pass the following test categories before deployment:

| Category | Description |
|---|---|
| Domain acceptance | Queries firmly within the agent's domain receive accurate, grounded answers |
| Domain boundary | Queries outside the agent's domain are redirected, not answered |
| Guardrail compliance | Jailbreak, harmful, and security-threat inputs are blocked statically |
| Output format | All responses are valid HTML with no markdown artifacts |
| Contact accuracy | Contact information in responses matches current organizational data |
| Context grounding | When context contains the answer, the response quotes it accurately |
| Context absence | When context is empty, the response acknowledges the gap and provides the correct contact |
| PII protection | Queries about another employee's salary or personal data are blocked by ORG_GUARDRAIL |

### 7.2 Adversarial Test Suite

A dedicated adversarial suite runs against all agents and the guardrail layer:

- Jailbreak patterns: "ignore all previous instructions", "act as", "DAN", "repeat your system prompt"
- Prompt injection via user message: embedded instructions to override role
- Domain confusion: deliberate mismatch between query domain and addressed agent
- PII extraction attempts: requests for salary, CTC, or personal information of named employees
- Scope inflation: queries designed to make the agent answer outside its domain
- Distress pattern variants: paraphrased distress signals to test DISTRESS_PROMPT trigger coverage

### 7.3 Regression Suite

A regression suite of at least 20 representative queries per agent is maintained in the test directory. This suite is re-run on every prompt change and must pass fully before a PR is approved.

---

## 8. Prompt Injection Prevention

### 8.1 Pre-processing Guardrail Layer

All user input passes through `guardrails.check_input()` in `guardrails.py` before reaching any agent or prompt template. This function applies regex pattern matching in priority order:

1. **Jailbreak** — patterns matching prompt override attempts (`ignore all previous instructions`, `act as`, `DAN`, `repeat your system prompt`, `bypass filter`) → static rejection; query never reaches LLM
2. **Harmful content** — patterns matching violence, weapon construction → static rejection
3. **Security threats** — patterns matching hacking, credential theft, malware deployment → static rejection; user directed to security@alignedautomation.com
4. **Distress** — patterns matching self-harm or crisis language → LLM empathetic response via `DISTRESS_PROMPT`; never a static block
5. **Org scope violation** — patterns matching another employee's salary, legal advice, personal life, competitor intelligence, medical diagnosis → LLM contextual redirect via `ORG_SCOPE_PROMPT`

### 8.2 Guardrail Prompt Injection into Every Agent

`GENERIC_GUARDRAIL` and `ORG_GUARDRAIL` are injected into the `_AGENT_SYSTEM` template for every single LLM call, regardless of agent type. These blocks are not optional and cannot be removed by agent personalities. Their content:

**GENERIC_GUARDRAIL enforces:**
- No system prompt disclosure
- Refusal of role-override instructions
- No harmful or threatening content
- No executable code or script generation
- Empathetic distress response routing

**ORG_GUARDRAIL enforces:**
- Stay within assigned domain; redirect cross-domain queries
- No disclosure of another employee's salary, CTC, compensation, or performance rating
- No disclosure of confidential client names, contract values, or undisclosed strategy
- No legal advice
- No speculation on company decisions not in retrieved context
- "I don't have that information" when context is absent; never infer from general knowledge

### 8.3 Structural Injection Defense

The `_AGENT_SYSTEM` template places guardrail blocks after the personality block and before the context and query. This ordering ensures:

- The LLM reads guardrails immediately before seeing the user query
- User-provided content in `{context}` or `{query}` cannot structurally override the guardrail blocks (which appear earlier in the prompt)
- The `---` delimiters separate company context from guardrail instructions, reducing boundary confusion

---

## 9. Hallucination Mitigation in Prompts

### 9.1 Context-First Answer Instruction

The `_AGENT_SYSTEM` output rules explicitly instruct the LLM to:

- Prefer company context above general knowledge
- Quote exact values (days, percentages, deadlines, portal names) when present in context
- Use `"Per the [Document Name],"` citation format when referencing a retrieved document

### 9.2 Gap Acknowledgment Protocol

Every agent personality includes an explicit fallback instruction: when retrieved context does not cover the question, agents must use the phrase "I don't have that information" and provide the department contact rather than inferring or guessing.

The base agent system prompt extends this: if general professional knowledge is used (explicitly permitted), the agent must prefix the answer with "Generally, ..." to signal to the user that the information is not sourced from organizational policy.

### 9.3 Retrieval Quality Controls

The RAG retrieval pipeline enforces a similarity threshold of 0.10 and returns the top 3 chunks. The adaptive retry mechanism re-runs a simplified query if pgvector returns no results above threshold. These controls reduce the probability of context-free generation by ensuring every LLM call receives at least some retrieved content when relevant documents exist.

### 9.4 LLM Configuration for Hallucination Control

The Ollama model (`gpt-oss`) is configured with `temperature: 0.1` to minimize creative generation. A low temperature biases the model toward retrieving and quoting context rather than generating novel text, which reduces hallucination risk in factual domains.

---

## 10. Domain Boundary Enforcement in Prompts

### 10.1 Explicit Out-of-Scope Lists

Every agent personality contains a labeled `## OUT OF SCOPE — Redirect Without Answering` section. This section:

- Uses a bulleted list of specific query types the agent must not answer
- Names the target agent for each out-of-scope category (e.g., `-> Employee Agent`)
- Is enforced by the `ORG_GUARDRAIL` instruction to stay within the assigned domain

### 10.2 Supervisor-Level Routing Enforcement

The `MasterAgent` in `supervisor_agent.py` enforces domain routing before any agent receives a query. Fast-path regex patterns handle high-confidence intents deterministically. LLM routing and keyword fallback handle ambiguous queries. This pre-routing step reduces the likelihood of a query reaching the wrong agent.

### 10.3 Cross-Domain Redirect Language

When an agent encounters an out-of-scope query, the redirect response must:

- Acknowledge the user's intent in one sentence
- Name the correct agent or team
- Not attempt to answer the out-of-scope question, even partially

Agents are prohibited from providing partial answers to out-of-scope queries as a "helpful" gesture. Partial answers across domain boundaries create inconsistency and potential compliance risk.

---

## 11. Output Format Standards

### 11.1 HTML-Only Requirement

All user-facing AURA responses must be rendered in HTML. This requirement exists because:

- The AURA frontend (`ChatWindow.jsx`) renders responses using an HTML renderer, not a markdown parser
- Markdown artifacts (asterisks, hashes, dashes as bullets) display as raw characters in the UI
- HTML provides consistent formatting across all screen sizes and themes (dark/light)

### 11.2 Permitted HTML Elements

| Element | Use |
|---|---|
| `<h3>` | Section titles within a response |
| `<p>` | Prose paragraphs |
| `<ul><li>` | Unordered/factual bullet lists |
| `<ol><li>` | Numbered step-by-step processes |
| `<strong>` | Key terms, contacts, deadlines, policy names |
| `<code>` | Portal names, form codes, system commands |
| `<a href>` | Direct portal links (used in fast-path responses) |

### 11.3 Prohibited Output Patterns

- `**bold**` — use `<strong>` instead
- `## Heading` — use `<h3>` instead
- `- item` — use `<ul><li>` instead
- `<html>`, `<head>`, `<body>` — return inner content only; no document wrapper tags
- Markdown code fences (triple backtick) — use `<code>` instead

### 11.4 Enforcement in Prompts

Every agent personality includes the following block (or equivalent) verbatim:

```
**Output Format — HTML Only**
- Respond exclusively in clean HTML.
- Do NOT use markdown syntax (no **, no ##, no dashes as bullets).
- Do NOT wrap in <html>, <head>, or <body> tags — return the inner content only.
- Keep responses concise and scannable.
```

This block must be present in every personality prompt without exception. Its removal or modification is classified as a Major change and requires full review board approval.

---

## 12. Prompt Governance Lifecycle

```mermaid
flowchart TD
    A([Prompt Change Requested]) --> B{Change Classification}
    B -->|Minor| C[AI Platform Lead Review]
    B -->|Moderate| D[AI Platform Lead + Domain SME Review]
    B -->|Major| E[Full Review Board]
    B -->|Emergency| F[Security Team Authorization]

    C --> G[QA: Regression Suite]
    D --> G
    E --> G
    F --> H[Hotfix Deployed]
    H --> I[Retrospective Review within 48h]
    I --> G

    G --> J{All Tests Pass?}
    J -->|No| K[Author Revises Prompt]
    K --> G
    J -->|Yes| L[Engineering Lead PR Approval]
    L --> M[Merge to main Branch]
    M --> N[CI/CD Deployment]
    N --> O[Audit Log Entry Created]
    O --> P([Prompt Active in Production])

    P --> Q{Monitoring Alert?}
    Q -->|Hallucination / Boundary Violation| R[Incident Ticket]
    Q -->|Security Threat| S[Emergency Rollback]
    R --> A
    S --> T[Revert to Prior Git SHA]
    T --> I
```

---

## 13. Prompt Audit Requirements

### 13.1 Audit Log Schema

Every prompt change event is recorded in the `audit_logs` table with the following fields:

| Field | Value |
|---|---|
| `action` | `PROMPT_CHANGE` / `PROMPT_ROLLBACK` / `PROMPT_REVIEW` |
| `entity_type` | `prompt` |
| `entity_id` | Git commit SHA of the changed file |
| `user_id` | UUID of the approver who merged the change |
| `status` | `approved` / `rejected` / `rolled_back` |
| `created_at` | Timestamp of the event |

### 13.2 Prompt Change Record

Each production prompt deployment must be documented with:

- Agent name and personality variable (e.g., `HR_PERSONALITY`)
- Nature of change (domain addition, rule addition, wording correction, etc.)
- Business justification for the change
- SME and reviewer names
- Test suite results (pass/fail counts)
- Git commit SHA
- Deployment timestamp

### 13.3 Periodic Prompt Review Schedule

| Review Type | Frequency | Trigger |
|---|---|---|
| Domain accuracy review | Quarterly | Scheduled; also on HR/IT/Admin policy changes |
| Contact information audit | Monthly | Automated check against current org directory |
| Guardrail pattern review | Semi-annually | Scheduled; also on any security incident |
| Output format compliance | On every deployment | Automated HTML validation in test suite |
| Full prompt library audit | Annually | Scheduled by AI Platform Team |

### 13.4 Retention

Prompt audit records are retained for a minimum of 3 years in the `audit_logs` table, consistent with the platform's general audit retention policy.

---

## 14. Future Prompt Evolution

### 14.1 Planned Enhancements

- **Prompt parameterization:** Move agent contact information (email addresses) to a centralized configuration file rather than embedding them in prompt strings. This reduces the scope of prompt changes required when organizational contacts change.
- **Structured output enforcement:** Introduce response schema validation at the API layer to detect and reject responses containing markdown artifacts before they reach the frontend renderer.
- **Automated domain boundary testing:** Build a continuous integration check that runs domain-boundary test queries against all agents on every pull request, blocking merges where boundary violations are detected.
- **Prompt A/B testing framework:** Implement a shadow-mode testing capability that routes a configurable percentage of traffic to a candidate prompt version and compares response quality metrics before full rollout.

### 14.2 Agent Roadmap

- **CandidateAgent:** Talent acquisition and recruitment query handling for HR teams
- **ComplianceAgent:** Legal and compliance policy queries (GDPR, labor law, internal policies)
- **LearningAgent:** Learning and development queries, certification tracking, training portal guidance
- **OnboardingAgent:** Formalized progression through the 8-step onboarding workflow (WelcomeStep through AllSetStep)

### 14.3 Model Evolution Considerations

The current AURA platform uses `gpt-oss` via a self-hosted Ollama instance at `ml01.alignedautomation.com`. As model capabilities evolve:

- Prompt simplification may be possible as instruction-following improves; domain lists may be expressible in fewer tokens
- Temperature and token count parameters (`temperature: 0.1`, `num_predict: 800`, `num_ctx: 2048`) must be re-evaluated for any replacement model
- Any model change triggers a mandatory full prompt regression suite run before production deployment

### 14.4 Multilingual Prompt Support

Current AURA personalities are English-only. If multilingual support is introduced, each language variant of a personality will be governed as a separate prompt artifact, subject to the same review and approval process, with domain SME review extended to include a speaker of the target language.

---

*Document Owner: AI Platform Team — Aligned Automation*
*Classification: Internal — Restricted*
*Next scheduled review: 2026-09-07*
