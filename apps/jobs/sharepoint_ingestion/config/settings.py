import os
from pathlib import Path
from typing import List
from urllib.parse import quote_plus
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

# Resolve repo root at import time (5 levels up from this file)
_REPO_ROOT = Path(__file__).resolve().parents[4]

# Resolve job root at import time (jobs/sharepoint_ingestion/)
_JOB_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    # ─── Azure AD / SharePoint ────────────────────────────────────────────────
    # Field names kept for backward compat; env vars come from root .env
    TENANT_ID: str = Field(default="3dcd35b5-f9c5-48ca-8653-821568ad3397", validation_alias="AZURE_TENANT_ID")
    CLIENT_ID: str = Field(default="f03e6b79-ed73-455c-b86a-f15a5d4b360c", validation_alias="SHAREPOINT_CLIENT_ID")
    CLIENT_SECRET: str = Field(default="", validation_alias="SHAREPOINT_CLIENT_SECRET")
    TENANT_NAME: str = Field(default="alignedautomation.sharepoint.com", validation_alias="SHAREPOINT_TENANT_NAME")
    SHAREPOINT_SITE_PATH: str = Field(default="sites/Nexus/DigitalKnowledgeManagement", validation_alias="SHAREPOINT_SITE_PATH")
    DOCUMENT_LIBRARY_NAME: str = Field(default="Documents", validation_alias="SHAREPOINT_DOCUMENT_LIBRARY")

    # ─── Embeddings ───────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"
    EMBEDDING_DIMENSION: int = 768

    # ─── Chunking ─────────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # ─── Local storage paths (overridable via .env) ───────────────────────────
    RAW_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "raw")
    PROCESSED_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "processed")
    FAILED_STORAGE_DIR: str = os.path.join(_JOB_ROOT, "storage", "failed")
    LOG_DIR: str = os.path.join(_JOB_ROOT, "logs")

    # ─── PostgreSQL ───────────────────────────────────────────────────────────
    SQL_HOST: str = Field(default="hackathon.alignedautomation.com", validation_alias="SQL_HOST")
    SQL_PORT: str = Field(default="5432", validation_alias="SQL_PORT")
    SQL_USERNAME: str = Field(default="squadrons", validation_alias="SQL_USERNAME")
    SQL_PWD: str = Field(default="TwlU0KL1LZbZLYS$", validation_alias="SQL_PWD")
    SQL_DB: str = Field(default="squadrons", validation_alias="SQL_DB")
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

    model_config = {
        "env_file": (str(_REPO_ROOT / ".env"), str(Path(_JOB_ROOT) / ".env")),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }


settings = Settings()
