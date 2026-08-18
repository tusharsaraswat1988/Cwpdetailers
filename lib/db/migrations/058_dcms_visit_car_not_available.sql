-- Migration 058: DCC visit outcome CAR_NOT_AVAILABLE
-- Staff can punch a daily cleaning visit when the car is not at the location.
-- This is PRESENT attendance with a non-completed service outcome.
-- Existing rows keep status 'completed' or 'rejected' (unchanged).
-- Historical interpretation:
--   completed          = staff present + cleaning done (consumes a cleaning)
--   rejected           = geofence/proof failure (not counted as present)
--   car_not_available  = staff present + car unavailable (does NOT consume a cleaning)
--   missed visit log   = genuinely no staff presence that day

ALTER TYPE dcms_visit_status ADD VALUE IF NOT EXISTS 'car_not_available';

COMMENT ON TYPE dcms_visit_status IS
  'DCC visit service outcome: completed, rejected (geofence), car_not_available (present, no clean).';
