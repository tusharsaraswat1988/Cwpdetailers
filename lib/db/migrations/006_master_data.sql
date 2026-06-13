-- Migration 006: Master Data Architecture
-- Vehicle masters, city masters, saved locations, service management, asset locations

-- ─── Vehicle Masters ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  seat_count  INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_brands (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id                   SERIAL PRIMARY KEY,
  brand_id             INTEGER NOT NULL,
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  vehicle_category_id  INTEGER NOT NULL,
  seat_category_id     INTEGER NOT NULL,
  fuel_type_id         INTEGER,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand ON vehicle_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_category ON vehicle_models(vehicle_category_id);

-- ─── City Masters ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS states (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cities (
  id          SERIAL PRIMARY KEY,
  state_id    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (state_id, slug)
);

CREATE TABLE IF NOT EXISTS service_areas (
  id          SERIAL PRIMARY KEY,
  city_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pincodes (
  id               SERIAL PRIMARY KEY,
  service_area_id  INTEGER NOT NULL,
  pincode          TEXT NOT NULL,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (pincode)
);

CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_city ON service_areas(city_id);
CREATE INDEX IF NOT EXISTS idx_pincodes_area ON pincodes(service_area_id);

-- ─── Saved Locations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_locations (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  label       TEXT NOT NULL,
  address     TEXT NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  place_id    TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_customer ON saved_locations(customer_id);

-- ─── Service Management ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_categories (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  icon_url         TEXT,
  legacy_category  TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_plans (
  id               SERIAL PRIMARY KEY,
  service_id       INTEGER NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  duration_months  INTEGER,
  price            NUMERIC(10,2) NOT NULL,
  features         JSONB DEFAULT '[]'::jsonb,
  tag              TEXT,
  is_highlighted   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_pricing (
  id                   SERIAL PRIMARY KEY,
  service_id           INTEGER NOT NULL,
  vehicle_category_id  INTEGER,
  seat_category_id     INTEGER,
  price                NUMERIC(10,2) NOT NULL,
  duration_minutes     INTEGER,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_plans_service ON service_plans(service_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_service ON service_pricing(service_id);

-- ─── Alter Existing Tables ───────────────────────────────────────────────────

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_model_id INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_address TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_lat DOUBLE PRECISION;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_lng DOUBLE PRECISION;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS location_complete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE solar_sites ADD COLUMN IF NOT EXISTS service_lat DOUBLE PRECISION;
ALTER TABLE solar_sites ADD COLUMN IF NOT EXISTS service_lng DOUBLE PRECISION;
ALTER TABLE solar_sites ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE solar_sites ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE solar_sites ADD COLUMN IF NOT EXISTS location_complete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS saved_location_id INTEGER;

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category_id INTEGER;

-- ─── Backfill vehicle_model_id from existing make/model text ────────────────
-- Runs after seed; safe no-op if models table empty

UPDATE vehicles v
SET vehicle_model_id = vm.id,
    location_complete = COALESCE(v.location_complete, FALSE)
FROM vehicle_models vm
JOIN vehicle_brands vb ON vb.id = vm.brand_id
WHERE LOWER(v.make) = LOWER(vb.name)
  AND LOWER(v.model) = LOWER(vm.name)
  AND v.vehicle_model_id IS NULL;

-- Map legacy vehicle_type enum to categories for display
UPDATE vehicles v
SET location_complete = TRUE
WHERE v.service_address IS NOT NULL
  AND v.service_lat IS NOT NULL
  AND v.service_lng IS NOT NULL;

UPDATE solar_sites s
SET location_complete = TRUE,
    service_lat = COALESCE(s.service_lat, NULL),
    service_lng = COALESCE(s.service_lng, NULL)
WHERE s.address IS NOT NULL AND s.location_complete = FALSE;

-- Link existing services to service_categories via legacy_category
UPDATE services s
SET service_category_id = sc.id
FROM service_categories sc
WHERE sc.legacy_category = s.category::text
  AND s.service_category_id IS NULL;
