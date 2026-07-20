-- Migration: create app_users table for portal-managed role/admin assignment.
-- Replaces the hardcoded authorizedUsers map in apps/web-ui/src/config/userConfig.js.
-- Run once against the target database.

CREATE TABLE IF NOT EXISTS app_users (
    email       VARCHAR(255) PRIMARY KEY,
    role        VARCHAR(50) NOT NULL DEFAULT 'user',
    updated_by  VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed with the current hardcoded admin list so nothing regresses on cutover.
INSERT INTO app_users (email, role) VALUES
    ('amol.metkari@alignedautomation.com', 'admin'),
    ('ayushi.singh@alignedautomation.com', 'admin'),
    ('maithili.joshi@alignedautomation.com', 'admin'),
    ('prashant.dikonda@alignedautomation.com', 'admin'),
    ('yogeshbrijlal.chandan@alignedautomation.com', 'admin'),
    ('vishal.jagdhane@alignedautomation.com', 'admin'),
    ('namita.bandal@alignedautomation.com', 'admin'),
    ('ashwani.tiwary@alignedautomation.com', 'admin'),
    ('nitin.asati@alignedautomation.com', 'admin'),
    ('seema.yadav@alignedautomation.com', 'admin'),
    ('hr@alignedautomation.com', 'admin')
ON CONFLICT (email) DO NOTHING;
