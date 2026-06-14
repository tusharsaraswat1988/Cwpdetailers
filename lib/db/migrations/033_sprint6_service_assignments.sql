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

CREATE UNIQUE INDEX IF NOT EXISTS service_assignments_pending_unique ON service_assignments(pending_assignment_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON service_assignments(status);
CREATE INDEX IF NOT EXISTS idx_service_assignments_staff ON service_assignments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_location ON service_assignments(service_location_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_contract ON service_assignments(contract_id);
