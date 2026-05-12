"""
IngestionService — top-level orchestrator for the SharePoint ingestion job.

Flow per file:
  SyncService classifies → NEW/CHANGED files are downloaded, extracted,
  chunked, embedded, then stored in PostgreSQL + pgvector.
  DELETED files have their chunks and document rows removed.
  UNCHANGED files are skipped entirely.
"""
import os
import shutil
from pathlib import Path

from config.settings import settings
from extractors.text_extractor import TextExtractor
from chunking.chunker import TextChunker
from embeddings.embedder import Embedder
from storage.db import DocumentRepository
from services.sync_service import SyncService, SyncAction, FileSyncResult
from utils.hashing import compute_sha256
from utils.logging_config import get_logger

logger = get_logger(__name__)


class IngestionService:
    """Orchestrates the full SharePoint → pgvector pipeline for a single job run."""

    def __init__(self):
        self.sync = SyncService()
        self.extractor = TextExtractor()
        self.chunker = TextChunker()
        self.embedder = Embedder()
        self.db = DocumentRepository()
        self._ensure_storage_dirs()

    # ─── Public entry point ───────────────────────────────────────────────────

    def run(self):
        logger.info("IngestionService: starting job run")

        try:
            _, sync_results = self.sync.run()
        except Exception as exc:
            logger.error(f"SharePoint sync failed: {exc}")
            raise

        stats = {"processed": 0, "skipped": 0, "failed": 0, "deleted": 0}

        for result in sync_results:
            try:
                if result.action == SyncAction.UNCHANGED:
                    stats["skipped"] += 1
                    continue
                elif result.action == SyncAction.DELETED:
                    self._handle_deleted(result)
                    stats["deleted"] += 1
                else:
                    self._handle_new_or_changed(result, stats)
            except Exception as exc:
                fname = result.file_info.get("name", "unknown")
                logger.error(f"Unhandled error processing {fname}: {exc}")
                stats["failed"] += 1

        logger.info(
            f"Job complete — processed: {stats['processed']}, "
            f"skipped: {stats['skipped']}, "
            f"failed: {stats['failed']}, "
            f"deleted: {stats['deleted']}"
        )
        self.db.close()

    # ─── Per-file handlers ────────────────────────────────────────────────────

    def _handle_new_or_changed(self, result: FileSyncResult, stats: dict):
        file_info = result.file_info
        file_name = file_info["name"]

        if result.content is None:
            logger.warning(f"No content available for {file_name}, skipping")
            stats["failed"] += 1
            return

        # Persist binary to raw storage
        raw_path = os.path.join(settings.RAW_STORAGE_DIR, file_name)
        try:
            with open(raw_path, "wb") as fh:
                fh.write(result.content)
        except OSError as exc:
            logger.error(f"Could not write {file_name} to raw storage: {exc}")
            stats["failed"] += 1
            return

        # Extract text
        try:
            text = self.extractor.extract(raw_path, file_name)
        except Exception as exc:
            logger.error(f"Text extraction failed for {file_name}: {exc}")
            self._move(raw_path, settings.FAILED_STORAGE_DIR, file_name)
            stats["failed"] += 1
            return

        if not text or not text.strip():
            logger.warning(f"No text extracted from {file_name}, skipping")
            self._move(raw_path, settings.FAILED_STORAGE_DIR, file_name)
            stats["failed"] += 1
            return

        # Chunk
        chunks = self.chunker.chunk(text)
        if not chunks:
            logger.warning(f"Zero chunks produced for {file_name}, skipping")
            stats["failed"] += 1
            return

        # Embed
        try:
            embeddings = self.embedder.embed(chunks)
        except Exception as exc:
            logger.error(f"Embedding failed for {file_name}: {exc}")
            stats["failed"] += 1
            return

        # Upsert document record
        checksum = compute_sha256(result.content)
        doc_data = {
            "source_system": "sharepoint",
            "document_name": file_name,
            "source_path": file_info["path"],
            "document_type": os.path.splitext(file_name)[1].lower().lstrip("."),
            "checksum": checksum,
            "visibility": "all",
            "tags": {
                "file_path": raw_path.replace("\\", "/"),
                "source_url": file_info.get("web_url", ""),
                "file_size": file_info.get("size", 0),
            },
            "last_modified": file_info.get("last_modified"),
        }
        doc_id = self.db.upsert_document(doc_data)

        # Replace stale chunks when re-ingesting a changed file
        if result.existing_doc_id:
            self.db.delete_document_chunks(doc_id)

        # Insert new chunks + embeddings
        chunk_metadata = {
            "document_name": file_name,
            "source_url": file_info.get("web_url", ""),
            "source_path": file_info["path"],
        }
        self.db.insert_chunks(doc_id, chunks, embeddings, chunk_metadata)

        self._move(raw_path, settings.PROCESSED_STORAGE_DIR, file_name)
        stats["processed"] += 1
        logger.info(
            f"{'New' if result.existing_doc_id is None else 'Updated'}: "
            f"{file_name} ({len(chunks)} chunks)"
        )

    def _handle_deleted(self, result: FileSyncResult):
        """Remove document record + all its chunks (CASCADE handles chunks)."""
        doc_id = result.existing_doc_id
        fname = result.file_info.get("name", "unknown")
        if not doc_id:
            return
        conn = self.db._get_conn()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
            conn.commit()
        logger.info(f"Deleted document and chunks for removed file: {fname}")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _ensure_storage_dirs(self):
        for d in (
            settings.RAW_STORAGE_DIR,
            settings.PROCESSED_STORAGE_DIR,
            settings.FAILED_STORAGE_DIR,
            settings.LOG_DIR,
        ):
            Path(d).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _move(src: str, dest_dir: str, file_name: str):
        dest = os.path.join(dest_dir, file_name)
        try:
            shutil.move(src, dest)
        except Exception:
            pass  # non-critical — raw file cleanup failure should not abort the job
