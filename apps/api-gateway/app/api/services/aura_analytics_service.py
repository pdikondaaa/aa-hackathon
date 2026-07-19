"""AURA usage analytics — real data from messages/conversations/users and
related feature tables (escalations, product feedback, event RSVPs).

All timestamps in `messages`/`conversations` are stored as naive UTC. Bucketing
(day / hour) is done in IST (UTC+5:30) since AURA's user base is India-based.
"""
from datetime import datetime, timedelta, timezone

from app.api.config.db_config import get_db_connection

IST_OFFSET = timedelta(hours=5, minutes=30)
LOCAL_SHIFT_SQL = "interval '5 hours 30 minutes'"

_CATEGORY_CASE_SQL = """
    CASE
        WHEN content ILIKE ANY(ARRAY['%%leave%%','%%payroll%%','%%salary%%','%%insurance%%','%%benefit%%',
                                     '%%wfh%%','%%work from home%%','%%referral%%','%%onboarding%%',
                                     '%%attendance%%','%%holiday%%','%%maternity%%','%%paternity%%'])
            THEN 'HR Queries'
        WHEN content ILIKE ANY(ARRAY['%%vpn%%','%%password%%','%%it ticket%%','%%laptop%%','%%network%%',
                                     '%%mfa%%','%%access%%','%%wifi%%','%%software%%','%%hardware%%','%%reset%%'])
            THEN 'IT Support'
        WHEN content ILIKE ANY(ARRAY['%%letter%%','%%certificate%%','%%document%%','%%draft%%','%%noc%%','%%generate%%'])
            THEN 'Documents'
        WHEN content ILIKE ANY(ARRAY['%%who is%%','%%org chart%%','%%ceo%%','%%coo%%','%%announcement%%',
                                     '%%event%%','%%organization%%','%%chief%%'])
            THEN 'Org Info'
        ELSE 'General'
    END
"""

_CATEGORY_COLORS = {
    'HR Queries':  '#1D76BC',
    'IT Support':  '#27AAE1',
    'Documents':   '#4ED44E',
    'Org Info':    '#2A3D90',
    'General':     '#f59e0b',
}


def _f(val, default=0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _range_bounds(date_range: str):
    """Returns (start_utc, now_utc, prev_start_utc) for the requested window, all naive UTC."""
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    now_local = now_utc + IST_OFFSET

    if date_range == 'today':
        start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == 'month':
        start_local = now_local - timedelta(days=30)
    elif date_range == 'quarter':
        start_local = now_local - timedelta(days=90)
    else:  # 'week' default
        start_local = now_local - timedelta(days=7)

    start_utc = start_local - IST_OFFSET
    length = now_utc - start_utc
    prev_start_utc = start_utc - length
    return start_utc, now_utc, prev_start_utc


def _pct_delta(current: float, previous: float) -> tuple[str, bool]:
    if previous <= 0:
        if current <= 0:
            return '0%', True
        return 'New', True
    change = (current - previous) / previous * 100
    positive = change >= 0
    return f"{'+' if positive else ''}{round(change)}%", positive


def get_aura_users() -> list:
    """Real per-user activity roster — joins `users` with their conversation/message counts."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id, u.email, u.display_name, u.role, u.is_active,
                    u.last_login_at, u.created_at,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.is_deleted = FALSE) AS total_conversations,
                    COUNT(m.id) FILTER (WHERE m.role = 'user')               AS total_queries,
                    MAX(m.created_at) FILTER (WHERE m.role = 'user')        AS last_active_at
                FROM users u
                LEFT JOIN conversations c ON c.user_id = u.id
                LEFT JOIN messages m ON m.conversation_id = c.id
                GROUP BY u.id, u.email, u.display_name, u.role, u.is_active, u.last_login_at, u.created_at
                ORDER BY last_active_at DESC NULLS LAST
                """
            )
            rows = cur.fetchall()

    out = []
    for r in rows:
        out.append({
            "id":               str(r["id"]),
            "name":             r["display_name"] or (r["email"] or "").split("@")[0],
            "email":            r["email"],
            "role":             r["role"] or "user",
            "isActive":         bool(r["is_active"]),
            "joinedAt":         r["created_at"].strftime("%Y-%m-%d") if r["created_at"] else None,
            "lastLoginAt":      r["last_login_at"].isoformat() if r["last_login_at"] else None,
            "lastActiveAt":     r["last_active_at"].isoformat() if r["last_active_at"] else None,
            "totalConversations": int(r["total_conversations"] or 0),
            "totalQueries":       int(r["total_queries"] or 0),
        })
    return out


