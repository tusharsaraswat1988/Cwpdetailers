-- Phase 2 — split staff assignment by task type + substitute executions

DO $$ BEGIN
  CREATE TYPE service_task_type AS ENUM (
    'daily_cleaning',
    'car_wash',
    'solar_cleaning',
    'interior_detailing',
    'one_time_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE service_assignments
  ADD COLUMN IF NOT EXISTS task_type service_task_type NOT NULL DEFAULT 'one_time_service';

ALTER TABLE service_executions
  ADD COLUMN IF NOT EXISTS task_type service_task_type NOT NULL DEFAULT 'one_time_service';

ALTER TABLE service_executions
  ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE service_executions
  ADD COLUMN IF NOT EXISTS substitute_for_staff_id INTEGER;

-- Backfill task types from product line
UPDATE service_assignments SET task_type = 'daily_cleaning' WHERE product_line = 'daily_cleaning';
UPDATE service_assignments SET task_type = 'car_wash' WHERE product_line IN ('wash_package', 'monthly_wash');
UPDATE service_assignments SET task_type = 'solar_cleaning' WHERE product_line = 'solar_amc';
UPDATE service_assignments SET task_type = 'interior_detailing' WHERE product_line = 'detailing_plan';

UPDATE service_executions se
SET task_type = sa.task_type
FROM service_assignments sa
WHERE se.service_assignment_id = sa.id;

UPDATE service_executions se
SET task_type = 'daily_cleaning'
FROM customer_contracts cc
WHERE se.contract_id = cc.id AND cc.product_line = 'daily_cleaning' AND se.task_type = 'one_time_service';

DROP INDEX IF EXISTS service_assignments_pending_unique;
CREATE UNIQUE INDEX IF NOT EXISTS service_assignments_pending_task_unique
  ON service_assignments(pending_assignment_id, task_type);

CREATE INDEX IF NOT EXISTS idx_service_assignments_task_type ON service_assignments(task_type);
CREATE INDEX IF NOT EXISTS idx_service_executions_task_type ON service_executions(task_type);
