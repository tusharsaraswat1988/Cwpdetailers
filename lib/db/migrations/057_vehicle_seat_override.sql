-- Migration 057: Per-vehicle seat category override (5 vs 7 seater on same model)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS seat_category_id INTEGER;

CREATE INDEX IF NOT EXISTS vehicles_seat_category_id_idx
  ON vehicles (seat_category_id)
  WHERE seat_category_id IS NOT NULL;

COMMENT ON COLUMN vehicles.seat_category_id IS
  'Optional seating override for pricing. When null, use vehicle_models.seat_category_id.';
