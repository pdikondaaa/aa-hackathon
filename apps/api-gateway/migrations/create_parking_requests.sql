-- Migration: create parking_requests table for the Parking Tracker feature
-- Run once against the target database.

CREATE TABLE IF NOT EXISTS parking_requests (
    id                        SERIAL PRIMARY KEY,
    email                     VARCHAR(255)  NOT NULL,
    employee_id               VARCHAR(100),
    employee_name             VARCHAR(255),
    location                  VARCHAR(50)   NOT NULL,
    category                  VARCHAR(10)   NOT NULL,  -- '2W' or '4W'
    parking_option            VARCHAR(50),             -- 'monthly_aaspl' | 'daily_fountainhead' | 'monthly_fountainhead'
    owner_name                VARCHAR(255)  NOT NULL,
    vehicle_reg_no            VARCHAR(50)   NOT NULL,
    vehicle_make              VARCHAR(100),
    vehicle_model             VARCHAR(100),
    sticker_required_date     DATE,
    vehicle_photo_url         TEXT,                    -- base64 or storage URL
    status                    VARCHAR(50)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | sticker_issued | closed
    -- | deactivation_requested | deactivated
    admin_remarks             TEXT,
    parking_sticker_rfid_no   VARCHAR(100),
    submitted_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP     NOT NULL DEFAULT NOW(),
    deactivation_requested_at TIMESTAMP,
    deactivation_date         DATE,
    closed_at                 TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parking_requests_email
    ON parking_requests (lower(email));
