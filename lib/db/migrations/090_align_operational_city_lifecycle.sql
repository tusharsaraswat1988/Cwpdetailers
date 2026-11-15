-- Migration 090: Align Operational City Lifecycle & Master Reference Scoping
-- PRD v6.7.0 (CITY-011): Ensure only truly operational cities (Varanasi) and setup markets (Noida) have operational status.
-- Non-operational pan-India reference cities are scoped to 'draft' status with is_active = false.

-- 1. Ensure Varanasi is active operational
UPDATE cities 
SET status = 'active', 
    is_active = true, 
    code = 'VNS',
    updated_at = NOW()
WHERE slug = 'varanasi';

-- 2. Ensure Noida is in setup_in_progress lifecycle (launch market)
UPDATE cities 
SET status = 'setup_in_progress', 
    is_active = true, 
    code = 'NOI',
    updated_at = NOW()
WHERE slug = 'noida';

-- 3. Scope all other pan-India master reference cities to draft status and inactive
UPDATE cities 
SET status = 'draft', 
    is_active = false,
    updated_at = NOW()
WHERE slug NOT IN ('varanasi', 'noida');

-- 4. Deactivate service availability matrix entries for non-operational cities
UPDATE service_city_availability
SET is_active = false,
    updated_at = NOW()
WHERE city_id NOT IN (
  SELECT id FROM cities WHERE slug IN ('varanasi', 'noida')
);

UPDATE service_availability_matrix
SET is_active = false,
    updated_at = NOW()
WHERE city_id IS NOT NULL 
  AND city_id NOT IN (
    SELECT id FROM cities WHERE slug IN ('varanasi', 'noida')
  );
