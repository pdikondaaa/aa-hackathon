"""Parking service — parking sticker request management."""
from app.api.config.db_config import get_db_connection
from app.utils.logging_config import get_logger

logger = get_logger("parking_service")


def get_parking_request(email: str) -> dict | None:
    """Return the employee's latest parking sticker request."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, employee_id, employee_name, location, category,
                           parking_option,
                           owner_name, vehicle_reg_no, vehicle_make, vehicle_model,
                           sticker_required_date, vehicle_photo_url, status,
                           admin_remarks, parking_sticker_rfid_no,
                           submitted_at, updated_at,
                           deactivation_requested_at, deactivation_date, closed_at
                    FROM parking_requests
                    WHERE lower(email) = lower(%s)
                    ORDER BY submitted_at DESC
                    LIMIT 1
                """, (email,))
                row = cur.fetchone()
                if not row:
                    return None
                result = dict(row)
                for field in ('submitted_at', 'updated_at', 'deactivation_requested_at', 'closed_at'):
                    if result.get(field):
                        result[field] = result[field].isoformat()
                for field in ('sticker_required_date', 'deactivation_date'):
                    if result.get(field):
                        result[field] = str(result[field])
                return result
    except Exception as exc:
        logger.warning("DB read failed for parking_requests %s: %s", email, exc)
        return None


def submit_parking_request(email: str, data: dict) -> dict:
    """Insert a new parking sticker application into parking_requests."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO parking_requests
                        (email, employee_id, employee_name, location, category,
                         parking_option,
                         owner_name, vehicle_reg_no, vehicle_make, vehicle_model,
                         sticker_required_date, vehicle_photo_url, status,
                         submitted_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW(), NOW())
                    RETURNING id
                """, (
                    email,
                    data.get('employee_id', ''),
                    data.get('employee_name', ''),
                    data['location'],
                    data['category'],
                    data.get('parking_option'),
                    data['owner_name'],
                    data['vehicle_reg_no'],
                    data['vehicle_make'],
                    data['vehicle_model'],
                    data.get('sticker_required_date'),
                    data.get('vehicle_photo_b64'),
                ))
                row = cur.fetchone()
                conn.commit()
                logger.info("Parking request submitted for %s, id=%s", email, row['id'])
                return {'success': True, 'id': row['id']}
    except Exception as exc:
        logger.error("DB write failed for parking_requests %s: %s", email, exc)
        raise


def submit_deactivation_request(email: str, request_id: int, deactivation_date: str) -> dict:
    """Mark a parking request as deactivation_requested."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE parking_requests
                    SET status = 'deactivation_requested',
                        deactivation_requested_at = NOW(),
                        deactivation_date = %s,
                        updated_at = NOW()
                    WHERE id = %s AND lower(email) = lower(%s)
                """, (deactivation_date, request_id, email))
                conn.commit()
                logger.info("Deactivation requested for %s, request_id=%s", email, request_id)
                return {'success': True}
    except Exception as exc:
        logger.error("DB deactivation failed for %s, request_id=%s: %s", email, request_id, exc)
        raise
