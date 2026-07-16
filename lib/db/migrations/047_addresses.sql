-- Phase 2: Structured Address Management System
-- Address Identity + Address + History + Snapshots + Legacy links

DO $$ BEGIN
  CREATE TYPE address_type AS ENUM (
    'HOME', 'WORK', 'OTHER', 'FAMILY', 'OFFICE', 'SITE', 'WAREHOUSE', 'FACTORY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE address_verification_status AS ENUM (
    'UNKNOWN', 'GOOGLE_VERIFIED', 'GPS_VERIFIED', 'USER_ENTERED', 'ADMIN_VERIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE address_source AS ENUM (
    'GOOGLE', 'GPS', 'MANUAL', 'IMPORTED', 'ADMIN', 'API'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE address_identity_status AS ENUM ('ACTIVE', 'MERGED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE address_snapshot_reason AS ENUM (
    'BOOKING', 'CONTRACT', 'MANUAL', 'MIGRATION', 'API'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS address_identities (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  canonical_place_id TEXT,
  canonical_latitude DOUBLE PRECISION,
  canonical_longitude DOUBLE PRECISION,
  fingerprint TEXT NOT NULL,
  status address_identity_status NOT NULL DEFAULT 'ACTIVE',
  merged_into_identity_id INTEGER REFERENCES address_identities(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS address_identities_customer_idx ON address_identities(customer_id);
CREATE INDEX IF NOT EXISTS address_identities_fingerprint_idx ON address_identities(fingerprint);
CREATE INDEX IF NOT EXISTS address_identities_place_id_idx ON address_identities(canonical_place_id);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES address_identities(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  version INTEGER NOT NULL DEFAULT 1,
  nickname TEXT,
  address_type address_type NOT NULL DEFAULT 'HOME',
  house_number TEXT,
  building_name TEXT,
  floor TEXT,
  apartment TEXT,
  street TEXT,
  landmark TEXT,
  area TEXT,
  locality TEXT,
  sub_locality TEXT,
  city_id INTEGER REFERENCES cities(id),
  district TEXT,
  state_id INTEGER REFERENCES states(id),
  country TEXT NOT NULL DEFAULT 'India',
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  place_id TEXT,
  formatted_address TEXT,
  plus_code TEXT,
  address_components JSONB,
  instructions TEXT,
  normalized_address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status address_verification_status NOT NULL DEFAULT 'UNKNOWN',
  source address_source NOT NULL DEFAULT 'MANUAL',
  confidence_score INTEGER,
  location_context_snapshot JSONB,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS addresses_customer_idx ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS addresses_identity_idx ON addresses(identity_id);
CREATE INDEX IF NOT EXISTS addresses_postal_code_idx ON addresses(postal_code);
CREATE INDEX IF NOT EXISTS addresses_place_id_idx ON addresses(place_id);
CREATE INDEX IF NOT EXISTS addresses_city_id_idx ON addresses(city_id);
CREATE INDEX IF NOT EXISTS addresses_is_default_idx ON addresses(is_default);
CREATE INDEX IF NOT EXISTS addresses_verification_idx ON addresses(verification_status);
CREATE INDEX IF NOT EXISTS addresses_normalized_idx ON addresses(normalized_address);
CREATE UNIQUE INDEX IF NOT EXISTS addresses_identity_current_uidx
  ON addresses(identity_id) WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS address_history (
  id SERIAL PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES address_identities(id),
  address_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_reason TEXT,
  superseded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  superseded_by_address_id INTEGER
);

CREATE INDEX IF NOT EXISTS address_history_identity_idx ON address_history(identity_id);
CREATE INDEX IF NOT EXISTS address_history_customer_idx ON address_history(customer_id);
CREATE INDEX IF NOT EXISTS address_history_address_idx ON address_history(address_id);

CREATE TABLE IF NOT EXISTS address_snapshots (
  id SERIAL PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES address_identities(id),
  address_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  location_context JSONB,
  coverage_validation_id TEXT,
  snapshot_reason address_snapshot_reason NOT NULL DEFAULT 'API',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS address_snapshots_identity_idx ON address_snapshots(identity_id);
CREATE INDEX IF NOT EXISTS address_snapshots_customer_idx ON address_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS address_snapshots_address_idx ON address_snapshots(address_id);

CREATE TABLE IF NOT EXISTS address_legacy_links (
  id SERIAL PRIMARY KEY,
  address_id INTEGER REFERENCES addresses(id),
  identity_id INTEGER REFERENCES address_identities(id),
  legacy_table TEXT NOT NULL,
  legacy_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS address_legacy_links_unique
  ON address_legacy_links(legacy_table, legacy_id);
CREATE INDEX IF NOT EXISTS address_legacy_links_address_idx ON address_legacy_links(address_id);

-- Optional booking anchors (additive — existing snapshot columns unchanged)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_snapshot_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_identity_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_id INTEGER;

CREATE INDEX IF NOT EXISTS bookings_address_snapshot_idx ON bookings(address_snapshot_id);
CREATE INDEX IF NOT EXISTS bookings_address_identity_idx ON bookings(address_identity_id);

-- GiST index for future geo queries (when PostGIS not required, use btree on lat/lng)
CREATE INDEX IF NOT EXISTS addresses_location_idx ON addresses(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
