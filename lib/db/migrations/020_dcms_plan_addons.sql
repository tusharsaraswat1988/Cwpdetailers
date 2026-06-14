-- Migration 020: DCMS plan addons — bundle service catalog addons with daily clean plans

CREATE TABLE IF NOT EXISTS dcms_plan_addons (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES dcms_plans(id) ON DELETE CASCADE,
  addon_id INTEGER NOT NULL REFERENCES service_addons(id),
  included_cleanings INTEGER NOT NULL DEFAULT 0,
  included_washes INTEGER NOT NULL DEFAULT 0,
  extra_price NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_dcms_plan_addons_plan ON dcms_plan_addons(plan_id);
CREATE INDEX IF NOT EXISTS idx_dcms_plan_addons_addon ON dcms_plan_addons(addon_id);
