-- Phase 5.2: Booking Engine — schedule-only domain
-- Collapses dual status machines, adds contract link, drops execution/pricing/staff columns.

-- 1) Add new timeline event value (safe if already present)
DO $$ BEGIN
  ALTER TYPE booking_timeline_event_type ADD VALUE IF NOT EXISTS 'WAITING_ASSIGNMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Map legacy statuses → schedule-only statuses (text staging)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status_v52 TEXT;

UPDATE bookings SET status_v52 = CASE status::text
  WHEN 'pending' THEN 'draft'
  WHEN 'scheduled' THEN 'scheduled'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'rescheduled' THEN 'rescheduled'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'en_route' THEN CASE WHEN staff_id IS NULL THEN 'waiting_assignment' ELSE 'cancelled' END
  WHEN 'in_progress' THEN CASE WHEN staff_id IS NULL THEN 'waiting_assignment' ELSE 'cancelled' END
  WHEN 'completed' THEN 'cancelled'
  WHEN 'missed' THEN 'cancelled'
  ELSE 'draft'
END;

-- 3) Replace booking_status enum
CREATE TYPE booking_status_v52 AS ENUM (
  'draft',
  'scheduled',
  'confirmed',
  'waiting_assignment',
  'rescheduled',
  'cancelled'
);

ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bookings
  ALTER COLUMN status TYPE booking_status_v52
  USING status_v52::booking_status_v52;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'scheduled'::booking_status_v52;
ALTER TABLE bookings DROP COLUMN IF EXISTS status_v52;

DROP TYPE IF EXISTS booking_status;
ALTER TYPE booking_status_v52 RENAME TO booking_status;

-- 4) Contract registry forward link + confirmation timestamp
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contract_registry_id INTEGER,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

UPDATE bookings b
SET contract_registry_id = cc.id
FROM customer_contracts cc
WHERE cc.source_system = 'booking'
  AND cc.source_id = b.id
  AND b.contract_registry_id IS NULL;

-- 5) Timeline: replace platform status columns with schedule status columns
ALTER TABLE booking_timeline
  ADD COLUMN IF NOT EXISTS from_status booking_status,
  ADD COLUMN IF NOT EXISTS to_status booking_status;

UPDATE booking_timeline SET
  from_status = CASE from_platform_status::text
    WHEN 'DRAFT' THEN 'draft'::booking_status
    WHEN 'VALIDATED' THEN 'draft'::booking_status
    WHEN 'CONFIRMED' THEN 'confirmed'::booking_status
    WHEN 'PAYMENT_PENDING' THEN 'confirmed'::booking_status
    WHEN 'ASSIGNED' THEN 'waiting_assignment'::booking_status
    WHEN 'CANCELLED' THEN 'cancelled'::booking_status
    WHEN 'FAILED' THEN 'cancelled'::booking_status
    ELSE NULL
  END,
  to_status = CASE to_platform_status::text
    WHEN 'DRAFT' THEN 'draft'::booking_status
    WHEN 'VALIDATED' THEN 'draft'::booking_status
    WHEN 'CONFIRMED' THEN 'confirmed'::booking_status
    WHEN 'PAYMENT_PENDING' THEN 'confirmed'::booking_status
    WHEN 'ASSIGNED' THEN 'waiting_assignment'::booking_status
    WHEN 'CANCELLED' THEN 'cancelled'::booking_status
    WHEN 'FAILED' THEN 'cancelled'::booking_status
    WHEN 'TRAVELLING' THEN 'cancelled'::booking_status
    WHEN 'STARTED' THEN 'cancelled'::booking_status
    WHEN 'COMPLETED' THEN 'cancelled'::booking_status
    ELSE NULL
  END
WHERE from_platform_status IS NOT NULL OR to_platform_status IS NOT NULL;

ALTER TABLE booking_timeline
  DROP COLUMN IF EXISTS from_platform_status,
  DROP COLUMN IF EXISTS to_platform_status;

-- 6) Drop obsolete Booking god-table columns
ALTER TABLE bookings
  DROP COLUMN IF EXISTS staff_id,
  DROP COLUMN IF EXISTS amount,
  DROP COLUMN IF EXISTS addon_ids,
  DROP COLUMN IF EXISTS proof_photo_urls,
  DROP COLUMN IF EXISTS before_photo_url,
  DROP COLUMN IF EXISTS after_photo_url,
  DROP COLUMN IF EXISTS customer_signature_url,
  DROP COLUMN IF EXISTS technician_notes,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS platform_status,
  DROP COLUMN IF EXISTS coverage_status,
  DROP COLUMN IF EXISTS coverage_validation_id,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS location_context_snapshot,
  DROP COLUMN IF EXISTS recurrence_rule,
  DROP COLUMN IF EXISTS parent_booking_id,
  DROP COLUMN IF EXISTS subscription_id,
  DROP COLUMN IF EXISTS entitlement_id;

-- 7) Scheduling indexes
CREATE INDEX IF NOT EXISTS bookings_scheduled_date_idx ON bookings (scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_branch_date_idx ON bookings (branch_id, scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_customer_date_idx ON bookings (customer_id, scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_asset_date_idx ON bookings (asset_id, scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_contract_registry_idx ON bookings (contract_registry_id);
