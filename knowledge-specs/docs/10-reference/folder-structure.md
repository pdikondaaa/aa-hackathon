# Folder Structure — AURA (AA-Hackathon Enterprise Assistant)

**Organization:** Aligned Automation
**Document Date:** 2026-07-02
**Version:** 1.0
**Audience:** Everyone — including non-technical readers who just want to know "where does X live?"

---

## How to read this document

Each folder below has a one-line plain-English description first, then (where useful) the technical detail. If you only care about "what does this app do," read the **bold summary lines** and skip the code-level notes.

---

## Top-Level Repository Layout

```
aa-hackathon/
├── apps/                     The three running pieces of software that make up AURA
│   ├── api-gateway/          The "brain" — backend server that answers every request
│   ├── web-ui/               The website/app employees actually see and click on
│   └── jobs/                 Behind-the-scenes scripts that keep the knowledge base fresh
├── integrations/             Older/shared connector code to outside systems (SharePoint)
├── deployments/              Instructions for how to start all the pieces together (Docker)
├── knowledge-specs/          This documentation set, plus source process documents
└── .claude/, .vscode/, .git/ Editor and tooling configuration — not part of the product
```

---

## `apps/api-gateway/` — The Backend ("the brain")

**Plain English:** This is the server that receives every question or click from the website, decides which specialist should answer it, talks to the AI models and the database, and sends a response back. If AURA is a company, this is the office building where all the actual work happens.

```
apps/api-gateway/
├── app/
│   ├── main.py                FastAPI application. Registers every URL the server responds to.
│   ├── api/
│   │   ├── auth/               Checks that every request has a valid Microsoft (Azure AD) login token
│   │   ├── config/              Database connection settings, Azure AD settings
│   │   ├── controllers/        One file per feature area — each defines the URLs (endpoints) for that feature
│   │   ├── models/              Data shape definitions (what a "message" or "escalation" looks like)
│   │   ├── services/            The actual business logic behind each controller (talks to the database)
│   │   └── onboarding.py       New-hire onboarding data endpoints
│   ├── agents/                 The "specialists" — one AI agent per subject area (see below)
│   ├── memory/                 Short-term and long-term memory for conversations
│   ├── rag/                     Looks up relevant company documents to ground AI answers in facts
│   └── utils/                   Shared helper code (logging, etc.)
├── migrations/                  Hand-written database change scripts
├── tests/                       Automated tests
└── requirements.txt             List of Python libraries the backend depends on
```

### `app/agents/` in detail — the specialist roster

**Plain English:** Each file here is one "expert" the system can hand a question to. Some experts look things up in company documents before answering (marked "RAG agent" below); others just do a specific job (send a form, draft an email) without needing to search documents.

| File | Specialist | What it actually does |
|---|---|---|
| `supervisor_agent.py` | **The Router (MasterAgent)** | Reads every incoming question and decides which specialist should handle it |
| `working/hr_agent.py` | HR Agent | Answers HR policy questions (RAG agent) |
| `working/it_agent.py` | IT Agent | Answers IT support questions (RAG agent) |
| `working/admin_agent.py` | Admin Agent | Answers facilities/travel/admin questions (RAG agent) |
| `working/finance_agent.py` | Finance Agent | Answers finance/tax/payroll-policy questions (RAG agent) |
| `working/pmo_agent.py` | PMO Agent | Answers project-management questions (RAG agent) |
| `org_agent.py` | Org Agent | Answers "what is our mission/structure" type questions (RAG agent) |
| `working/funny_agent.py` | Funny Agent | Handles jokes / casual small talk |
| `working/quick_agent.py` | Quick Agent | Catch-all for simple questions nothing else matched |
| `document_agent.py` | Document Agent | Walks a user through generating an HR letter (offer letter, NOC, etc.) |
| `email_agent.py` | Email Agent | Helps draft a professional email from chat context |
| `ms_forms_agent.py` | Forms Agent | Creates a Microsoft Form on the user's behalf |
| `allocation_agent.py` | Allocation Agent | Answers project-staffing / resource-allocation questions |
| `escalation_agent.py` | Escalation Agent | Handles "I need to talk to a human" requests |
| `license_agent.py` | License Agent | Answers "who has a Claude/Figma/Copilot license" type questions |
| `parking_config.py` | Parking data | Static Fountainhead parking rate tables (not an agent itself — used by the Admin Agent) |
| `guardrails.py` | Safety Filter | Checks every question for jailbreak attempts, harmful content, or off-limits topics before anything else runs |
| `employee/employee_agent.py`, `employee/attendance_agent.py` | Employee/Attendance Agents | Answer "who am I" and "what's my attendance" questions from the HR system |
| `working/base_deep_agent.py` | Shared "brain" | The common logic that the document-searching specialists (HR/IT/Admin/Finance/PMO/Org) all share |
| `working/knowledge_base.py` | Local backup search | A fallback document search used only when the main database search comes back empty |
| `working/personalities.py` | Tone settings | The writing style/personality instructions for each specialist |
| `working/config.py` | AI model chooser | Decides whether to use Claude, Groq, or Ollama to generate answers |
| `working/tools/tavily_search.py` | Web search | Optional live internet search, used when enabled |

