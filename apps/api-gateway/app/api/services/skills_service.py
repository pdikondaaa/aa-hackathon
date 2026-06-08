"""
Skills Analytics service.
Queries employee_details for primary_skills and builds org-wide aggregates.
"""
from collections import Counter
from typing import Any

from app.api.config.db_config import get_db_connection
from app.utils.logging_config import get_logger

logger = get_logger("skills_service")


def _parse_skills(skill_str: str) -> list[str]:
    if not skill_str:
        return []
    return [s.strip() for s in skill_str.split(",") if s.strip()]


def get_skills_analytics() -> dict[str, Any]:
    """
    Returns org-wide skill analytics derived from employee_details.primary_skills.
    No sensitive columns (effort, billability) are exposed.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT employee_id, name, designation, function, subfunction,
                       location, primary_skills, total_experience_years, exp_group
                FROM employee_details
                ORDER BY name
                """
            )
            rows = [dict(r) for r in cur.fetchall()]

    all_skills: Counter = Counter()
    by_function: dict[str, Counter] = {}
    by_exp_group: dict[str, Counter] = {}
    by_designation: dict[str, Counter] = {}
    employees = []

    for emp in rows:
        skills = _parse_skills(emp.get("primary_skills") or "")
        func = (emp.get("function") or "Others").strip() or "Others"
        exp_grp = (emp.get("exp_group") or "Unknown").strip() or "Unknown"
        desig = (emp.get("designation") or "Unknown").strip() or "Unknown"

        all_skills.update(skills)

        by_function.setdefault(func, Counter()).update(skills)
        by_exp_group.setdefault(exp_grp, Counter()).update(skills)
        by_designation.setdefault(desig, Counter()).update(skills)

        employees.append(
            {
                "employee_id": emp.get("employee_id"),
                "name": emp.get("name") or "",
                "designation": desig,
                "function": func,
                "subfunction": (emp.get("subfunction") or "").strip(),
                "location": (emp.get("location") or "").strip(),
                "primary_skills": emp.get("primary_skills") or "",
                "skill_list": skills,
                "skill_count": len(skills),
                "total_experience_years": emp.get("total_experience_years"),
                "exp_group": exp_grp,
            }
        )

    total_employees = len(employees)
    skill_counts = [e["skill_count"] for e in employees]
    avg_skills = round(sum(skill_counts) / total_employees, 1) if total_employees else 0.0
    top_skill = all_skills.most_common(1)[0][0] if all_skills else ""

    # Top 20 skills overall
    top_skills = [{"skill": k, "count": v} for k, v in all_skills.most_common(20)]

    # Skills by function (top-5 skills per function, sorted by headcount)
    skills_by_function = [
        {
            "function": func,
            "headcount": sum(1 for e in employees if e["function"] == func),
            "top_skills": [{"skill": k, "count": v} for k, v in cntr.most_common(5)],
            "total_skill_mentions": sum(cntr.values()),
        }
        for func, cntr in sorted(
            by_function.items(),
            key=lambda x: -sum(1 for e in employees if e["function"] == x[0]),
        )
    ]

    # Skills by experience group
    exp_order = ["0-1 Years", "1-3 Years", "3-6 Years", "6-10 Years", "10+ Years"]
    skills_by_exp_group = [
        {
            "exp_group": grp,
            "top_skills": [{"skill": k, "count": v} for k, v in cntr.most_common(5)],
        }
        for grp in exp_order
        if grp in by_exp_group
        for cntr in [by_exp_group[grp]]
    ]
    # Append any groups not in the predefined order
    for grp, cntr in by_exp_group.items():
        if grp not in exp_order:
            skills_by_exp_group.append(
                {"exp_group": grp, "top_skills": [{"skill": k, "count": v} for k, v in cntr.most_common(5)]}
            )

    # Distinct filter options for the frontend
    functions = sorted({e["function"] for e in employees if e["function"] != "Others"})
    designations = sorted({e["designation"] for e in employees if e["designation"] != "Unknown"})
    exp_groups = [g for g in exp_order if g in by_exp_group]
    locations = sorted({e["location"] for e in employees if e["location"]})

    return {
        "summary": {
            "total_employees": total_employees,
            "total_unique_skills": len(all_skills),
            "avg_skills_per_employee": avg_skills,
            "most_popular_skill": top_skill,
        },
        "top_skills": top_skills,
        "skills_by_function": skills_by_function,
        "skills_by_exp_group": skills_by_exp_group,
        "employees": employees,
        "filter_options": {
            "functions": functions,
            "designations": designations,
            "exp_groups": exp_groups,
            "locations": locations,
        },
    }