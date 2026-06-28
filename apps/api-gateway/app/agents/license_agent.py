import re
import logging
import os
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

logger = logging.getLogger(__name__)

# ── Tool registry ─────────────────────────────────────────────────────────────
_TOOLS: Dict[str, Dict] = {
    'claude': {
        'table':      'ai_claude_users',
        'label':      'Claude (Anthropic)',
        'icon':       '🤖',
        'name_col':   'name',
        'email_col':  'email',
        'extra_cols': ['role', 'status', 'seat_tier'],
        'keywords':   ['claude', 'anthropic'],
    },
    'figma': {
        'table':      'ai_figma_users',
        'label':      'Figma',
        'icon':       '🎨',
        'name_col':   'name',
        'email_col':  'email',
        'extra_cols': ['role', 'seat_type'],
        'keywords':   ['figma'],
    },
    'lovable': {
        'table':      'ai_lovable_users',
        'label':      'Lovable',
        'icon':       '💜',
        'name_col':   'display_name',
        'email_col':  'email',
        'extra_cols': ['role', 'status', 'credit_limit', 'monthly_usage'],
        'keywords':   ['lovable'],
    },
    'm365': {
        'table':      'ai_m365_copilot_users',
        'label':      'M365 Copilot',
        'icon':       '🪟',
        'name_col':   'display_name',
        'email_col':  'user_principal_name',
        'extra_cols': ['licenses', 'department'],
        'keywords':   ['m365', 'microsoft 365', 'copilot', 'microsoft copilot'],
    },
}


def _connect() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.getenv("SQL_HOST", "hackathon.alignedautomation.com"),
        port=int(os.getenv("SQL_PORT", "5432")),
        dbname=os.getenv("SQL_DB", "squadrons"),
        user=os.getenv("SQL_USERNAME", "squadrons"),
        password=os.getenv("SQL_PWD", ""),
        connect_timeout=10,
    )


def _run(sql: str, params: tuple = ()) -> List[Dict]:
    conn = None
    try:
        conn = _connect()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("License DB error: %s", exc)
        return []
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ── Query classification ──────────────────────────────────────────────────────

def _detect_tools(query: str) -> List[str]:
    """Return list of tool keys mentioned in the query (empty = all)."""
    q = query.lower()
    found = [key for key, info in _TOOLS.items()
             if any(kw in q for kw in info['keywords'])]
    return found


def _is_count_query(query: str) -> bool:
    return bool(re.search(
        r'\b(how many|count|total|number of|how much|quantity)\b',
        query, re.IGNORECASE,
    ))


def _is_list_query(query: str) -> bool:
    return bool(re.search(
        r'\b(who|list|show|display|give me|get|fetch|all users|all employees|people)\b',
        query, re.IGNORECASE,
    ))


def _extract_person(query: str) -> Optional[str]:
    """Try to extract a person name / email from the query."""
    email_m = re.search(r'\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b', query)
    if email_m:
        return email_m.group(1)

    name_m = re.search(
        r'\b(?:for|of|about|does|has)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b',
        query,
    )
    if name_m:
        return name_m.group(1)
    return None


# ── HTML formatting ───────────────────────────────────────────────────────────

_CSS = """<style>
.lic-wrap{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;max-width:900px;}
.lic-title{font-size:1.15em;font-weight:700;margin-bottom:12px;color:#1e3a5f;}
.lic-summary{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;}
.lic-card{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 18px;min-width:130px;text-align:center;}
.lic-card .cnt{font-size:2em;font-weight:700;color:#1d4ed8;line-height:1.1;}
.lic-card .lbl{font-size:0.78em;color:#64748b;margin-top:4px;}
.lic-section{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05);}
.lic-section-hdr{background:linear-gradient(90deg,#1e3a5f,#2563eb);color:#fff;padding:8px 14px;font-weight:600;font-size:0.92em;display:flex;justify-content:space-between;align-items:center;}
.lic-section-hdr .pill{background:rgba(255,255,255,.2);border-radius:20px;padding:2px 10px;font-size:0.8em;}
.lic-tbl{width:100%;border-collapse:collapse;font-size:0.86em;}
.lic-tbl thead tr{background:#f1f5f9;}
.lic-tbl thead th{padding:7px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;}
.lic-tbl tbody tr:nth-child(even){background:#f8fafc;}
.lic-tbl tbody tr:hover{background:#eff6ff;}
.lic-tbl td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.78em;font-weight:600;}
.badge-active{background:#dcfce7;color:#15803d;}
.badge-inactive{background:#fee2e2;color:#b91c1c;}
.badge-neutral{background:#e0f2fe;color:#0369a1;}
</style>"""


