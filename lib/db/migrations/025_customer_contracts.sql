-- Migration 025: Unified customer contract registry + entitlement asset binding

DO $$ BEGIN
  CREATE TYPE contract_asset_type AS ENUM ('vehicle', 'solar_site', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_product_line AS ENUM (
    'daily_cleaning', 'wash_package', 'monthly_wash', 'solar_amc', 'detailing_plan'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_source_system AS ENUM ('dcms', 'entitlement', 'subscription');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_registry_status AS ENUM (
    'active', 'paused', 'completed', 'expired', 'cancelled', 'expiring'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS customer_contracts (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL,
  asset_type      contract_asset_type,
  asset_id        INTEGER,
  product_line    contract_product_line NOT NULL,
  source_system   contract_source_system NOT NULL,
  source_id       INTEGER NOT NULL,
  status          contract_registry_status NOT NULL DEFAULT 'active',
  valid_from      DATE,
  valid_until     DATE,
  summary_json    JSONB NOT NULL DEFAULT '{}',
  company_id      INTEGER,
  franchisee_id   INTEGER,
  branch_id       INTEGER,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_contracts_source_unique UNIQUE (source_system, source_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_contracts_customer ON customer_contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_status ON customer_contracts (status);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_product ON customer_contracts (product_line);

ALTER TABLE customer_entitlements
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER,
  ADD COLUMN IF NOT EXISTS solar_site_id INTEGER;

-- Backfill registry from DCMS
INSERT INTO customer_contracts (
  customer_id, asset_type, asset_id, product_line, source_system, source_id,
  status, valid_from, valid_until, summary_json, company_id, franchisee_id, branch_id
)
SELECT
  s.customer_id,
  'vehicle'::contract_asset_type,
  s.vehicle_id,
  'daily_cleaning'::contract_product_line,
  'dcms'::contract_source_system,
  s.id,
  CASE s.status::text
    WHEN 'active' THEN 'active'::contract_registry_status
    WHEN 'paused' THEN 'paused'::contract_registry_status
    WHEN 'completed' THEN 'completed'::contract_registry_status
    WHEN 'expired' THEN 'expired'::contract_registry_status
    WHEN 'cancelled' THEN 'cancelled'::contract_registry_status
    ELSE 'active'::contract_registry_status
  END,
  s.start_date,
  NULL,
  jsonb_build_object(
    'planId', s.plan_id,
    'remainingCleanings', s.remaining_cleanings,
    'remainingWashes', s.remaining_washes,
    'allocatedCleanings', s.allocated_cleanings,
    'allocatedWashes', s.allocated_washes
  ),
  s.company_id,
  s.franchisee_id,
  s.branch_id
FROM dcms_subscriptions s
ON CONFLICT (source_system, source_id) DO NOTHING;

-- Backfill from legacy subscriptions
INSERT INTO customer_contracts (
  customer_id, asset_type, asset_id, product_line, source_system, source_id,
  status, valid_from, valid_until, summary_json, company_id, franchisee_id, branch_id
)
SELECT
  s.customer_id,
  CASE
    WHEN s.vehicle_id IS NOT NULL THEN 'vehicle'::contract_asset_type
    WHEN s.solar_site_id IS NOT NULL THEN 'solar_site'::contract_asset_type
    ELSE 'customer'::contract_asset_type
  END,
  COALESCE(s.vehicle_id, s.solar_site_id),
  CASE s.type::text
    WHEN 'monthly_wash' THEN 'monthly_wash'::contract_product_line
    WHEN 'solar_amc' THEN 'solar_amc'::contract_product_line
    WHEN 'detailing_plan' THEN 'detailing_plan'::contract_product_line
    ELSE 'monthly_wash'::contract_product_line
  END,
  'subscription'::contract_source_system,
  s.id,
  CASE s.status::text
    WHEN 'active' THEN 'active'::contract_registry_status
    WHEN 'paused' THEN 'paused'::contract_registry_status
    WHEN 'expiring' THEN 'expiring'::contract_registry_status
    WHEN 'expired' THEN 'expired'::contract_registry_status
    WHEN 'cancelled' THEN 'cancelled'::contract_registry_status
    WHEN 'missed' THEN 'active'::contract_registry_status
    WHEN 'pending' THEN 'active'::contract_registry_status
    ELSE 'active'::contract_registry_status
  END,
  s.start_date,
  s.end_date,
  jsonb_build_object(
    'type', s.type,
    'servicesRemaining', s.services_remaining,
    'totalServices', s.total_services,
    'nextDueDate', s.next_due_date,
    'price', s.price
  ),
  s.company_id,
  s.franchisee_id,
  s.branch_id
FROM subscriptions s
ON CONFLICT (source_system, source_id) DO NOTHING;

-- Backfill from entitlements
INSERT INTO customer_contracts (
  customer_id, asset_type, asset_id, product_line, source_system, source_id,
  status, valid_from, valid_until, summary_json, company_id, franchisee_id, branch_id
)
SELECT
  e.customer_id,
  CASE
    WHEN e.solar_site_id IS NOT NULL THEN 'solar_site'::contract_asset_type
    WHEN e.vehicle_id IS NOT NULL THEN 'vehicle'::contract_asset_type
    ELSE 'customer'::contract_asset_type
  END,
  COALESCE(e.solar_site_id, e.vehicle_id),
  CASE e.entitlement_type::text
    WHEN 'solar_visit' THEN 'solar_amc'::contract_product_line
    WHEN 'detailing_credit' THEN 'detailing_plan'::contract_product_line
    ELSE 'wash_package'::contract_product_line
  END,
  'entitlement'::contract_source_system,
  e.id,
  CASE
    WHEN e.status::text = 'cancelled' THEN 'cancelled'::contract_registry_status
    WHEN e.status::text = 'expired' THEN 'expired'::contract_registry_status
    WHEN e.status::text = 'exhausted' THEN 'expired'::contract_registry_status
    WHEN e.remaining_credits <= 0 THEN 'expired'::contract_registry_status
    WHEN e.valid_until < CURRENT_DATE THEN 'expired'::contract_registry_status
    ELSE 'active'::contract_registry_status
  END,
  e.valid_from,
  e.valid_until,
  jsonb_build_object(
    'entitlementType', e.entitlement_type,
    'packageId', e.package_id,
    'serviceId', e.service_id,
    'remainingCredits', e.remaining_credits,
    'totalCredits', e.total_credits
  ),
  NULL,
  NULL,
  NULL
FROM customer_entitlements e
ON CONFLICT (source_system, source_id) DO NOTHING;
