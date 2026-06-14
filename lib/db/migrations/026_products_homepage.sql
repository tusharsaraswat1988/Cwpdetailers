-- Homepage visibility toggles for product/plan cards
ALTER TABLE catalog_packages
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

ALTER TABLE service_plans
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

ALTER TABLE dcms_plans
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;
