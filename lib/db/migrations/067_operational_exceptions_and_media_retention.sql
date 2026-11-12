-- Migration 067: Operational Exceptions and Media Retention

-- 1. Create Enums for DCMS Operational Exceptions
DO $$ BEGIN
  CREATE TYPE dcms_exception_type AS ENUM (
    'car_not_available',
    'vehicle_moved_bay',
    'gate_access_denied',
    'staff_unavailable',
    'missed_cleaning',
    'customer_complaint',
    'reclean_requested',
    'basement_gps_audit'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dcms_exception_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'dismissed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add media retention fields to dcms_visits
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMP;
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS retention_hold BOOLEAN DEFAULT false;

-- 3. Create dcms_operational_exceptions Table
CREATE TABLE IF NOT EXISTS dcms_operational_exceptions (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
  visit_id INTEGER REFERENCES dcms_visits(id) ON DELETE SET NULL,
  society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  exception_type dcms_exception_type NOT NULL,
  status dcms_exception_status NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  notes TEXT,
  evidence_photo_url TEXT,
  reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_action TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_id INTEGER,
  branch_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast operations dashboard filtering
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_sub ON dcms_operational_exceptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_society ON dcms_operational_exceptions(society_id);
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_status ON dcms_operational_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_city ON dcms_operational_exceptions(city_id);
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_reported ON dcms_operational_exceptions(reported_at);
