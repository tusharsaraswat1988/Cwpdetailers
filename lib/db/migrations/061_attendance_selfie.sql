-- Selfie proof required for staff self check-in (GPS already logged in staff_location_logs).
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS selfie_photo_url text;
