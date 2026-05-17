"""
AURA SharePoint Ingestion Job — entry point.

Run manually:
    cd apps/jobs/sharepoint_ingestion
    python main.py

Schedule via cron (Linux/AKS CronJob):
    0 2 * * * cd /app/jobs/sharepoint_ingestion && python main.py >> logs/cron.log 2>&1

Schedule via Windows Task Scheduler:
    Action: python.exe  Arguments: main.py  Start in: <path>/jobs/sharepoint_ingestion

Web scraping is controlled by .env flags (both default to false):
    SCRAPE_PAGES_ENABLED=true   — scrape SharePoint site pages (HTML)
    SCRAPE_LISTS_ENABLED=true   — scrape SharePoint list contents

Pipeline order:
    1. File ingestion  (documents from SharePoint document libraries)
    2. Web scraping    (site pages + lists, only when enabled)
"""
import sys
import os

# Ensure the job root is on sys.path so relative imports resolve correctly
# whether the script is run from its own directory or the repo root.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from config.settings import settings
from services.ingestion_service import IngestionService
from utils.logging_config import get_logger

logger = get_logger("main")


def main():
    logger.info("=" * 60)
    logger.info("AURA SharePoint Ingestion Job  —  starting")
    logger.info("=" * 60)

    # ── Phase 1: File ingestion (PDF, DOCX, XLSX, …) ──────────────────────────
    logger.info("Phase 1: file ingestion")
    try:
        service = IngestionService()
        service.run()
    except Exception as exc:
        logger.exception(f"File ingestion failed with unhandled exception: {exc}")
        sys.exit(1)

    # ── Phase 2: Web scraping (site pages + lists) — opt-in via .env ─────────
    if settings.SCRAPE_PAGES_ENABLED or settings.SCRAPE_LISTS_ENABLED:
        logger.info("Phase 2: web scraping (pages / lists)")
        try:
            from services.web_scraper_service import WebScraperService
            WebScraperService().run()
        except Exception as exc:
            logger.exception(f"Web scraping failed: {exc}")
            # Non-fatal: file ingestion already succeeded
    else:
        logger.info(
            "Phase 2: web scraping skipped "
            "(SCRAPE_PAGES_ENABLED and SCRAPE_LISTS_ENABLED are both false)"
        )

    logger.info("=" * 60)
    logger.info("AURA SharePoint Ingestion Job  —  finished")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
