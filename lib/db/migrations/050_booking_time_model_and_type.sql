-- Phase 5.2 pre-freeze: time window + booking type
-- Adds canonical start/end/duration and booking_type without redesigning the engine.

DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM (
    'one_time',
    'subscription_visit',
    'contract_visit',
    'inspection',
    'follow_up',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_type booking_type NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Backfill windows from scheduled_date + scheduled_time (default duration 60m)
UPDATE bookings
SET
  duration_minutes = COALESCE(duration_minutes, 60),
  scheduled_start_at = CASE
    WHEN scheduled_time IS NOT NULL AND scheduled_time ~ '^\d{1,2}:\d{2}' THEN
      (scheduled_date::text || ' ' || scheduled_time || ':00')::timestamptz
    ELSE (scheduled_date::text || ' 09:00:00')::timestamptz
  END
WHERE scheduled_start_at IS NULL;

UPDATE bookings
SET scheduled_end_at = scheduled_start_at + make_interval(mins => COALESCE(duration_minutes, 60))
WHERE scheduled_end_at IS NULL AND scheduled_start_at IS NOT NULL;

-- Infer booking_type from legacy service_type where obvious
UPDATE bookings
SET booking_type = CASE service_type::text
  WHEN 'subscription_wash' THEN 'subscription_visit'::booking_type
  WHEN 'daily_cleaning' THEN 'contract_visit'::booking_type
  ELSE 'one_time'::booking_type
END
WHERE booking_type = 'one_time'
  AND service_type::text IN ('subscription_wash', 'daily_cleaning');

CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON bookings (scheduled_start_at);
CREATE INDEX IF NOT EXISTS bookings_type_idx ON bookings (booking_type);
