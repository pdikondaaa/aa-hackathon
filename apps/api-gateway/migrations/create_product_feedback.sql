-- Migration: create product_feedback table for the "Share Feedback" module
-- (distinct from the message-level thumbs up/down `feedback` table).
-- Run once against the target database.

CREATE TABLE IF NOT EXISTS product_feedback (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    type         VARCHAR(30)  NOT NULL,
                 -- improvement | bug | suggestion | compliment
    module       VARCHAR(100),
    title        VARCHAR(120) NOT NULL,
    description  TEXT NOT NULL,
    rating       SMALLINT NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'open',
                 -- open | reviewed | resolved | closed
    admin_notes  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at  TIMESTAMP,
    CONSTRAINT chk_product_feedback_type   CHECK (type IN ('improvement', 'bug', 'suggestion', 'compliment')),
    CONSTRAINT chk_product_feedback_status CHECK (status IN ('open', 'reviewed', 'resolved', 'closed')),
    CONSTRAINT chk_product_feedback_rating CHECK (rating BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_product_feedback_created ON product_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_feedback_user    ON product_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_feedback_status  ON product_feedback(status, created_at DESC);
