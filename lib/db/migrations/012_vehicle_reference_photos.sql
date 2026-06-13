-- Migration 012: Vehicle reference photos for staff identification

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ref_photo_front_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ref_photo_rear_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ref_photo_left_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ref_photo_right_url TEXT;
