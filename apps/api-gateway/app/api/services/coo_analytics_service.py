"""
COO Analytics service — Billable Projects scope only.
All queries are scoped to billing = 'Billable' AND status_active_inactive = 'Active'.
Only accessible to analytics roles (executive, business_lead, functional_lead).
"""
from app.api.config.db_config import get_db_connection
from app.api.services.allocation_service import get_user_profile, ANALYTICS_ROLES
from app.utils.logging_config import get_logger

logger = get_logger("coo_analytics_service")


def _build_filter_where(filters: dict) -> tuple[str, list]:
    clauses, params = [], []
    mapping = [
        ("function",         "ad.function = %s"),
        ("subfunction",      "ad.subfunction = %s"),
        ("client",           "ad.client_master = %s"),
        ("project_status",   "ad.project_status = %s"),
        ("delivery_manager", "ad.delivery_manager = %s"),
    ]
    for key, clause in mapping:
        if filters.get(key):
            clauses.append(clause)
            params.append(filters[key])
    if filters.get("date_from"):
        clauses.append("ad.allocation_date >= %s")
        params.append(filters["date_from"])
    if filters.get("date_to"):
        clauses.append("ad.allocation_date <= %s")
        params.append(filters["date_to"])
    return (" AND ".join(clauses), params) if clauses else ("", [])


def _f(val) -> float:
    try:
        return float(val) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def get_coo_dashboard(email: str, filters: dict | None = None) -> dict:
    profile = get_user_profile(email)
    if profile["role"] not in ANALYTICS_ROLES:
        raise PermissionError("COO Analytics requires executive or business lead access.")

    filters = filters or {}
    extra_where, extra_params = _build_filter_where(filters)
    # Base scope: active + billable projects only
    base = "ad.status_active_inactive = 'Active' AND ad.billing = 'Billable'"
    where = f"{base} AND {extra_where}" if extra_where else base

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            return _run_all_queries(cur, where, extra_params)


