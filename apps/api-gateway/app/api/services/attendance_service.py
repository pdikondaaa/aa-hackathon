import os
import datetime
import logging
from typing import Optional

import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

from app.api.config.db_config import get_db_connection
from app.api.models.attendance_model import (
    AttendanceOut, AttendanceRecord, MonthSummary, ReporteeAttendanceOut,
    ReporteeSummary, TeamAttendanceOut,
)
from app.api.services.user_service import get_employee_full_name, get_employee_profile

load_dotenv(Path(__file__).resolve().parents[5] / ".env")

_ESSL_DB_HOST = os.getenv("ESSL_DB_HOST", "")
_ESSL_DB_USER = os.getenv("ESSL_DB_USER", "")
_ESSL_DB_PWD  = os.getenv("ESSL_DB_PWD", "")
_ESSL_DB_NAME = os.getenv("ESSL_DB_NAME", "eSSL")
_ESSL_VIEW    = os.getenv("ESSL_ATTENDANCE_VIEW", "[dbo].[vbUserTimeEntryLog]")
_ESSL_DATE_COL = os.getenv("ESSL_DATE_COLUMN", "CHECKDATE")
_ESSL_USER_COL = os.getenv("ESSL_USER_COLUMN", "UserName")

logger = logging.getLogger(__name__)

_ATTENDANCE_TABLE = "attendance"
_EMPLOYEE_VIEW = os.getenv("EMPLOYEE_VIEW", "people.vb_employees")


# ---------------------------------------------------------------------------
# Employee name resolution is now handled by user_service.get_employee_full_name
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Attendance helpers
# ---------------------------------------------------------------------------

_MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _duration_to_minutes(checkin, checkout) -> int:
    try:
        def _to_time(t):
            if hasattr(t, 'hour'):
                return t
            if isinstance(t, str):
                for fmt in ("%H:%M:%S", "%H:%M"):
                    try:
                        return datetime.datetime.strptime(t, fmt).time()
                    except ValueError:
                        continue
            return None

        t_in = _to_time(checkin)
        t_out = _to_time(checkout)
        if not t_in or not t_out:
            return 0
        diff = (t_out.hour * 60 + t_out.minute) - (t_in.hour * 60 + t_in.minute)
        return max(diff, 0)
    except Exception:
        return 0


def _minutes_to_label(minutes: int) -> str:
    if minutes <= 0:
        return "0h 00m"
    h, m = divmod(minutes, 60)
    return f"{h}h {m:02d}m"


def _fmt_time(t) -> Optional[str]:
    if not t:
        return None
    return t.strftime("%H:%M") if hasattr(t, 'strftime') else str(t)


def _attendance_status(minutes: int, has_checkout: bool) -> str:
    if not has_checkout:
        return "no_checkout"
    if minutes >= 480:   # >= 8h
        return "full_day"
    if minutes >= 360:   # >= 6h
        return "half_day"
    return "short"


def _normalize_essl_row(row: dict) -> dict:
    """Map eSSL column names (any casing) to the standard keys used by the rest of the service."""
    r = {(k or '').lower().strip(): v for k, v in row.items()}
    return {
        'username':      r.get('username')     or r.get('employeename') or r.get('empname') or r.get('usercode') or '',
        'checkdate':     r.get('checkdate'),
        'checkintime':   r.get('firstin')      or r.get('checkintime')  or r.get('intime')  or r.get('checkin'),
        'checkouttime':  r.get('lastout')       or r.get('checkouttime') or r.get('outtime') or r.get('checkout'),
        'deptname':      r.get('deptname')      or r.get('department')   or r.get('dept')    or '',
        'timeinhours':   r.get('timeinhours')   or r.get('duration')     or '',
        'timeinminutes': r.get('timeinminutes') or 0,
    }


