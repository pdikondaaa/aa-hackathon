# AURA SharePoint Ingestion — Setup Guide

## Architecture

```
SharePoint (https://alignedautomation.sharepoint.com/sites/Nexus)
│
├─ Phase 1 — File ingestion
│   MSAL (app-only token) ──► Graph API ──► TextExtractor ──► chunker ──► pgvector
│   (PDF, DOCX, XLSX, PPTX, TXT from document libraries)
│
└─ Phase 2 — Web scraping
    Playwright (browser login) ──► SharePoint REST API ──► HtmlExtractor ──► chunker ──► pgvector
    (site pages + list contents — no Azure AD app registration required)

pgvector  ──►  retriever.py  ──►  Existing AURA agents / Web UI
               (already wired — no changes needed to chat layer)
```

**Two-phase pipeline, one command:**  `python main.py`

Scraped pages and lists are stored in the same `document_chunks` table as files.
The existing chat agents pick them up automatically via `retriever.py`.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Python | 3.11+ |
| PostgreSQL + pgvector | 15+ |
| Azure AD app registration | Phase 1 only (file ingestion via Graph API) |
| SharePoint account | Phase 2 — any user/service account with site read access |

---

## 1. Azure AD App Registration (Phase 1 — file ingestion only)

> Skip this section if you only want to scrape pages and lists (Phase 2).
> Phase 2 uses your SharePoint login directly — no app registration needed.

### Step 1 — Create the registration

1. **Azure Portal** → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: `AURA-SharePoint-Ingestion`
3. Account types: **Accounts in this organizational directory only**
4. Redirect URI: leave blank
5. Click **Register**

### Step 2 — Add API permissions (Application permissions)

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
2. Add:

| Permission | Purpose |
|---|---|
| `Sites.Read.All` | List sites and subsites |
| `Files.Read.All` | Download files from document libraries |

3. Click **Grant admin consent** (requires Global Admin or Application Admin role)

### Step 3 — Create a client secret

1. **Certificates & secrets** → **New client secret**
2. Description: `AURA Ingestion Key` — Expiry: **24 months**
3. Copy the **Value** immediately (shown only once) → this is `SHAREPOINT_CLIENT_SECRET`

### Step 4 — Note your IDs

From the **Overview** tab:

| Field | Setting name |
|---|---|
| Application (client) ID | `SHAREPOINT_CLIENT_ID` |
| Directory (tenant) ID | `AZURE_TENANT_ID` |

---

## 2. Environment Configuration

Edit the root `.env` file:

```env
# ── Phase 1: Azure AD / Graph API (file ingestion) ───────────────────────────
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_CLIENT_SECRET=your~client~secret~value~here
SHAREPOINT_TENANT_NAME=alignedautomation.sharepoint.com
SHAREPOINT_SITE_PATH=sites/Nexus/DigitalKnowledgeManagement
SHAREPOINT_DOCUMENT_LIBRARY=Documents

# ── Phase 2: Web scraping (Playwright login — no app registration needed) ─────
SHAREPOINT_SITE_URL=https://alignedautomation.sharepoint.com/sites/Nexus
SHAREPOINT_LOGIN_EMAIL=your.email@alignedautomation.com
SHAREPOINT_LOGIN_PASSWORD=yourpassword


```

---

## 3. Installation

```bash
cd apps/jobs/sharepoint_ingestion

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux / macOS

# Install all dependencies
pip install -r requirements.txt

# Install Playwright browser (required for Phase 2 web scraping)
playwright install chromium
```

---

## 4. Database Initialization (run once)

```bash
python create_schema.py
```

Creates the `documents`, `document_chunks`, and all supporting tables with pgvector indexes.

---

## 5. Running the Ingestion Job

```bash
cd apps/jobs/sharepoint_ingestion
python main.py
```

**First run behaviour:**
A Chrome window opens automatically for Phase 2 login.
Log in with your Microsoft account and complete MFA if prompted.
The session is saved to `storage/.playwright_session.json`.
All subsequent runs are fully headless — no login prompt.

**Expected output:**
```
[INFO] Phase 1: file ingestion
[INFO] TOTAL FILES COLLECTED: 47
[INFO] Job complete — processed: 44, skipped: 2, failed: 1, deleted: 0

[INFO] Phase 2: web scraping (pages / lists)
[INFO] Discovered 12 page(s)
[INFO]   [1/12] Home
[INFO]   Stored 6 chunks for: Home.html
[INFO]   [2/12] HR Policies
[INFO]   Stored 9 chunks for: HR Policies.html
[INFO] Discovered 3 list(s)
[INFO]   [1/3] Announcements
[INFO]   Stored 11 chunks for: Announcements (SharePoint List)
[INFO] WebScraperService done: pages ok=11 skip=1 fail=0 | lists ok=3 skip=0 fail=0
```

