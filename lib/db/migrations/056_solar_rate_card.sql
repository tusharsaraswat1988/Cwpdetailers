-- Migration 056: Configurable solar rate card (term bands, site-visit, AMC linkage)
-- Rates, panel bands, and minimum billing live in solar_pricing_slabs — not in app code.

DO $$ BEGIN
  CREATE TYPE solar_pricing_term AS ENUM ('one_time', 'amc_6', 'amc_12');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE solar_pricing_slabs
  ADD COLUMN IF NOT EXISTS term solar_pricing_term NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS package_id INTEGER,
  ADD COLUMN IF NOT EXISTS requires_site_visit BOOLEAN NOT NULL DEFAULT FALSE;

-- Site-visit rows may omit a numeric rate until finalized after visit
ALTER TABLE solar_pricing_slabs
  ALTER COLUMN price_per_panel DROP NOT NULL;

ALTER TABLE catalog_packages
  ADD COLUMN IF NOT EXISTS solar_term solar_pricing_term;

CREATE INDEX IF NOT EXISTS solar_pricing_slabs_term_idx
  ON solar_pricing_slabs (term, service_id, package_id, is_active);

CREATE INDEX IF NOT EXISTS solar_pricing_slabs_panel_idx
  ON solar_pricing_slabs (min_panels, max_panels);
