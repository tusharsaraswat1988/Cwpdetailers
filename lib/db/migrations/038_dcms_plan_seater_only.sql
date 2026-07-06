-- DCMS plan pricing is keyed by seater tier only, not car type.
-- Clear any legacy per-car-type plan scope so all vehicle types share the same plan price.
UPDATE dcms_plans SET vehicle_category_id = NULL WHERE vehicle_category_id IS NOT NULL;