def get_aura_dashboard(date_range: str = 'week') -> dict:
    start_utc, now_utc, prev_start_utc = _range_bounds(date_range)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            return {
                "overviewStats":    _overview_stats(cur, start_utc, now_utc, prev_start_utc),
                "mostUsedTabs":     _most_used_features(cur, start_utc, now_utc),
                "dailyUsage":       _daily_usage(cur, start_utc, now_utc),
                "queryCategories":  _query_categories(cur, start_utc, now_utc),
                "activeUsersTrend": _active_users_trend(cur),
                "peakUsageHours":   _peak_usage_hours(cur, start_utc, now_utc),
                "topQueries":       _top_queries(cur, start_utc, now_utc),
                "successVsFailed":  _success_vs_failed(cur, start_utc, now_utc),
            }


# ------------------------------------------------------------------ #
# Overview KPI cards                                                  #
# ------------------------------------------------------------------ #
def _overview_stats(cur, start_utc, now_utc, prev_start_utc) -> list:
    cur.execute("SELECT COUNT(*) AS c FROM users")
    total_users = cur.fetchone()["c"]

    def _count_new_users(a, b):
        cur.execute("SELECT COUNT(*) AS c FROM users WHERE created_at >= %s AND created_at < %s", (a, b))
        return cur.fetchone()["c"]

    def _count_conversations(a, b):
        cur.execute(
            "SELECT COUNT(*) AS c FROM conversations WHERE is_deleted = FALSE AND created_at >= %s AND created_at < %s",
            (a, b),
        )
        return cur.fetchone()["c"]

    def _count_queries(a, b):
        cur.execute(
            "SELECT COUNT(*) AS c FROM messages WHERE role = 'user' AND created_at >= %s AND created_at < %s",
            (a, b),
        )
        return cur.fetchone()["c"]

    def _count_active_users(a, b):
        cur.execute(
            """
            SELECT COUNT(DISTINCT c.user_id) AS c
            FROM messages m JOIN conversations c ON c.id = m.conversation_id
            WHERE m.role = 'user' AND m.created_at >= %s AND m.created_at < %s
            """,
            (a, b),
        )
        return cur.fetchone()["c"]

    def _count_escalations(a, b):
        cur.execute(
            "SELECT COUNT(*) AS c FROM escalation_records WHERE created_at >= %s AND created_at < %s",
            (a, b),
        )
        return cur.fetchone()["c"]

    new_users_cur       = _count_new_users(start_utc, now_utc)
    new_users_prev      = _count_new_users(prev_start_utc, start_utc)
    conversations_cur  = _count_conversations(start_utc, now_utc)
    conversations_prev = _count_conversations(prev_start_utc, start_utc)
    queries_cur         = _count_queries(start_utc, now_utc)
    queries_prev        = _count_queries(prev_start_utc, start_utc)
    active_cur          = _count_active_users(start_utc, now_utc)
    active_prev         = _count_active_users(prev_start_utc, start_utc)
    escalations_cur     = _count_escalations(start_utc, now_utc)
    escalations_prev    = _count_escalations(prev_start_utc, start_utc)

    today_local_start = (now_utc + IST_OFFSET).replace(hour=0, minute=0, second=0, microsecond=0) - IST_OFFSET
    yesterday_local_start = today_local_start - timedelta(days=1)
    today_usage     = _count_queries(today_local_start, now_utc)
    yesterday_usage = _count_queries(yesterday_local_start, today_local_start)

    users_delta, users_pos         = _pct_delta(new_users_cur, new_users_prev)
    conv_delta, conv_pos           = _pct_delta(conversations_cur, conversations_prev)
    query_delta, query_pos         = _pct_delta(queries_cur, queries_prev)
    active_delta, active_pos       = _pct_delta(active_cur, active_prev)
    esc_delta, esc_pos             = _pct_delta(escalations_cur, escalations_prev)
    today_delta, today_pos         = _pct_delta(today_usage, yesterday_usage)

    return [
        {
            "id": "totalUsers", "label": "Total Users", "value": total_users,
            "icon": "fa-users", "color": "#1D76BC",
            "delta": users_delta, "positive": users_pos, "suffix": "",
        },
        {
            "id": "totalConversations", "label": "Total Conversations", "value": conversations_cur,
            "icon": "fa-comments", "color": "#27AAE1",
            "delta": conv_delta, "positive": conv_pos, "suffix": "",
        },
        {
            "id": "totalQueries", "label": "Total Queries", "value": queries_cur,
            "icon": "fa-magnifying-glass", "color": "#4ED44E",
            "delta": query_delta, "positive": query_pos, "suffix": "",
        },
        {
            "id": "activeUsers", "label": "Active Users", "value": active_cur,
            "icon": "fa-user-check", "color": "#2A3D90",
            "delta": active_delta, "positive": active_pos, "suffix": "",
        },
        {
            # Fewer escalations is the good outcome, so the up/down sense is inverted
            # relative to the other cards (a "-X%" drop in escalations shows positive).
            "id": "escalationsRaised", "label": "Escalations Raised", "value": escalations_cur,
            "icon": "fa-triangle-exclamation", "color": "#f59e0b",
            "delta": esc_delta, "positive": (esc_delta == '0%') or (not esc_pos), "suffix": "",
        },
        {
            "id": "dailyUsage", "label": "Today's Usage", "value": today_usage,
            "icon": "fa-calendar-day", "color": "#a855f7",
            "delta": today_delta, "positive": today_pos, "suffix": "",
        },
    ]


