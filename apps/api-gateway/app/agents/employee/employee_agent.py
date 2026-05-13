import re
import logging
from typing import Dict, List, Tuple

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()  # ensure .env is loaded before reading env vars at call time

from app.agents.employee.config import (
    EMPLOYEE_VIEW,
    COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL, COL_DESIGNATION,
    COL_DEPARTMENT, COL_REPORTING_MANAGER, COL_REPORTING_MANAGER_EMAIL,
    COL_FUNCTIONAL_MANAGER, COL_EMPLOYEE_STATUS, COL_EMPLOYEE_TYPE,
    COL_WORK_PHONE, COL_MOBILE, COL_LOCATION_NAME, COL_WORK_LOCATION,
    COL_ROLE, COL_PROJECT_NAME, COL_SKILL_SET, COL_GRADE, COL_LEVEL,
    COL_ENTITY_NAME, COL_REGION, COL_DOJ, COL_TOTAL_EXPERIENCE,
    COL_PARENT_DEPARTMENT, COL_NATIONALITY, COL_BLOOD_GROUP,
    SEARCH_COLUMNS, SUMMARY_FIELDS, HIDDEN_DETAIL_COLUMNS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _connect() -> psycopg2.extensions.connection:
    """Read credentials fresh from env vars every call so .env loads correctly."""
    import os
    return psycopg2.connect(
        host=os.getenv("ZOHO_DB_HOST", ""),
        port=int(os.getenv("ZOHO_DB_PORT", "")),
        dbname=os.getenv("ZOHO_DB_NAME", ""),
        user=os.getenv("ZOHO_DB_USER", ""),
        password=os.getenv("ZOHO_DB_PWD", ""),
        connect_timeout=int(os.getenv("ZOHO_DB_CONNECT_TIMEOUT", "10")),
    )


def _run(sql: str, params: tuple = ()) -> List[Dict]:
    """Execute *sql* and return rows as list of dicts."""
    conn = None
    try:
        conn = _connect()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Employee DB error: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def _ilike_clause(cols: List[str]) -> str:
    """Return 'col1 ILIKE %s OR col2 ILIKE %s ...' for the given columns."""
    return " OR ".join(f'"{c}" ILIKE %s' for c in cols)


def _order_by() -> str:
    return f'"{COL_LAST_NAME}", "{COL_FIRST_NAME}"'


# ---------------------------------------------------------------------------
# Query builder — natural language → (sql, params, intent)
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    'who', 'what', 'where', 'when', 'how', 'the', 'are', 'for', 'can', 'you', 'tell',
    'about', 'employee', 'employees', 'staff', 'person', 'people', 'show', 'give',
    'list', 'all', 'any', 'find', 'search', 'get', 'details', 'information', 'info',
    'me', 'their', 'his', 'her', 'please', 'and', 'with', 'from', 'that', 'this',
    'is', 'has', 'have', 'does', 'did', 'was', 'were',
}

# Maps field keywords (lowercase) → (display label, column name)
# Longer phrases are checked first to avoid partial matches.
_FIELD_MAP = [
    ("mobile number",       ("Mobile Number",      COL_MOBILE)),
    ("contact number",      ("Contact Number",     COL_MOBILE)),
    ("work phone",          ("Work Phone",         COL_WORK_PHONE)),
    ("phone number",        ("Phone Number",       COL_WORK_PHONE)),
    ("email id",            ("Email",              COL_EMAIL)),
    ("email address",       ("Email",              COL_EMAIL)),
    ("reporting manager",   ("Reporting Manager",  COL_REPORTING_MANAGER)),
    ("blood group",         ("Blood Group",        COL_BLOOD_GROUP)),
    ("joining date",        ("Date of Joining",    COL_DOJ)),
    ("date of joining",     ("Date of Joining",    COL_DOJ)),
    ("total experience",    ("Total Experience",   COL_TOTAL_EXPERIENCE)),
    ("skill set",           ("Skills",             COL_SKILL_SET)),
    ("mobile",              ("Mobile Number",      COL_MOBILE)),
    ("phone",               ("Work Phone",         COL_WORK_PHONE)),
    ("cell",                ("Mobile Number",      COL_MOBILE)),
    ("email",               ("Email",              COL_EMAIL)),
    ("mail",                ("Email",              COL_EMAIL)),
    ("designation",         ("Designation",        COL_DESIGNATION)),
    ("title",               ("Designation",        COL_DESIGNATION)),
    ("role",                ("Role",               COL_ROLE)),
    ("position",            ("Designation",        COL_DESIGNATION)),
    ("department",          ("Department",         COL_DEPARTMENT)),
    ("dept",                ("Department",         COL_DEPARTMENT)),
    ("manager",             ("Reporting Manager",  COL_REPORTING_MANAGER)),
    ("location",            ("Location",           COL_LOCATION_NAME)),
    ("address",             ("Location",           COL_LOCATION_NAME)),
    ("grade",               ("Grade",              COL_GRADE)),
    ("level",               ("Level",              COL_LEVEL)),
    ("skills",              ("Skills",             COL_SKILL_SET)),
    ("skill",               ("Skills",             COL_SKILL_SET)),
    ("project",             ("Project",            COL_PROJECT_NAME)),
    ("blood",               ("Blood Group",        COL_BLOOD_GROUP)),
    ("status",              ("Status",             COL_EMPLOYEE_STATUS)),
    ("experience",          ("Total Experience",   COL_TOTAL_EXPERIENCE)),
    ("joining",             ("Date of Joining",    COL_DOJ)),
    ("nationality",         ("Nationality",        COL_NATIONALITY)),
]

