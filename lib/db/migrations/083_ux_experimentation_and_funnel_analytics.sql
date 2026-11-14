-- Migration 083: Customer App UX Modernization, Experimentation & Conversion Funnel Analytics (Phase 23, PRD v5.3)
-- Requirements: CUX-001 through CUX-010, TEST-011

-- 1. Ensure homepage_sections schema integrity for multi-city CMS
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Enhance marketing_events table with funnel attribution fields
ALTER TABLE IF EXISTS marketing_events ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS marketing_events ADD COLUMN IF NOT EXISTS device_type VARCHAR(32) DEFAULT 'mobile';
ALTER TABLE IF EXISTS marketing_events ADD COLUMN IF NOT EXISTS step_number INTEGER;
ALTER TABLE IF EXISTS marketing_events ADD COLUMN IF NOT EXISTS experiment_id INTEGER;
ALTER TABLE IF EXISTS marketing_events ADD COLUMN IF NOT EXISTS experiment_variant VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_mkt_events_service ON marketing_events(service_id);
CREATE INDEX IF NOT EXISTS idx_mkt_events_device ON marketing_events(device_type);
CREATE INDEX IF NOT EXISTS idx_mkt_events_experiment ON marketing_events(experiment_id, experiment_variant);

-- 3. Create ux_experiments table for lightweight configuration-driven A/B testing
CREATE TABLE IF NOT EXISTS ux_experiments (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  target_screen VARCHAR(64) NOT NULL DEFAULT 'homepage', -- 'homepage', 'services', 'booking_flow', 'cart'
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE, -- null = global
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE, -- null = all branches
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE, -- null = all services
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  variants JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of { id, name, weight, config }
  traffic_allocation INTEGER NOT NULL DEFAULT 100, -- 0 - 100%
  primary_metric VARCHAR(64) NOT NULL DEFAULT 'booking_confirmed',
  winner_variant_id VARCHAR(64),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ux_experiments_key ON ux_experiments(key);
CREATE INDEX IF NOT EXISTS idx_ux_experiments_status ON ux_experiments(status);
CREATE INDEX IF NOT EXISTS idx_ux_experiments_target ON ux_experiments(target_screen);
CREATE INDEX IF NOT EXISTS idx_ux_experiments_city ON ux_experiments(city_id);

-- 4. Create ux_experiment_exposures table for atomic exposure and conversion tracking
CREATE TABLE IF NOT EXISTS ux_experiment_exposures (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES ux_experiments(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) NOT NULL,
  session_id TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  device_type VARCHAR(32) DEFAULT 'mobile',
  first_exposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_event VARCHAR(64),
  converted_at TIMESTAMPTZ,
  conversion_value NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT uq_exp_session UNIQUE (experiment_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_exposures_exp_var ON ux_experiment_exposures(experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_exp_exposures_converted ON ux_experiment_exposures(experiment_id, converted);
CREATE INDEX IF NOT EXISTS idx_exp_exposures_session ON ux_experiment_exposures(session_id);
