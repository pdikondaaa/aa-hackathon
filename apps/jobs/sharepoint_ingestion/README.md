# SharePoint Ingestion Job

Scheduled background job that ingests documents from SharePoint into PostgreSQL + pgvector.

Runtime agents and API endpoints **never** talk to SharePoint. They query only PostgreSQL.

---

## Architecture

```
SharePoint / Nexus
      │
      ▼
SharePoint Connector  (connectors/sharepoint.py)
      │  MSAL OAuth + Microsoft Graph API
      ▼
Sync Service          (services/sync_service.py)
      │  SHA256 checksum comparison — skip unchanged files
      ▼
Ingestion Service     (services/ingestion_service.py)
      │
      ├── Text Extractor   (extractors/text_extractor.py)   PDF, DOCX, PPTX, XLS, TXT, CSV
      ├── Text Chunker     (chunking/chunker.py)            RecursiveCharacterTextSplitter
      ├── Embedder         (embeddings/embedder.py)         sentence-transformers/all-MiniLM-L6-v2
      └── Document Repo    (storage/db.py)                  PostgreSQL + pgvector
                │
                ▼
        PostgreSQL (documents + document_chunks tables)
                │
                ▼
        Runtime Retriever  (apps/api-gateway/app/rag/retriever.py)
                │
                ▼
        LangGraph Agents → LLM → User
```

---

## Directory Structure

```
jobs/sharepoint_ingestion/
├── config/
│   └── settings.py          # Pydantic BaseSettings — all config from .env
├── connectors/
│   └── sharepoint.py        # MSAL auth + Graph API listing/download
├── extractors/
│   └── text_extractor.py    # PDF/DOCX/PPTX/XLS/TXT/CSV → plain text
├── chunking/
│   └── chunker.py           # RecursiveCharacterTextSplitter
├── embeddings/
│   └── embedder.py          # HuggingFace sentence-transformer embeddings
├── storage/
│   ├── db.py                # PostgreSQL + pgvector upsert / similarity_search
│   ├── raw/                 # Downloaded files (temporary)
│   ├── processed/           # Successfully ingested files
│   └── failed/              # Files that failed extraction or embedding
├── services/
│   ├── sync_service.py      # Incremental sync (checksum-based delta detection)
│   └── ingestion_service.py # Top-level job orchestrator
├── utils/
│   ├── hashing.py           # SHA256 helpers
│   └── logging_config.py    # Structured logger factory
├── logs/                    # ingestion.log written here
├── main.py                  # Job entry point
├── create_schema.py         # One-time DB schema setup
├── requirements.txt
└── .env.example             # Copy to .env and fill in credentials
```

---

## Quick Start

### 1. Install dependencies

```bash
cd jobs/sharepoint_ingestion
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your SharePoint credentials and PostgreSQL connection
```

Required values:

| Variable               | Description                                 |
|------------------------|---------------------------------------------|
| `TENANT_ID`            | Azure AD tenant ID                          |
| `CLIENT_ID`            | Azure App registration client ID            |
| `CLIENT_SECRET`        | Azure App registration client secret        |
| `TENANT_NAME`          | SharePoint hostname (e.g. `org.sharepoint.com`) |
| `SHAREPOINT_SITE_PATH` | Site-relative path to the SharePoint site   |
| `DOCUMENT_LIBRARY_NAME`| Document library name (usually `Documents`) |
| `SQL_HOST`             | PostgreSQL host                             |
| `SQL_PORT`             | PostgreSQL port (default `5432`)            |
| `SQL_USERNAME`         | PostgreSQL username                         |
| `SQL_PWD`              | PostgreSQL password                         |
| `SQL_DB`               | PostgreSQL database name                    |

### 3. Create the database schema (first run only)

```bash
python create_schema.py
```

This creates two tables (`documents`, `document_chunks`) and the pgvector IVFFlat index.

### 4. Run the ingestion job

```bash
python main.py
```

Logs are written to `logs/ingestion.log` and stdout simultaneously.

---

## Incremental Sync

The job only processes files that have changed since the last run:

1. Fetch all file metadata from SharePoint (name, path, last_modified).
2. Compare `last_modified` against the `documents` table.
3. If unchanged → skip.
4. If new or timestamp changed → download and compute SHA256.
5. If SHA256 unchanged (timestamp drift only) → update metadata only.
6. If SHA256 changed → delete old chunks, re-extract, re-chunk, re-embed, store.
7. Files deleted from SharePoint → document row + all chunks removed (CASCADE).

---

## Scheduling

### Linux cron

```cron
# Run every day at 02:00 AM
0 2 * * * cd /app/jobs/sharepoint_ingestion && /app/.venv/bin/python main.py >> logs/cron.log 2>&1
```

### Kubernetes CronJob (future)

```yaml
# deployments/k8s/sharepoint-ingestion-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sharepoint-ingestion
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: ingestion
            image: aura/sharepoint-ingestion:latest
            command: ["python", "main.py"]
            envFrom:
            - secretRef:
                name: sharepoint-ingestion-secrets
          restartPolicy: OnFailure
```

---

## Database Tables

### `documents`

| Column           | Type          | Description                              |
|------------------|---------------|------------------------------------------|
| `id`             | UUID          | Primary key                              |
| `file_name`      | TEXT          | File name (e.g. `HR_Policy.pdf`)         |
| `file_path`      | TEXT          | Local path at time of processing         |
| `sharepoint_path`| TEXT (UNIQUE) | SharePoint-relative path                 |
| `source_url`     | TEXT          | SharePoint web URL for deep linking      |
| `checksum`       | VARCHAR(64)   | SHA256 of file content                   |
| `file_size`      | BIGINT        | File size in bytes                       |
| `file_type`      | VARCHAR(20)   | Extension without dot (e.g. `pdf`)       |
| `source`         | TEXT          | Always `sharepoint` for this job         |
| `last_modified`  | TIMESTAMPTZ   | Last modified timestamp from SharePoint  |
| `created_at`     | TIMESTAMPTZ   | Row creation time                        |
| `updated_at`     | TIMESTAMPTZ   | Last upsert time                         |

### `document_chunks`

| Column       | Type         | Description                             |
|--------------|--------------|-----------------------------------------|
| `id`         | UUID         | Primary key                             |
| `document_id`| UUID (FK)    | References `documents.id` (CASCADE DEL) |
| `chunk_index`| INTEGER      | Position of chunk within the document   |
| `chunk_text` | TEXT         | Raw text of the chunk                   |
| `embedding`  | VECTOR(384)  | Dense vector from all-MiniLM-L6-v2      |
| `metadata`   | JSONB        | file_name, source_url, sharepoint_path  |
| `created_at` | TIMESTAMPTZ  | Insertion time                          |

---

## What NOT to do

- Do **not** import from this job in runtime API code.
- Do **not** query SharePoint from LangGraph agents or the API gateway.
- Do **not** store PDFs or binary files in PostgreSQL — only text and vectors are stored.