_FIELD_CONNECTOR_WORDS = {
    'tell', 'me', 'what', 'is', 'the', 'of', 'for', 'get', 'find', 'show',
    'give', 'number', 'id', 'details', 'their', 'his', 'her', 'please',
    'share', 'provide', 'fetch', 'check',
}


def _keywords(text: str) -> List[str]:
    return [w for w in re.findall(r'[a-zA-Z]+', text.lower())
            if len(w) > 2 and w not in _STOP_WORDS]


def _detect_field_query(q: str):
    """
    Detect queries like:
      "Tell me mobile - Amol", "email of Ravi Kumar", "Amol's phone number"
    Returns (field_label, col_name, person_name) or None.
    """
    matched_label = None
    matched_col   = None
    matched_kw    = None

    for keyword, (label, col) in _FIELD_MAP:
        if keyword in q:
            matched_label = label
            matched_col   = col
            matched_kw    = keyword
            break

    if not matched_label:
        return None

    # Strategy 1: possessive — "Amol's mobile"
    m = re.search(r"([a-zA-Z][a-zA-Z\s\-\.]{1,30}?)'s\b", q)
    if m:
        name = m.group(1).strip()
        if len(name) >= 2:
            return matched_label, matched_col, name

    # Strategy 2: "of / for Name" at end — "mobile of Amol Kumar"
    m = re.search(r'\b(?:of|for)\s+([a-zA-Z][a-zA-Z\s\-\.]{1,40}?)(?:\s*$)', q)
    if m:
        name = m.group(1).strip()
        if len(name) >= 2:
            return matched_label, matched_col, name

    # Strategy 3: separator  "mobile - Amol" / "email: Ravi"
    m = re.search(r'[-:]\s*([a-zA-Z][a-zA-Z\s\-\.]{1,40}?)(?:\s*$)', q)
    if m:
        name = m.group(1).strip()
        if len(name) >= 2:
            return matched_label, matched_col, name

    # Strategy 4: strip all field + connector words; remainder is the name
    remove = set(matched_kw.split()) | _FIELD_CONNECTOR_WORDS
    name_words = [w for w in re.findall(r'[a-zA-Z]+', q) if w not in remove and len(w) > 1]
    if name_words:
        return matched_label, matched_col, " ".join(name_words)

    return None


