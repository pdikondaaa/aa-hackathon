"""
Incremental sync logic — decides which SharePoint files need (re-)processing.

Strategy:
  1. Fetch full file list + last_modified timestamps from SharePoint.
  2. For each file, look up its record in the documents table.
  3. If absent → needs processing (new file).
  4. If last_modified changed → download and compare SHA256 checksums.
     - Checksum unchanged  → metadata-only update, skip chunking/embedding.
     - Checksum changed    → full re-ingest.
  5. Files whose sharepoint_path no longer exists in SharePoint are flagged
     as deleted so the caller can clean them from the database.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from connectors.sharepoint import SharePointConnector
from storage.db import DocumentRepository
from utils.hashing import compute_sha256
from utils.logging_config import get_logger

logger = get_logger(__name__)


class SyncAction(str, Enum):
    NEW = "new"
    CHANGED = "changed"
    UNCHANGED = "unchanged"
    DELETED = "deleted"


@dataclass
class FileSyncResult:
    file_info: dict
    action: SyncAction
    existing_doc_id: Optional[str] = None
    content: Optional[bytes] = None   # populated only for NEW / CHANGED


class SyncService:
    """
    Compares SharePoint state against the documents table and classifies
    each file as new, changed, unchanged, or deleted.
    """

    def __init__(self):
        self.connector = SharePointConnector()
        self.db = DocumentRepository()

    def run(self) -> tuple:
        """
        Returns (drive_id, results) where results is a list of FileSyncResult.
        Callers should iterate results and process only NEW / CHANGED entries.
        """
        logger.info("SyncService: fetching SharePoint file list")
        site_id = self.connector.get_site_id()
        remote_files = self.connector.list_all_files(site_id)
        logger.info(f"SyncService: {len(remote_files)} eligible files found across all sites")

        remote_paths = {f["path"] for f in remote_files}
        results = []

        # ── Classify each remote file ─────────────────────────────────────────
        for file_info in remote_files:
            result = self._classify(file_info)
            results.append(result)

        # ── Detect server-side deletions ──────────────────────────────────────
        deleted = self._find_deleted(remote_paths)
        results.extend(deleted)

        new_count = sum(1 for r in results if r.action == SyncAction.NEW)
        changed_count = sum(1 for r in results if r.action == SyncAction.CHANGED)
        unchanged_count = sum(1 for r in results if r.action == SyncAction.UNCHANGED)
        deleted_count = sum(1 for r in results if r.action == SyncAction.DELETED)

        logger.info(
            f"Sync summary — new: {new_count}, changed: {changed_count}, "
            f"unchanged: {unchanged_count}, deleted: {deleted_count}"
        )
        return site_id, results

    # ─── Private helpers ──────────────────────────────────────────────────────

    def _classify(self, file_info: dict) -> "FileSyncResult":
        sp_path = file_info["path"]
        # Each file carries the drive_id of the site it came from
        drive_id = file_info["drive_id"]
        existing = self.db.get_document_by_source_path(sp_path)

        if existing is None:
            # New file — download immediately so content is ready for ingestion
            content = self._safe_download(drive_id, sp_path, file_info["name"])
            return FileSyncResult(
                file_info=file_info,
                action=SyncAction.NEW,
                content=content,
            )

        stored_modified = str(existing.get("last_modified", ""))
        remote_modified = file_info.get("last_modified", "")

        if stored_modified == remote_modified:
            return FileSyncResult(
                file_info=file_info,
                action=SyncAction.UNCHANGED,
                existing_doc_id=str(existing["id"]),
            )

        # Timestamp changed — download and check checksum before deciding
        content = self._safe_download(drive_id, sp_path, file_info["name"])
        if content is None:
            # Download failed; treat as unchanged to avoid data loss
            return FileSyncResult(
                file_info=file_info,
                action=SyncAction.UNCHANGED,
                existing_doc_id=str(existing["id"]),
            )

        new_checksum = compute_sha256(content)
        if new_checksum == existing.get("checksum", ""):
            # Timestamp drifted but content is identical — just refresh metadata
            return FileSyncResult(
                file_info=file_info,
                action=SyncAction.UNCHANGED,
                existing_doc_id=str(existing["id"]),
                content=content,
            )

        return FileSyncResult(
            file_info=file_info,
            action=SyncAction.CHANGED,
            existing_doc_id=str(existing["id"]),
            content=content,
        )

    def _safe_download(self, drive_id: str, sp_path: str, name: str) -> Optional[bytes]:
        try:
            return self.connector.download_file(drive_id, sp_path)
        except PermissionError as exc:
            logger.warning(f"Skipping {name} (no access): {exc}")
            return None
        except Exception as exc:
            logger.error(f"Download failed for {name}: {exc}")
            return None

    def _find_deleted(self, remote_paths: set) -> list:
        """
        Placeholder: query the documents table for sharepoint paths that are
        no longer present in the remote list. This prevents stale embeddings
        from accumulating after documents are removed from SharePoint.

        Full implementation requires a 'SELECT sharepoint_path FROM documents'
        query, which is added here for clarity.
        """
        deleted = []
        conn = self.db._get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, source_path, document_name FROM documents WHERE source_system = 'sharepoint'"
            )
            for doc_id, sp_path, fname in cur.fetchall():
                if sp_path not in remote_paths:
                    logger.info(f"Detected deleted file: {fname} ({sp_path})")
                    deleted.append(FileSyncResult(
                        file_info={"name": fname, "path": sp_path},
                        action=SyncAction.DELETED,
                        existing_doc_id=str(doc_id),
                    ))
        return deleted
