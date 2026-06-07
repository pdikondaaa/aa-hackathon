-- Add parking_option column to parking_requests.
-- Values: 'monthly_aaspl' | 'daily_fountainhead' | 'monthly_fountainhead'
ALTER TABLE parking_requests
    ADD COLUMN IF NOT EXISTS parking_option VARCHAR(50);
