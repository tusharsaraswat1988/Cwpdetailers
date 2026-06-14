-- Migration 030: Assets foundation — registry, placement, ownership history (Sprint 3)

DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM ('vehicle', 'solar_site');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('active', 'inactive', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_asset_link_type AS ENUM ('operational', 'commercial', 'historical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE solar_sites
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE solar_sites
SET site_name = COALESCE(NULLIF(TRIM(site_name), ''), LEFT(address, 80))
WHERE site_name IS NULL OR TRIM(site_name) = '';

CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
  asset_type      asset_type NOT NULL,
  vehicle_id      INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  solar_site_id   INTEGER REFERENCES solar_sites(id) ON DELETE SET NULL,
  label           TEXT NOT NULL,
  notes           TEXT,
  status          asset_status NOT NULL DEFAULT 'active',
  company_id      INTEGER,
  franchisee_id   INTEGER,
  branch_id       INTEGER,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT assets_vehicle_unique UNIQUE (vehicle_id),
  CONSTRAINT assets_solar_site_unique UNIQUE (solar_site_id)
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);
CREATE INDEX IF NOT EXISTS idx_assets_company ON assets (company_id);

CREATE TABLE IF NOT EXISTS location_asset_links (
  id                  SERIAL PRIMARY KEY,
  asset_id            INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  service_location_id INTEGER NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  effective_from      DATE,
  effective_until     DATE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_asset_links_asset ON location_asset_links (asset_id);
CREATE INDEX IF NOT EXISTS idx_location_asset_links_location ON location_asset_links (service_location_id);

CREATE TABLE IF NOT EXISTS customer_asset_links (
  id              SERIAL PRIMARY KEY,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  link_type       customer_asset_link_type NOT NULL DEFAULT 'commercial',
  effective_from  DATE,
  effective_until DATE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_asset_links_asset ON customer_asset_links (asset_id);
CREATE INDEX IF NOT EXISTS idx_customer_asset_links_customer ON customer_asset_links (customer_id);

-- Backfill assets + links from existing vehicles and solar sites
DO $$
DECLARE
  r RECORD;
  loc_id INTEGER;
  asset_id INTEGER;
  eff_from DATE;
BEGIN
  -- Vehicles
  FOR r IN
    SELECT v.*
    FROM vehicles v
    WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.vehicle_id = v.id)
  LOOP
    eff_from := COALESCE(r.created_at::date, CURRENT_DATE);

    SELECT cl.service_location_id INTO loc_id
    FROM customer_location_links cl
    WHERE cl.customer_id = r.customer_id AND cl.is_default = TRUE
    LIMIT 1;

    IF loc_id IS NULL THEN
      INSERT INTO service_locations (
        label, address, city, location_type, status, is_auto_created,
        company_id, franchisee_id, branch_id
      )
      SELECT 'Primary', c.address, c.city,
        CASE WHEN c.address IS NOT NULL AND TRIM(c.address) <> '' THEN 'residence'::service_location_type ELSE 'other'::service_location_type END,
        'active', TRUE, c.company_id, c.franchisee_id, c.branch_id
      FROM customers c WHERE c.id = r.customer_id
      RETURNING id INTO loc_id;

      INSERT INTO customer_location_links (customer_id, service_location_id, is_default, effective_from)
      VALUES (r.customer_id, loc_id, TRUE, eff_from)
      ON CONFLICT (customer_id, service_location_id) DO NOTHING;
    END IF;

    INSERT INTO assets (
      asset_type, vehicle_id, label, status, company_id, franchisee_id, branch_id
    )
    VALUES (
      'vehicle', r.id, r.registration_number, 'active', r.company_id, r.franchisee_id, r.branch_id
    )
    RETURNING id INTO asset_id;

    INSERT INTO location_asset_links (asset_id, service_location_id, effective_from)
    VALUES (asset_id, loc_id, eff_from);

    INSERT INTO customer_asset_links (asset_id, customer_id, link_type, effective_from)
    VALUES (asset_id, r.customer_id, 'commercial', eff_from);
  END LOOP;

  -- Solar sites
  FOR r IN
    SELECT s.*
    FROM solar_sites s
    WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.solar_site_id = s.id)
  LOOP
    eff_from := COALESCE(r.created_at::date, CURRENT_DATE);

    SELECT cl.service_location_id INTO loc_id
    FROM customer_location_links cl
    WHERE cl.customer_id = r.customer_id AND cl.is_default = TRUE
    LIMIT 1;

    IF loc_id IS NULL THEN
      INSERT INTO service_locations (
        label, address, city, location_type, status, is_auto_created,
        company_id, franchisee_id, branch_id
      )
      SELECT 'Primary', c.address, c.city,
        CASE WHEN c.address IS NOT NULL AND TRIM(c.address) <> '' THEN 'residence'::service_location_type ELSE 'other'::service_location_type END,
        'active', TRUE, c.company_id, c.franchisee_id, c.branch_id
      FROM customers c WHERE c.id = r.customer_id
      RETURNING id INTO loc_id;

      INSERT INTO customer_location_links (customer_id, service_location_id, is_default, effective_from)
      VALUES (r.customer_id, loc_id, TRUE, eff_from)
      ON CONFLICT (customer_id, service_location_id) DO NOTHING;
    END IF;

    INSERT INTO assets (
      asset_type, solar_site_id, label, status, company_id, franchisee_id, branch_id
    )
    VALUES (
      'solar_site', r.id,
      COALESCE(NULLIF(TRIM(r.site_name), ''), LEFT(r.address, 80)),
      'active', r.company_id, r.franchisee_id, r.branch_id
    )
    RETURNING id INTO asset_id;

    INSERT INTO location_asset_links (asset_id, service_location_id, effective_from)
    VALUES (asset_id, loc_id, eff_from);

    INSERT INTO customer_asset_links (asset_id, customer_id, link_type, effective_from)
    VALUES (asset_id, r.customer_id, 'commercial', eff_from);
  END LOOP;
END $$;
