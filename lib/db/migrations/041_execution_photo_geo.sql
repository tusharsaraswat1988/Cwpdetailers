-- Geo coordinates on service execution proof photos
ALTER TABLE service_execution_photos
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS accuracy double precision;
