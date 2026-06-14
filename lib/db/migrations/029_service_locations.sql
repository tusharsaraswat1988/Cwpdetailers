-- Migration 029: Service Locations + customer links (Sprint 2)

DO $$ BEGIN
  CREATE TYPE service_location_type AS ENUM ('office', 'factory', 'residence', 'parking', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_location_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_locations (
  id              SERIAL PRIMARY KEY,
  label           TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  place_id        TEXT,
  location_type   service_location_type NOT NULL DEFAULT 'other',
  status          service_location_status NOT NULL DEFAULT 'active',
  is_auto_created BOOLEAN NOT NULL DEFAULT FALSE,
  company_id      INTEGER,
  franchisee_id   INTEGER,
  branch_id       INTEGER,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_locations_status ON service_locations (status);
CREATE INDEX IF NOT EXISTS idx_service_locations_company ON service_locations (company_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_branch ON service_locations (branch_id);

CREATE TABLE IF NOT EXISTS customer_location_links (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_location_id INTEGER NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from      DATE,
  effective_until     DATE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_location_links_customer_location_unique UNIQUE (customer_id, service_location_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_location_links_customer ON customer_location_links (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_location_links_location ON customer_location_links (service_location_id);
CREATE INDEX IF NOT EXISTS idx_customer_location_links_default ON customer_location_links (customer_id, is_default);

-- Backfill default "Primary" location for existing customers without one
DO $$
DECLARE
  r RECORD;
  loc_id INTEGER;
BEGIN
  FOR r IN
    SELECT c.*
    FROM customers c
    WHERE NOT EXISTS (
      SELECT 1
      FROM customer_location_links cl
      WHERE cl.customer_id = c.id AND cl.is_default = TRUE
    )
  LOOP
    INSERT INTO service_locations (
      label, address, city, location_type, status, is_auto_created,
      company_id, franchisee_id, branch_id
    )
    VALUES (
      'Primary',
      r.address,
      r.city,
      CASE
        WHEN r.address IS NOT NULL AND TRIM(r.address) <> '' THEN 'residence'::service_location_type
        ELSE 'other'::service_location_type
      END,
      'active',
      TRUE,
      r.company_id,
      r.franchisee_id,
      r.branch_id
    )
    RETURNING id INTO loc_id;

    INSERT INTO customer_location_links (
      customer_id, service_location_id, is_default, effective_from
    )
    VALUES (
      r.id,
      loc_id,
      TRUE,
      COALESCE(r.customer_since, CURRENT_DATE)
    );
  END LOOP;
END $$;
