"""
AURA SharePoint Ingestion Job — entry point.

Run manually:
    cd jobs/sharepoint_ingestion
    python main.py

Schedule via cron (Linux/AKS CronJob):
    0 2 * * * cd /app/jobs/sharepoint_ingestion && python main.py >> logs/cron.log 2>&1

Schedule via Windows Task Scheduler:
    Action: python.exe  Arguments: main.py  Start in: <path>/jobs/sharepoint_ingestion
"""
import sys
import os

# Ensure the job root is on sys.path so relative imports resolve correctly
# whether the script is run from its own directory or the repo root.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from services.ingestion_service import IngestionService
from utils.logging_config import get_logger

logger = get_logger("main")


def main():
    logger.info("=" * 60)
    logger.info("AURA SharePoint Ingestion Job  —  starting")
    logger.info("=" * 60)

    try:
        service = IngestionService()
        service.run()
    except Exception as exc:
        logger.exception(f"Job failed with unhandled exception: {exc}")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("AURA SharePoint Ingestion Job  —  finished")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
