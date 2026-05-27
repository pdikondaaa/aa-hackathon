"""
User service — shared helpers for resolving user identity.

All user information (name, designation, department, etc.) is sourced
from the Zoho People database (people.vb_employees) using the logged-in
user's email as the lookup key.  Azure AD data (display_name from the JWT)
is only used as a last-resort fallback.
"""

import os
import logging
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any

import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

from app.api.config.db_config import get_db_connection

load_dotenv(Path(__file__).resolve().parents[5] / ".env")

logger = logging.getLogger(__name__)

_EMPLOYEE_VIEW = os.getenv("EMPLOYEE_VIEW", "people.vb_employees")


# ---------------------------------------------------------------------------
# Zoho DB connection
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Zoho employee profile lookup (primary source of truth)
# ---------------------------------------------------------------------------

def get_employee_profile(email: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the full employee record from people.vb_employees by email.

    Returns a dict with all columns from the view, or None if not found.
    This is the single source of truth for user identity across the app.
    """
    conn = None
    try:
        conn = _get_zoho_connection()
        with conn.cursor() as cur:
            cur.execute(
                f'SELECT * FROM {_EMPLOYEE_VIEW} WHERE "EmailId" ILIKE %s LIMIT 1',
                (email,),
            )
            row = cur.fetchone()
        return dict(row) if row else None
    except Exception as exc:
        logger.error("Zoho profile lookup failed for %s: %s", email, exc)
        return None
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def get_employee_full_name(email: str) -> Optional[str]:
    """
    Return 'FirstName LastName' for the given email, or None.
    Convenience wrapper around get_employee_profile().
    """
    profile = get_employee_profile(email)
    if not profile:
        return None
    first = str(profile.get("FirstName") or "").strip()
    last  = str(profile.get("LastName") or "").strip()
    return f"{first} {last}".strip() or None


def get_todays_work_anniversaries() -> list:
    """
    Return a list of active employees whose work anniversary falls today
    (matching month and day of DateOfJoining). Uses people.vb_employees as
    the source of truth.

    Each entry: { full_name, first_name, department, designation, years }
    Returns an empty list on any error.
    """
    conn = None
    try:
        today = date.today()
        conn = _get_zoho_connection()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT \"FirstName\", \"LastName\", \"Department\", \"Designation\",
                       \"DateOfJoining\"
                FROM   {_EMPLOYEE_VIEW}
                WHERE  \"EmployeeStatus\" ILIKE 'Active'
                  AND  EXTRACT(MONTH FROM \"DateOfJoining\") = %s
                  AND  EXTRACT(DAY   FROM \"DateOfJoining\") = %s
                ORDER  BY \"FirstName\", \"LastName\"
                """,
                (today.month, today.day),
            )
            rows = cur.fetchall()
        result = []
        for row in rows:
            first = str(row.get("FirstName") or "").strip()
            last  = str(row.get("LastName")  or "").strip()
            doj   = row.get("DateOfJoining")
            years = None
            if doj:
                try:
                    years = today.year - doj.year
                except Exception:
                    pass
            result.append({
                "full_name":   f"{first} {last}".strip(),
                "first_name":  first,
                "department":  str(row.get("Department")  or "").strip(),
                "designation": str(row.get("Designation") or "").strip(),
                "years":       years,
            })
        return result
    except Exception as exc:
        logger.error("get_todays_work_anniversaries failed: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def get_todays_birthdays() -> list:
    """
    Return a list of active employees whose birthday falls today (matching
    month and day of DateOfBirth).  Uses people.vb_employees as the source
    of truth.

    Each entry: { full_name, first_name, department, designation }
    Returns an empty list on any error.
    """
    conn = None
    try:
        today = date.today()
        conn = _get_zoho_connection()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT "FirstName", "LastName", "Department", "Designation"
                FROM   {_EMPLOYEE_VIEW}
                WHERE  "EmployeeStatus" ILIKE 'Active'
                  AND  EXTRACT(MONTH FROM "DateOfBirth") = %s
                  AND  EXTRACT(DAY   FROM "DateOfBirth") = %s
                ORDER  BY "FirstName", "LastName"
                """,
                (today.month, today.day),
            )
            rows = cur.fetchall()
        result = []
        for row in rows:
            first = str(row.get("FirstName") or "").strip()
            last  = str(row.get("LastName")  or "").strip()
            result.append({
                "full_name":    f"{first} {last}".strip(),
                "first_name":   first,
                "department":   str(row.get("Department")  or "").strip(),
                "designation":  str(row.get("Designation") or "").strip(),
            })
        return result
    except Exception as exc:
        logger.error("get_todays_birthdays failed: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass




def build_user_profile_response(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a raw vb_employees row into a clean API response dict.
    Sensitive PII columns (Aadhar, PAN, UAN, Passport) are excluded.
    """
    _HIDDEN = {
        "Aadhar", "PAN", "UAN", "PassportNumber", "PassportExpiryDate",
        "PersonalEmailId", "DependentEmergencyDetails", "InsuranceDetails",
        "AddedBy", "AddedTime", "ModifiedBy", "ModifiedTime",
        "Functional_Manager.ID", "Reporting_To.ID",
    }
    first = str(profile.get("FirstName") or "").strip()
    last  = str(profile.get("LastName") or "").strip()
    return {
        "full_name":              f"{first} {last}".strip(),
        "first_name":             first,
        "last_name":              last,
        "email":                  profile.get("EmailId", ""),
        "employee_id":            profile.get("EmployeeId", ""),
        "designation":            profile.get("Designation", ""),
        "department":             profile.get("Department", ""),
        "parent_department":      profile.get("ParentDepartment", ""),
        "role":                   profile.get("Role", ""),
        "grade":                  profile.get("Grade", ""),
        "level":                  profile.get("Level", ""),
        "employee_type":          profile.get("EmployeeType", ""),
        "employee_status":        profile.get("EmployeeStatus", ""),
        "reporting_manager":      profile.get("ReportingManager", ""),
        "reporting_manager_email":profile.get("ReportingManagerEmail", ""),
        "functional_manager":     profile.get("FunctionalManager", ""),
        "work_phone":             profile.get("WorkPhone", ""),
        "mobile":                 profile.get("MobileNumber", ""),
        "work_location":          profile.get("WorkLocation", ""),
        "location_name":          profile.get("LocationName", ""),
        "region":                 profile.get("Region", ""),
        "entity_name":            profile.get("EntityName", ""),
        "project_name":           profile.get("ProjectName", ""),
        "skill_set":              profile.get("SkillSet", ""),
        "total_experience":       profile.get("TotalExperience", ""),
        "date_of_joining":        str(profile.get("DateOfJoining") or ""),
        "nationality":            profile.get("Nationality", ""),
        "blood_group":            profile.get("BloodGroup", ""),
        "gender":                 profile.get("Gender", ""),
    }


# ---------------------------------------------------------------------------
# Aura DB user upsert (unchanged)
# ---------------------------------------------------------------------------

def get_or_create_user(azure_oid: str, email: str, display_name: str) -> str:
    """Upsert a user row by Azure OID and return their DB UUID.

    Mirrors the pattern used in EscalationsService so every controller
    resolves the same stable primary key before touching user-scoped tables.
    """
    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, azure_oid, display_name, last_login_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (azure_oid) DO UPDATE
                    SET last_login_at = EXCLUDED.last_login_at,
                        updated_at    = EXCLUDED.updated_at
                RETURNING id
                """,
                (email, azure_oid, display_name, now, now),
            )
            user_id = str(cur.fetchone()["id"])
        conn.commit()
    return user_id
