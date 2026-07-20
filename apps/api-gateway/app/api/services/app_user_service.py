"""App user service — portal-managed role/admin assignment (app_users table)."""
from app.api.config.db_config import get_db_connection
from app.utils.logging_config import get_logger

logger = get_logger("app_user_service")

VALID_ROLES = {'admin', 'hr', 'it', 'org', 'user'}
DEFAULT_ROLE = 'user'


def get_role(email: str) -> str:
    """Return the stored role for email, or DEFAULT_ROLE if not present."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role FROM app_users WHERE lower(email) = lower(%s)",
                    (email,),
                )
                row = cur.fetchone()
                return row['role'] if row else DEFAULT_ROLE
    except Exception as exc:
        logger.warning("DB read failed for app_users %s: %s", email, exc)
        return DEFAULT_ROLE


def list_users() -> list[dict]:
    """Return all rows in app_users, ordered by email."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email, role, updated_by, created_at, updated_at "
                "FROM app_users ORDER BY email"
            )
            rows = cur.fetchall()
            result = []
            for row in rows:
                item = dict(row)
                for field in ('created_at', 'updated_at'):
                    if item.get(field):
                        item[field] = item[field].isoformat()
                result.append(item)
            return result


def upsert_user_role(email: str, role: str, updated_by: str) -> dict:
    """Create or update a user's role. Raises ValueError on invalid role."""
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role: {role}")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO app_users (email, role, updated_by, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (email) DO UPDATE
                    SET role = EXCLUDED.role,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = NOW()
            """, (email, role, updated_by))
            conn.commit()
            logger.info("Role for %s set to %s by %s", email, role, updated_by)
            return {'email': email, 'role': role}


def delete_user(email: str) -> bool:
    """Remove a user's app_users row, reverting them to DEFAULT_ROLE."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM app_users WHERE lower(email) = lower(%s)", (email,))
            deleted = cur.rowcount > 0
            conn.commit()
            if deleted:
                logger.info("Removed app_users row for %s", email)
            return deleted