### `app/api/controllers/` in detail — the feature list

**Plain English:** Each controller is one feature area of the product, exposed as a set of web addresses (endpoints) the frontend calls. This is effectively the full feature list of AURA.

| Controller | Feature |
|---|---|
| `chat_controller.py` | The core chat conversation |
| `conversations_controller.py`, `messages_controller.py` | Saving and listing past conversations |
| `feedback_controller.py` | Thumbs up/down on individual answers |
| `escalations_controller.py` | "Talk to a human" ticket tracking |
| `pii_controller.py` | Admin tools for reviewing detected personal-data (PII) events |
| `allocation_controller.py` | PMO resource allocation board |
| `email_controller.py` | AI email drafting/refinement |
| `attendance_controller.py` | Attendance record lookup |
| `profile_controller.py` | "Who am I" — employee profile, birthdays, anniversaries |
| `documents_controller.py` | List of generated HR documents |
| `coo_analytics_controller.py` | Executive-level usage dashboard |
| `forms_controller.py` | Microsoft Forms creation |
| `communications_controller.py` | Company announcements and events |
| `graph_calendar_controller.py` | Shared company calendar |
| `parking_controller.py` | Employee parking requests |
| `skills_controller.py` | Company-wide skills analytics |
| `form_builder_controller.py` | **The largest feature in the codebase** — a full no-code form and approval-workflow builder |
| `health_controller.py`, `debug_controller.py` | Internal diagnostics |

---

## `apps/web-ui/` — The Frontend ("what employees see")

**Plain English:** This is the actual website. It is a single page that changes what it shows based on what the user clicks in the sidebar — there are no separate web addresses/URLs per screen (no "page routing" in the traditional sense).

```
apps/web-ui/
├── src/
│   ├── main.jsx              Starting point — signs the user in, then loads the app
│   ├── App.jsx                The overall page layout (top bar, sidebar, main content)
│   ├── components/            Shared building blocks used across the whole app (17 files)
│   ├── modules/                Self-contained feature areas (8 modules, see below)
│   ├── config/                  Settings files (login config, theme colors, navigation menu)
│   ├── services/                Code that talks to the backend server
│   └── utils/                    Small helper functions (PDF generation, spell-check, etc.)
├── public/                       Static files served as-is (handbook PDF, logo, sample docs)
└── package.json                 List of JavaScript libraries the frontend depends on
```

### `src/components/` — shared building blocks

**Plain English:** These are pieces used directly by the main app shell, not tucked inside a feature module.

| File | What a user sees |
|---|---|
| `ChatWindow.jsx` | The main chat conversation window — the biggest, most complex piece |
| `TopBar.jsx`, `Sidebar.jsx`, `RightPanel.jsx` | The overall page frame (header, left menu, right info panel) |
| `LoginPage.jsx` | The "Sign in with Microsoft" screen |
| `MessageBubble.jsx` | One chat message, including thumbs up/down and document download buttons |
| `AllocationBoard.jsx` | The PMO staffing/allocation table and chart |
| `AttendancePage.jsx` | Personal and team attendance view |
| `DocumentsPage.jsx` | Library of previously generated HR documents |
| `EmailAgentPage.jsx` | Standalone email-drafting tool |
| `EscalationDrawer.jsx`, `FormsDrawer.jsx`, `ParkingDrawer.jsx` | Slide-in panels for escalations, Microsoft Forms, and parking requests |
| `CommunicationsPage.jsx`, `CommunicationsAdmin.jsx`, `CommunicationsWidget.jsx` | Company announcements and events (viewer + admin editor + home-screen preview) |
| `AnnouncementBanner.jsx`, `AnnouncementOverlay.jsx` | The banner strip and welcome pop-up for announcements |
| `PersonalNotes.jsx` | A private notes/task scratchpad, saved on the user's own device (not the server) |
| `AdminPage.jsx`, `QuickLinksAdmin.jsx` | Admin-only settings screens |

