-- Migration 077: Customer Self-Service Rescheduling, Dispatch Notifications & Technician ETA Foundation (Phase 17)
-- Adds rescheduled_from_booking_id, rescheduled_to_booking_id, is_makeup_booking, makeup_eligibility_status to bookings
-- Adds technician_en_route_at, estimated_arrival_at, eta_minutes, last_location_update_at, last_known_latitude, last_known_longitude to bookings
-- Adds en_route_at, estimated_arrival_at, eta_minutes, last_location_update_at to service_executions
-- Extends notification_type enum with operational dispatch event types

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'technician_en_route';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_started';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_reassigned';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'schedule_changed';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_cancelled';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'makeup_booking_confirmed';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_failure';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'repeated_execution_failure';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reschedule_approval_required';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'general';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_from_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_to_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_makeup_booking BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS makeup_eligibility_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS technician_en_route_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS eta_minutes INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_known_latitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_known_longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS bookings_rescheduled_from_idx ON bookings(rescheduled_from_booking_id);
CREATE INDEX IF NOT EXISTS bookings_rescheduled_to_idx ON bookings(rescheduled_to_booking_id);

ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;
ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS eta_minutes INTEGER;
ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;