def _dedup_by_date(rows: list) -> list:
    """Collapse multiple swipes for the same date into one row (earliest in, latest out)."""
    groups: dict = {}
    for row in rows:
        cd = row.get('checkdate')
        date_key = cd.date() if hasattr(cd, 'date') else cd
        key = (row.get('username', ''), date_key)
        if key not in groups:
            groups[key] = dict(row)
        else:
            merged = groups[key]
            ci_new, ci_old = row.get('checkintime'), merged.get('checkintime')
            if ci_new and (not ci_old or ci_new < ci_old):
                merged['checkintime'] = ci_new
            co_new, co_old = row.get('checkouttime'), merged.get('checkouttime')
            if co_new and (not co_old or co_new > co_old):
                merged['checkouttime'] = co_new

    return sorted(groups.values(),
                  key=lambda r: r.get('checkdate') or datetime.date.min,
                  reverse=True)


def _build_month_summary(rows: list, year: int, month: int) -> MonthSummary:
    records: list[AttendanceRecord] = []
    total_minutes = 0

    for row in rows:
        cd = row.get('checkdate')
        date_key = cd.date() if hasattr(cd, 'date') else cd
        if not (hasattr(date_key, 'year') and date_key.year == year and date_key.month == month):
            continue

        ci = row.get('checkintime')
        co = row.get('checkouttime')
        mins = _duration_to_minutes(ci, co)
        total_minutes += mins

        records.append(AttendanceRecord(
            date=date_key.strftime("%d %b %Y"),
            day=date_key.strftime("%A"),
            check_in=_fmt_time(ci),
            check_out=_fmt_time(co),
            duration_minutes=mins,
            duration_label=_minutes_to_label(mins),
            status=_attendance_status(mins, bool(co)),
        ))

    # Sort records chronologically descending (already deduped)
    records.sort(key=lambda r: r.date, reverse=True)

    return MonthSummary(
        month_label=f"{_MONTH_NAMES[month]} {year}",
        year=year,
        month_number=month,
        total_days=len(records),
        total_minutes=total_minutes,
        total_hours_label=_minutes_to_label(total_minutes),
        records=records,
    )


# ---------------------------------------------------------------------------
# Hierarchy helpers (mirror of onboarding.py logic)
# ---------------------------------------------------------------------------

