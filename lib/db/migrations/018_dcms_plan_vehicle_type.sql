-- Migration 018: Link DCMS plans to vehicle category + seat category for correct billing

ALTER TABLE dcms_plans
  ADD COLUMN IF NOT EXISTS vehicle_category_id INTEGER REFERENCES vehicle_categories(id),
  ADD COLUMN IF NOT EXISTS seat_category_id INTEGER REFERENCES seat_categories(id);

CREATE INDEX IF NOT EXISTS idx_dcms_plans_vehicle_category ON dcms_plans(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_dcms_plans_seat_category ON dcms_plans(seat_category_id);

CREATE UNIQUE INDEX IF NOT EXISTS dcms_plans_vehicle_seat_bundle_unique
  ON dcms_plans(
    vehicle_category_id,
    seat_category_id,
    included_cleanings,
    included_washes,
    weekly_offs,
    COALESCE(company_id, 0)
  )
  WHERE vehicle_category_id IS NOT NULL AND seat_category_id IS NOT NULL;
