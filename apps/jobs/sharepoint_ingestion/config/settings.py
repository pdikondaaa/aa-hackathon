import os
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings

# Resolve job root at import time (jobs/sharepoint_ingestion/)
_JOB_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    # ─── Azure AD / SharePoint ────────────────────────────────────────────────
    TENANT_ID: str = "3dcd35b5-f9c5-48ca-8653-821568ad3397"
    CLIENT_ID: str = "f03e6b79-ed73-455c-b86a-f15a5d4b360c"
    CLIENT_SECRET: str = "2a1b1e9d-d34d-4eed-9219-138fa4d7b866"
    TENANT_NAME: str = "alignedautomation.sharepoint.com"
    SHAREPOINT_SITE_PATH: str = "sites/Nexus/DigitalKnowledgeManagement/HR"
    DOCUMENT_LIBRARY_NAME: str = "Documents"

    # ─── Embeddings ───────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # ─── Chunking ─────────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # ─── Local storage paths (overridable via .env) ───────────────────────────
    RAW_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "raw")
    PROCESSED_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "processed")
    FAILED_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "failed")
    LOG_DIR: str = os.path.join(_JOB_ROOT, "logs")

    # ─── PostgreSQL ───────────────────────────────────────────────────────────
    SQL_HOST: str = "localhost"
    SQL_PORT: str = "5432"
    SQL_USERNAME: str = "root"
    SQL_PWD: str = "Pass@123"           # matches existing platform convention
    SQL_DB: str = "aura_db"

    # ─── Logging ──────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ─── Derived properties ───────────────────────────────────────────────────
    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{quote_plus(self.SQL_USERNAME)}:{quote_plus(self.SQL_PWD)}"
            f"@{self.SQL_HOST}:{self.SQL_PORT}/{self.SQL_DB}"
        )

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.TENANT_ID}"

    @property
    def graph_scopes(self) -> list:
        return ["https://graph.microsoft.com/.default"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