def _build_query(query: str) -> Tuple[str, tuple, str]:
    q = query.lower().strip()

    # ---- COUNT ----------------------------------------------------------
    if re.search(r'\b(count|how many|total|number of)\b', q):
        dept_m = re.search(
            r'\b(?:in|from|of)\s+(?:the\s+)?([a-zA-Z &]+?)'
            r'(?:\s+(?:department|dept|team))?\s*$', q
        )
        if dept_m:
            dept = dept_m.group(1).strip()
            return (
                f'SELECT COUNT(*) AS count FROM {EMPLOYEE_VIEW} '
                f'WHERE "{COL_DEPARTMENT}" ILIKE %s',
                (f"%{dept}%",),
                "count",
            )
        return f"SELECT COUNT(*) AS count FROM {EMPLOYEE_VIEW}", (), "count"

    # ---- SKILL SET search -----------------------------------------------
    skill_m = re.search(r'\b(?:skill(?:s|set)?|expertise|knows?|expert in|proficient in)\s+([a-zA-Z\s\+\#\.]+)', q)
    if skill_m:
        skill = skill_m.group(1).strip()
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_SKILL_SET}", "{COL_PROJECT_NAME}" '
            f'FROM {EMPLOYEE_VIEW} WHERE "{COL_SKILL_SET}" ILIKE %s '
            f'ORDER BY {_order_by()} LIMIT 30',
            (f"%{skill}%",),
            "skill_search",
        )

    # ---- PROJECT search -------------------------------------------------
    project_m = re.search(r'\b(?:project|working on|assigned to)\s+([a-zA-Z\s\-]+)', q)
    if project_m:
        project = project_m.group(1).strip()
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_PROJECT_NAME}" '
            f'FROM {EMPLOYEE_VIEW} WHERE "{COL_PROJECT_NAME}" ILIKE %s '
            f'ORDER BY {_order_by()} LIMIT 30',
            (f"%{project}%",),
            "project_search",
        )

    # ---- DEPARTMENT listing ---------------------------------------------
    dept_m = re.search(
        r'\b(?:employees?|staff|people|team|members?)\s+'
        r'(?:in|from|of|under|belonging to)\s+(?:the\s+)?'
        r'([a-zA-Z &]+?)(?:\s+(?:department|dept|team))?\s*$',
        q,
    )
    if not dept_m:
        dept_m = re.search(r'\b([a-zA-Z &]+?)\s+(?:department|dept|team)\b', q)
    if dept_m:
        dept = dept_m.group(1).strip()
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_WORK_PHONE}", '
            f'"{COL_EMPLOYEE_STATUS}" '
            f'FROM {EMPLOYEE_VIEW} WHERE "{COL_DEPARTMENT}" ILIKE %s '
            f'ORDER BY {_order_by()} LIMIT 50',
            (f"%{dept}%",),
            "department",
        )

    # ---- EXPLICIT NAME / FIND -------------------------------------------
    name_m = re.search(
        r'\b(?:find|search|get|show|who is|info (?:about|on|for)|'
        r'details? (?:of|for|about)|tell me about|contact (?:for|of))\s+'
        r'(?:employee\s+)?([a-zA-Z][\w\s\-\.]{1,40})',
        q,
    )
    if name_m:
        name = name_m.group(1).strip()
        name_cols = [COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL]
        clause = _ilike_clause(name_cols)
        return (
            f"SELECT * FROM {EMPLOYEE_VIEW} WHERE {clause} "
            f"ORDER BY {_order_by()} LIMIT 10",
            tuple(f"%{name}%" for _ in name_cols),
            "name_search",
        )

    # ---- DESIGNATION / ROLE search --------------------------------------
    role_m = re.search(
        r'\b(?:title|role|designation|position)\s*(?:is\s+|of\s+|:?\s*)([a-zA-Z\s]+)', q
    )
    if role_m:
        role = role_m.group(1).strip()
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_REPORTING_MANAGER}" '
            f'FROM {EMPLOYEE_VIEW} WHERE "{COL_DESIGNATION}" ILIKE %s '
            f'ORDER BY {_order_by()} LIMIT 20',
            (f"%{role}%",),
            "role_search",
        )

    # ---- REPORTING / MANAGER --------------------------------------------
    if re.search(r'\b(manager|reporting to|reports? to|team lead)\b', q):
        mgr_m = re.search(r'(?:manager of|reports? to|reporting to|team of)\s+([a-zA-Z\s]+)', q)
        if mgr_m:
            name = mgr_m.group(1).strip()
            return (
                f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
                f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_REPORTING_MANAGER}" '
                f'FROM {EMPLOYEE_VIEW} WHERE "{COL_REPORTING_MANAGER}" ILIKE %s '
                f'ORDER BY {_order_by()} LIMIT 20',
                (f"%{name}%",),
                "manager_search",
            )

    # ---- LOCATION search ------------------------------------------------
    location_m = re.search(r'\b(?:employees?|staff|people)\s+(?:in|at|from)\s+([a-zA-Z\s]+)', q)
    if location_m:
        loc = location_m.group(1).strip()
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_LOCATION_NAME}" '
            f'FROM {EMPLOYEE_VIEW} WHERE "{COL_LOCATION_NAME}" ILIKE %s '
            f'OR "{COL_WORK_LOCATION}" ILIKE %s '
            f'ORDER BY {_order_by()} LIMIT 30',
            (f"%{loc}%", f"%{loc}%"),
            "location_search",
        )

    # ---- SPECIFIC FIELD for a PERSON  ("Tell me mobile - Amol") ----------
    field_result = _detect_field_query(q)
    if field_result:
        field_label, col_name, person_name = field_result
        name_cols = [COL_FIRST_NAME, COL_LAST_NAME]
        clause = _ilike_clause(name_cols)
        return (
            f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", '
            f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{col_name}" '
            f'FROM {EMPLOYEE_VIEW} WHERE {clause} '
            f'ORDER BY {_order_by()} LIMIT 5',
            tuple(f"%{person_name}%" for _ in name_cols),
            f"field:{field_label}:{col_name}",
        )

    # ---- GENERAL TEXT SEARCH — each keyword searched independently -------
    words = _keywords(q)
    if words:
        # Build: (col1 ILIKE %word1% OR col2 ILIKE %word1% ...) for each word
        conditions: List[str] = []
        params_list: List[str] = []
        for word in words[:3]:
            for col in [COL_FIRST_NAME, COL_LAST_NAME, COL_EMAIL,
                        COL_DESIGNATION, COL_DEPARTMENT]:
                conditions.append(f'"{col}" ILIKE %s')
                params_list.append(f"%{word}%")
        where_clause = " OR ".join(conditions)
        return (
            f"SELECT * FROM {EMPLOYEE_VIEW} WHERE {where_clause} "
            f"ORDER BY {_order_by()} LIMIT 10",
            tuple(params_list),
            "general_search",
        )

    # ---- FALLBACK: list first 20 ----------------------------------------
    return (
        f'SELECT "{COL_FIRST_NAME}", "{COL_LAST_NAME}", "{COL_EMAIL}", '
        f'"{COL_DESIGNATION}", "{COL_DEPARTMENT}", "{COL_EMPLOYEE_STATUS}" '
        f'FROM {EMPLOYEE_VIEW} ORDER BY {_order_by()} LIMIT 20',
        (),
        "list_all",
    )


