-- Migration 008: CWP Service Catalog Engine
-- Multi-city pricing, GST, addons, packages, entitlements, CMS

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE pricing_type AS ENUM ('inclusive', 'exclusive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_model AS ENUM ('fixed', 'vehicle_matrix', 'solar_slab');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_status AS ENUM ('active', 'disabled', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE entitlement_type AS ENUM ('wash_credit', 'cleaning_credit', 'solar_visit', 'detailing_credit', 'generic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE entitlement_status AS ENUM ('active', 'expired', 'exhausted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Extend service_categories ───────────────────────────────────────────────

ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS show_in_booking BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS show_in_seo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS seo_keywords TEXT;

-- ─── Extend services ─────────────────────────────────────────────────────────

ALTER TABLE services ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_type pricing_type NOT NULL DEFAULT 'inclusive';
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_model pricing_model NOT NULL DEFAULT 'fixed';
ALTER TABLE services ADD COLUMN IF NOT EXISTS status service_status NOT NULL DEFAULT 'active';
ALTER TABLE services ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS feature_icons JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS benefits JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS process JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_keywords TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS og_image_url TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS schema_data JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services (slug) WHERE slug IS NOT NULL;

-- ─── Extend service_plans & service_pricing ──────────────────────────────────

ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18;
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'inclusive';
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS city_id INTEGER;

ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS city_id INTEGER;
ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2);
ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS pricing_type TEXT;

-- ─── Catalog settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_settings (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO catalog_settings (key, value) VALUES
  ('default_gst_mode', '"inclusive"'),
  ('default_gst_rate', '18')
ON CONFLICT (key) DO NOTHING;

-- ─── City availability ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_city_availability (
  id                  SERIAL PRIMARY KEY,
  service_id          INTEGER NOT NULL,
  city_id             INTEGER NOT NULL,
  base_price_override NUMERIC(10,2),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, city_id)
);

-- ─── Solar pricing slabs ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solar_pricing_slabs (
  id               SERIAL PRIMARY KEY,
  service_id       INTEGER NOT NULL,
  city_id          INTEGER,
  min_panels       INTEGER NOT NULL DEFAULT 1,
  max_panels       INTEGER,
  price_per_panel  NUMERIC(10,2) NOT NULL,
  minimum_billing  NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Addons ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_addons (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  base_price       NUMERIC(10,2) NOT NULL,
  gst_rate         NUMERIC(5,2) NOT NULL DEFAULT 18,
  pricing_type     pricing_type NOT NULL DEFAULT 'inclusive',
  duration_minutes INTEGER,
  image_url        TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_addon_links (
  id                  SERIAL PRIMARY KEY,
  addon_id            INTEGER NOT NULL,
  service_id          INTEGER,
  service_category_id INTEGER,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Packages & entitlements ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_packages (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT,
  short_description   TEXT,
  service_category_id INTEGER,
  city_id             INTEGER,
  price               NUMERIC(10,2) NOT NULL,
  gst_rate            NUMERIC(5,2) NOT NULL DEFAULT 18,
  pricing_type        pricing_type NOT NULL DEFAULT 'inclusive',
  validity_days       INTEGER NOT NULL DEFAULT 30,
  off_days            JSONB DEFAULT '[]',
  tag                 TEXT,
  is_highlighted      BOOLEAN NOT NULL DEFAULT FALSE,
  features            JSONB DEFAULT '[]',
  image_url           TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  status              service_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_package_entitlements (
  id               SERIAL PRIMARY KEY,
  package_id       INTEGER NOT NULL,
  service_id       INTEGER NOT NULL,
  entitlement_type entitlement_type NOT NULL,
  credit_count     INTEGER NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_entitlements (
  id                 SERIAL PRIMARY KEY,
  customer_id        INTEGER NOT NULL,
  package_id         INTEGER,
  subscription_id    INTEGER,
  service_id         INTEGER NOT NULL,
  city_id            INTEGER,
  entitlement_type   entitlement_type NOT NULL,
  total_credits      INTEGER NOT NULL,
  used_credits       INTEGER NOT NULL DEFAULT 0,
  remaining_credits  INTEGER NOT NULL,
  valid_from         DATE NOT NULL,
  valid_until        DATE NOT NULL,
  status             entitlement_status NOT NULL DEFAULT 'active',
  notes              TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entitlement_consumption_log (
  id               SERIAL PRIMARY KEY,
  entitlement_id   INTEGER NOT NULL,
  booking_id       INTEGER,
  credits_consumed INTEGER NOT NULL DEFAULT 1,
  consumed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  reverted_at      TIMESTAMP
);

-- ─── City SEO content ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_city_content (
  id               SERIAL PRIMARY KEY,
  service_id       INTEGER NOT NULL,
  city_id          INTEGER NOT NULL,
  seo_title        TEXT,
  seo_description  TEXT,
  seo_keywords     TEXT,
  og_image_url     TEXT,
  schema_data      JSONB,
  short_description TEXT,
  long_description  TEXT,
  benefits         JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, city_id)
);

-- ─── Homepage CMS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS homepage_sections (
  id          SERIAL PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  title       TEXT,
  subtitle    TEXT,
  content     JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Reminder hooks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_reminder_hooks (
  id            SERIAL PRIMARY KEY,
  hook_key      TEXT NOT NULL UNIQUE,
  description   TEXT,
  trigger_days  INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  config        JSONB DEFAULT '{}',
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO catalog_reminder_hooks (hook_key, description, trigger_days, config) VALUES
  ('solar_amc_no_booking', 'Solar AMC: no cleaning booked for N days', 30, '{"message": "Your solar cleaning is due."}'),
  ('package_credits_low', 'Package credits running low', 7, '{"threshold": 2}'),
  ('package_expiry_soon', 'Package validity nearing expiry', 14, '{"message": "Your package expires soon."}')
ON CONFLICT (hook_key) DO NOTHING;

-- ─── Booking addon selections ────────────────────────────────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS addon_ids JSONB DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entitlement_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_id INTEGER;
