from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user
from app.api.config.db_config import get_db_connection

router = APIRouter(prefix="/api/documents", tags=["Documents"])

# Keyword-based category derivation using the document name and folder path.
# Evaluated in order — first match wins.
_CATEGORY_SQL = """
CASE
  WHEN lower(source_path || ' ' || document_name) ~
       '(\\mhr\\M|human.?resource|\\bleave\\b|payroll|\\bwfh\\b|employee|benefit|insurance|posh|referral|onboard|offboard|appraisal|attendance|handbook|increment|salary.?cert|experience.?letter|offer.?letter|relieving|noc|bonafide|internship|employment|confirmation.?letter|address.?proof)'
  THEN 'hr'
  WHEN lower(source_path || ' ' || document_name) ~
       '(\\bit\\b|information.?tech|helpdesk|vpn|password|\\baccess\\b|software|hardware|network|security|laptop|device|ticket|azure|microsoft|o365|troubleshoot|antivirus|backup|printer|polycom|mfa|two.?factor)'
  THEN 'it'
  WHEN lower(source_path || ' ' || document_name) ~
       '(admin|administration|finance|invoice|expense|reimburse|accounting|tax|procurement|vendor|budget|contract|facility|legal|compliance|operations|\\bpmo\\b|project.?plan|milestone|office|\\bsop\\b)'
  THEN 'admin'
  ELSE 'general'
END
"""


class DocumentOut(BaseModel):
    id: str
    source_system: str
    document_name: str
    source_path: str
    document_type: Optional[str] = None
    source_url: Optional[str] = None
    category: str
    last_modified: Optional[datetime] = None
    indexed_at: Optional[datetime] = None
    status: Optional[str] = None


class DocumentListOut(BaseModel):
    data: list[DocumentOut]
    total: int
    page: int
    limit: int


@router.get("", response_model=DocumentListOut, summary="List ingested documents")
def list_documents(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Filter by document name"),
    category: Optional[str] = Query(None, description="hr | it | admin | general"),
    _: dict = Depends(get_current_user),
):
    """Return paginated list of all indexed documents, each tagged with a derived category."""
    offset = (page - 1) * limit
    conditions = ["status = 'indexed'"]
    params: list = []

    if search:
        conditions.append("document_name ILIKE %s")
        params.append(f"%{search}%")

    if category:
        conditions.append(f"({_CATEGORY_SQL}) = %s")
        params.append(category.lower())

    where = "WHERE " + " AND ".join(conditions)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM documents {where}", params)
            total = cur.fetchone()["count"]

            cur.execute(
                f"""
                SELECT
                    id::text,
                    source_system,
                    document_name,
                    source_path,
                    document_type,
                    tags->>'source_url' AS source_url,
                    {_CATEGORY_SQL}   AS category,
                    last_modified,
                    indexed_at,
                    status
                FROM documents
                {where}
                ORDER BY indexed_at DESC NULLS LAST
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = [dict(r) for r in cur.fetchall()]

    return {"data": rows, "total": total, "page": page, "limit": limit}
