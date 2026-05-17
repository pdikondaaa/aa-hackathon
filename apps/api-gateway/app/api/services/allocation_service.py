"""
Allocation Board service.
All data access for the three Zoho tables and the designation-based role map.

Role lookup chain (per request, resolved ONCE):
  email → employee_details.designation → allocation_role_map.role
"""
from app.api.config.db_config import get_db_connection
from app.utils.logging_config import get_logger

logger = get_logger("allocation_service")

ANALYTICS_ROLES = {"executive", "business_lead", "functional_lead"}


# ── User profile (designation + role) ────────────────────────────────────────

def get_user_profile(email: str) -> dict:
    """
    Single DB round-trip: look up the user's designation from employee_details,
    then resolve it to an allocation role via allocation_role_map.

    Returns: { "designation": str | None, "role": str }
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, designation FROM employee_details "
                "WHERE lower(email) = lower(%s) LIMIT 1",
                (email,),
            )
            emp = cur.fetchone()
            if not emp or not emp["designation"]:
                return {"designation": None, "role": "employee", "name": None}

            designation = emp["designation"]
            cur.execute(
                "SELECT role FROM allocation_role_map "
                "WHERE lower(designation) = lower(%s)",
                (designation,),
            )
            row = cur.fetchone()

    return {
        "designation": designation,
        "role": row["role"] if row else "employee",
        "name": emp["name"] if emp else None,
    }


def get_allocation_role(email: str) -> str:
    """Convenience wrapper — returns only the role string."""
    return get_user_profile(email)["role"]


# ── Column-level access check ─────────────────────────────────────────────────

def _can_see_sensitive(email: str, row: dict, role: str) -> bool:
    """
    Returns True if `email` may view Effort %, Billability %, Completion Status
    for the given allocation row.

    `role` must be pre-resolved by the caller (avoids per-row DB queries).

    Rules (evaluated in priority order):
      1. executive / functional_lead / business_lead  → always yes
      2. Delivery Manager of that row                 → yes
      3. Functional Manager of that row               → yes
      4. Project is "No Allocation"                   → only executives / functional manager
      5. Project Lead is Amar Nirmal & email matches  → yes
      6. Otherwise                                    → no
    """
    if role in ANALYTICS_ROLES:
        return True

    email_lower = email.lower()
    name_part   = email_lower.split("@")[0].replace(".", " ")

    def _matches(field: str) -> bool:
        val = (row.get(field) or "").strip().lower()
        return bool(val) and (name_part in val or val in email_lower)

    if _matches("delivery_manager"):
        return True
    if _matches("functional_manager"):
        return True

    if str(row.get("project_name", "")).strip().lower() == "no allocation":
        return False

    pl = (row.get("project_lead") or "").lower()
    if "amar" in pl and "nirmal" in pl and _matches("project_lead"):
        return True

    return False


def _mask(row: dict, email: str, role: str) -> dict:
    """Return a copy of `row` with sensitive fields nulled out when access is denied."""
    r = dict(row)
    if not _can_see_sensitive(email, r, role):
        r["efforts_pct"]       = None
        r["billability_pct"]   = None
        r["completion_status"] = None
    return r


# ── Public data functions ─────────────────────────────────────────────────────

def get_my_allocation(email: str) -> list[dict]:
    """Employee: own allocation rows — no sensitive columns exposed."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ad.project_name, ad.sub_project, ad.project_lead,
                       ad.delivery_manager, ad.functional_manager,
                       ad.function, ad.subfunction, ad.project_status,
                       ad.billing, ad.project_type, ad.allocation_date, ad.sow_name,
                       ad.status_active_inactive
                FROM allocation_details ad
                JOIN employee_details ed ON ad.employee_id = ed.employee_id
                WHERE lower(ed.email) = lower(%s)
                ORDER BY ad.allocation_date DESC NULLS LAST
                """,
                (email,),
            )
            return [dict(r) for r in cur.fetchall()]


def get_team_view(email: str) -> dict:
    """Team lead: direct reportees with their project names."""
    name_fragment = email.split("@")[0].replace(".", " ")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ed.employee_id, ed.name, ed.designation, ed.email,
                       ed.function, ed.subfunction, ed.primary_skills,
                       ed.total_experience_years, ed.location,
                       ad.project_name, ad.sub_project, ad.project_status,
                       ad.billing, ad.allocation_date
                FROM employee_details ed
                LEFT JOIN allocation_details ad ON ed.employee_id = ad.employee_id
                WHERE lower(ed.reporting_manager) LIKE lower(%s)
                ORDER BY ed.name
                """,
                (f"%{name_fragment}%",),
            )
            return [dict(r) for r in cur.fetchall()]