### `src/modules/` — self-contained feature areas

**Plain English:** Each of these is a bigger feature that was built as its own self-contained package (its own pages, its own connections to the server).

| Module | What it is | Is it real / connected to live data? |
|---|---|---|
| `analytics/` | Chatbot usage dashboard (10 charts) | **No — currently shows made-up sample numbers**, not live usage data |
| `coo-analytics/` | Executive dashboard for leadership | Yes — pulls real numbers from the server |
| `pmo-hub/` | Project/milestone/risk dashboard | **No — entirely made-up example projects**, no server connection at all |
| `skill-hub/` | Company skills radar/analytics | Yes — pulls real numbers from the server |
| `feedback/` | In-app suggestion/bug-report form | Saved only on the user's own device, not sent to the server |
| `parking-assistant/` | Backend connector for parking requests | Yes (the visible UI is `components/ParkingDrawer.jsx`) |
| `onboarding-guidance/` | 8-step new-hire onboarding wizard | Yes — pulls real employee data from the server |
| `form-builder/` | No-code form and workflow builder ("NCL") | Yes — the largest and most complex module in the frontend |

---

## `apps/jobs/` — Background Data Jobs

**Plain English:** These are scripts that don't run all the time — someone (or a scheduled task) runs them periodically to keep the knowledge base and reference data up to date. They are not part of the live website or server.

```
apps/jobs/
├── sharepoint_ingestion/     Downloads company documents from SharePoint, breaks them into
│                             searchable pieces, and stores them so the AI agents can find them
├── Data_Files/                Spreadsheet exports (employee records, AI tool license lists,
│                              project/allocation data) loaded into the database
└── run_all_ingestion.py       Runs every ingestion job in sequence
```

**What "ingestion" means in plain terms:** Company policy documents live in SharePoint as Word/Excel/PDF files. A computer can't search inside those the way a person reading them can. This job downloads each file, splits it into ~1000-character pieces, converts each piece into a list of 768 numbers that captures its meaning (an "embedding"), and stores all of that in the database. When someone asks a question, the same conversion is applied to their question, and the database finds the stored pieces whose numbers are most similar — that's how the AI finds the right policy paragraph to answer from.

---

## `integrations/` and `deployments/`

- **`integrations/sharepoint/client.py`** — an older/shared SharePoint connector, separate from the ingestion job's own connector code under `apps/jobs/sharepoint_ingestion/connectors/`.
- **`deployments/docker/docker-compose.yml`** — starts three containers together: the backend server, the database, and a Redis cache container that is defined but **not currently used by any application code**.

---

## `knowledge-specs/`

**Plain English:** This folder — everything you're reading right now, plus source Word documents that describe manual company processes (parking, travel, ID card replacement, etc.) that the AI agents are meant to know about.

```
knowledge-specs/
├── docs/                      This specification set (numbered 00–10 by topic)
└── process_docs/              Original Word documents describing manual HR/Admin/IT processes
    ├── Admin Process Doc/
    └── IT Process Doc/
```

---

## Quick "where do I change X?" lookup

| I want to... | Go to... |
|---|---|
| Change how a question gets routed to an agent | `apps/api-gateway/app/agents/supervisor_agent.py` |
| Change what an HR/IT/Admin/Finance/PMO agent says | `apps/api-gateway/app/agents/working/<domain>_agent.py` and `personalities.py` |
| Add a new HR document type | `apps/api-gateway/app/agents/document_agent.py` |
| Change which AI model is used (Claude/Groq/Ollama) | `apps/api-gateway/app/agents/working/config.py` |
| Add a new backend feature/endpoint | New file in `apps/api-gateway/app/api/controllers/` + `services/` |
| Change the sidebar menu | `apps/web-ui/src/config/chatConfig.js` |
| Change login/security behavior | `apps/web-ui/src/config/authConfig.js` (frontend), `apps/api-gateway/app/api/auth/` (backend) |
| Add a new frontend feature area | New folder under `apps/web-ui/src/modules/` |
| Fix or refresh the SharePoint knowledge base | `apps/jobs/sharepoint_ingestion/` |
