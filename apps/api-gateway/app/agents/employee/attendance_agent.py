import re
import logging
import calendar
import datetime
from typing import Dict, List, Tuple, Optional

import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[5] / ".env")

from app.agents.employee.config import (
    EMPLOYEE_VIEW,
    COL_EMPLOYEE_ID, COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL,
    COL_REPORTING_MANAGER, COL_FUNCTIONAL_MANAGER, COL_EMPLOYEE_STATUS,
)

logger = logging.getLogger(__name__)

ATTENDANCE_TABLE = "attendance"

_NO_ATTENDANCE_PROMPT = """\
You are AURA, an internal assistant for Aligned Automation.
The user asked: "{query}"
A database query for attendance records returned no results.
In 1-2 sentences, tell the user no records were found for their specific request and suggest they try refining their search (e.g. check the name spelling, try a different date range, or contact HR).
Do not mention SQL, databases, or internal system details.
"""


def _llm_no_attendance_response(query: str) -> str:
    try:
        from langchain_ollama import ChatOllama
        from app.agents.working.config import LLMConfig
        cfg = LLMConfig()
        llm = ChatOllama(base_url=cfg.base_url, model=cfg.model, temperature=0.3, num_predict=120)
        result = llm.invoke(_NO_ATTENDANCE_PROMPT.format(query=query))
        text = result.content if hasattr(result, "content") else str(result)
        return text.strip()
    except Exception as exc:
        logger.warning("LLM fallback unavailable: %s", exc)
        return (
            "No attendance records found for your query.\n\n"
            "Try searching by employee name, department, or a specific month."
        )


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _connect_zoho() -> psycopg2.extensions.connection:
    import os
    return psycopg2.connect(
        host=os.getenv("ZOHO_DB_HOST", ""),
        port=int(os.getenv("ZOHO_DB_PORT", "")),
        dbname=os.getenv("ZOHO_DB_NAME", ""),
        user=os.getenv("ZOHO_DB_USER", ""),
        password=os.getenv("ZOHO_DB_PWD", ""),
        connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
    )


def _connect_aura() -> psycopg2.extensions.connection:
    import os
    return psycopg2.connect(
        host=os.getenv("SQL_HOST", "localhost"),
        port=int(os.getenv("SQL_PORT", "5432")),
        dbname=os.getenv("SQL_DB", "aura"),
        user=os.getenv("SQL_USERNAME", "postgres"),
        password=os.getenv("SQL_PWD", "Admin@1"),
        connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
    )


def _run_zoho(sql: str, params: tuple = ()) -> List[Dict]:
    conn = None
    try:
        conn = _connect_zoho()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Zoho DB error: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def _run_aura(sql: str, params: tuple = ()) -> List[Dict]:
    conn = None
    try:
        conn = _connect_aura()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Aura DB error: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Query classification
# ---------------------------------------------------------------------------

_ATTENDANCE_RE = re.compile(
    r'\b(attendance|check[\s\-]?in|check[\s\-]?out|clock[\s\-]?in|clock[\s\-]?out|'
    r'punch[\s\-]?in|punch[\s\-]?out|working hours?|hours?\s+worked|'
    r'arrival\s+time|departure\s+time|in\s+time|out\s+time)\b',
    re.IGNORECASE,
)

_DATE_PHRASES_RE = re.compile(
    r'\b(?:this\s+month|current\s+month|last\s+month'
    r'|this\s+week|last\s+week'
    r'|today|yesterday'
    r'|january|february|march|april|may|june|july|august'
    r'|september|october|november|december'
    r'|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec'
    r')(?:\s+\d{4})?\b',
    re.IGNORECASE,
)

_ATTENDANCE_KW_RE = re.compile(
    r'\b(?:attendance|check[\s\-]?(?:in|out)|clock[\s\-]?(?:in|out)'
    r'|punch[\s\-]?(?:in|out)|working\s+hours?|hours?\s+worked'
    r'|arrival\s+time|departure\s+time)\b',
    re.IGNORECASE,
)


def is_attendance_query(query: str) -> bool:
    return bool(_ATTENDANCE_RE.search(query))


# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------

def _strip_date_phrases(q: str) -> str:
    q = _DATE_PHRASES_RE.sub('', q)
    q = re.sub(r'\b(?:in|on|for|from|during|of)\s*$', '', q, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', q).strip()


def _extract_date_filter(q: str) -> Tuple[str, list]:
    today = datetime.date.today()

    if re.search(r'\btoday\b', q, re.IGNORECASE):
        return 'checkdate::date = %s', [today]
    if re.search(r'\byesterday\b', q, re.IGNORECASE):
        return 'checkdate::date = %s', [today - datetime.timedelta(days=1)]
    if re.search(r'\bthis\s+week\b', q, re.IGNORECASE):
        start = today - datetime.timedelta(days=today.weekday())
        return 'checkdate::date >= %s', [start]
    if re.search(r'\blast\s+week\b', q, re.IGNORECASE):
        start = today - datetime.timedelta(days=today.weekday() + 7)
        end = start + datetime.timedelta(days=6)
        return 'checkdate::date BETWEEN %s AND %s', [start, end]
    if re.search(r'\b(this\s+month|current\s+month)\b', q, re.IGNORECASE):
        return 'checkdate::date >= %s', [today.replace(day=1)]
    if re.search(r'\blast\s+month\b', q, re.IGNORECASE):
        first_this = today.replace(day=1)
        last_end = first_this - datetime.timedelta(days=1)
        return 'checkdate::date BETWEEN %s AND %s', [last_end.replace(day=1), last_end]

    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8, 'september': 9,
        'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
        'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    }
    for month_name, month_num in months.items():
        if re.search(rf'\b{month_name}\b', q, re.IGNORECASE):
            year_m = re.search(rf'\b{month_name}\b\s*(\d{{4}})', q, re.IGNORECASE)
            year = int(year_m.group(1)) if year_m else today.year
            last_day = calendar.monthrange(year, month_num)[1]
            start = datetime.date(year, month_num, 1)
            end = datetime.date(year, month_num, last_day)
            return 'checkdate::date BETWEEN %s AND %s', [start, end]

    return '', []


def _build_attendance_query(query: str, resolved_name: Optional[str] = None) -> Tuple[str, tuple, str]:
    q = query.lower().strip()
    date_clause, date_params = _extract_date_filter(q)
    date_where = f'AND {date_clause}' if date_clause else ''

    SELECT = (
        f'SELECT username, checkdate, checkintime, checkouttime, '
        f'timeinhours, timeinminutes, deptname '
        f'FROM {ATTENDANCE_TABLE}'
    )

    if resolved_name:
        return (
            f'{SELECT} WHERE username ILIKE %s {date_where} '
            f'ORDER BY checkdate DESC LIMIT 200',
            tuple([f'%{resolved_name}%'] + date_params),
            'attendance_self',
        )

    q_clean = _strip_date_phrases(q)

    kw_pos = _ATTENDANCE_KW_RE.search(q_clean)
    if kw_pos and kw_pos.start() > 0:
        name = q_clean[:kw_pos.start()].strip().rstrip(",'- ")
        name = re.sub(r'^(?:show|get|find|check|display|view)(?:\s+|$)', '', name, flags=re.IGNORECASE).strip()
        name = re.sub(r"'s?\s*$", '', name).strip()
        _SKIP = {'my', 'me', 'i', 'the', 'a', 'an', 'his', 'her', 'their'}
        _is_dept = bool(re.search(r'\b(?:department|dept|team)\s*$', name, re.IGNORECASE))
        if name and name.lower() not in _SKIP and len(name) >= 2 and not _is_dept:
            return (
                f'{SELECT} WHERE username ILIKE %s {date_where} '
                f'ORDER BY checkdate DESC LIMIT 200',
                tuple([f'%{name}%'] + date_params),
                'attendance_employee',
            )

    name_m = re.search(
        r'\b(?:attendance|check[\s\-]?(?:in|out)|clock[\s\-]?(?:in|out))\s+(?:of|for)\s+'
        r'([a-zA-Z][a-zA-Z\s\-\.]{1,50}?)\s*$',
        q_clean,
    )
    if not name_m:
        name_m = re.search(
            r"([a-zA-Z][a-zA-Z\s\-\.]{1,30}?)'s\s+(?:attendance|check|clock|punch)",
            q,
        )
    if not name_m:
        name_m = re.search(
            r'\b(?:of|for)\s+([a-zA-Z][a-zA-Z\s\-\.]{2,50}?)\s*$',
            q_clean,
        )
    if name_m:
        name = name_m.group(1).strip()
        if name and len(name) >= 2:
            return (
                f'{SELECT} WHERE username ILIKE %s {date_where} '
                f'ORDER BY checkdate DESC LIMIT 200',
                tuple([f'%{name}%'] + date_params),
                'attendance_employee',
            )

    dept_m = re.search(r'\b([a-zA-Z &]+?)\s+(?:department|dept|team)\b', q)
    if dept_m:
        dept = dept_m.group(1).strip()
        return (
            f'{SELECT} WHERE deptname ILIKE %s {date_where} '
            f'ORDER BY checkdate DESC, username LIMIT 50',
            tuple([f'%{dept}%'] + date_params),
            'attendance_dept',
        )

    if date_clause:
        return (
            f'{SELECT} WHERE {date_clause} '
            f'ORDER BY checkdate DESC, username LIMIT 50',
            tuple(date_params),
            'attendance_date',
        )

    return (
        f'{SELECT} ORDER BY checkdate DESC LIMIT 20',
        (),
        'attendance_recent',
    )


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

def _fmt_time(dt) -> str:
    if not dt:
        return "N/A"
    return dt.strftime("%H:%M") if hasattr(dt, 'strftime') else str(dt)


def _fmt_date(dt) -> str:
    if not dt:
        return "N/A"
    return dt.strftime("%d %b %Y") if hasattr(dt, 'strftime') else str(dt)


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


def _duration_badge(checkin, checkout) -> str:
    mins = _duration_to_minutes(checkin, checkout)
    if mins == 0:
        return '<span style="color:#94a3b8;">N/A</span>'
    h, m = divmod(mins, 60)
    label = f"{h}h {m:02d}m"
    if h >= 8:
        color, bg = "#16a34a", "#dcfce7"
    elif h >= 6:
        color, bg = "#d97706", "#fef9c3"
    else:
        color, bg = "#dc2626", "#fee2e2"
    return (
        f'<span style="display:inline-block;padding:2px 8px;border-radius:12px;'
        f'font-weight:600;font-size:0.82em;background:{bg};color:{color};">'
        f'{label}</span>'
    )


def _dedup_attendance_by_date(rows: List[Dict]) -> List[Dict]:
    groups: Dict[tuple, Dict] = {}
    for row in rows:
        date_key = row.get('checkdate')
        if hasattr(date_key, 'date'):
            date_key = date_key.date()
        user_key = (row.get('username', ''), date_key)

        if user_key not in groups:
            groups[user_key] = dict(row)
        else:
            merged = groups[user_key]
            ci_new = row.get('checkintime')
            ci_old = merged.get('checkintime')
            if ci_new and (not ci_old or ci_new < ci_old):
                merged['checkintime'] = ci_new
            co_new = row.get('checkouttime')
            co_old = merged.get('checkouttime')
            if co_new and (not co_old or co_new > co_old):
                merged['checkouttime'] = co_new

    return sorted(
        groups.values(),
        key=lambda r: r.get('checkdate') or datetime.date.min,
        reverse=True,
    )


def _format_attendance_results(rows: List[Dict], intent: str) -> str:
    if not rows:
        return ""

    rows = _dedup_attendance_by_date(rows)
    total_days = len(rows)

    is_single_emp = intent in ('attendance_self', 'attendance_employee')
    if intent == 'attendance_self':
        emp_name = rows[0].get('username', 'You')
        title_txt = f"Your Attendance &mdash; {emp_name}"
    elif intent == 'attendance_employee':
        emp_name = rows[0].get('username', 'Employee')
        title_txt = f"Attendance &mdash; {emp_name}"
    elif intent == 'attendance_dept':
        dept = rows[0].get('deptname', '')
        title_txt = f"Department Attendance{' &mdash; ' + dept if dept else ''}"
    else:
        title_txt = "Attendance Records"

    month_groups: Dict[tuple, List[Dict]] = {}
    for row in rows:
        cd = row.get('checkdate')
        if hasattr(cd, 'year'):
            key = (cd.year, cd.month)
        else:
            key = (0, 0)
        month_groups.setdefault(key, []).append(row)
    sorted_months = sorted(month_groups.keys(), reverse=True)

    css = """<style>
.att-wrap{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;max-width:900px;}
.att-title{font-size:1.15em;font-weight:700;margin-bottom:4px;color:#1e3a5f;}
.att-meta{font-size:0.85em;color:#64748b;margin-bottom:16px;}
.att-month{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);}
.att-month-hdr{background:linear-gradient(90deg,#1e3a5f,#2563eb);color:#fff;padding:8px 14px;font-weight:600;font-size:0.95em;display:flex;justify-content:space-between;align-items:center;}
.att-month-hdr .pill{background:rgba(255,255,255,.2);border-radius:20px;padding:2px 10px;font-size:0.8em;}
.att-tbl{width:100%;border-collapse:collapse;font-size:0.88em;}
.att-tbl thead tr{background:#f1f5f9;}
.att-tbl thead th{padding:7px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;}
.att-tbl tbody tr:nth-child(even){background:#f8fafc;}
.att-tbl tbody tr:hover{background:#eff6ff;}
.att-tbl td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
.att-tbl td.num{text-align:center;}
.att-tbl tfoot tr{background:#f1f5f9;}
.att-tbl tfoot td{padding:7px 12px;font-weight:600;color:#334155;border-top:2px solid #cbd5e1;font-size:0.85em;}
.time-val{font-weight:600;color:#1e3a5f;}
.day-lbl{color:#64748b;font-size:0.8em;margin-left:4px;}
</style>"""

    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]

    sections: List[str] = []
    total_minutes_all = 0

    for (year, month) in sorted_months:
        month_rows = month_groups[(year, month)]
        month_days = len(month_rows)
        month_minutes = sum(
            _duration_to_minutes(r.get('checkintime'), r.get('checkouttime'))
            for r in month_rows
        )
        total_minutes_all += month_minutes
        mh, mm_rem = divmod(month_minutes, 60)
        month_total_str = f"{mh}h {mm_rem:02d}m"
        month_label = f"{month_names[month] if month else '?'} {year if year else ''}"

        if is_single_emp:
            thead = ("<tr>"
                     "<th>#</th><th>Date</th><th>Day</th>"
                     "<th>Check-In</th><th>Check-Out</th><th>Duration</th>"
                     "</tr>")
        else:
            thead = ("<tr>"
                     "<th>#</th><th>Employee</th><th>Date</th><th>Day</th>"
                     "<th>Check-In</th><th>Check-Out</th><th>Duration</th>"
                     "</tr>")

        tbody_rows: List[str] = []
        for idx, row in enumerate(month_rows, 1):
            cd = row.get('checkdate')
            date_str = _fmt_date(cd)
            day_name = cd.strftime("%a") if hasattr(cd, 'strftime') else ""
            check_in = _fmt_time(row.get('checkintime'))
            check_out = _fmt_time(row.get('checkouttime'))
            badge = _duration_badge(row.get('checkintime'), row.get('checkouttime'))

            if is_single_emp:
                tbody_rows.append(
                    f"<tr>"
                    f"<td class='num' style='color:#94a3b8;'>{idx}</td>"
                    f"<td>{date_str}</td>"
                    f"<td><span class='day-lbl'>{day_name}</span></td>"
                    f"<td><span class='time-val'>{check_in}</span></td>"
                    f"<td><span class='time-val'>{check_out}</span></td>"
                    f"<td class='num'>{badge}</td>"
                    f"</tr>"
                )
            else:
                name = row.get('username', '')
                dept = row.get('deptname', '') if intent in ('attendance_date', 'attendance_recent') else ''
                tbody_rows.append(
                    f"<tr>"
                    f"<td class='num' style='color:#94a3b8;'>{idx}</td>"
                    f"<td><strong>{name}</strong>{('<br><span style=\"color:#94a3b8;font-size:0.8em\">' + dept + '</span>') if dept else ''}</td>"
                    f"<td>{date_str}</td>"
                    f"<td><span class='day-lbl'>{day_name}</span></td>"
                    f"<td><span class='time-val'>{check_in}</span></td>"
                    f"<td><span class='time-val'>{check_out}</span></td>"
                    f"<td class='num'>{badge}</td>"
                    f"</tr>"
                )

        if is_single_emp:
            tfoot = (f"<tr>"
                     f"<td colspan='5' style='text-align:right;'>Month Total &nbsp;&mdash;</td>"
                     f"<td class='num'>"
                     f"<span style='background:#dbeafe;color:#1d4ed8;padding:2px 8px;"
                     f"border-radius:12px;font-size:0.82em;font-weight:700;'>{month_total_str}</span>"
                     f"&nbsp; <span style='color:#64748b;font-weight:400;'>({month_days} day{'s' if month_days != 1 else ''})</span>"
                     f"</td></tr>")
        else:
            tfoot = (f"<tr>"
                     f"<td colspan='6' style='text-align:right;'>Month Total &nbsp;&mdash;</td>"
                     f"<td class='num'>"
                     f"<span style='background:#dbeafe;color:#1d4ed8;padding:2px 8px;"
                     f"border-radius:12px;font-size:0.82em;font-weight:700;'>{month_total_str}</span>"
                     f"&nbsp; <span style='color:#64748b;font-weight:400;'>({month_days} day{'s' if month_days != 1 else ''})</span>"
                     f"</td></tr>")

        section = (
            f'<div class="att-month">'
            f'<div class="att-month-hdr">'
            f'<span>{month_label}</span>'
            f'&nbsp;&nbsp;'
            f'<span class="pill">{month_days} day{"s" if month_days != 1 else ""} &bull; {month_total_str}</span>'
            f'</div>'
            f'<table class="att-tbl"><thead>{thead}</thead>'
            f'<tbody>{"".join(tbody_rows)}</tbody>'
            f'<tfoot>{tfoot}</tfoot>'
            f'</table></div>'
        )
        sections.append(section)

    gh, gm = divmod(total_minutes_all, 60)
    grand_total = f"{gh}h {gm:02d}m"
    summary_bar = (
        f'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
        f'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;'
        f'padding:8px 16px;font-size:0.88em;">'
        f'<span style="color:#94a3b8;">Total Days</span><br>'
        f'<strong style="font-size:1.3em;color:#1d4ed8;">{total_days}</strong>'
        f'</div>'
        f'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;'
        f'padding:8px 16px;font-size:0.88em;">'
        f'<span style="color:#94a3b8;">Total Hours</span><br>'
        f'<strong style="font-size:1.3em;color:#16a34a;">{grand_total}</strong>'
        f'</div>'
        f'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;'
        f'padding:8px 16px;font-size:0.88em;">'
        f'<span style="color:#94a3b8;">Months Covered</span><br>'
        f'<strong style="font-size:1.3em;color:#ea580c;">{len(sorted_months)}</strong>'
        f'</div>'
        f'</div>'
    )

    return (
        f'{css}'
        f'<div class="att-wrap">'
        f'<div class="att-title">{title_txt}</div>'
        f'<div class="att-meta">Showing {total_days} unique day(s) across {len(sorted_months)} month(s)</div>'
        f'{summary_bar}'
        f'{"".join(sections)}'
        f'</div>'
    )

