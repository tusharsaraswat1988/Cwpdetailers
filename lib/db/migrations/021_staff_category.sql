-- Migration 021: Staff category (Supervisor vs Cleaning Staff)

DO $$ BEGIN
  CREATE TYPE staff_category AS ENUM ('supervisor', 'cleaning_staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_category staff_category;

-- Backfill: legacy supervisor role → supervisor category; everyone else → cleaning staff
UPDATE staff SET staff_category = 'supervisor' WHERE staff_category IS NULL AND role = 'supervisor';
UPDATE staff SET staff_category = 'cleaning_staff' WHERE staff_category IS NULL;

ALTER TABLE staff ALTER COLUMN staff_category SET DEFAULT 'cleaning_staff';
ALTER TABLE staff ALTER COLUMN staff_category SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_category ON staff(staff_category);