# ------------------------------------------------------------------ #
# Most Used Features — real cross-module usage counts                #
# ------------------------------------------------------------------ #
def _most_used_features(cur, start_utc, now_utc) -> list:
    def _count(table, ts_col, extra=""):
        cur.execute(
            f"SELECT COUNT(*) AS c FROM {table} WHERE {ts_col} >= %s AND {ts_col} < %s {extra}",
            (start_utc, now_utc),
        )
        return cur.fetchone()["c"]

    rows = [
        {"tab": "AI Assistant Chat", "count": _count("messages", "created_at", "AND role = 'user'"), "fill": "#1D76BC"},
        {"tab": "IT/HR Escalations", "count": _count("escalation_records", "created_at"), "fill": "#27AAE1"},
        {"tab": "Product Feedback",  "count": _count("product_feedback", "created_at"), "fill": "#4ED44E"},
        {"tab": "Event RSVPs",       "count": _count("org_event_rsvps", "responded_at"), "fill": "#2A3D90"},
        {"tab": "Parking Requests",  "count": _count("parking_requests", "submitted_at"), "fill": "#f59e0b"},
    ]
    return [r for r in rows if r["count"] > 0] or rows[:1]


# ------------------------------------------------------------------ #
# Daily Usage — queries + distinct active users per local day         #
# ------------------------------------------------------------------ #
def _daily_usage(cur, start_utc, now_utc) -> list:
    cur.execute(
        f"""
        SELECT
            TO_CHAR(m.created_at + {LOCAL_SHIFT_SQL}, 'Mon DD') AS date_label,
            DATE(m.created_at + {LOCAL_SHIFT_SQL})              AS date_key,
            COUNT(*) FILTER (WHERE m.role = 'user')             AS queries,
            COUNT(DISTINCT c.user_id) FILTER (WHERE m.role = 'user') AS users
        FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.created_at >= %s AND m.created_at < %s
        GROUP BY date_key, date_label
        ORDER BY date_key ASC
        """,
        (start_utc, now_utc),
    )
    return [
        {"date": r["date_label"], "queries": int(r["queries"] or 0), "users": int(r["users"] or 0)}
        for r in cur.fetchall()
    ]


# ------------------------------------------------------------------ #
# Query Categories — keyword classification of real message content   #
# ------------------------------------------------------------------ #
def _query_categories(cur, start_utc, now_utc) -> list:
    cur.execute(
        f"""
        SELECT {_CATEGORY_CASE_SQL} AS category, COUNT(*) AS c
        FROM messages
        WHERE role = 'user' AND created_at >= %s AND created_at < %s
        GROUP BY category
        ORDER BY c DESC
        """,
        (start_utc, now_utc),
    )
    rows = cur.fetchall()
    total = sum(r["c"] for r in rows) or 1
    return [
        {
            "name": r["category"],
            "value": round(r["c"] / total * 100, 1),
            "color": _CATEGORY_COLORS.get(r["category"], "#a8bdd4"),
        }
        for r in rows
    ]