def _fetch_reportees_emails(manager_full_name: str) -> list[str]:
    """
    Return EmailId list of all active employees whose ReportingManager
    matches manager_full_name (case-insensitive), using people.vb_employees —
    the same source-of-truth used by onboarding.py.
    """
    import psycopg2
    import psycopg2.extras
    conn = None
    try:
        conn = psycopg2.connect(
            host=os.getenv("ZOHO_DB_HOST", ""),
            port=int(os.getenv("ZOHO_DB_PORT", "5432")),
            dbname=os.getenv("ZOHO_DB_NAME", ""),
            user=os.getenv("ZOHO_DB_USER", ""),
            password=os.getenv("ZOHO_DB_PWD", ""),
            connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
        )
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT "EmailId"
                FROM {_EMPLOYEE_VIEW}
                WHERE "ReportingManager" ILIKE %s
                  AND "EmployeeStatus" ILIKE 'Active'
                ORDER BY "FirstName", "LastName"
                """,
                (f"%{manager_full_name}%",),
            )
            return [row["EmailId"] for row in cur.fetchall()]
    except Exception as exc:
        logger.error("_fetch_reportees_emails error: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class AttendanceService:

    def get_my_attendance(self, email: str) -> AttendanceOut:
        """
        Resolve the logged-in user's name from people.vb_employees (via user_service),
        fetch this month and last month attendance from the Aura DB, and return
        a structured summary.

        Raises ValueError if the employee is not found in the directory.
        """
        employee_name = get_employee_full_name(email)
        if not employee_name:
            raise ValueError(f"No employee record found for email: {email}")

        today = datetime.date.today()

        # Date ranges
        this_month_start = today.replace(day=1)
        this_month_end = today

        last_month_end = this_month_start - datetime.timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        rows = self._fetch_attendance(employee_name, last_month_start, this_month_end)
        rows = _dedup_by_date(rows)

        this_month = _build_month_summary(rows, today.year, today.month)
        last_month = _build_month_summary(rows, last_month_end.year, last_month_end.month)

        total_days = this_month.total_days + last_month.total_days
        total_mins = this_month.total_minutes + last_month.total_minutes

        return AttendanceOut(
            employee_name=employee_name,
            this_month=this_month,
            last_month=last_month,
            total_days_combined=total_days,
            total_minutes_combined=total_mins,
            total_hours_combined=_minutes_to_label(total_mins),
        )

    def get_reportee_attendance(
        self,
        viewer_email: str,
        reportee_email: str,
    ) -> ReporteeAttendanceOut:
        """
        A manager can view a reportee's attendance, and an employee can view
        their own manager's data (i.e. the manager can also view data when
        the reportee queries the manager's email — but the primary restriction
        enforced here is: viewer must be the direct reporting manager of the
        reportee, OR viewer == reportee (own data).

        Logic mirrors onboarding.py:
          1. Fetch viewer profile → get full name + email
          2. Fetch reportee profile → get ReportingManagerEmail
          3. Check ReportingManagerEmail == viewer_email  (manager → can view)
             OR viewer_email == reportee_email             (self-view)
          4. If not authorised → raise PermissionError
          5. Fetch and return attendance for the reportee.
        """
        # Step 1: resolve viewer
        viewer_profile = get_employee_profile(viewer_email)
        if not viewer_profile:
            raise ValueError(f"No employee record found for viewer email: {viewer_email}")

        # Step 2: resolve reportee
        reportee_profile = get_employee_profile(reportee_email)
        if not reportee_profile:
            raise ValueError(f"No employee record found for reportee email: {reportee_email}")

        reportee_manager_email = (reportee_profile.get("ReportingManagerEmail") or "").strip().lower()
        viewer_email_lower = viewer_email.strip().lower()
        reportee_email_lower = reportee_email.strip().lower()

        # Step 3: access check
        is_self       = viewer_email_lower == reportee_email_lower
        is_manager    = reportee_manager_email == viewer_email_lower

        if not (is_self or is_manager):
            raise PermissionError(
                f"{viewer_email} is not the reporting manager of {reportee_email}. "
                f"Access denied."
            )

        # Step 4: build reportee full name for attendance query
        first = str(reportee_profile.get("FirstName") or "").strip()
        last  = str(reportee_profile.get("LastName") or "").strip()
        reportee_name = f"{first} {last}".strip()

        if not reportee_name:
            raise ValueError(f"Could not resolve full name for reportee: {reportee_email}")

        # Step 5: fetch attendance (same date window as get_my_attendance)
        today = datetime.date.today()
        this_month_start = today.replace(day=1)
        this_month_end   = today
        last_month_end   = this_month_start - datetime.timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        rows = self._fetch_attendance(reportee_name, last_month_start, this_month_end)
        rows = _dedup_by_date(rows)

        this_month = _build_month_summary(rows, today.year, today.month)
        last_month = _build_month_summary(rows, last_month_end.year, last_month_end.month)
        total_days = this_month.total_days + last_month.total_days
        total_mins = this_month.total_minutes + last_month.total_minutes

        attendance = AttendanceOut(
            employee_name=reportee_name,
            this_month=this_month,
            last_month=last_month,
            total_days_combined=total_days,
            total_minutes_combined=total_mins,
            total_hours_combined=_minutes_to_label(total_mins),
        )

        return ReporteeAttendanceOut(
            viewer_email=viewer_email,
            reportee_email=reportee_email,
            reportee_name=reportee_name,
            attendance=attendance,
        )

    def _fetch_attendance(
        self,
        username: str,
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        """
        Fetch attendance from eSSL SQL Server (primary) with automatic fallback
        to the local PostgreSQL attendance table if SQL Server is unavailable.
        """
        if _ESSL_DB_HOST:
            try:
                return self._fetch_from_essl(username, date_from, date_to)
            except Exception as exc:
                logger.warning(
                    "eSSL SQL Server unavailable (%s). Falling back to PostgreSQL.", exc
                )

        return self._fetch_from_postgres(username, date_from, date_to)

    def _fetch_from_essl(
        self,
        username: str,
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        """Query eSSL SQL Server vbUserTimeEntryLog view."""
        try:
            import pymssql
        except ImportError:
            raise RuntimeError("pymssql not installed — run: pip install pymssql")

        conn = pymssql.connect(
            server=_ESSL_DB_HOST,
            user=_ESSL_DB_USER,
            password=_ESSL_DB_PWD,
            database=_ESSL_DB_NAME,
            timeout=15,
            login_timeout=10,
        )
        try:
            with conn.cursor(as_dict=True) as cur:
                sql = f"""
                    SELECT * FROM {_ESSL_VIEW}
                    WHERE CAST([{_ESSL_DATE_COL}] AS DATE) BETWEEN %s AND %s
                      AND [{_ESSL_USER_COL}] LIKE %s
                    ORDER BY [{_ESSL_DATE_COL}] DESC
                """
                cur.execute(sql, (str(date_from), str(date_to), f"%{username}%"))
                raw_rows = cur.fetchall()
        finally:
            conn.close()

        logger.info("eSSL: fetched %d rows for '%s'", len(raw_rows), username)
        return [_normalize_essl_row(r) for r in raw_rows]

    def _fetch_from_postgres(
        self,
        username: str,
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        """Fallback: query the PostgreSQL attendance table."""
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT username, checkdate, checkintime, checkouttime,
                           timeinhours, timeinminutes, deptname
                    FROM {_ATTENDANCE_TABLE}
                    WHERE username ILIKE %s
                      AND checkdate::date BETWEEN %s AND %s
                    ORDER BY checkdate DESC
                    LIMIT 200
                    """,
                    (f"%{username}%", date_from, date_to),
                )
                rows = [dict(r) for r in cur.fetchall()]
        logger.info("PostgreSQL fallback: fetched %d rows for '%s'", len(rows), username)
        return rows

    # -----------------------------------------------------------------------
    # Team attendance
    # -----------------------------------------------------------------------

    def get_team_attendance(self, manager_email: str) -> TeamAttendanceOut:
        """
        Return attendance summaries for all active direct reports of manager_email.
        Fetches all rows in a single batch query per source (eSSL / PostgreSQL).
        """
        manager_profile = get_employee_profile(manager_email)
        if not manager_profile:
            raise ValueError(f"No employee record found for: {manager_email}")

        first = str(manager_profile.get("FirstName") or "").strip()
        last  = str(manager_profile.get("LastName") or "").strip()
        manager_name = f"{first} {last}".strip()

        reportee_profiles = self._fetch_reportee_profiles(manager_name)
        if not reportee_profiles:
            return TeamAttendanceOut(
                manager_name=manager_name,
                manager_email=manager_email,
                team_size=0,
                reportees=[],
            )

        today            = datetime.date.today()
        this_month_start = today.replace(day=1)
        last_month_end   = this_month_start - datetime.timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        names = [
            f"{p.get('FirstName','')} {p.get('LastName','')}".strip()
            for p in reportee_profiles
        ]

        # Single batch fetch for all team members
        all_rows = self._fetch_team_batch(names, last_month_start, today)

        reportees: list[ReporteeSummary] = []
        for profile, emp_name in zip(reportee_profiles, names):
            rows = _dedup_by_date([r for r in all_rows if emp_name.lower() in str(r.get("username", "")).lower()])
            this_month = _build_month_summary(rows, today.year, today.month)
            last_month = _build_month_summary(rows, last_month_end.year, last_month_end.month)
            total_mins = this_month.total_minutes + last_month.total_minutes
            reportees.append(ReporteeSummary(
                name=emp_name,
                email=profile.get("EmailId", ""),
                department=profile.get("Department", ""),
                designation=profile.get("Designation", ""),
                this_month=this_month,
                last_month=last_month,
                total_days_combined=this_month.total_days + last_month.total_days,
                total_minutes_combined=total_mins,
                total_hours_combined=_minutes_to_label(total_mins),
            ))

        return TeamAttendanceOut(
            manager_name=manager_name,
            manager_email=manager_email,
            team_size=len(reportees),
            reportees=reportees,
        )

    def _fetch_reportee_profiles(self, manager_full_name: str) -> list[dict]:
        """Return profile rows (name, email, dept, designation) for all active direct reports.

        ReportingManager is stored as 'Full Name AASPL-XXXX' so we use a LIKE wildcard.
        """
        conn = None
        try:
            conn = psycopg2.connect(
                host=os.getenv("ZOHO_DB_HOST", ""),
                port=int(os.getenv("ZOHO_DB_PORT", "5432")),
                dbname=os.getenv("ZOHO_DB_NAME", ""),
                user=os.getenv("ZOHO_DB_USER", ""),
                password=os.getenv("ZOHO_DB_PWD", ""),
                connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
            )
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f"""
                    SELECT "FirstName", "LastName", "EmailId", "Department", "Designation"
                    FROM {_EMPLOYEE_VIEW}
                    WHERE "ReportingManager" ILIKE %s
                      AND "EmployeeStatus" ILIKE 'Active'
                    ORDER BY "FirstName", "LastName"
                    """,
                    (f"%{manager_full_name}%",),
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception as exc:
            logger.error("_fetch_reportee_profiles error: %s", exc)
            return []
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    def _fetch_team_batch(
        self,
        names: list[str],
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        """
        Fetch attendance rows for all names in one query (batch).
        Tries eSSL SQL Server first, falls back to PostgreSQL.
        """
        if _ESSL_DB_HOST and names:
            try:
                return self._fetch_team_from_essl(names, date_from, date_to)
            except Exception as exc:
                logger.warning("eSSL team batch failed (%s). Falling back to PostgreSQL.", exc)

        return self._fetch_team_from_postgres(names, date_from, date_to)

    def _fetch_team_from_essl(
        self,
        names: list[str],
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        try:
            import pymssql
        except ImportError:
            raise RuntimeError("pymssql not installed")

        placeholders = ", ".join(["%s"] * len(names))
        conn = pymssql.connect(
            server=_ESSL_DB_HOST, user=_ESSL_DB_USER, password=_ESSL_DB_PWD,
            database=_ESSL_DB_NAME, timeout=30, login_timeout=10,
        )
        try:
            with conn.cursor(as_dict=True) as cur:
                sql = f"""
                    SELECT * FROM {_ESSL_VIEW}
                    WHERE CAST([{_ESSL_DATE_COL}] AS DATE) BETWEEN %s AND %s
                      AND [{_ESSL_USER_COL}] IN ({placeholders})
                    ORDER BY [{_ESSL_USER_COL}], [{_ESSL_DATE_COL}] DESC
                """
                cur.execute(sql, (str(date_from), str(date_to), *names))
                raw_rows = cur.fetchall()
        finally:
            conn.close()

        logger.info("eSSL team batch: %d rows for %d employees", len(raw_rows), len(names))
        return [_normalize_essl_row(r) for r in raw_rows]

    def _fetch_team_from_postgres(
        self,
        names: list[str],
        date_from: datetime.date,
        date_to: datetime.date,
    ) -> list:
        if not names:
            return []
        clauses = " OR ".join(["username ILIKE %s"] * len(names))
        params  = [f"%{n}%" for n in names] + [date_from, date_to]
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT username, checkdate, checkintime, checkouttime,
                           timeinhours, timeinminutes, deptname
                    FROM {_ATTENDANCE_TABLE}
                    WHERE ({clauses})
                      AND checkdate::date BETWEEN %s AND %s
                    ORDER BY username, checkdate DESC
                    LIMIT 5000
                    """,
                    params,
                )
                rows = [dict(r) for r in cur.fetchall()]
        logger.info("PostgreSQL team batch: %d rows for %d employees", len(rows), len(names))
        return rows
