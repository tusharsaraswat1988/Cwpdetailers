-- Migration 017: Staff location audit trail (attendance + job actions)

DO $$ BEGIN
  CREATE TYPE staff_location_action AS ENUM (
    'attendance',
    'en_route',
    'job_start',
    'job_complete'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_location_logs (
  id                      SERIAL PRIMARY KEY,
  staff_id                INTEGER NOT NULL,
  company_id              INTEGER,
  branch_id               INTEGER,
  booking_id              INTEGER,
  subscription_id         INTEGER,
  action                  staff_location_action NOT NULL,
  latitude                DOUBLE PRECISION NOT NULL,
  longitude               DOUBLE PRECISION NOT NULL,
  accuracy_meters         DOUBLE PRECISION,
  geo_fence_verified      BOOLEAN,
  geo_fence_radius_meters INTEGER,
  distance_meters         DOUBLE PRECISION,
  target_latitude         DOUBLE PRECISION,
  target_longitude        DOUBLE PRECISION,
  recorded_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS staff_location_logs_staff_idx
  ON staff_location_logs (staff_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS staff_location_logs_booking_idx
  ON staff_location_logs (booking_id, recorded_at DESC)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staff_location_logs_action_idx
  ON staff_location_logs (action, recorded_at DESC);