def _run_all_queries(cur, where: str, params: list) -> dict:

    # ── Per-employee effort aggregation (foundation for KPIs + distribution) ──
    cur.execute(f"""
        SELECT
            ad.employee_id,
            COALESCE(SUM(ad.efforts_pct), 0)      AS total_efforts,
            ROUND(AVG(ad.billability_pct)::numeric, 1) AS avg_bill
        FROM allocation_details ad
        WHERE {where}
        GROUP BY ad.employee_id
    """, params)
    per_emp = cur.fetchall()

    total           = len(per_emp) or 1
    fully_allocated = sum(1 for r in per_emp if _f(r["total_efforts"]) == 100)
    underallocated  = sum(1 for r in per_emp if 0 < _f(r["total_efforts"]) < 100)
    overallocated   = sum(1 for r in per_emp if _f(r["total_efforts"]) > 100)
    zero_alloc      = sum(1 for r in per_emp if _f(r["total_efforts"]) == 0)

    # ── KPIs ──────────────────────────────────────────────────────────────────
    cur.execute(f"""
        SELECT
            ROUND(AVG(ad.efforts_pct)::numeric, 1)                                     AS avg_efforts_pct,
            ROUND(AVG(ad.billability_pct)::numeric, 1)                                 AS avg_billability_pct,
            COUNT(DISTINCT CASE WHEN ad.client_master IS NOT NULL AND ad.client_master != '' THEN ad.client_master END) AS active_clients,
            COUNT(DISTINCT ad.project_name)                                            AS active_projects
        FROM allocation_details ad
        WHERE {where}
    """, params)
    kpi_row = dict(cur.fetchone())

    avg_eff  = _f(kpi_row.get("avg_efforts_pct"))
    avg_bill = _f(kpi_row.get("avg_billability_pct"))

    kpi = {
        "total_billable_employees":  total,
        "fully_allocated_employees": fully_allocated,
        "overallocated_employees":   overallocated,
        "underallocated_employees":  underallocated,
        "zero_effort_employees":     zero_alloc,
        "active_clients":            int(kpi_row.get("active_clients") or 0),
        "active_projects":           int(kpi_row.get("active_projects") or 0),
        "avg_efforts_pct":           avg_eff,
        "avg_billability_pct":       avg_bill,
        "operational_efficiency_score": round((avg_eff + avg_bill) / 2, 1),
    }

    # ── Allocation Distribution ────────────────────────────────────────────────
    allocation_distribution = [
        {"name": "Fully Allocated",    "value": fully_allocated, "color": "#4ED44E"},
        {"name": "Underallocated",     "value": underallocated,  "color": "#f59e0b"},
        {"name": "Overallocated",      "value": overallocated,   "color": "#f05252"},
        {"name": "Zero / No Effort",   "value": zero_alloc,      "color": "#5e7a9a"},
    ]

    # ── Allocation Trend ───────────────────────────────────────────────────────
    cur.execute(f"""
        SELECT
            TO_CHAR(DATE_TRUNC('month', ad.allocation_date), 'Mon YYYY') AS month_label,
            DATE_TRUNC('month', ad.allocation_date)                       AS month_date,
            ROUND(AVG(ad.efforts_pct)::numeric, 1)                       AS avg_efforts,
            ROUND(AVG(ad.billability_pct)::numeric, 1)                   AS avg_billability
        FROM allocation_details ad
        WHERE {where} AND ad.allocation_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', ad.allocation_date),
                 TO_CHAR(DATE_TRUNC('month', ad.allocation_date), 'Mon YYYY')
        ORDER BY month_date DESC
        LIMIT 12
    """, params)
    trend_rows = [dict(r) for r in cur.fetchall()]
    trend_rows.reverse()
    allocation_trend = [
        {"month": r["month_label"], "efforts": _f(r["avg_efforts"]), "billability": _f(r["avg_billability"])}
        for r in trend_rows
    ]

    # ── Client Contribution ────────────────────────────────────────────────────
    cur.execute(f"""
        SELECT
            ad.client_master,
            ROUND(AVG(ad.billability_pct)::numeric, 1) AS avg_billability,
            COUNT(DISTINCT ad.employee_id)              AS headcount,
            COUNT(DISTINCT ad.project_name)             AS project_count
        FROM allocation_details ad
        WHERE {where}
            AND ad.client_master IS NOT NULL AND ad.client_master != ''
        GROUP BY ad.client_master
        ORDER BY headcount DESC, avg_billability DESC NULLS LAST
        LIMIT 12
    """, params)
    client_contribution = [
        {**dict(r), "avg_billability": _f(r["avg_billability"]), "headcount": int(r["headcount"] or 0)}
        for r in cur.fetchall()
    ]

    # ── Top Billable Projects by Headcount ────────────────────────────────────
    cur.execute(f"""
        SELECT
            ad.project_name,
            ad.client_master,
            COUNT(DISTINCT ad.employee_id)              AS headcount,
            ROUND(AVG(ad.efforts_pct)::numeric, 1)      AS avg_efforts,
            ROUND(AVG(ad.billability_pct)::numeric, 1)  AS avg_billability
        FROM allocation_details ad
        WHERE {where}
            AND ad.project_name IS NOT NULL AND ad.project_name != ''
        GROUP BY ad.project_name, ad.client_master
        ORDER BY headcount DESC
        LIMIT 12
    """, params)
    top_projects = [
        {**dict(r), "headcount": int(r["headcount"] or 0),
         "avg_efforts": _f(r["avg_efforts"]), "avg_billability": _f(r["avg_billability"])}
        for r in cur.fetchall()
    ]

    # ── Function Efficiency Heatmap ────────────────────────────────────────────
    cur.execute(f"""
        SELECT
            ad.function,
            ad.subfunction,
            COUNT(DISTINCT ad.employee_id)              AS headcount,
            ROUND(AVG(ad.efforts_pct)::numeric, 1)      AS avg_efforts,
            ROUND(AVG(ad.billability_pct)::numeric, 1)  AS avg_billability
        FROM allocation_details ad
        WHERE {where}
            AND ad.function IS NOT NULL AND ad.function != ''
        GROUP BY ad.function, ad.subfunction
        ORDER BY ad.function, avg_billability DESC NULLS LAST
    """, params)
    function_efficiency = [
        {
            **dict(r),
            "avg_efforts":    _f(r["avg_efforts"]),
            "avg_billability": _f(r["avg_billability"]),
            "headcount":      int(r["headcount"] or 0),
        }
        for r in cur.fetchall()
    ]

    # ── Delivery Load Distribution (Scatter) ───────────────────────────────────
    cur.execute(f"""
        SELECT
            ad.function,
            ROUND(AVG(ad.efforts_pct)::numeric, 1)     AS avg_efforts,
            ROUND(AVG(ad.billability_pct)::numeric, 1)  AS avg_billability,
            COUNT(DISTINCT ad.employee_id)              AS headcount
        FROM allocation_details ad
        WHERE {where}
            AND ad.function IS NOT NULL AND ad.function != ''
        GROUP BY ad.function
        ORDER BY headcount DESC
    """, params)
    delivery_load = [
        {
            **dict(r),
            "avg_efforts":    _f(r["avg_efforts"]),
            "avg_billability": _f(r["avg_billability"]),
            "headcount":      int(r["headcount"] or 0),
        }
        for r in cur.fetchall()
    ]

    # ── Client Concentration Risk ──────────────────────────────────────────────
    # total is already the full billable headcount from per_emp aggregation
    cur.execute(f"""
        SELECT
            ad.client_master,
            COUNT(DISTINCT ad.employee_id) AS headcount
        FROM allocation_details ad
        WHERE {where}
            AND ad.client_master IS NOT NULL AND ad.client_master != ''
        GROUP BY ad.client_master
        ORDER BY headcount DESC
        LIMIT 10
    """, params)
    client_concentration = [
        {
            "client":      r["client_master"],
            "headcount":   int(r["headcount"] or 0),
            "share_pct":   round((r["headcount"] or 0) / total * 100, 1),
        }
        for r in cur.fetchall()
    ]

    insights = _generate_insights(kpi, client_concentration, delivery_load)

    return {
        "kpis":                    kpi,
        "allocation_distribution": allocation_distribution,
        "allocation_trend":        allocation_trend,
        "client_contribution":     client_contribution,
        "top_projects":            top_projects,
        "function_efficiency":     function_efficiency,
        "delivery_load":           delivery_load,
        "client_concentration":    client_concentration,
        "insights":                insights,
    }


