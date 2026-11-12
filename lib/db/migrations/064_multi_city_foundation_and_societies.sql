-- Migration 064: Multi-City Foundation & Residential Societies Hierarchy
-- Implements: CWP-023, CWP-024, CITY-003, SOC-001, SOC-005

-- 1. Residential Societies Table
CREATE TABLE IF NOT EXISTS residential_societies (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  service_area_id INTEGER REFERENCES service_areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gate_security_notes TEXT,
  total_towers INTEGER DEFAULT 0,
  total_flats INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  franchisee_id INTEGER REFERENCES franchisees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_societies_city ON residential_societies(city_id);
CREATE INDEX IF NOT EXISTS idx_societies_service_area ON residential_societies(service_area_id);
CREATE INDEX IF NOT EXISTS idx_societies_code ON residential_societies(code);

-- 2. Society Towers Table
CREATE TABLE IF NOT EXISTS society_towers (
  id SERIAL PRIMARY KEY,
  society_id INTEGER NOT NULL REFERENCES residential_societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  total_floors INTEGER,
  total_flats INTEGER,
  parking_levels TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_society_towers_society ON society_towers(society_id);

-- 3. Multi-City Normalization: Add city_id and society/parking columns
ALTER TABLE branches ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_location_id INTEGER REFERENCES service_locations(id) ON DELETE SET NULL;

ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tower_id INTEGER REFERENCES society_towers(id) ON DELETE SET NULL;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS flat_number TEXT;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_level TEXT;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_bay TEXT;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_service_locations_city ON service_locations(city_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_society ON service_locations(society_id);

-- 4. DCMS Plans & Subscriptions: City Scoping and Society Linkage
ALTER TABLE dcms_plans ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS tower_id INTEGER REFERENCES society_towers(id) ON DELETE SET NULL;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS parking_bay TEXT;

CREATE INDEX IF NOT EXISTS idx_dcms_plans_city ON dcms_plans(city_id);
CREATE INDEX IF NOT EXISTS idx_dcms_subscriptions_city ON dcms_subscriptions(city_id);
CREATE INDEX IF NOT EXISTS idx_dcms_subscriptions_society ON dcms_subscriptions(society_id);

-- 5. Backfill city_id where city text matches city master names
UPDATE branches b
SET city_id = c.id
FROM cities c
WHERE b.city_id IS NULL AND LOWER(TRIM(b.city)) = LOWER(TRIM(c.name));

UPDATE customers cust
SET city_id = c.id
FROM cities c
WHERE cust.city_id IS NULL AND LOWER(TRIM(cust.city)) = LOWER(TRIM(c.name));

UPDATE service_locations sl
SET city_id = c.id
FROM cities c
WHERE sl.city_id IS NULL AND LOWER(TRIM(sl.city)) = LOWER(TRIM(c.name));
