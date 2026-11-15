-- 089_location_serviceability_and_pricing.sql
-- Migration 089: Location Hierarchy, Operational Zones, Zone Coverage Rules, Differential Location-Based Pricing & Snapshots

-- 1. Geographic Localities / Sectors
CREATE TABLE IF NOT EXISTS geographic_localities (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  service_area_id INTEGER REFERENCES service_areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  code TEXT,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  boundary_geojson JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geographic_localities_city ON geographic_localities(city_id);
CREATE INDEX IF NOT EXISTS idx_geographic_localities_slug ON geographic_localities(slug);
CREATE INDEX IF NOT EXISTS idx_geographic_localities_pincode ON geographic_localities(pincode);

-- 2. Location Aliases & Alternative Spellings
CREATE TABLE IF NOT EXISTS location_aliases (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'city', 'locality', 'society', 'property'
  entity_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_aliases_lookup ON location_aliases(entity_type, normalized_alias);
CREATE INDEX IF NOT EXISTS idx_location_aliases_entity ON location_aliases(entity_type, entity_id);

-- 3. Operational Zones
CREATE TABLE IF NOT EXISTS operational_zones (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  center_latitude DOUBLE PRECISION,
  center_longitude DOUBLE PRECISION,
  radius_meters INTEGER,
  boundary_geojson JSONB,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_zones_city ON operational_zones(city_id);
CREATE INDEX IF NOT EXISTS idx_operational_zones_branch ON operational_zones(branch_id);
CREATE INDEX IF NOT EXISTS idx_operational_zones_status ON operational_zones(status, is_active);

-- 4. Branch-Zone Mappings
CREATE TABLE IF NOT EXISTS branch_zone_mappings (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES operational_zones(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_branch_zone UNIQUE (branch_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_zone_branch ON branch_zone_mappings(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_branch_zone_zone ON branch_zone_mappings(zone_id, is_active);

-- 5. Zone Coverage Rules
CREATE TABLE IF NOT EXISTS zone_coverage_rules (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES operational_zones(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  coverage_type TEXT NOT NULL, -- 'society', 'locality', 'pincode', 'property_type', 'all'
  society_id INTEGER REFERENCES residential_societies(id) ON DELETE CASCADE,
  locality_id INTEGER REFERENCES geographic_localities(id) ON DELETE CASCADE,
  pincode TEXT,
  property_type TEXT NOT NULL DEFAULT 'ALL', -- 'ALL', 'GATED_SOCIETY', 'APARTMENT', 'INDIVIDUAL_HOME', 'COMMERCIAL_PROPERTY', 'OTHER'
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'serviceable', -- 'serviceable', 'not_serviceable', 'coming_soon', 'waitlist'
  rejection_reason TEXT,
  priority INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zone_coverage_zone ON zone_coverage_rules(zone_id, is_active);
CREATE INDEX IF NOT EXISTS idx_zone_coverage_society ON zone_coverage_rules(society_id, is_active);
CREATE INDEX IF NOT EXISTS idx_zone_coverage_locality ON zone_coverage_rules(locality_id, is_active);
CREATE INDEX IF NOT EXISTS idx_zone_coverage_pincode ON zone_coverage_rules(pincode, is_active);

-- 6. Location-Based Differential Pricing Rules
CREATE TABLE IF NOT EXISTS location_pricing_rules (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES catalog_packages(id) ON DELETE SET NULL,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL,
  society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL,
  location_type TEXT NOT NULL DEFAULT 'ALL', -- 'ALL', 'GATED_SOCIETY', 'APARTMENT', 'INDIVIDUAL_HOME', 'COMMERCIAL_PROPERTY', 'OTHER'
  vehicle_category_id INTEGER,
  base_price NUMERIC(10, 2) NOT NULL,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT '18',
  pricing_type TEXT NOT NULL DEFAULT 'inclusive', -- 'inclusive', 'exclusive'
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'draft', 'expired', 'archived'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loc_pricing_lookup ON location_pricing_rules(city_id, service_id, location_type, is_active);
CREATE INDEX IF NOT EXISTS idx_loc_pricing_branch ON location_pricing_rules(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_loc_pricing_zone ON location_pricing_rules(zone_id, is_active);
CREATE INDEX IF NOT EXISTS idx_loc_pricing_society ON location_pricing_rules(society_id, is_active);

-- 7. Pricing Rule Audit Logs
CREATE TABLE IF NOT EXISTS pricing_rule_audit_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES location_pricing_rules(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'deactivated', 'price_changed'
  previous_values JSONB,
  new_values JSONB,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_audit_rule ON pricing_rule_audit_logs(rule_id);

-- 8. Additive columns to existing tables
-- addresses
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'OTHER';
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS locality_id INTEGER REFERENCES geographic_localities(id) ON DELETE SET NULL;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS tower_id INTEGER REFERENCES society_towers(id) ON DELETE SET NULL;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS serviceability_status TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS resolution_status TEXT;

-- saved_locations
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'OTHER';
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS locality_id INTEGER;
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS society_id INTEGER;
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS tower_id INTEGER;
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS zone_id INTEGER;
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS branch_id INTEGER;

-- bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_rule_id INTEGER REFERENCES location_pricing_rules(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_snapshot JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS property_type TEXT;

-- subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pricing_rule_id INTEGER REFERENCES location_pricing_rules(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_snapshot JSONB;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS property_type TEXT;

-- dcms_subscriptions
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS pricing_rule_id INTEGER REFERENCES location_pricing_rules(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS price_snapshot JSONB;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS property_type TEXT;

-- staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS assigned_zone_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL;
