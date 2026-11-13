-- Migration 078: Supervisor Makeup Approval Queue & GPS Retention Indexes (Phase 18)
DO $$ BEGIN
  CREATE TYPE makeup_approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS makeup_approval_requests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  city_id INTEGER,
  branch_id INTEGER,
  contract_registry_id INTEGER,
  requested_date DATE NOT NULL,
  requested_time VARCHAR(32) NOT NULL,
  requested_notes TEXT,
  reason TEXT NOT NULL,
  status makeup_approval_status NOT NULL DEFAULT 'pending',
  decided_by INTEGER,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_booking_id INTEGER,
  previous_makeups_count INTEGER NOT NULL DEFAULT 0,
  applicable_quota INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS makeup_approvals_status_idx ON makeup_approval_requests(status);
CREATE INDEX IF NOT EXISTS makeup_approvals_city_branch_idx ON makeup_approval_requests(city_id, branch_id);
CREATE INDEX IF NOT EXISTS makeup_approvals_booking_idx ON makeup_approval_requests(booking_id);
CREATE INDEX IF NOT EXISTS makeup_approvals_customer_idx ON makeup_approval_requests(customer_id);

CREATE INDEX IF NOT EXISTS service_execution_location_logs_recorded_at_idx ON service_execution_location_logs(recorded_at);