def get_full_allocation(email: str, role: str) -> list[dict]:
    """
    functional_lead / business_lead / executive: full allocation table.
    `role` is pre-resolved by the caller so masking avoids per-row DB calls.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ad.employee_id, ad.name, ad.project_name, ad.sub_project,
                       ad.project_lead, ad.delivery_manager, ad.functional_manager,
                       ad.function, ad.subfunction, ad.completion_status,
                       ad.efforts_pct, ad.billability_pct, ad.project_status,
                       ad.billing, ad.project_type, ad.allocation_date,
                       ad.status_active_inactive, ad.client_master, ad.sow_name,
                       ed.designation, ed.location, ed.employee_type,
                       ed.primary_skills, ed.total_experience_years,
                       ed.email AS employee_email, ed.reporting_manager,
                       ed.exp_group
                FROM allocation_details ad
                LEFT JOIN employee_details ed ON ad.employee_id = ed.employee_id
                ORDER BY ad.function NULLS LAST, ad.name NULLS LAST
                """
            )
            rows = cur.fetchall()
    return [_mask(row, email, role) for row in rows]


def get_analytics(email: str, role: str) -> dict:
    """
    Aggregated dashboard data — analytics roles only.
    `role` is pre-resolved by the caller.
    """
    if role not in ANALYTICS_ROLES:
        return {}

    with get_db_connection() as conn:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT billing,
                       COUNT(DISTINCT project_name)  AS project_count,
                       COUNT(DISTINCT employee_id)   AS resource_count
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                  AND billing IS NOT NULL AND billing != ''
                GROUP BY billing
                ORDER BY resource_count DESC
                """
            )
            billing_breakdown = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT ed.name, ed.designation, ed.location,
                       ed.total_experience_years, ed.primary_skills, ed.employee_id
                FROM employee_details ed
                JOIN allocation_details ad ON ed.employee_id = ad.employee_id
                WHERE ad.project_name = 'No Allocation'
                  AND ed.status_active_inactive = 'Active'
                ORDER BY ed.name
                """
            )
            available_pool = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT project_status,
                       COUNT(DISTINCT employee_id) AS resource_count
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                  AND project_status IS NOT NULL AND project_status != ''
                GROUP BY project_status
                ORDER BY resource_count DESC
                """
            )
            status_distribution = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT function, COUNT(DISTINCT employee_id) AS headcount
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                  AND function IS NOT NULL AND function != ''
                GROUP BY function
                ORDER BY headcount DESC
                """
            )
            function_headcount = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT
                    CASE
                        WHEN billability_pct IS NULL THEN 'Unknown'
                        WHEN billability_pct = 0    THEN '0%'
                        WHEN billability_pct < 50   THEN '1-49%'
                        WHEN billability_pct < 100  THEN '50-99%'
                        ELSE '100%'
                    END AS bucket,
                    COUNT(DISTINCT employee_id) AS count
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                GROUP BY bucket
                ORDER BY count DESC
                """
            )
            billability_buckets = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT ed.location, COUNT(DISTINCT ed.employee_id) AS count
                FROM employee_details ed
                WHERE ed.status_active_inactive = 'Active'
                  AND ed.location IS NOT NULL AND ed.location != ''
                GROUP BY ed.location
                ORDER BY count DESC
                """
            )
            headcount_by_location = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT ed.exp_group, COUNT(DISTINCT ed.employee_id) AS count
                FROM employee_details ed
                WHERE ed.status_active_inactive = 'Active'
                  AND ed.exp_group IS NOT NULL AND ed.exp_group != ''
                GROUP BY ed.exp_group
                ORDER BY count DESC
                """
            )
            experience_distribution = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT ad.project_name, COUNT(DISTINCT ad.employee_id) AS resource_count
                FROM allocation_details ad
                WHERE ad.status_active_inactive = 'Active'
                  AND ad.project_name IS NOT NULL AND ad.project_name != ''
                  AND lower(ad.project_name) != 'no allocation'
                GROUP BY ad.project_name
                ORDER BY resource_count DESC
                LIMIT 12
                """
            )
            top_projects = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT
                    CASE
                        WHEN efforts_pct IS NULL OR efforts_pct = 0 THEN '0%'
                        WHEN efforts_pct < 50   THEN '1-49%'
                        WHEN efforts_pct < 100  THEN '50-99%'
                        WHEN efforts_pct = 100  THEN '100%'
                        ELSE '>100%'
                    END AS bucket,
                    COUNT(DISTINCT employee_id) AS count
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                GROUP BY bucket
                ORDER BY count DESC
                """
            )
            effort_buckets = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT function,
                       COUNT(DISTINCT employee_id) AS total,
                       COUNT(DISTINCT CASE WHEN billing = 'Billable' THEN employee_id END) AS billable,
                       COUNT(DISTINCT CASE WHEN lower(project_name) = 'no allocation' THEN employee_id END) AS bench
                FROM allocation_details
                WHERE status_active_inactive = 'Active'
                  AND function IS NOT NULL AND function != ''
                GROUP BY function
                ORDER BY total DESC
                """
            )
            function_billability = [dict(r) for r in cur.fetchall()]

    return {
        "billing_breakdown":      billing_breakdown,
        "available_pool":         available_pool,
        "status_distribution":    status_distribution,
        "function_headcount":     function_headcount,
        "billability_buckets":    billability_buckets,
        "headcount_by_location":  headcount_by_location,
        "experience_distribution": experience_distribution,
        "top_projects":           top_projects,
        "effort_buckets":         effort_buckets,
        "function_billability":   function_billability,
    }


