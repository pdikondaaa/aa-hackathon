"""
Communications schema initialisation — org_announcements, org_events, and supporting tables.

Run ONCE before using the Communications module, or whenever you need to
re-create the tables on a fresh database.

Usage:
    cd apps/jobs/sharepoint_ingestion
    python create_communications_schema.py
"""
import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import psycopg2
from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger("create_communications_schema")

_SCHEMA_SQL = """
-- =========================================================
-- AURA COMMUNICATIONS MODULE
-- Announcements · Events · Dismissals · RSVPs
-- =========================================================

-- =========================================================
-- TABLE: org_announcements
-- Org-wide announcements managed from the Admin panel.
-- =========================================================
CREATE TABLE IF NOT EXISTS org_announcements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    message          TEXT         NOT NULL,
    rich_content     TEXT,
    banner_image_url TEXT,

    -- priority: critical > high > medium > low
    priority         VARCHAR(20)  NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('critical', 'high', 'medium', 'low')),

    -- display_mode determines how the announcement surfaces in the UI
    display_mode     VARCHAR(30)  NOT NULL DEFAULT 'banner'
                     CHECK (display_mode IN ('banner', 'overlay', 'carousel', 'inline')),

    -- lifecycle status
    status           VARCHAR(20)  NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),

    -- optional audience targeting (NULL = everyone)
    audience_roles   TEXT[],

    -- optional call-to-action
    cta_label        VARCHAR(100),
    cta_url          TEXT,
    cta_type         VARCHAR(20)  DEFAULT 'link'
                     CHECK (cta_type IN ('link', 'acknowledge', 'dismiss')),

    -- UX controls
    auto_hide_seconds INTEGER,
    allow_dismiss    BOOLEAN      NOT NULL DEFAULT TRUE,

    -- scheduling window (NULL = no restriction)
    scheduled_start  TIMESTAMPTZ,
    scheduled_end    TIMESTAMPTZ,
    published_at     TIMESTAMPTZ,

    created_by_email VARCHAR(255),
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ann_status   ON org_announcements(status);
CREATE INDEX IF NOT EXISTS idx_ann_priority ON org_announcements(priority);
CREATE INDEX IF NOT EXISTS idx_ann_created  ON org_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ann_schedule ON org_announcements(scheduled_start, scheduled_end);


-- =========================================================
-- TABLE: org_announcement_dismissals
-- Tracks per-user "Do not show again" dismissals.
-- =========================================================
CREATE TABLE IF NOT EXISTS org_announcement_dismissals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID         NOT NULL REFERENCES org_announcements(id) ON DELETE CASCADE,
    user_email      VARCHAR(255) NOT NULL,
    dismissed_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_dismissals_user         ON org_announcement_dismissals(user_email);
CREATE INDEX IF NOT EXISTS idx_dismissals_announcement ON org_announcement_dismissals(announcement_id);


-- =========================================================
-- TABLE: org_events
-- Company events with RSVP support.
-- =========================================================
CREATE TABLE IF NOT EXISTS org_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    cover_image_url  TEXT,
    event_type       VARCHAR(50)  NOT NULL DEFAULT 'general',

    -- event lifecycle (admin-controlled)
    status           VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),

    -- publish lifecycle
    publish_status   VARCHAR(20)  NOT NULL DEFAULT 'draft'
                     CHECK (publish_status IN ('draft', 'published', 'archived')),

    starts_at        TIMESTAMPTZ  NOT NULL,
    ends_at          TIMESTAMPTZ,
    timezone         VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',

    -- venue
    location         VARCHAR(255),
    virtual_link     TEXT,
    is_virtual       BOOLEAN      NOT NULL DEFAULT FALSE,

    -- RSVP settings
    rsvp_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    rsvp_deadline    TIMESTAMPTZ,
    max_attendees    INTEGER,

    -- notification reminders in minutes before start (e.g. [60, 1440])
    reminder_minutes INTEGER[],

    -- optional audience targeting (NULL = everyone)
    audience_roles   TEXT[],

    created_by_email VARCHAR(255),
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_status         ON org_events(status);
CREATE INDEX IF NOT EXISTS idx_events_publish_status ON org_events(publish_status);
CREATE INDEX IF NOT EXISTS idx_events_starts_at      ON org_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_created        ON org_events(created_at DESC);


-- =========================================================
-- TABLE: org_event_rsvps
-- Per-user RSVP responses for events.
-- =========================================================
CREATE TABLE IF NOT EXISTS org_event_rsvps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID         NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
    user_email   VARCHAR(255) NOT NULL,
    user_name    VARCHAR(255),
    rsvp_status  VARCHAR(20)  NOT NULL DEFAULT 'attending'
                 CHECK (rsvp_status IN ('attending', 'not_attending', 'maybe')),
    responded_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON org_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user  ON org_event_rsvps(user_email);
"""


def create_schema():
    db_url = settings.database_url
    logger.info(
        f"Connecting to {settings.SQL_HOST}:{settings.SQL_PORT}/{settings.SQL_DB} "
        f"as {settings.SQL_USERNAME}"
    )

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA_SQL)
        logger.info("Communications schema created / verified successfully")
    except Exception as exc:
        logger.error(f"Schema creation failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    create_schema()
