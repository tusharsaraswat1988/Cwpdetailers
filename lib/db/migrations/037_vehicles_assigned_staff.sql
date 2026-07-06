-- Migration 037: vehicles.assigned_staff_id (schema drift fix)

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER;
