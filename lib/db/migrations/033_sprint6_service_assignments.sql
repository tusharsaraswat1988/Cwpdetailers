-- Sprint 6 — unified service assignments (manual assign only)

DO $$ BEGIN
  CREATE TYPE service_assignment_status AS ENUM ('pending', 'assigned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_assignments (
  id serial PRIMARY KEY,
  pending_assignment_id integer NOT NULL REFERENCES pending_service_assignments(id),
  customer_id integer NOT NULL,
  service_location_id integer,
  asset_id integer,
  contract_id integer NOT NULL REFERENCES customer_contracts(id),
  service_id integer,
  assigned_staff_id integer NOT NULL,
  assigned_at timestamp NOT NULL DEFAULT now(),
  status service_assignment_status NOT NULL DEFAULT 'assigned',
  service_label text,
  product_line text,
  company_id integer,
  franchisee_id integer,
  branch_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Keep one row per pending_assignment_id before adding the unique index (legacy duplicates).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_assignments
    GROUP BY pending_assignment_id
    HAVING COUNT(*) > 1
  ) THEN
    IF to_regclass('public.service_executions') IS NOT NULL THEN
      WITH ranked AS (
        SELECT id,
               FIRST_VALUE(id) OVER (
                 PARTITION BY pending_assignment_id
                 ORDER BY id DESC
               ) AS keep_id
        FROM service_assignments
      ),
      dupes AS (
        SELECT id AS old_id, keep_id
        FROM ranked
        WHERE id <> keep_id
      )
      UPDATE service_executions se
      SET service_assignment_id = d.keep_id
      FROM dupes d
      WHERE se.service_assignment_id = d.old_id;
    END IF;

    DELETE FROM service_assignments sa
    WHERE sa.id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY pending_assignment_id
                 ORDER BY id DESC
               ) AS rn
        FROM service_assignments
      ) ranked
      WHERE rn > 1
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS service_assignments_pending_task_unique
  ON service_assignments(pending_assignment_id, task_type);
-- NOTE: do not recreate service_assignments_pending_unique (one-row-per-pending).
-- Split task types (daily_cleaning + car_wash) need multiple rows per pending job.
DROP INDEX IF EXISTS service_assignments_pending_unique;
CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON service_assignments(status);
CREATE INDEX IF NOT EXISTS idx_service_assignments_staff ON service_assignments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_location ON service_assignments(service_location_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_contract ON service_assignments(contract_id);
