-- Migration 031: Sprint 4B — service contract linkage columns + registry extensions

DO $$ BEGIN
  ALTER TYPE contract_source_system ADD VALUE 'booking';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE contract_product_line ADD VALUE 'one_time_service';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_fulfillment_type AS ENUM (
    'one_time',
    'contract_recurring',
    'contract_credits'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_location_id INTEGER,
  ADD COLUMN IF NOT EXISTS asset_id INTEGER;

ALTER TABLE dcms_subscriptions
  ADD COLUMN IF NOT EXISTS service_location_id INTEGER,
  ADD COLUMN IF NOT EXISTS asset_id INTEGER;

ALTER TABLE customer_entitlements
  ADD COLUMN IF NOT EXISTS service_location_id INTEGER,
  ADD COLUMN IF NOT EXISTS asset_id INTEGER;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS service_location_id INTEGER,
  ADD COLUMN IF NOT EXISTS asset_id INTEGER;

ALTER TABLE customer_contracts
  ADD COLUMN IF NOT EXISTS service_location_id INTEGER,
  ADD COLUMN IF NOT EXISTS registry_asset_id INTEGER,
  ADD COLUMN IF NOT EXISTS service_id INTEGER,
  ADD COLUMN IF NOT EXISTS contract_type contract_fulfillment_type,
  ADD COLUMN IF NOT EXISTS catalog_ref_kind TEXT,
  ADD COLUMN IF NOT EXISTS catalog_ref_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_customer_contracts_location
  ON customer_contracts (service_location_id);

CREATE INDEX IF NOT EXISTS idx_customer_contracts_contract_type
  ON customer_contracts (contract_type);
