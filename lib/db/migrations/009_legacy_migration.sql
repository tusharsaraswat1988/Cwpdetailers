-- Migration 009: Legacy customer migration toolkit + extended customer profile fields

-- ─── Extended customer profile (legacy import + portal) ───────────────────────

ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_since DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS historical_wash_count INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS historical_solar_visit_count INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS operational_notes TEXT;

COMMENT ON COLUMN customers.total_dues IS 'Outstanding amount owed by customer (legacy: outstanding_amount)';
COMMENT ON COLUMN customers.photo_url IS 'Optional profile photo URL (import or customer portal upload)';
COMMENT ON COLUMN customers.operational_notes IS 'Contract / operational notes from legacy system';

-- ─── Migration audit enums ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE migration_entity_type AS ENUM (
    'customer', 'user', 'vehicle', 'solar_site', 'subscription', 'entitlement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE migration_row_status AS ENUM ('success', 'error', 'skipped', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE migration_batch_status AS ENUM ('preview', 'dry_run', 'committed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Migration audit tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration_batches (
  id                  SERIAL PRIMARY KEY,
  filename            TEXT,
  city_slug           TEXT,
  import_mode         TEXT NOT NULL DEFAULT 'upsert',
  status              migration_batch_status NOT NULL DEFAULT 'preview',
  summary             JSONB NOT NULL DEFAULT '{}',
  created_by_user_id  INTEGER REFERENCES users(id),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_entity_map (
  id            SERIAL PRIMARY KEY,
  batch_id      INTEGER NOT NULL REFERENCES migration_batches(id) ON DELETE CASCADE,
  entity_type   migration_entity_type NOT NULL,
  legacy_id     TEXT NOT NULL,
  platform_id   INTEGER NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, entity_type, legacy_id)
);

CREATE INDEX IF NOT EXISTS migration_entity_map_legacy_idx
  ON migration_entity_map (entity_type, legacy_id);

CREATE TABLE IF NOT EXISTS migration_row_log (
  id          SERIAL PRIMARY KEY,
  batch_id    INTEGER NOT NULL REFERENCES migration_batches(id) ON DELETE CASCADE,
  sheet_name  TEXT NOT NULL,
  row_number  INTEGER NOT NULL,
  status      migration_row_status NOT NULL,
  message     TEXT,
  legacy_id   TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS migration_row_log_batch_idx ON migration_row_log (batch_id);
