-- Migration 079: Universal City/Branch Service Catalog, Pricing Matrix & Subscription Packages (Phase 19, PRD v4.9)
-- Requirements: SVC-011, SVC-012, SVC-013, SVC-014, ADMIN-023, TEST-007

-- 1. Extend services table with catalog metadata & extensibility
ALTER TABLE services ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS supported_vehicle_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS applicable_booking_modes JSONB DEFAULT '["one_time"]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS default_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Populate code from slug where null
UPDATE services SET code = slug WHERE code IS NULL AND slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS services_code_unique_idx ON services (code) WHERE code IS NOT NULL;

-- 2. Create service_availability_matrix table
CREATE TABLE IF NOT EXISTS service_availability_matrix (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  booking_modes JSONB NOT NULL DEFAULT '["one_time"]'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  base_price_override NUMERIC(10, 2),
  package_config_id INTEGER,
  operational_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_city_branch_service ON service_availability_matrix (city_id, branch_id, service_id);
CREATE INDEX IF NOT EXISTS idx_sam_service ON service_availability_matrix (service_id);
CREATE INDEX IF NOT EXISTS idx_sam_effective ON service_availability_matrix (effective_from, effective_until);
CREATE INDEX IF NOT EXISTS idx_sam_active ON service_availability_matrix (is_active);

-- 3. Extend service_pricing table for branch overrides & effective date bounds
ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_service_pricing_branch ON service_pricing (branch_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_effective ON service_pricing (effective_from, effective_until);

-- 4. Extend catalog_packages table for branch scoping, versioning & fulfillment rules
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'recurring_monthly';
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS included_visits INTEGER DEFAULT 1;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS complimentary_visits INTEGER DEFAULT 0;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS service_frequency TEXT DEFAULT 'daily';
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS vehicle_category_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS is_renewal_eligible BOOLEAN DEFAULT TRUE;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS renewal_discount_percent NUMERIC(5, 2) DEFAULT '0';
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_catalog_packages_branch ON catalog_packages (branch_id);
CREATE INDEX IF NOT EXISTS idx_catalog_packages_service ON catalog_packages (service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_packages_effective ON catalog_packages (effective_from, effective_until);

-- 5. Safe backfill: Populate service_availability_matrix from existing service_city_availability
INSERT INTO service_availability_matrix (
  service_id, city_id, branch_id, is_active, base_price_override, booking_modes, created_at, updated_at
)
SELECT
  sca.service_id,
  sca.city_id,
  NULL,
  sca.is_active,
  sca.base_price_override,
  '["one_time", "subscription"]'::jsonb,
  sca.created_at,
  sca.updated_at
FROM service_city_availability sca
WHERE NOT EXISTS (
  SELECT 1 FROM service_availability_matrix sam
  WHERE sam.service_id = sca.service_id
    AND sam.city_id = sca.city_id
    AND sam.branch_id IS NULL
);

-- Backfill branch overrides from service_branch_overrides
INSERT INTO service_availability_matrix (
  service_id, city_id, branch_id, is_active, base_price_override, booking_modes, operational_constraints, created_at, updated_at
)
SELECT
  sbo.service_id,
  b.city_id,
  sbo.branch_id,
  sbo.is_active,
  sbo.base_price_override,
  '["one_time", "subscription"]'::jsonb,
  COALESCE(sbo.custom_settings, '{}'::jsonb),
  sbo.created_at,
  sbo.updated_at
FROM service_branch_overrides sbo
JOIN branches b ON b.id = sbo.branch_id
WHERE b.city_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM service_availability_matrix sam
    WHERE sam.service_id = sbo.service_id
      AND sam.city_id = b.city_id
      AND sam.branch_id = sbo.branch_id
  );