def _status_badge(val: Optional[str]) -> str:
    if not val:
        return '<span style="color:#94a3b8;">—</span>'
    v = str(val).strip().lower()
    if v in ('active', 'enabled', 'yes', 'true', '1'):
        return f'<span class="badge badge-active">{val}</span>'
    if v in ('inactive', 'disabled', 'no', 'false', '0', 'deprovisioned'):
        return f'<span class="badge badge-inactive">{val}</span>'
    return f'<span class="badge badge-neutral">{val}</span>'


def _cell(val) -> str:
    if val is None or str(val).strip() == '':
        return '<span style="color:#94a3b8;">—</span>'
    return str(val)


def _format_tool_table(tool_key: str, rows: List[Dict]) -> str:
    info = _TOOLS[tool_key]
    name_col  = info['name_col']
    email_col = info['email_col']
    extra     = [c for c in info['extra_cols'] if any(c in r for r in rows)]

    headers = ['#', 'Name', 'Email'] + [c.replace('_', ' ').title() for c in extra]
    thead = '<tr>' + ''.join(f'<th>{h}</th>' for h in headers) + '</tr>'

    tbody_rows = []
    for idx, row in enumerate(rows, 1):
        name_val  = _cell(row.get(name_col))
        email_val = _cell(row.get(email_col))
        extra_vals = []
        for c in extra:
            if c == 'status':
                extra_vals.append(f'<td>{_status_badge(row.get(c))}</td>')
            else:
                extra_vals.append(f'<td>{_cell(row.get(c))}</td>')
        tbody_rows.append(
            f'<tr><td style="color:#94a3b8;">{idx}</td>'
            f'<td><strong>{name_val}</strong></td>'
            f'<td style="color:#64748b;font-size:0.9em;">{email_val}</td>'
            + ''.join(extra_vals) +
            '</tr>'
        )

    return (
        f'<div class="lic-section">'
        f'<div class="lic-section-hdr">'
        f'<span>{info["icon"]} {info["label"]}</span>'
        f'<span class="pill">{len(rows)} user{"s" if len(rows) != 1 else ""}</span>'
        f'</div>'
        f'<table class="lic-tbl"><thead>{thead}</thead>'
        f'<tbody>{"".join(tbody_rows)}</tbody>'
        f'</table></div>'
    )


# ── Intent handlers ───────────────────────────────────────────────────────────

def _handle_overview(tool_keys: List[str]) -> str:
    """Show count cards + full user list for each tool."""
    cards = []
    sections = []
    total = 0

    for key in tool_keys:
        info = _TOOLS[key]
        rows = _run(f'SELECT * FROM public."{info["table"]}" ORDER BY {info["name_col"]} LIMIT 500')
        cnt = len(rows)
        total += cnt
        cards.append(
            f'<div class="lic-card">'
            f'<div class="cnt">{cnt}</div>'
            f'<div class="lbl">{info["icon"]} {info["label"]}</div>'
            f'</div>'
        )
        if rows:
            sections.append(_format_tool_table(key, rows))

    if len(tool_keys) > 1:
        cards.insert(0,
            f'<div class="lic-card" style="background:#f0fdf4;border-color:#bbf7d0;">'
            f'<div class="cnt" style="color:#15803d;">{total}</div>'
            f'<div class="lbl">Total AI Licenses</div>'
            f'</div>'
        )

    title = "AI License Summary" if len(tool_keys) > 1 else f'{_TOOLS[tool_keys[0]]["label"]} Licenses'

    return (
        f'{_CSS}'
        f'<div class="lic-wrap">'
        f'<div class="lic-title">{title}</div>'
        f'<div class="lic-summary">{"".join(cards)}</div>'
        f'{"".join(sections)}'
        f'</div>'
    )


