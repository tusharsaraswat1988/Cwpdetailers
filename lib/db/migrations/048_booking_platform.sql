-- Phase 3: Intelligent Booking Platform
-- Adds platform status, snapshots, timeline, and coverage anchoring columns.

DO $$ BEGIN
  CREATE TYPE booking_platform_status AS ENUM (
    'DRAFT', 'VALIDATED', 'CONFIRMED', 'PAYMENT_PENDING', 'ASSIGNED', 'ACCEPTED',
    'TRAVELLING', 'ARRIVED', 'STARTED', 'PAUSED', 'RESUMED', 'COMPLETED',
    'CANCELLED', 'FAILED', 'REVIEW_PENDING', 'REVIEWED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_snapshot_type AS ENUM (
    'ADDRESS', 'LOCATION', 'COVERAGE', 'PRICE', 'STAFF', 'VEHICLE', 'COUPON'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_timeline_event_type AS ENUM (
    'BOOKING_CREATED', 'COVERAGE_VALIDATED', 'ADDRESS_SNAPSHOT_CREATED',
    'PRICE_CALCULATED', 'BOOKING_VALIDATED', 'BOOKING_CONFIRMED',
    'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'ASSIGNED', 'ACCEPTED',
    'TRAVELLING', 'ARRIVED', 'STARTED', 'PAUSED', 'RESUMED',
    'COMPLETED', 'CANCELLED', 'FAILED', 'REVIEW_PENDING', 'REVIEWED',
    'ARCHIVED', 'ADDRESS_CHANGED', 'RESCHEDULED', 'PROOF_UPLOADED',
    'BUSINESS_RULE_EVALUATED', 'SERVICE_DISCOVERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS platform_status booking_platform_status DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS coverage_status TEXT,
  ADD COLUMN IF NOT EXISTS coverage_validation_id TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_context_snapshot JSONB;

CREATE TABLE IF NOT EXISTS booking_timeline (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type booking_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  from_platform_status booking_platform_status,
  to_platform_status booking_platform_status,
  actor_id INTEGER,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  trace_id TEXT,
  request_id TEXT,
  booking_operation_id TEXT,
  address_identity_id INTEGER,
  address_snapshot_id INTEGER,
  coverage_validation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_timeline_booking_id ON booking_timeline(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_timeline_event_type ON booking_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_timeline_trace_id ON booking_timeline(trace_id);

CREATE TABLE IF NOT EXISTS booking_snapshots (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  snapshot_type booking_snapshot_type NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  trace_id TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_snapshots_booking_id ON booking_snapshots(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_snapshots_type ON booking_snapshots(snapshot_type);

-- Backfill platform_status from legacy status for existing bookings
UPDATE bookings SET platform_status = CASE status
  WHEN 'pending' THEN 'DRAFT'::booking_platform_status
  WHEN 'scheduled' THEN 'CONFIRMED'::booking_platform_status
  WHEN 'confirmed' THEN 'CONFIRMED'::booking_platform_status
  WHEN 'en_route' THEN 'TRAVELLING'::booking_platform_status
  WHEN 'in_progress' THEN 'STARTED'::booking_platform_status
  WHEN 'completed' THEN 'COMPLETED'::booking_platform_status
  WHEN 'cancelled' THEN 'CANCELLED'::booking_platform_status
  WHEN 'rescheduled' THEN 'CONFIRMED'::booking_platform_status
  WHEN 'missed' THEN 'FAILED'::booking_platform_status
  ELSE 'DRAFT'::booking_platform_status
END
WHERE platform_status IS NULL OR platform_status = 'DRAFT';