# ---------------------------------------------------------------------------
# Response formatters
# ---------------------------------------------------------------------------

def _full_name(emp: Dict) -> str:
    first = str(emp.get(COL_FIRST_NAME) or "").strip()
    last  = str(emp.get(COL_LAST_NAME)  or "").strip()
    return f"{first} {last}".strip() or emp.get("EmployeeId", "Unknown")


def _fmt_summary_line(emp: Dict) -> str:
    """One-line summary for multi-result lists."""
    parts = [f"**{_full_name(emp)}**"]
    for col, label in SUMMARY_FIELDS:
        val = emp.get(col)
        if val and str(val).strip():
            parts.append(f"{label}: {val}")
    return " | ".join(parts)


def _fmt_detail_card(emp: Dict) -> str:
    """Full detail card for a single employee (hides PII columns)."""
    lines: List[str] = []

    # Name always comes first
    lines.append(f"**Name:** {_full_name(emp)}")

    # Ordered priority fields
    priority = [
        (COL_DESIGNATION,             "Designation"),
        (COL_DEPARTMENT,              "Department"),
        (COL_PARENT_DEPARTMENT,       "Parent Department"),
        (COL_ROLE,                    "Role"),
        (COL_GRADE,                   "Grade"),
        (COL_LEVEL,                   "Level"),
        (COL_EMPLOYEE_TYPE,           "Employee Type"),
        (COL_EMPLOYEE_STATUS,         "Status"),
        (COL_EMAIL,                   "Work Email"),
        (COL_WORK_PHONE,              "Work Phone"),
        (COL_MOBILE,                  "Mobile"),
        (COL_WORK_LOCATION,           "Work Location"),
        (COL_LOCATION_NAME,           "Location"),
        (COL_REGION,                  "Region"),
        (COL_ENTITY_NAME,             "Entity"),
        (COL_REPORTING_MANAGER,       "Reporting Manager"),
        (COL_REPORTING_MANAGER_EMAIL, "Manager Email"),
        (COL_FUNCTIONAL_MANAGER,      "Functional Manager"),
        (COL_PROJECT_NAME,            "Project"),
        (COL_SKILL_SET,               "Skills"),
        (COL_TOTAL_EXPERIENCE,        "Total Experience"),
        (COL_DOJ,                     "Date of Joining"),
        (COL_NATIONALITY,             "Nationality"),
    ]

    rendered_keys = {COL_FIRST_NAME, COL_LAST_NAME}
    for col, label in priority:
        val = emp.get(col)
        if val and str(val).strip() and col not in HIDDEN_DETAIL_COLUMNS:
            lines.append(f"**{label}:** {val}")
            rendered_keys.add(col)

    # Append any remaining columns not in priority list and not hidden
    for col, val in emp.items():
        if col in rendered_keys or col in HIDDEN_DETAIL_COLUMNS:
            continue
        if val and str(val).strip():
            label = col.replace("_", " ").title()
            lines.append(f"**{label}:** {val}")

    return "\n".join(lines)


