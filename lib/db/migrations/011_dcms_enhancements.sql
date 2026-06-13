-- Migration 011: DCMS enhancements — registration uniqueness, missed visits, route order, EXIF

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_normalized TEXT;

UPDATE vehicles
SET registration_normalized = upper(regexp_replace(registration_number, '[^a-zA-Z0-9]', '', 'g'))
WHERE registration_normalized IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_registration_normalized_unique
  ON vehicles (registration_normalized) WHERE registration_normalized IS NOT NULL;

ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS missed_cleanings INTEGER NOT NULL DEFAULT 0;

ALTER TABLE dcms_staff_assignments ADD COLUMN IF NOT EXISTS route_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS exif_json JSONB;
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS visit_date DATE;

UPDATE dcms_visits SET visit_date = visit_time::date WHERE visit_date IS NULL;

CREATE INDEX IF NOT EXISTS dcms_visits_visit_date_idx ON dcms_visits (visit_date);
CREATE INDEX IF NOT EXISTS dcms_visits_type_status_idx ON dcms_visits (visit_type, status);
