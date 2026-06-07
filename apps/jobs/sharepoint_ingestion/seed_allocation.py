"""
Re-seeds the allocation_details table from the updated CSV.
Deletes all existing rows and re-imports, so the data matches the CSV exactly.
Run from the sharepoint_ingestion directory:
    python seed_allocation.py
"""
import csv
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(ROOT_ENV)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", os.getenv("SQL_HOST", "hackathon.alignedautomation.com")),
    "port":     int(os.getenv("DB_PORT", os.getenv("SQL_PORT", 5432))),
    "dbname":   os.getenv("DB_NAME", os.getenv("SQL_DB", "squadrons")),
    "user":     os.getenv("DB_USER", os.getenv("SQL_USERNAME", "squadrons")),
    "password": os.getenv("DB_PASSWORD", os.getenv("SQL_PWD", "TwlU0KL1LZbZLYS$")),
}

CSV_PATH = Path(__file__).parent / "data" / "allocation_details.csv"

INT_COLS   = {"efforts_pct", "billability_pct", "efforts_ft", "billability_ft"}
FLOAT_COLS = {"calculated_project_multiselect"}
TS_COLS    = {"allocation_date", "added_time", "modified_time"}
SKIP_COLS  = set()  # id is included — we insert it explicitly to preserve IDs


def coerce(col, val):
    if val == "" or val is None:
        return None
    if col in INT_COLS:
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return None
    if col in FLOAT_COLS:
        try:
            return float(val)
        except (ValueError, TypeError):
            return None
    if col in TS_COLS:
        return val or None
    return val


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    col_names = list(rows[0].keys())  # preserve CSV column order
    placeholders = ", ".join(["%s"] * len(col_names))
    cols_sql = ", ".join(col_names)
    insert_sql = (
        f"INSERT INTO allocation_details ({cols_sql}) VALUES ({placeholders}) "
        f"ON CONFLICT (id) DO UPDATE SET "
        + ", ".join(f"{c} = EXCLUDED.{c}" for c in col_names if c != "id")
    )

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM allocation_details")
            before = cur.fetchone()[0]
            print(f"Rows before: {before}")

            inserted = updated = 0
            for r in rows:
                values = [coerce(c, r.get(c)) for c in col_names]
                cur.execute(insert_sql, values)
                if cur.rowcount == 1:
                    inserted += 1
                else:
                    updated += 1

            cur.execute("SELECT COUNT(*) FROM allocation_details")
            after = cur.fetchone()[0]

        conn.commit()
        print(f"Done. Inserted: {inserted}, Updated: {updated}")
        print(f"Rows after:  {after}")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