# ---------------------------------------------------------------------------
    """
    Walk the full reporting hierarchy rooted at viewer_zoho_name using a
    recursive CTE and check whether any employee matching target_name appears
    anywhere in that tree (direct OR indirect reportee).

    Both ReportingManager and FunctionalManager relationships are followed at
    every level. UNION (not UNION ALL) deduplicates by EmployeeId so circular
    data in Zoho cannot cause an infinite loop.

    Returns (is_in_hierarchy, exact_zoho_full_name).
    exact_zoho_full_name pins the attendance ILIKE to one specific person
    instead of everyone whose username contains a partial name.
    """
    if not viewer_zoho_name or not target_name:
        return False, None

    sql = f'''
        WITH RECURSIVE reportee_tree AS (

            -- Base: direct reportees of the viewer
            SELECT
                "{COL_EMPLOYEE_ID}",
                "{COL_FIRST_NAME}",
                "{COL_LAST_NAME}"
            FROM {EMPLOYEE_VIEW}
            WHERE (
                "{COL_REPORTING_MANAGER}"  ILIKE %s
                OR "{COL_FUNCTIONAL_MANAGER}" ILIKE %s
            )
            AND "{COL_EMPLOYEE_STATUS}" ILIKE \'Active\'

            UNION

            -- Recursive: go one level deeper for every person already in the tree
            SELECT
                e."{COL_EMPLOYEE_ID}",
                e."{COL_FIRST_NAME}",
                e."{COL_LAST_NAME}"
            FROM {EMPLOYEE_VIEW} e
            INNER JOIN reportee_tree rt
                ON  e."{COL_REPORTING_MANAGER}"  ILIKE rt."{COL_FIRST_NAME}" || \' \' || rt."{COL_LAST_NAME}"
                OR  e."{COL_FUNCTIONAL_MANAGER}" ILIKE rt."{COL_FIRST_NAME}" || \' \' || rt."{COL_LAST_NAME}"
            WHERE e."{COL_EMPLOYEE_STATUS}" ILIKE \'Active\'
        )
        SELECT DISTINCT
            "{COL_FIRST_NAME}",
            "{COL_LAST_NAME}"
        FROM reportee_tree
        WHERE (
            "{COL_FIRST_NAME}" || \' \' || "{COL_LAST_NAME}" ILIKE %s
            OR "{COL_FIRST_NAME}" ILIKE %s
            OR "{COL_LAST_NAME}"  ILIKE %s
        )
        LIMIT 5
    '''

    rows = _run_zoho(
        sql,
        (
            viewer_zoho_name,    # ReportingManager  = viewer (base case)
            viewer_zoho_name,    # FunctionalManager = viewer (base case)
            f'%{target_name}%',  # full-name match on target
            f'%{target_name}%',  # first-name match on target
            f'%{target_name}%',  # last-name  match on target
        ),
    )

    if not rows:
        return False, None

    r = rows[0]
    exact = f"{r.get(COL_FIRST_NAME, '')} {r.get(COL_LAST_NAME, '')}".strip()
    return True, exact or None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def attendance_agent(query: str, user_email: str = "") -> str:
    """
    Attendance Agent — answers attendance queries from the Aura DB.
    No access restrictions — any employee's attendance can be queried.

    Execution order:
      Step 1 — Resolve the viewer's own Zoho name (for self-service queries).
      Step 2 — Identify the target employee from the query.
      Step 3 — Fetch and format attendance from Aura DB.
    """
    from app.api.services.user_service import get_employee_profile

    try:
        # ══════════════════════════════════════════════════════════════════
        # STEP 1 — Resolve the viewer's name (used for self-queries only)
        # ══════════════════════════════════════════════════════════════════
        user_zoho_name: str | None = None
        if user_email:
            profile = get_employee_profile(user_email)
            if profile:
                first = str(profile.get("FirstName") or "").strip()
                last  = str(profile.get("LastName") or "").strip()
                user_zoho_name = f"{first} {last}".strip() or None

        # ══════════════════════════════════════════════════════════════════
        # STEP 2 — Identify the target employee from the query
        # ══════════════════════════════════════════════════════════════════
        resolved_name: str | None = None

        # Case A: first-person pronoun → viewer's own data
        if user_zoho_name and re.search(r'\bmy\b|\bme\b|\bi\b', query, re.IGNORECASE):
            resolved_name = user_zoho_name

        # Case B: explicit email address in query
        if not resolved_name:
            email_m = re.search(
                r'\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b', query
            )
            if email_m:
                lookup_email = email_m.group(1).strip().lower()
                if user_email and lookup_email == user_email.strip().lower():
                    resolved_name = user_zoho_name
                else:
                    target_rows = _run_zoho(
                        f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}" '
                        f'FROM {EMPLOYEE_VIEW} WHERE "{COL_EMAIL}" ILIKE %s LIMIT 1',
                        (lookup_email,),
                    )
                    if not target_rows:
                        return f"No employee found with email **{lookup_email}**."
                    t = target_rows[0]
                    resolved_name = (
                        f"{t.get(COL_FIRST_NAME, '')} {t.get(COL_LAST_NAME, '')}".strip()
                    )

        # Case C: name extracted from natural language
        if not resolved_name:
            _, params_probe, intent_probe = _build_attendance_query(
                query, resolved_name=None
            )
            if intent_probe == 'attendance_employee' and params_probe:
                extracted = params_probe[0].strip('%').strip()
                # If the extracted name matches the viewer's name → use exact Zoho name
                if user_zoho_name:
                    q_words = {w.lower() for w in extracted.split() if len(w) > 1}
                    z_words = {w.lower() for w in user_zoho_name.split()}
                    if q_words and q_words.issubset(z_words):
                        resolved_name = user_zoho_name
                    else:
                        resolved_name = extracted
                else:
                    resolved_name = extracted

        # Case D: no name detected → default to viewer's own data
        if not resolved_name and user_zoho_name:
            resolved_name = user_zoho_name

        # ══════════════════════════════════════════════════════════════════
        # STEP 4 — Fetch attendance from Aura DB + format
        # ══════════════════════════════════════════════════════════════════
        sql, params, intent = _build_attendance_query(query, resolved_name=resolved_name)
        rows = _run_aura(sql, params)

        if rows:
            if intent == 'attendance_employee':
                distinct = list(dict.fromkeys(
                    r['username'] for r in rows if r.get('username')
                ))
                if len(distinct) > 1:
                    names_list = "\n".join(
                        f"  {i + 1}. **{n}**" for i, n in enumerate(distinct[:10])
                    )
                    return (
                        f"I found **{len(distinct)}** employees matching your search. "
                        f"Which one did you mean?\n\n{names_list}\n\n"
                        "Please ask again with the full name, "
                        "e.g. *\"attendance of Yogesh Chandan for this month\"*."
                    )
            return _format_attendance_results(rows, intent)

        if intent == 'attendance_employee' and len(params) >= 1:
            name_param = params[0]
            exist_rows = _run_aura(
                f'SELECT username, '
                f'MIN(checkdate::date) AS from_dt, MAX(checkdate::date) AS to_dt '
                f'FROM {ATTENDANCE_TABLE} '
                f'WHERE username ILIKE %s '
                f'GROUP BY username LIMIT 5',
                (name_param,),
            )
            if exist_rows:
                if len(exist_rows) > 1:
                    names_list = "\n".join(
                        f"  {i + 1}. **{r['username']}** "
                        f"({_fmt_date(r.get('from_dt'))} – {_fmt_date(r.get('to_dt'))})"
                        for i, r in enumerate(exist_rows[:10])
                    )
                    return (
                        f"Found **{len(exist_rows)}** employees matching your search, "
                        "but none have records in the requested period. "
                        f"Available attendance ranges:\n\n{names_list}\n\n"
                        "Please ask again with the full name and a date range that matches."
                    )
                r = exist_rows[0]
                emp_name = r.get('username', '')
                from_dt  = _fmt_date(r.get('from_dt'))
                to_dt    = _fmt_date(r.get('to_dt'))
                return (
                    f"No attendance records found for **{emp_name}** in the requested period.\n\n"
                    f"Available data for this employee: **{from_dt}** – **{to_dt}**.\n"
                    "Please ask again with a date in that range, "
                    f'e.g. *"attendance of {emp_name} in April"*.'
                )

        return _llm_no_attendance_response(query)

    except Exception as exc:
        logger.exception("Attendance agent error: %s", exc)
        return (
            "Attendance data is temporarily unavailable. "
            "Please contact HR at hr@alignedautomation.com for assistance."
        )