def _handle_count(tool_keys: List[str]) -> str:
    """Return just the counts as cards."""
    cards = []
    total = 0
    lines = []

    for key in tool_keys:
        info = _TOOLS[key]
        rows = _run(f'SELECT COUNT(*) AS cnt FROM public."{info["table"]}"')
        cnt = int(rows[0]['cnt']) if rows else 0
        total += cnt
        cards.append(
            f'<div class="lic-card">'
            f'<div class="cnt">{cnt}</div>'
            f'<div class="lbl">{info["icon"]} {info["label"]}</div>'
            f'</div>'
        )
        lines.append(f'{info["icon"]} <strong>{info["label"]}:</strong> {cnt} user{"s" if cnt != 1 else ""}')

    if len(tool_keys) > 1:
        cards.insert(0,
            f'<div class="lic-card" style="background:#f0fdf4;border-color:#bbf7d0;">'
            f'<div class="cnt" style="color:#15803d;">{total}</div>'
            f'<div class="lbl">Total AI Licenses</div>'
            f'</div>'
        )

    title = "AI License Count" if len(tool_keys) > 1 else f'{_TOOLS[tool_keys[0]]["label"]} — License Count'

    return (
        f'{_CSS}'
        f'<div class="lic-wrap">'
        f'<div class="lic-title">{title}</div>'
        f'<div class="lic-summary">{"".join(cards)}</div>'
        f'<ul style="margin:0;padding-left:20px;font-size:0.9em;color:#334155;">'
        + ''.join(f'<li style="margin-bottom:4px;">{l}</li>' for l in lines) +
        f'</ul></div>'
    )


def _handle_person_lookup(person: str, tool_keys: List[str]) -> str:
    """Find licenses assigned to a specific person (name or email)."""
    is_email = '@' in person
    sections = []
    found_tools = []

    for key in tool_keys:
        info = _TOOLS[key]
        tbl = info['table']
        if is_email:
            col = info['email_col']
            rows = _run(
                f'SELECT * FROM public."{tbl}" WHERE {col} ILIKE %s LIMIT 20',
                (f'%{person}%',),
            )
        else:
            col = info['name_col']
            rows = _run(
                f'SELECT * FROM public."{tbl}" WHERE {col} ILIKE %s LIMIT 20',
                (f'%{person}%',),
            )
        if rows:
            sections.append(_format_tool_table(key, rows))
            found_tools.append(info['label'])

    if not sections:
        return (
            f'{_CSS}'
            f'<div class="lic-wrap">'
            f'<div class="lic-title">License Lookup — {person}</div>'
            f'<p style="color:#64748b;">No AI licenses found for <strong>{person}</strong>.</p>'
            f'</div>'
        )

    return (
        f'{_CSS}'
        f'<div class="lic-wrap">'
        f'<div class="lic-title">Licenses for {person}</div>'
        f'<p style="color:#64748b;margin-bottom:12px;">'
        f'Found in: {", ".join(found_tools)}</p>'
        f'{"".join(sections)}'
        f'</div>'
    )


# ── Public entry point ────────────────────────────────────────────────────────

def license_agent(query: str, user_email: str = "") -> str:
    """
    License Agent — answers AI tool license questions from the squadrons DB.

    Handles:
      - How many [tool] licenses do we have?
      - Who has [tool] access?
      - Does [person] have Claude / Figma / etc.?
      - Overview of all AI tools and their users.
    """
    try:
        tool_keys = _detect_tools(query)
        if not tool_keys:
            tool_keys = list(_TOOLS.keys())  # default: all tools

        person = _extract_person(query)
        if person:
            return _handle_person_lookup(person, tool_keys)

        if _is_count_query(query) and not _is_list_query(query):
            return _handle_count(tool_keys)

        return _handle_overview(tool_keys)

    except Exception as exc:
        logger.exception("License agent error: %s", exc)
        return (
            "AI license information is temporarily unavailable. "
            "Please contact IT at it@alignedautomation.com for assistance."
        )
