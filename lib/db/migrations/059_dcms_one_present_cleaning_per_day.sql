-- Migration 059: At most one present DCC cleaning visit per subscription per day.
-- Prevents duplicate CNA / completed rows from double taps.
-- Does not touch rejected geofence rows. Does not apply to wash visits.
-- Skips index creation if historical duplicates already exist (no data deleted).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dcms_visits
    WHERE visit_type = 'cleaning'
      AND visit_date IS NOT NULL
      AND status IN ('completed', 'car_not_available')
    GROUP BY subscription_id, visit_date
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '059 skipped unique index: duplicate present cleaning visits exist';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS dcms_visits_one_present_cleaning_per_day
    ON dcms_visits (subscription_id, visit_date)
    WHERE visit_type = 'cleaning'
      AND visit_date IS NOT NULL
      AND status IN ('completed', 'car_not_available');
END $$;