**Schedule (run daily):**

```bash
# Linux / macOS cron — 2 AM daily
0 2 * * * cd /app/jobs/sharepoint_ingestion && python main.py >> logs/cron.log 2>&1

# Windows Task Scheduler
# Program:   python.exe
# Arguments: main.py
# Start in:  C:\...\apps\jobs\sharepoint_ingestion
```

---

## 6. How the Chat Gets the Data

No changes are needed to the chatbot or agents.

```
python main.py
    └─ writes to document_chunks table
              │
              ▼
apps/api-gateway/app/rag/retriever.py
    └─ retrieve_chunks(query) — already queries all rows in document_chunks
              │
              ▼
Existing AURA agents (HR, IT, Finance, …)  +  Web UI
```

Scraped pages and lists are tagged `source_system = 'sharepoint_web'` so they can be distinguished from files (`source_system = 'sharepoint'`) in queries if needed.

---

## 7. Session Management

| Situation | Behaviour |
|---|---|
| `storage/.playwright_session.json` does not exist | Browser opens (headed) for login + MFA |
| Session file exists and is valid | Fully headless — no login |
| Session expired (401 from REST API) | Delete the session file and run again |

To force a fresh login:
```bash
del apps\jobs\sharepoint_ingestion\storage\.playwright_session.json   # Windows
rm  apps/jobs/sharepoint_ingestion/storage/.playwright_session.json   # Linux/macOS
```

---

## 8. Security Best Practices

### Credentials
- Store `SHAREPOINT_LOGIN_PASSWORD` in environment variables or **Azure Key Vault** — never commit to git
- Use a **dedicated service account** (e.g. `svc-aura@alignedautomation.com`) with Reader access to the target site only
- Use an **app password** (not the regular login password) if the account has MFA — avoids MFA prompts in automation
- The `.env` file is already in `.gitignore`

| Environment | Recommended secret storage |
|---|---|
| Local dev | `.env` file |
| Docker / Kubernetes | Kubernetes Secrets or Docker Secrets |
| Azure (AKS / App Service) | Azure Key Vault with Managed Identity |

### Authorization
- The service account needs **Reader** access on the SharePoint site — no Contribute or higher
- For Phase 1 (Graph API), grant only `Sites.Read.All` + `Files.Read.All` — never write permissions

### Network
- Phase 1 (Graph API): egress to `graph.microsoft.com:443`
- Phase 2 (Playwright + REST): egress to `*.sharepoint.com:443` and `login.microsoftonline.com:443`
- Use PostgreSQL with `sslmode=require` in production

### Data
- `document_chunks` contains extracted plain text — apply the same data classification as the source SharePoint site
- Set `LOG_LEVEL=INFO` in production (DEBUG logs may include chunk text)
- Review and rotate the Azure AD client secret before expiry (every 24 months)

---

## 9. Module Reference

| File | Role |
|---|---|
| `main.py` | Entry point — Phase 1 (files) then Phase 2 (web scraping) |
| `config/settings.py` | All configuration via Pydantic BaseSettings + `.env` |
| `connectors/sharepoint.py` | MSAL auth + Graph API — file listing and download (Phase 1) |
| `connectors/sharepoint_web_scraper.py` | Playwright login + SharePoint REST API — pages and lists (Phase 2) |
| `extractors/text_extractor.py` | PDF, DOCX, XLSX, PPTX, TXT text extraction |
| `extractors/html_extractor.py` | BeautifulSoup — strips SharePoint chrome, returns clean plain text |
| `chunking/chunker.py` | LangChain RecursiveCharacterTextSplitter |
| `embeddings/embedder.py` | HuggingFace sentence-transformers (nomic-embed-text-v1.5) |
| `storage/db.py` | PostgreSQL + pgvector upsert and similarity search |
| `services/ingestion_service.py` | Phase 1 orchestrator — files |
| `services/sync_service.py` | SHA-256 checksum-based incremental sync |
| `services/web_scraper_service.py` | Phase 2 orchestrator — pages and lists |
| `create_schema.py` | One-time database schema creation |
| `apps/api-gateway/app/rag/retriever.py` | Runtime retriever — queries pgvector (no SharePoint contact) |