# ------------------------------------------------------------------ #
# Active Users Trend — last 8 ISO weeks                                #
# ------------------------------------------------------------------ #
def _active_users_trend(cur) -> list:
    cur.execute(
        f"""
        SELECT
            TO_CHAR(DATE_TRUNC('week', m.created_at + {LOCAL_SHIFT_SQL}), 'Mon DD') AS week_label,
            DATE_TRUNC('week', m.created_at + {LOCAL_SHIFT_SQL})                     AS week_start,
            COUNT(DISTINCT c.user_id) FILTER (WHERE m.role = 'user')                  AS active_users
        FROM messages m JOIN conversations c ON c.id = m.conversation_id
        GROUP BY week_start, week_label
        ORDER BY week_start DESC
        LIMIT 8
        """
    )
    rows = list(reversed(cur.fetchall()))

    cur.execute("SELECT COUNT(*) AS c FROM users")
    total_users = cur.fetchone()["c"]

    return [
        {"week": r["week_label"], "active": int(r["active_users"] or 0), "total": total_users}
        for r in rows
    ]


# ------------------------------------------------------------------ #
# Peak Usage Hours — hour-of-day (IST) bucket over the selected range  #
# ------------------------------------------------------------------ #
def _peak_usage_hours(cur, start_utc, now_utc) -> list:
    cur.execute(
        f"""
        SELECT EXTRACT(HOUR FROM m.created_at + {LOCAL_SHIFT_SQL})::int AS hr, COUNT(*) AS c
        FROM messages m
        WHERE m.role = 'user' AND m.created_at >= %s AND m.created_at < %s
        GROUP BY hr
        """,
        (start_utc, now_utc),
    )
    counts = {int(r["hr"]): int(r["c"]) for r in cur.fetchall()}

    def _label(h):
        suffix = "AM" if h < 12 else "PM"
        h12 = h % 12
        h12 = 12 if h12 == 0 else h12
        return f"{h12}{suffix}"

    return [{"hour": _label(h), "count": counts.get(h, 0)} for h in range(24)]


# ------------------------------------------------------------------ #
# Top Queries — grouped by normalized content, with next-reply status  #
# ------------------------------------------------------------------ #
def _top_queries(cur, start_utc, now_utc) -> list:
    cur.execute(
        f"""
        WITH ordered AS (
            SELECT
                id, conversation_id, role, content, status, created_at,
                LEAD(role)   OVER (PARTITION BY conversation_id ORDER BY created_at, ctid) AS next_role,
                LEAD(status) OVER (PARTITION BY conversation_id ORDER BY created_at, ctid) AS next_status
            FROM messages
        )
        SELECT
            LOWER(TRIM(content))                                        AS norm_query,
            (ARRAY_AGG(content ORDER BY created_at DESC))[1]             AS display_query,
            COUNT(*)                                                    AS hits,
            MAX(created_at + {LOCAL_SHIFT_SQL})                         AS last_used,
            COUNT(*) FILTER (WHERE next_role = 'assistant' AND next_status = 'done')       AS resolved,
            COUNT(*) FILTER (WHERE next_role = 'assistant')                                 AS answered
        FROM ordered
        WHERE role = 'user' AND created_at >= %s AND created_at < %s
          AND LENGTH(TRIM(content)) > 0
        GROUP BY norm_query
        ORDER BY hits DESC, last_used DESC
        LIMIT 15
        """,
        (start_utc, now_utc),
    )
    rows = cur.fetchall()
    out = []
    for i, r in enumerate(rows, start=1):
        answered = r["answered"] or 0
        resolved = r["resolved"] or 0
        success_rate = round(resolved / answered * 100) if answered else 100
        out.append({
            "id": i,
            "query": r["display_query"],
            "hits": int(r["hits"]),
            "lastUsed": r["last_used"].strftime("%Y-%m-%d") if r["last_used"] else "",
            "successRate": success_rate,
        })
    return out


