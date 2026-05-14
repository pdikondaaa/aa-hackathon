import os
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

import psycopg2
import psycopg2.extras

from app.agents.employee.config import (
    EMPLOYEE_VIEW,
    COL_EMPLOYEE_ID, COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL,
    COL_DESIGNATION, COL_DEPARTMENT, COL_PARENT_DEPARTMENT,
    COL_REPORTING_MANAGER, COL_REPORTING_MANAGER_EMAIL,
    COL_FUNCTIONAL_MANAGER, COL_DOJ, COL_WORK_LOCATION, COL_LOCATION_NAME,
    COL_MOBILE, COL_WORK_PHONE, COL_ROLE, COL_GRADE, COL_LEVEL,
    COL_EMPLOYEE_TYPE, COL_EMPLOYEE_STATUS, COL_SKILL_SET,
    COL_TOTAL_EXPERIENCE, COL_ENTITY_NAME,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onboarding")

_PROFILE_COLS = [
    COL_EMPLOYEE_ID, COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL,
    COL_DESIGNATION, COL_DEPARTMENT, COL_PARENT_DEPARTMENT,
    COL_REPORTING_MANAGER, COL_REPORTING_MANAGER_EMAIL,
    COL_FUNCTIONAL_MANAGER, COL_DOJ, COL_WORK_LOCATION, COL_LOCATION_NAME,
    COL_MOBILE, COL_WORK_PHONE, COL_ROLE, COL_GRADE, COL_LEVEL,
    COL_EMPLOYEE_TYPE, COL_EMPLOYEE_STATUS, COL_SKILL_SET,
    COL_TOTAL_EXPERIENCE, COL_ENTITY_NAME,
]


def _connect() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.getenv("ZOHO_DB_HOST", ""),
        port=int(os.getenv("ZOHO_DB_PORT", "5432")),
        dbname=os.getenv("ZOHO_DB_NAME", ""),
        user=os.getenv("ZOHO_DB_USER", ""),
        password=os.getenv("ZOHO_DB_PWD", ""),
        connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
    )


def _fetch_email_by_fullname(conn, full_name: str) -> str | None:
    """Return the EmailId for an employee whose FirstName+LastName matches full_name."""
    view = os.getenv("EMPLOYEE_VIEW", EMPLOYEE_VIEW)
    parts = full_name.strip().split(None, 1)
    if len(parts) < 2:
        return None
    first, last = parts
    sql = (
        f'SELECT "{COL_EMAIL}" FROM {view} '
        f'WHERE "{COL_FIRST_NAME}" ILIKE %s AND "{COL_LAST_NAME}" ILIKE %s '
        f'LIMIT 1'
    )
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, (first, last))
    row = cur.fetchone()
    return row[COL_EMAIL] if row else None


def _fetch_by_email(email: str) -> dict | None:
    view = os.getenv("EMPLOYEE_VIEW", EMPLOYEE_VIEW)
    cols = ", ".join(f'"{c}"' for c in _PROFILE_COLS)
    sql  = f'SELECT {cols} FROM {view} WHERE "{COL_EMAIL}" ILIKE %s LIMIT 1'
    conn = None
    try:
        conn = _connect()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, (email,))
        row = cur.fetchone()
        if not row:
            return None
        result = dict(row)
        func_mgr = result.get(COL_FUNCTIONAL_MANAGER)
        if func_mgr and func_mgr != result.get(COL_REPORTING_MANAGER):
            result["_functional_manager_email"] = _fetch_email_by_fullname(conn, func_mgr)
        return result
    except Exception as exc:
        logger.error("Onboarding DB error: %s", exc)
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


_PEER_COLS = [
    COL_EMPLOYEE_ID, COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL,
    COL_DESIGNATION, COL_DEPARTMENT, COL_WORK_LOCATION, COL_LOCATION_NAME,
    COL_REPORTING_MANAGER, COL_EMPLOYEE_STATUS,
]


