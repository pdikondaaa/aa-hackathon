from datetime import datetime, timezone

from app.api.config.db_config import get_db_connection


def get_or_create_user(azure_oid: str, email: str, display_name: str) -> str:
    """Upsert a user row by Azure OID and return their DB UUID.

    Mirrors the pattern used in EscalationsService so every controller
    resolves the same stable primary key before touching user-scoped tables.
    """
    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, azure_oid, display_name, last_login_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (azure_oid) DO UPDATE
                    SET last_login_at = EXCLUDED.last_login_at,
                        updated_at    = EXCLUDED.updated_at
                RETURNING id
                """,
                (email, azure_oid, display_name, now, now),
            )
            user_id = str(cur.fetchone()["id"])
        conn.commit()
    return user_id
