-- Migration 046: Bundle service catalog addons with car wash / solar packages

CREATE TABLE IF NOT EXISTS catalog_package_addons (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES catalog_packages(id) ON DELETE CASCADE,
  addon_id INTEGER NOT NULL REFERENCES service_addons(id),
  extra_price NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(package_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_package_addons_package ON catalog_package_addons(package_id);
CREATE INDEX IF NOT EXISTS idx_catalog_package_addons_addon ON catalog_package_addons(addon_id);