def _fetch_peers(reporting_manager: str, exclude_email: str) -> list[dict]:
    view = os.getenv("EMPLOYEE_VIEW", EMPLOYEE_VIEW)
    cols = ", ".join(f'"{c}"' for c in _PEER_COLS)
    sql  = (
        f'SELECT {cols} FROM {view} '
        f'WHERE "{COL_REPORTING_MANAGER}" ILIKE %s '
        f'  AND "{COL_EMAIL}" NOT ILIKE %s '
        f'  AND "{COL_EMPLOYEE_STATUS}" ILIKE %s '
        f'ORDER BY "{COL_FIRST_NAME}", "{COL_LAST_NAME}"'
    )
    conn = None
    try:
        conn = _connect()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, (reporting_manager, exclude_email, 'Active'))
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Onboarding peers DB error: %s", exc)
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def _format_peer(row: dict) -> dict:
    first = str(row.get(COL_FIRST_NAME) or "")
    last  = str(row.get(COL_LAST_NAME) or "")
    return {
        "employee_id":  row.get(COL_EMPLOYEE_ID),
        "full_name":    f"{first} {last}".strip(),
        "email":        row.get(COL_EMAIL),
        "designation":  row.get(COL_DESIGNATION),
        "department":   row.get(COL_DEPARTMENT),
        "location":     row.get(COL_LOCATION_NAME) or row.get(COL_WORK_LOCATION),
    }


@router.get("/employee")
def get_onboarding_employee(
    email: str = Query(..., description="Employee work email address"),
):
    """Return the onboarding profile for the employee identified by email."""
    try:
        row = _fetch_by_email(email)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if not row:
        raise HTTPException(status_code=404, detail=f"No employee found for email: {email}")

    first = str(row.get(COL_FIRST_NAME) or "")
    last  = str(row.get(COL_LAST_NAME) or "")
    doj   = row.get(COL_DOJ)

    return {
        "employee_id":             row.get(COL_EMPLOYEE_ID),
        "first_name":              first,
        "last_name":               last,
        "full_name":               f"{first} {last}".strip(),
        "email":                   row.get(COL_EMAIL),
        "designation":             row.get(COL_DESIGNATION),
        "department":              row.get(COL_DEPARTMENT),
        "parent_department":       row.get(COL_PARENT_DEPARTMENT),
        "reporting_manager":        row.get(COL_REPORTING_MANAGER),
        "reporting_manager_email":  row.get(COL_REPORTING_MANAGER_EMAIL),
        "functional_manager":       row.get(COL_FUNCTIONAL_MANAGER),
        "functional_manager_email": row.get("_functional_manager_email"),
        "date_of_joining":         doj.isoformat() if doj else None,
        "work_location":           row.get(COL_WORK_LOCATION),
        "location_name":           row.get(COL_LOCATION_NAME),
        "mobile":                  row.get(COL_MOBILE),
        "work_phone":              row.get(COL_WORK_PHONE),
        "role":                    row.get(COL_ROLE),
        "grade":                   row.get(COL_GRADE),
        "level":                   row.get(COL_LEVEL),
        "employee_type":           row.get(COL_EMPLOYEE_TYPE),
        "employee_status":         row.get(COL_EMPLOYEE_STATUS),
        "skill_set":               row.get(COL_SKILL_SET),
        "total_experience":        row.get(COL_TOTAL_EXPERIENCE),
        "entity_name":             row.get(COL_ENTITY_NAME),
    }


@router.get("/peers")
def get_onboarding_peers(
    email: str = Query(..., description="Employee email — returns active colleagues with the same reporting manager"),
):
    """Return active employees who share the same reporting manager as the given employee."""
    try:
        profile = _fetch_by_email(email)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if not profile:
        raise HTTPException(status_code=404, detail=f"No employee found for email: {email}")

    manager = profile.get(COL_REPORTING_MANAGER)
    if not manager:
        return {"peers": [], "reporting_manager": None}

    try:
        rows = _fetch_peers(manager, email)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return {
        "reporting_manager": manager,
        "peers": [_format_peer(r) for r in rows],
    }
