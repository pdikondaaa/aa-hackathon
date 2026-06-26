#!/usr/bin/env python3
"""
AURA — Unified Data Ingestion Runner
=====================================
Runs every ingestion step in the correct order with a single command.

Steps
-----
  1. create_schema              — core pgvector schema, seed CSVs, attendance table
  2. create_communications_schema — org_announcements / org_events tables
  3. ingest_data_files          — AI-licence & Zoho Analytics CSVs → DB tables
  4. sharepoint main            — SharePoint document ingestion pipeline

Usage
-----
  # from anywhere inside the repo:
  python apps/jobs/run_all_ingestion.py

  # skip SharePoint (schema + local data only):
  python apps/jobs/run_all_ingestion.py --skip-sharepoint

  # run a single named step:
  python apps/jobs/run_all_ingestion.py --only create_schema
"""

import argparse
import logging
import subprocess
import sys
from pathlib import Path

JOBS_DIR = Path(__file__).resolve().parent
SP_DIR   = JOBS_DIR / "sharepoint_ingestion"
DF_DIR   = JOBS_DIR / "Data_Files"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run_all_ingestion")

# ── Step registry ─────────────────────────────────────────────────────────────
STEPS = [
    {
        "key":    "create_schema",
        "name":   "Core schema + seed data",
        "script": SP_DIR / "create_schema.py",
        "cwd":    SP_DIR,
    },
    {
        "key":    "create_communications_schema",
        "name":   "Communications schema",
        "script": SP_DIR / "create_communications_schema.py",
        "cwd":    SP_DIR,
    },
    {
        "key":    "ingest_data_files",
        "name":   "Data Files CSV ingestion",
        "script": DF_DIR / "ingest_data_files.py",
        "cwd":    DF_DIR,
    },
    {
        "key":    "sharepoint",
        "name":   "SharePoint document ingestion",
        "script": SP_DIR / "main.py",
        "cwd":    SP_DIR,
    },
]


# ── Runner ────────────────────────────────────────────────────────────────────

def run_step(step: dict) -> bool:
    log.info("")
    log.info("=" * 60)
    log.info("  STEP: %s", step["name"])
    log.info("=" * 60)

    result = subprocess.run(
        [sys.executable, str(step["script"])],
        cwd=str(step["cwd"]),
    )

    if result.returncode != 0:
        log.error("FAILED: %s  (exit code %d)", step["name"], result.returncode)
        return False

    log.info("DONE:   %s", step["name"])
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all AURA ingestion steps.")
    parser.add_argument(
        "--skip-sharepoint",
        action="store_true",
        help="Skip the SharePoint document ingestion step.",
    )
    parser.add_argument(
        "--only",
        metavar="KEY",
        help=(
            "Run only the named step. Keys: "
            + ", ".join(s["key"] for s in STEPS)
        ),
    )
    args = parser.parse_args()

    # Determine which steps to run
    steps = STEPS
    if args.only:
        steps = [s for s in STEPS if s["key"] == args.only]
        if not steps:
            log.error("Unknown step key: %s", args.only)
            sys.exit(1)
    elif args.skip_sharepoint:
        steps = [s for s in STEPS if s["key"] != "sharepoint"]

    log.info("")
    log.info("=" * 60)
    log.info("  AURA — Full Ingestion Pipeline")
    log.info("  Steps to run: %d", len(steps))
    log.info("=" * 60)

    passed, failed, skipped = [], [], []

    for step in steps:
        ok = run_step(step)
        (passed if ok else failed).append(step["name"])
        if not ok:
            skipped = [s["name"] for s in steps if s["name"] not in passed and s["name"] not in failed]
            log.error("Stopping pipeline after failed step.")
            break

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 60)
    log.info("  SUMMARY")
    log.info("=" * 60)
    for name in passed:
        log.info("  ✓  %s", name)
    for name in failed:
        log.error("  ✗  %s", name)
    for name in skipped:
        log.info("  -  %s  (skipped)", name)
    log.info("")

    if failed:
        log.error(
            "Pipeline failed. %d step(s) succeeded, %d failed, %d skipped.",
            len(passed), len(failed), len(skipped),
        )
        sys.exit(1)
    else:
        log.info("All %d step(s) completed successfully.", len(passed))


if __name__ == "__main__":
    main()
