#!/usr/bin/env python3
"""
Data_Files CSV → PostgreSQL Ingestion
======================================
Reads every CSV under Data_Files/ and loads it into a separate table on
hackathon.alignedautomation.com (squadrons DB).

Table naming:
  AI_Tool_License_Details/Claude_Users_List.csv  → ai_claude_users
  Zoho_Analytics_Data/employee_master.csv        → zoho_employee_master
  ... etc.

Usage:
  python ingest_data_files.py
"""

import os
import re
import sys
import logging
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ── Setup ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
load_dotenv()  # searches up from cwd to find root .env

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host":     os.getenv("SQL_HOST",     "hackathon.alignedautomation.com"),
    "port":     int(os.getenv("SQL_PORT", "5432")),
    "dbname":   os.getenv("SQL_DB",       "squadrons"),
    "user":     os.getenv("SQL_USERNAME", "squadrons"),
    "password": os.getenv("SQL_PWD",      ""),
}

DATA_DIR   = ROOT  # CSVs live in subdirs of the same folder as this script
SCHEMA     = "public"          # target schema
BATCH_SIZE = 500               # rows per INSERT batch

# Folder → short prefix
FOLDER_PREFIX = {
    "ai_tool_license_details": "ai",
    "zoho_analytics_data":     "zoho",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convert any string to a safe lowercase PostgreSQL identifier."""
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    if not text or text[0].isdigit():
        text = "col_" + text
    return text


def make_table_name(csv_path: Path) -> str:
    folder_slug = slugify(csv_path.parent.name)
    prefix      = FOLDER_PREFIX.get(folder_slug, folder_slug[:6])
    stem        = slugify(csv_path.stem)
    # Drop trailing "_list" suffix (e.g. claude_users_list → claude_users)
    stem = re.sub(r"_list$", "", stem)
    return f"{prefix}_{stem}"


def unique_columns(columns: list[str]) -> list[str]:
    """Deduplicate column names by appending _2, _3 … when needed."""
    seen: dict[str, int] = {}
    result = []
    for col in columns:
        if col not in seen:
            seen[col] = 0
            result.append(col)
        else:
            seen[col] += 1
            result.append(f"{col}_{seen[col] + 1}")
    return result


def read_csv(path: Path) -> pd.DataFrame:
    """
    Read a CSV file robustly:
    - handles BOM (utf-8-sig) and latin-1 fallback
    - keeps all values as strings (avoids losing leading zeros, mixed formats)
    - normalises empty strings to None (→ SQL NULL)
    """
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            df = pd.read_csv(
                path,
                dtype=str,
                keep_default_na=False,
                encoding=enc,
                low_memory=False,
            )
            # Normalise empty / whitespace-only strings → None
            df = df.map(lambda v: None if str(v).strip() == "" else str(v).strip())
            return df
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Could not decode {path}")


def build_create_ddl(table: str, columns: list[str]) -> str:
    """All data columns stored as TEXT; synthetic PK added automatically."""
    col_defs = "\n".join(f'    "{c}" TEXT,' for c in columns)
    return (
        f'CREATE TABLE IF NOT EXISTS {SCHEMA}."{table}" (\n'
        f'    _id SERIAL PRIMARY KEY,\n'
        f'{col_defs}\n'
        f'    _source_file TEXT\n'
        f');'
    )


# ── Core ingest ───────────────────────────────────────────────────────────────

def ingest_csv(conn, csv_path: Path) -> dict:
    table      = make_table_name(csv_path)
    rel        = csv_path.relative_to(ROOT)

    log.info("▶  %-55s → %s", str(rel), table)

    # 1. Read
    df = read_csv(csv_path)

    # 2. Sanitise column names
    df.columns = unique_columns([slugify(c) for c in df.columns])

    row_count = len(df)
    col_count = len(df.columns)
    log.info("   Columns: %d  |  Rows: %d", col_count, row_count)

    # 3. DDL: drop + recreate for a clean load
    with conn.cursor() as cur:
        cur.execute(f'DROP TABLE IF EXISTS {SCHEMA}."{table}" CASCADE;')
        cur.execute(build_create_ddl(table, list(df.columns)))
    conn.commit()

    # 4. Bulk INSERT in batches
    data_cols   = list(df.columns)
    all_cols    = data_cols + ["_source_file"]
    cols_quoted = ", ".join(f'"{c}"' for c in all_cols)
    insert_sql  = f'INSERT INTO {SCHEMA}."{table}" ({cols_quoted}) VALUES %s'

    source_tag  = str(rel)

    # Build rows: (col1, col2, …, _source_file)
    def make_row(row_tuple):
        return tuple(row_tuple) + (source_tag,)

    total_inserted = 0
    with conn.cursor() as cur:
        for start in range(0, row_count, BATCH_SIZE):
            chunk = df.iloc[start : start + BATCH_SIZE]
            rows  = [make_row(r) for r in chunk.itertuples(index=False, name=None)]
            execute_values(cur, insert_sql, rows)
            total_inserted += len(rows)
    conn.commit()

    log.info("   ✓  %d rows inserted into \"%s\"\n", total_inserted, table)
    return {"table": table, "rows": total_inserted, "columns": col_count, "status": "ok"}


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("=" * 65)
    log.info("Data_Files CSV Ingestion")
    log.info("Target: %s/%s", DB_CONFIG["host"], DB_CONFIG["dbname"])
    log.info("=" * 65)

    # Discover CSV files
    csv_files = sorted(DATA_DIR.rglob("*.csv"))
    if not csv_files:
        log.error("No CSV files found under %s", DATA_DIR)
        sys.exit(1)

    log.info("Found %d CSV files\n", len(csv_files))

    # Connect
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        log.info("Connected to database.\n")
    except Exception as e:
        log.error("Cannot connect to database: %s", e)
        sys.exit(1)

    results  = []
    failures = []

    for csv_path in csv_files:
        try:
            result = ingest_csv(conn, csv_path)
            results.append(result)
        except Exception as exc:
            log.error("   ✗  FAILED %s: %s\n", csv_path.name, exc)
            conn.rollback()
            failures.append({"file": csv_path.name, "error": str(exc)})

    conn.close()

    # ── Summary report ────────────────────────────────────────────────────────
    log.info("=" * 65)
    log.info("SUMMARY")
    log.info("=" * 65)
    log.info("%-40s %8s %7s", "Table", "Rows", "Cols")
    log.info("-" * 60)
    for r in results:
        log.info("%-40s %8d %7d", r["table"], r["rows"], r["columns"])

    if failures:
        log.info("")
        log.info("FAILURES:")
        for f in failures:
            log.error("  ✗  %-35s %s", f["file"], f["error"])

    log.info("")
    log.info("Done  ✓ %d tables loaded  ✗ %d failed", len(results), len(failures))
    log.info("=" * 65)

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
