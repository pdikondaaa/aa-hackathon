"""
WebScraperService — orchestrates the SharePoint HTML page / list scraping
pipeline and writes results into the same PostgreSQL document_chunks table
that the file-based IngestionService uses.

Does NOT require Azure AD app registration or Graph API.
Uses Playwright for Microsoft SSO login and the SharePoint REST API for data.

Activation (both default to false):
    SCRAPE_PAGES_ENABLED=true   — scrape site pages
    SCRAPE_LISTS_ENABLED=true   — scrape list contents

Rows written here carry source_system='sharepoint_web' so they can be
distinguished from file-based rows ('sharepoint') at query time.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from config.settings import settings
from connectors.sharepoint_web_scraper import SharePointSiteScraper
from extractors.html_extractor import HtmlExtractor
from chunking.chunker import TextChunker
from embeddings.embedder import Embedder
from storage.db import DocumentRepository
from utils.logging_config import get_logger

logger = get_logger(__name__)


class WebScraperService:
    """
    Discover → scrape → extract → chunk → embed → store pipeline for
    SharePoint site pages and lists.

    Reads SHAREPOINT_SITE_URL, SHAREPOINT_LOGIN_EMAIL, and
    SHAREPOINT_LOGIN_PASSWORD from settings.
    """

    SOURCE_SYSTEM = "sharepoint_web"

    def __init__(self):
        self.html_extractor = HtmlExtractor()
        self.chunker = TextChunker()
        self.embedder = Embedder()
        self.db = DocumentRepository()

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self):
        """
        Run the full web scraping pipeline.

        Opens (or restores) an authenticated Playwright session, then
        scrapes pages and/or lists depending on settings flags.
        """
        site_url = settings.SHAREPOINT_SITE_URL
        if not site_url:
            logger.error(
                "SHAREPOINT_SITE_URL is not configured — web scraping aborted"
            )
            return

        stats = {
            "pages_ok": 0, "pages_skip": 0, "pages_fail": 0,
            "lists_ok": 0,  "lists_skip": 0,  "lists_fail": 0,
        }

        with SharePointSiteScraper(site_url) as scraper:
            scraper.ensure_login(
                settings.SHAREPOINT_LOGIN_EMAIL,
                settings.SHAREPOINT_LOGIN_PASSWORD,
            )

            if settings.SCRAPE_PAGES_ENABLED:
                self._ingest_pages(scraper, stats)
            else:
                logger.info("SCRAPE_PAGES_ENABLED=false — page scraping skipped")

            if settings.SCRAPE_LISTS_ENABLED:
                self._ingest_lists(scraper, stats)
            else:
                logger.info("SCRAPE_LISTS_ENABLED=false — list scraping skipped")

        self.db.close()
        logger.info(
            "WebScraperService done: "
            f"pages ok={stats['pages_ok']} skip={stats['pages_skip']} "
            f"fail={stats['pages_fail']} | "
            f"lists ok={stats['lists_ok']} skip={stats['lists_skip']} "
            f"fail={stats['lists_fail']}"
        )

    # ── Pages pipeline ────────────────────────────────────────────────────────

    def _ingest_pages(self, scraper: SharePointSiteScraper, stats: dict):
        pages = scraper.list_pages()

        if settings.SCRAPE_MAX_PAGES and len(pages) > settings.SCRAPE_MAX_PAGES:
            logger.warning(
                f"Capping to {settings.SCRAPE_MAX_PAGES} pages "
                f"(discovered {len(pages)})"
            )
            pages = pages[: settings.SCRAPE_MAX_PAGES]

        total = len(pages)
        logger.info(f"Scraping {total} page(s)")

        for i, page_meta in enumerate(pages, 1):
            title = page_meta.get("title", "Untitled")
            page_url = page_meta.get("url", "")
            last_mod = page_meta.get("last_modified", "")
            logger.info(f"  [{i}/{total}] {title}")
            try:
                self._process_page(scraper, title, page_url, last_mod, stats)
            except Exception as exc:
                logger.error(f"  Error for page '{title}': {exc}")
                stats["pages_fail"] += 1

    def _process_page(
        self,
        scraper: SharePointSiteScraper,
        title: str,
        page_url: str,
        last_mod: str,
        stats: dict,
    ):
        html = scraper.get_page_html(page_url)
        if not html:
            logger.warning(f"  No HTML for '{title}' — skipping")
            stats["pages_fail"] += 1
            return

        text = self.html_extractor.extract(html, title)
        if not text.strip():
            logger.warning(f"  Empty text after extraction for '{title}' — skipping")
            stats["pages_fail"] += 1
            return

        source_path = f"page://{page_url}"
        skipped = self._push_to_db(
            text=text,
            source_path=source_path,
            document_name=f"{title}.html",
            document_type="html",
            web_url=page_url,
            last_modified=last_mod,
        )
        stats["pages_skip" if skipped else "pages_ok"] += 1

    # ── Lists pipeline ────────────────────────────────────────────────────────

    def _ingest_lists(self, scraper: SharePointSiteScraper, stats: dict):
        sp_lists = scraper.list_all_lists()

        whitelist = {n.strip().lower() for n in settings.SCRAPE_LIST_NAMES if n.strip()}
        if whitelist:
            before = len(sp_lists)
            sp_lists = [l for l in sp_lists if l["title"].lower() in whitelist]
            logger.info(f"List whitelist applied: {before} → {len(sp_lists)} list(s)")

        total = len(sp_lists)
        logger.info(f"Scraping {total} list(s)")

        for i, lst in enumerate(sp_lists, 1):
            title = lst["title"]
            logger.info(f"  [{i}/{total}] {title}")
            try:
                self._process_list(scraper, lst, stats)
            except Exception as exc:
                logger.error(f"  Error for list '{title}': {exc}")
                stats["lists_fail"] += 1

    def _process_list(
        self,
        scraper: SharePointSiteScraper,
        lst: dict,
        stats: dict,
    ):
        title = lst["title"]
        text = scraper.get_list_items_as_text(title)
        if not text.strip():
            logger.warning(f"  Empty content for list '{title}' — skipping")
            stats["lists_fail"] += 1
            return

        source_path = f"list://{settings.SHAREPOINT_SITE_URL}/{lst['id']}"
        skipped = self._push_to_db(
            text=text,
            source_path=source_path,
            document_name=f"{title} (SharePoint List)",
            document_type="sharepoint_list",
            web_url="",
            last_modified="",
        )
        stats["lists_skip" if skipped else "lists_ok"] += 1

    # ── Core: chunk → embed → upsert ──────────────────────────────────────────

    def _push_to_db(
        self,
        text: str,
        source_path: str,
        document_name: str,
        document_type: str,
        web_url: str,
        last_modified: str,
    ) -> bool:
        """
        Chunk, embed, and upsert into documents + document_chunks.

        Returns True when content was unchanged (skipped), False when ingested.
        """
        checksum = hashlib.sha256(text.encode("utf-8")).hexdigest()

        existing = self.db.get_document_by_source_path(source_path)
        if existing and existing.get("checksum") == checksum:
            logger.debug(f"  Unchanged: {document_name}")
            return True

        chunks = self.chunker.chunk(text)
        if not chunks:
            logger.warning(f"  Zero chunks for: {document_name}")
            return False

        embeddings = self.embedder.embed(chunks)

        doc_data = {
            "source_system": self.SOURCE_SYSTEM,
            "document_name": document_name,
            "source_path": source_path,
            "document_type": document_type,
            "checksum": checksum,
            "visibility": "all",
            "tags": {
                "source_url": web_url,
                "file_size": len(text),
                "scraped_at": datetime.now(tz=timezone.utc).isoformat(),
            },
            "last_modified": last_modified or None,
        }
        doc_id = self.db.upsert_document(doc_data)

        if existing:
            self.db.delete_document_chunks(doc_id)

        self.db.insert_chunks(
            doc_id, chunks, embeddings,
            {"document_name": document_name, "source_url": web_url, "source_path": source_path},
        )
        logger.info(f"  Stored {len(chunks)} chunks for: {document_name}")
        return False