def _generate_insights(kpi: dict, client_conc: list, delivery_load: list) -> list[dict]:
    out = []
    total    = kpi.get("total_billable_employees") or 1
    avg_eff  = kpi.get("avg_efforts_pct") or 0
    avg_bill = kpi.get("avg_billability_pct") or 0

    # Utilization
    if avg_eff >= 90:
        out.append({"type": "warning", "icon": "fa-fire",
                    "text": f"Billable workforce nearing full capacity — average effort at {avg_eff}%. Limited bandwidth for new engagements."})
    elif avg_eff < 60:
        out.append({"type": "risk", "icon": "fa-triangle-exclamation",
                    "text": f"Low utilization on billable projects — average effort at {avg_eff}%. Review project staffing levels."})
    else:
        out.append({"type": "success", "icon": "fa-circle-check",
                    "text": f"Billable workforce utilization is healthy at {avg_eff}% average effort allocation."})

    # Overallocated
    over = kpi.get("overallocated_employees") or 0
    if over > 0:
        over_pct = round(over / total * 100, 1)
        out.append({"type": "warning", "icon": "fa-person-running",
                    "text": f"{over} billable employees ({over_pct}%) are overallocated — delivery quality risk and burnout potential."})

    # Underallocated
    under = kpi.get("underallocated_employees") or 0
    under_pct = round(under / total * 100, 1)
    if under_pct > 30:
        out.append({"type": "warning", "icon": "fa-clock",
                    "text": f"{under} billable employees ({under_pct}%) are underallocated — unused billable capacity worth optimizing."})

    # Billability rate
    if avg_bill >= 80:
        out.append({"type": "success", "icon": "fa-chart-line",
                    "text": f"Strong billability rate at {avg_bill}% — billable team is delivering efficiently against client commitments."})
    elif avg_bill < 55:
        out.append({"type": "risk", "icon": "fa-chart-line",
                    "text": f"Billability rate on billable projects is low at {avg_bill}% — check if effort is being tracked correctly."})

    # Client concentration
    if client_conc:
        top3_share = sum(r["share_pct"] for r in client_conc[:3])
        top3 = ", ".join(r["client"] for r in client_conc[:3])
        if top3_share > 60:
            out.append({"type": "risk", "icon": "fa-building",
                        "text": f"Top 3 clients ({top3}) represent {top3_share:.1f}% of billable headcount — high customer concentration risk."})
        else:
            out.append({"type": "success", "icon": "fa-building",
                        "text": f"Billable portfolio is diversified — top 3 clients represent {top3_share:.1f}% of headcount."})

    # Function-level hotspots
    for fn in delivery_load:
        if (fn.get("avg_efforts") or 0) >= 90 and (fn.get("headcount") or 0) >= 3:
            out.append({"type": "warning", "icon": "fa-sitemap",
                        "text": f"{fn['function']} is at {fn['avg_efforts']}% avg effort on billable projects ({fn['headcount']} resources) — near capacity."})
            break

    low_fns = [f for f in delivery_load if (f.get("avg_efforts") or 0) < 50 and (f.get("headcount") or 0) >= 3]
    if low_fns:
        fn = low_fns[0]
        out.append({"type": "info", "icon": "fa-gauge-high",
                    "text": f"{fn['function']} billable team has {100 - fn['avg_efforts']:.0f}% average availability — capacity for additional client work."})

    # Efficiency score
    eff = kpi.get("operational_efficiency_score") or 0
    if eff >= 80:
        out.append({"type": "success", "icon": "fa-star",
                    "text": f"Operational efficiency score is {eff}% — billable team is performing above expectations."})
    elif eff < 55:
        out.append({"type": "risk", "icon": "fa-star-half",
                    "text": f"Operational efficiency score is {eff}% — review effort tracking and billability on active accounts."})

    return out[:8]


def get_filter_options(email: str) -> dict:
    """Returns filter dropdown options scoped to active billable records."""
    profile = get_user_profile(email)
    if profile["role"] not in ANALYTICS_ROLES:
        raise PermissionError("Access denied.")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            def _distinct(col):
                cur.execute(f"""
                    SELECT DISTINCT {col} FROM allocation_details
                    WHERE status_active_inactive = 'Active'
                      AND billing = 'Billable'
                      AND {col} IS NOT NULL AND {col} != ''
                    ORDER BY {col}
                """)
                return [r[col] for r in cur.fetchall()]

            return {
                "functions":         _distinct("function"),
                "subfunctions":      _distinct("subfunction"),
                "clients":           _distinct("client_master"),
                "project_statuses":  _distinct("project_status"),
                "delivery_managers": _distinct("delivery_manager"),
            }
