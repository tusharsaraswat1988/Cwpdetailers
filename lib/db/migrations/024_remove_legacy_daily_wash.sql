-- Migration 024: Remove legacy daily_wash subscription type (DCMS is the sole daily cleaning system)
-- Safe to re-run: compares status/type as text so it remains valid after later booking_status
-- enum shrinks (049 removed 'en_route' / 'in_progress').

DELETE FROM subscriptions WHERE type::text = 'daily_wash';

UPDATE bookings
SET status = 'cancelled',
    updated_at = NOW()
WHERE service_type::text = 'daily_cleaning'
  AND status::text IN ('scheduled', 'confirmed', 'en_route', 'in_progress');

ALTER TABLE subscriptions DROP COLUMN IF EXISTS daily_rate;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS off_days;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_type'
      AND e.enumlabel = 'daily_wash'
  ) THEN
    CREATE TYPE subscription_type_new AS ENUM ('monthly_wash', 'solar_amc', 'detailing_plan');

    ALTER TABLE subscriptions
      ALTER COLUMN type TYPE subscription_type_new
      USING (type::text::subscription_type_new);

    DROP TYPE subscription_type;
    ALTER TYPE subscription_type_new RENAME TO subscription_type;
  END IF;
END $$;
