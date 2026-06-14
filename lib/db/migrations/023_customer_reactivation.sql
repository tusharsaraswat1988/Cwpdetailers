-- Migration 023: Legacy contact segment + customer reactivation tracking

ALTER TABLE customers ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS legacy_segment TEXT;

COMMENT ON COLUMN customers.legacy_segment IS 'Dormant segment tag, e.g. legacy_contact — cleared on reactivation';
COMMENT ON COLUMN customers.reactivated_at IS 'When a legacy/dormant customer returned and was reactivated';

CREATE INDEX IF NOT EXISTS customers_legacy_segment_idx
  ON customers (legacy_segment) WHERE legacy_segment IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_reactivated_at_idx
  ON customers (reactivated_at) WHERE reactivated_at IS NOT NULL;

DO $$ BEGIN
  ALTER TYPE comm_journey_event_type ADD VALUE 'customer_reactivated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