def _fmt_field_results(rows: List[Dict], field_label: str, col_name: str) -> str:
    """Format results for a specific-field query (e.g. 'mobile of Amol')."""
    if len(rows) == 1:
        emp = rows[0]
        name = _full_name(emp)
        val  = emp.get(col_name)
        if val and str(val).strip():
            return f"**{name}** — {field_label}: **{val}**"
        return f"**{name}** — {field_label} is not available in the records."

    lines = [f"Found **{len(rows)}** matching employees:\n"]
    for emp in rows:
        name = _full_name(emp)
        val  = emp.get(col_name)
        val_str  = f"**{val}**" if val and str(val).strip() else "N/A"
        desig = emp.get(COL_DESIGNATION, "")
        dept  = emp.get(COL_DEPARTMENT, "")
        extra = f" ({desig}, {dept})" if desig or dept else ""
        lines.append(f"- **{name}**{extra} — {field_label}: {val_str}")
    return "\n".join(lines)


def _format_results(rows: List[Dict], intent: str) -> str:
    if not rows:
        return ""

    if intent == "count":
        count = rows[0].get("count", 0)
        return f"There are **{count}** employees in the system."

    # Field-specific query: intent = "field:<label>:<col_name>"
    if intent.startswith("field:"):
        _, field_label, col_name = intent.split(":", 2)
        return _fmt_field_results(rows, field_label, col_name)

    if len(rows) == 1:
        return _fmt_detail_card(rows[0])

    header = f"Found **{len(rows)}** employee(s):\n"
    lines  = [f"- {_fmt_summary_line(e)}" for e in rows]
    return header + "\n".join(lines)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def employee_agent(query: str) -> str:
    """
    Employee Agent — answers employee queries by querying
    the Zoho People database (people.vb_employees) directly.
    """
    try:
        sql, params, intent = _build_query(query)
        rows = _run(sql, params)

        if rows:
            result = _format_results(rows, intent)
            if result:
                return result

        # Widen the search when a targeted query returns nothing
        if not intent.startswith("field:") and intent not in ("count", "list_all"):
            words = _keywords(query)
            if words:
                conditions: List[str] = []
                params_list: List[str] = []
                for word in words[:2]:
                    for col in [COL_FIRST_NAME, COL_LAST_NAME, COL_DESIGNATION, COL_DEPARTMENT]:
                        conditions.append(f'"{col}" ILIKE %s')
                        params_list.append(f"%{word}%")
                broad_rows = _run(
                    f"SELECT * FROM {EMPLOYEE_VIEW} WHERE {' OR '.join(conditions)} "
                    f"ORDER BY {_order_by()} LIMIT 10",
                    tuple(params_list),
                )
                if broad_rows:
                    return _format_results(broad_rows, "general_search")

        return (
            f"No employee records found for: \"{query}\". "
            "Try searching by full name, department, designation, or skill. "
            "Contact HR at hr@alignedautomation.com for further assistance."
        )

    except Exception as exc:
        logger.exception("Employee agent error: %s", exc)
        return (
            "Employee data is temporarily unavailable. "
            "Please contact HR at hr@alignedautomation.com for assistance."
        )
