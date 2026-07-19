"""
Employee Directory service.
Sources the full active-employee roster from the Zoho People database
(people.vb_employees) — the same source of truth used by user_service.
"""
import os
import logging
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).resolve().parents[5] / ".env")

_EMPLOYEE_VIEW = os.getenv("EMPLOYEE_VIEW", "people.vb_employees")


def _get_zoho_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.getenv("ZOHO_DB_HOST", ""),
        port=int(os.getenv("ZOHO_DB_PORT", "5432")),
        dbname=os.getenv("ZOHO_DB_NAME", ""),
        user=os.getenv("ZOHO_DB_USER", ""),
        password=os.getenv("ZOHO_DB_PWD", ""),
        connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def get_employee_directory() -> dict:
    """
    Returns the active-employee roster plus filter options for the
    Employee Directory tab.  Only non-sensitive columns are exposed.
    """
    with _get_zoho_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT "EmployeeId", employee_id AS zoho_record_id, "FirstName", "LastName", "EmailId",
                       "Designation", "Department", "Role", "LocationName",
                       "WorkLocation", "ReportingManager"
                FROM   {_EMPLOYEE_VIEW}
                WHERE  "EmployeeStatus" ILIKE 'Active'
                ORDER  BY "FirstName", "LastName"
                """
            )
            rows = cur.fetchall()

    employees = []
    for row in rows:
        first = str(row.get("FirstName") or "").strip()
        last = str(row.get("LastName") or "").strip()
        name = f"{first} {last}".strip()
        email = str(row.get("EmailId") or "").strip()
        department = str(row.get("Department") or "").strip()
        designation = str(row.get("Designation") or "").strip()

        employees.append({
            "employee_id": row.get("EmployeeId") or "",
            # Sent as a string — this 18-digit Zoho record ID exceeds JS's safe
            # integer range (2^53), so a bare JSON number would get silently
            # rounded (and distinct IDs could collide) on the frontend.
            "zoho_record_id": str(row["zoho_record_id"]) if row.get("zoho_record_id") is not None else None,
            "name": name,
            "email": email,
            "teams_handle": email.split("@")[0] if email else "",
            "designation": designation,
            "department": department,
            "location": str(row.get("LocationName") or row.get("WorkLocation") or "").strip(),
            "reporting_manager": str(row.get("ReportingManager") or "").strip(),
        })

    departments = sorted({e["department"] for e in employees if e["department"]})
    designations = sorted({e["designation"] for e in employees if e["designation"]})

    return {
        "total": len(employees),
        "employees": employees,
        "filter_options": {
            "departments": departments,
            "designations": designations,
        },
    }