def get_employee_detail(employee_id: str, requester_email: str) -> dict | None:
    """Single employee detail; sensitive fields masked based on requester's role."""
    role = get_allocation_role(requester_email)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ed.employee_id, ed.name, ed.email, ed.designation,
                       ed.function, ed.subfunction, ed.location, ed.employee_type,
                       ed.primary_skills, ed.total_experience_years,
                       ed.joining_date, ed.reporting_manager,
                       ed.functional_manager, ed.gender, ed.exp_group,
                       ad.project_name, ad.sub_project, ad.project_lead,
                       ad.delivery_manager,
                       ad.functional_manager AS alloc_functional_manager,
                       ad.completion_status, ad.efforts_pct, ad.billability_pct,
                       ad.project_status, ad.billing, ad.allocation_date, ad.sow_name
                FROM employee_details ed
                LEFT JOIN allocation_details ad ON ed.employee_id = ad.employee_id
                WHERE ed.employee_id = %s
                LIMIT 1
                """,
                (employee_id,),
            )
            row = cur.fetchone()

    if not row:
        return None
    r = dict(row)
    r["functional_manager"] = r.get("alloc_functional_manager") or r.get("functional_manager")
    return _mask(r, requester_email, role)


def build_ask_context(email: str) -> tuple[str, str]:
    """
    Build a role-scoped plain-text context block for the Ask Aura LLM call.
    Returns (context_text, role).
    """
    profile = get_user_profile(email)
    role        = profile["role"]
    user_name   = profile.get("name") or email.split("@")[0].replace(".", " ")

    def _name_match(field: str) -> bool:
        if not field or not user_name:
            return False
        return user_name.lower() in field.lower() or field.lower() in user_name.lower()

    lines = [
        f"User: {user_name}",
        f"Role: {role}",
        f"Designation: {profile.get('designation') or 'Unknown'}",
        "",
    ]

    if role == "employee":
        rows = get_my_allocation(email)
        lines.append(f"My Allocations ({len(rows)} records):")
        for r in rows:
            lines.append(
                f"  - Project: {r.get('project_name','—')} | Status: {r.get('project_status','—')} "
                f"| Billing: {r.get('billing','—')} | Function: {r.get('function','—')}"
            )

    elif role == "team_lead":
        rows = get_team_view(email)
        lines.append(f"Direct Team ({len(rows)} members):")
        for r in rows:
            lines.append(
                f"  - {r.get('name','—')} | {r.get('designation','—')} | "
                f"Project: {r.get('project_name','—')} | Billing: {r.get('billing','—')}"
            )

    elif role in ANALYTICS_ROLES:
        all_rows = get_full_allocation(email, role)

        if role == "executive":
            lines.append(f"Full Allocation Data ({len(all_rows)} records):")
            lines.append("")
            for r in all_rows:
                effort   = r.get("efforts_pct")
                bill_pct = r.get("billability_pct")
                lines.append(
                    f"  Name: {r.get('name','—')} | Designation: {r.get('designation','—')} "
                    f"| Function: {r.get('function','—')} | Project: {r.get('project_name','—')} "
                    f"| Sub-Project: {r.get('sub_project','—')} | Status: {r.get('project_status','—')} "
                    f"| Billing: {r.get('billing','—')} | Effort%: {effort if effort is not None else '—'} "
                    f"| Billability%: {bill_pct if bill_pct is not None else '—'} "
                    f"| Completion: {r.get('completion_status','—')} "
                    f"| Delivery Mgr: {r.get('delivery_manager','—')} "
                    f"| Functional Mgr: {r.get('functional_manager','—')} "
                    f"| Project Lead: {r.get('project_lead','—')} "
                    f"| Location: {r.get('location','—')} "
                    f"| Experience: {r.get('total_experience_years','—')} yrs"
                )

        else:
            my_team = [r for r in all_rows if _name_match(r.get("functional_manager", ""))]
            reportees = [r for r in all_rows if _name_match(r.get("reporting_manager", ""))]
            available = [r for r in my_team if (r.get("efforts_pct") or 0) < 100]
            billable  = [r for r in my_team if (r.get("billing") or "").lower() == "billable"]

            lines.append(f"Functional Team ({len(my_team)} members):")
            for r in my_team:
                effort = r.get("efforts_pct")
                bill   = r.get("billability_pct")
                lines.append(
                    f"  - {r.get('name','—')} | {r.get('designation','—')} | "
                    f"Project: {r.get('project_name','—')} | Billing: {r.get('billing','—')} "
                    f"| Effort: {effort}% | Billability: {bill}%"
                )

            lines.append(f"\nDirect Reportees ({len(reportees)}):")
            for r in reportees:
                lines.append(f"  - {r.get('name','—')} | Project: {r.get('project_name','—')} | Billing: {r.get('billing','—')}")

            lines.append(f"\nAvailable Resources ({len(available)}):")
            for r in available:
                effort = r.get("efforts_pct")
                avail  = 100 - (effort or 0)
                lines.append(f"  - {r.get('name','—')} | Available: {avail}% | Project: {r.get('project_name','—')}")

            lines.append(f"\nBillable Resources ({len(billable)}):")
            for r in billable:
                lines.append(
                    f"  - {r.get('name','—')} | Project: {r.get('project_name','—')} "
                    f"| Billability: {r.get('billability_pct')}%"
                )

            if role == "business_lead":
                my_projects: dict = {}
                for r in all_rows:
                    if _name_match(r.get("project_lead", "")) or _name_match(r.get("delivery_manager", "")):
                        pname = r.get("project_name") or "Unknown"
                        my_projects.setdefault(pname, []).append(r.get("name", "—"))
                lines.append(f"\nMy Projects ({len(my_projects)}):")
                for pname, members in my_projects.items():
                    lines.append(f"  - {pname}: {', '.join(members[:10])}" + ("..." if len(members) > 10 else ""))

    return "\n".join(lines), role


def get_board_data(email: str) -> dict:
    """
    Top-level entry point: resolve user profile once, return role-appropriate payload.

    All response shapes include `designation` and `role` so the UI can display them.
    """
    profile = get_user_profile(email)
    role        = profile["role"]
    designation = profile["designation"]

    base = {"role": role, "designation": designation, "user_name": profile.get("name")}

    if role in ANALYTICS_ROLES:
        return {
            **base,
            "view":            "analytics",
            "allocation_rows": get_full_allocation(email, role),
            "analytics":       get_analytics(email, role),
        }

    if role == "team_lead":
        return {
            **base,
            "view":      "team",
            "team_rows": get_team_view(email),
        }

    return {
        **base,
        "view":          "self",
        "my_allocation": get_my_allocation(email),
    }