# ------------------------------------------------------------------ #
# Success vs Failed — per local day, based on next-assistant-status    #
# ------------------------------------------------------------------ #
def _success_vs_failed(cur, start_utc, now_utc) -> list:
    cur.execute(
        f"""
        WITH ordered AS (
            SELECT
                id, conversation_id, role, created_at,
                LEAD(role)   OVER (PARTITION BY conversation_id ORDER BY created_at, ctid) AS next_role,
                LEAD(status) OVER (PARTITION BY conversation_id ORDER BY created_at, ctid) AS next_status
            FROM messages
        )
        SELECT
            TO_CHAR(created_at + {LOCAL_SHIFT_SQL}, 'Mon DD') AS date_label,
            DATE(created_at + {LOCAL_SHIFT_SQL})               AS date_key,
            COUNT(*) FILTER (WHERE next_role = 'assistant' AND next_status = 'done')  AS success,
            COUNT(*) FILTER (WHERE next_role = 'assistant' AND next_status = 'error') AS failed
        FROM ordered
        WHERE role = 'user' AND created_at >= %s AND created_at < %s
        GROUP BY date_key, date_label
        ORDER BY date_key ASC
        """,
        (start_utc, now_utc),
    )
    return [
        {"date": r["date_label"], "success": int(r["success"] or 0), "failed": int(r["failed"] or 0)}
        for r in cur.fetchall()
    ]


# ------------------------------------------------------------------ #
# Recent Activities — latest real user queries across the org         #
# ------------------------------------------------------------------ #
_ACTIVITIES_BASE_SQL = """
    WITH ordered AS (
        SELECT
            m.id, m.conversation_id, m.role, m.content, m.created_at,
            LEAD(m.role)   OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.ctid) AS next_role,
            LEAD(m.status) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.ctid) AS next_status
        FROM messages m
    )
    SELECT
        o.id, o.content, o.created_at, o.next_status,
        u.display_name, u.email,
        EXISTS(SELECT 1 FROM escalation_records er WHERE er.message_id = o.id) AS is_escalation
    FROM ordered o
    JOIN conversations c ON c.id = o.conversation_id
    JOIN users u ON u.id = c.user_id
    WHERE o.role = 'user'
"""

_DOC_KEYWORDS = ('letter', 'certificate', 'document', 'draft', 'noc', 'generate')


def _ago(ts, now_utc) -> str:
    secs = (now_utc - ts).total_seconds()
    if secs < 60:
        return "just now"
    if secs < 3600:
        return f"{int(secs // 60)}m ago"
    if secs < 86400:
        return f"{int(secs // 3600)}h ago"
    return f"{int(secs // 86400)}d ago"


def _map_activity_row(r, idx, now_utc) -> dict:
    content = (r["content"] or "").strip()
    lower = content.lower()
    if r["is_escalation"]:
        category, atype = "IT", "escalation"
    elif any(k in lower for k in _DOC_KEYWORDS):
        category, atype = "Doc", "document"
    elif any(k in lower for k in ("leave", "payroll", "salary", "insurance", "benefit", "wfh", "attendance")):
        category, atype = "HR", "query"
    elif any(k in lower for k in ("vpn", "password", "ticket", "laptop", "network", "mfa", "access")):
        category, atype = "IT", "query"
    elif any(k in lower for k in ("who is", "org chart", "ceo", "coo", "announcement", "event")):
        category, atype = "Org", "query"
    else:
        category, atype = "HR", "query"

    if r["next_status"] == "done":
        status = "success"
    elif r["next_status"] == "error":
        status = "failed"
    else:
        status = "pending"

    name = r["display_name"] or (r["email"] or "").split("@")[0] or "Unknown"
    action = content if len(content) <= 60 else content[:57] + "..."

    return {
        "id": idx,
        "user": name,
        "action": action,
        "time": _ago(r["created_at"], now_utc),
        "category": category,
        "type": atype,
        "status": status,
    }


def get_recent_activities(page: int = 1, limit: int = 15) -> dict:
    """Paginated recent-activity feed — every real user query across the org."""
    offset = (page - 1) * limit
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM ({_ACTIVITIES_BASE_SQL}) sub")
            total = cur.fetchone()["c"]
            cur.execute(f"{_ACTIVITIES_BASE_SQL} ORDER BY o.created_at DESC LIMIT %s OFFSET %s", (limit, offset))
            rows = cur.fetchall()

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    data = [_map_activity_row(r, offset + i, now_utc) for i, r in enumerate(rows, start=1)]
    return {"data": data, "total": total, "page": page, "limit": limit}
