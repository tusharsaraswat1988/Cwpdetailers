-- Migration 042: Remove legacy daily-clean booking rows and duplicate DCMS subscriptions
-- Targets the parallel pre-DCMS flow (daily_cleaning bookings + daily-named one_time_wash catalog bookings).

BEGIN;

CREATE TEMP TABLE _legacy_daily_bookings ON COMMIT DROP AS
SELECT b.id
FROM bookings b
LEFT JOIN services s ON s.id = b.service_id
WHERE b.service_type = 'daily_cleaning'
   OR (
     b.service_type = 'one_time_wash'
     AND s.id IS NOT NULL
     AND lower(s.name) LIKE '%daily%'
     AND (lower(s.name) LIKE '%clean%' OR lower(s.name) LIKE '%exterior%')
   );

CREATE TEMP TABLE _legacy_booking_contracts ON COMMIT DROP AS
SELECT cc.id AS contract_id
FROM customer_contracts cc
WHERE cc.source_system = 'booking'
  AND cc.source_id IN (SELECT id FROM _legacy_daily_bookings);

CREATE TEMP TABLE _legacy_pending ON COMMIT DROP AS
SELECT psa.id AS pending_id
FROM pending_service_assignments psa
WHERE psa.contract_registry_id IN (SELECT contract_id FROM _legacy_booking_contracts);

CREATE TEMP TABLE _duplicate_dcms_subs ON COMMIT DROP AS
SELECT s.id AS subscription_id
FROM dcms_subscriptions s
INNER JOIN (
  SELECT customer_id, vehicle_id, plan_id,
    (ARRAY_AGG(id ORDER BY visit_count DESC, id ASC))[1] AS keeper_id
  FROM (
    SELECT ds.id, ds.customer_id, ds.vehicle_id, ds.plan_id,
      (SELECT count(*)::int FROM dcms_visits v WHERE v.subscription_id = ds.id) AS visit_count
    FROM dcms_subscriptions ds
    WHERE ds.status = 'active'
  ) ranked
  GROUP BY customer_id, vehicle_id, plan_id
  HAVING count(*) > 1
) d ON d.customer_id = s.customer_id
   AND d.vehicle_id = s.vehicle_id
   AND d.plan_id = s.plan_id
WHERE s.id <> d.keeper_id;

CREATE TEMP TABLE _duplicate_dcms_contracts ON COMMIT DROP AS
SELECT cc.id AS contract_id
FROM customer_contracts cc
WHERE cc.source_system = 'dcms'
  AND cc.source_id IN (SELECT subscription_id FROM _duplicate_dcms_subs);

CREATE TEMP TABLE _duplicate_pending ON COMMIT DROP AS
SELECT psa.id AS pending_id
FROM pending_service_assignments psa
WHERE psa.contract_registry_id IN (SELECT contract_id FROM _duplicate_dcms_contracts);

-- Service execution children (legacy bookings)
DELETE FROM service_execution_photos
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.legacy_booking_id IN (SELECT id FROM _legacy_daily_bookings)
     OR se.contract_id IN (SELECT contract_id FROM _legacy_booking_contracts)
);

DELETE FROM service_execution_notes
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.legacy_booking_id IN (SELECT id FROM _legacy_daily_bookings)
     OR se.contract_id IN (SELECT contract_id FROM _legacy_booking_contracts)
);

DELETE FROM service_execution_checklist_items
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.legacy_booking_id IN (SELECT id FROM _legacy_daily_bookings)
     OR se.contract_id IN (SELECT contract_id FROM _legacy_booking_contracts)
);

DELETE FROM service_execution_location_logs
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.legacy_booking_id IN (SELECT id FROM _legacy_daily_bookings)
     OR se.contract_id IN (SELECT contract_id FROM _legacy_booking_contracts)
);

DELETE FROM service_executions
WHERE legacy_booking_id IN (SELECT id FROM _legacy_daily_bookings)
   OR contract_id IN (SELECT contract_id FROM _legacy_booking_contracts);

-- Unified assignment queue (legacy booking contracts)
DELETE FROM service_assignments
WHERE pending_assignment_id IN (SELECT pending_id FROM _legacy_pending);

DELETE FROM pending_service_assignments
WHERE id IN (SELECT pending_id FROM _legacy_pending);

UPDATE quotations SET contract_registry_id = NULL
WHERE contract_registry_id IN (SELECT contract_id FROM _legacy_booking_contracts);

UPDATE invoices SET contract_registry_id = NULL
WHERE contract_registry_id IN (SELECT contract_id FROM _legacy_booking_contracts);

DELETE FROM customer_contracts
WHERE id IN (SELECT contract_id FROM _legacy_booking_contracts);

-- Detach optional FKs before booking delete
UPDATE invoices SET booking_id = NULL
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

UPDATE quotations SET booking_id = NULL
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

UPDATE leads SET booking_id = NULL
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

UPDATE complaints SET booking_id = NULL
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

DELETE FROM booking_events
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

DELETE FROM staff_location_logs
WHERE booking_id IN (SELECT id FROM _legacy_daily_bookings);

DELETE FROM bookings
WHERE id IN (SELECT id FROM _legacy_daily_bookings);

-- Duplicate DCMS subscriptions (keep subscription with most visits, else lowest id)
DELETE FROM service_execution_photos
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.contract_id IN (SELECT contract_id FROM _duplicate_dcms_contracts)
);

DELETE FROM service_execution_notes
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.contract_id IN (SELECT contract_id FROM _duplicate_dcms_contracts)
);

DELETE FROM service_execution_checklist_items
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.contract_id IN (SELECT contract_id FROM _duplicate_dcms_contracts)
);

DELETE FROM service_execution_location_logs
WHERE execution_id IN (
  SELECT se.id FROM service_executions se
  WHERE se.contract_id IN (SELECT contract_id FROM _duplicate_dcms_contracts)
);

DELETE FROM service_executions
WHERE contract_id IN (SELECT contract_id FROM _duplicate_dcms_contracts);

DELETE FROM service_assignments
WHERE pending_assignment_id IN (SELECT pending_id FROM _duplicate_pending);

DELETE FROM pending_service_assignments
WHERE id IN (SELECT pending_id FROM _duplicate_pending);

UPDATE quotations SET contract_registry_id = NULL
WHERE contract_registry_id IN (SELECT contract_id FROM _duplicate_dcms_contracts);

UPDATE invoices SET contract_registry_id = NULL
WHERE contract_registry_id IN (SELECT contract_id FROM _duplicate_dcms_contracts);

DELETE FROM customer_contracts
WHERE id IN (SELECT contract_id FROM _duplicate_dcms_contracts);

-- dcms_staff_assignments, visits, etc. cascade from subscription delete
DELETE FROM dcms_subscriptions
WHERE id IN (SELECT subscription_id FROM _duplicate_dcms_subs);

COMMIT;
