import uuid
from datetime import datetime, timezone
from typing import Optional

from app.api.config.db_config import get_db_connection


class ProductFeedbackService:

    # ------------------------------------------------------------------ #
    # Submit feedback  POST /api/product-feedback                         #
    # ------------------------------------------------------------------ #
    def submit_feedback(
        self,
        user_id: str,
        type_: str,
        module: Optional[str],
        title: str,
        description: str,
        rating: int,
    ) -> dict:
        now = datetime.now(timezone.utc)
        feedback_id = str(uuid.uuid4())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO product_feedback
                        (id, user_id, type, module, title, description, rating, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, user_id, type, module, title, description, rating,
                              status, admin_notes, created_at, reviewed_at
                    """,
                    (feedback_id, user_id, type_, module, title, description, rating, now),
                )
                row = dict(cur.fetchone())
            conn.commit()

        return row

    # ------------------------------------------------------------------ #
    # List my own submissions  GET /api/product-feedback                  #
    # ------------------------------------------------------------------ #
    def list_my_feedback(self, user_id: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, type, module, title, description, rating,
                           status, admin_notes, created_at, reviewed_at
                    FROM product_feedback
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    """,
                    (user_id,),
                )
                rows = [dict(r) for r in cur.fetchall()]

        return rows

    # ------------------------------------------------------------------ #
    # List all feedback (admin)  GET /api/admin/product-feedback          #
    # ------------------------------------------------------------------ #
    def list_all_feedback(
        self,
        page: int,
        limit: int,
        type_: Optional[str],
        status: Optional[str],
    ) -> dict:
        offset = (page - 1) * limit
        filters = []
        params: list = []

        if type_:
            filters.append("pf.type = %s")
            params.append(type_)
        if status:
            filters.append("pf.status = %s")
            params.append(status)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT
                        pf.id, pf.user_id, pf.type, pf.module, pf.title, pf.description,
                        pf.rating, pf.status, pf.admin_notes, pf.created_at, pf.reviewed_at,
                        u.display_name AS user_name, u.email AS user_email
                    FROM product_feedback pf
                    JOIN users u ON u.id = pf.user_id
                    {where}
                    ORDER BY pf.created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, limit, offset),
                )
                rows = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    f"SELECT COUNT(*) FROM product_feedback pf {where}",
                    params,
                )
                total = cur.fetchone()["count"]

        return {"data": rows, "total": total, "page": page, "limit": limit}

    # ------------------------------------------------------------------ #
    # Update status / admin notes (admin)  PATCH /api/admin/product-feedback/{id}
    # ------------------------------------------------------------------ #
    def update_feedback(
        self,
        feedback_id: str,
        status: Optional[str],
        admin_notes: Optional[str],
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE product_feedback
                    SET
                        status      = COALESCE(%s, status),
                        admin_notes = COALESCE(%s, admin_notes),
                        reviewed_at = %s
                    WHERE id = %s
                    RETURNING id, user_id, type, module, title, description, rating,
                              status, admin_notes, created_at, reviewed_at
                    """,
                    (status, admin_notes, now, feedback_id),
                )
                row = cur.fetchone()
            conn.commit()

        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Delete feedback (admin)  DELETE /api/admin/product-feedback/{id}     #
    # ------------------------------------------------------------------ #
    def delete_feedback(self, feedback_id: str) -> bool:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM product_feedback WHERE id = %s RETURNING id",
                    (feedback_id,),
                )
                deleted = cur.fetchone() is not None
            conn.commit()
        return deleted
