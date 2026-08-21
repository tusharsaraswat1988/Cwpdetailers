-- Migration 062: Structured fields on customer saved_locations
-- Canonical reusable customer service location. Bookings keep a snapshot
-- of address/lat/lng/placeId at booking time and are not rewritten on edit.

ALTER TABLE saved_locations
  ADD COLUMN IF NOT EXISTS house_number TEXT,
  ADD COLUMN IF NOT EXISTS building_name TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS city_id INTEGER,
  ADD COLUMN IF NOT EXISTS city_name TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_components JSONB;

ALTER TABLE saved_locations ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE saved_locations ALTER COLUMN longitude DROP NOT NULL;

CREATE INDEX IF NOT EXISTS saved_locations_customer_idx ON saved_locations (customer_id);
CREATE INDEX IF NOT EXISTS saved_locations_customer_default_idx ON saved_locations (customer_id, is_default);
CREATE INDEX IF NOT EXISTS saved_locations_place_id_idx ON saved_locations (place_id);

-- Zero coordinates were used as a "no pin" sentinel; treat them as unknown.
UPDATE saved_locations
SET latitude = NULL, longitude = NULL
WHERE latitude = 0 AND longitude = 0;
