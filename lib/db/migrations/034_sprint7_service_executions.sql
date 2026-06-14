-- Sprint 7 — service execution domain (separate from service_assignments)

DO $$ BEGIN
  CREATE TYPE service_execution_status AS ENUM (
    'scheduled', 'started', 'completed', 'missed', 'cancelled', 'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_execution_photo_kind AS ENUM ('before', 'after', 'proof', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_execution_note_kind AS ENUM ('technician', 'customer', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_execution_location_event AS ENUM ('check_in', 'check_out', 'gps_ping');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_executions (
  id serial PRIMARY KEY,
  service_assignment_id integer REFERENCES service_assignments(id),
  contract_id integer NOT NULL REFERENCES customer_contracts(id),
  customer_id integer NOT NULL,
  service_location_id integer,
  asset_id integer,
  assigned_staff_id integer NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time text,
  status service_execution_status NOT NULL DEFAULT 'scheduled',
  started_at timestamp,
  completed_at timestamp,
  cancellation_reason text,
  rescheduled_from_id integer REFERENCES service_executions(id),
  legacy_booking_id integer,
  legacy_dcms_visit_id integer,
  company_id integer,
  franchisee_id integer,
  branch_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_executions_assignment ON service_executions(service_assignment_id);
CREATE INDEX IF NOT EXISTS idx_service_executions_staff_date ON service_executions(assigned_staff_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_service_executions_status ON service_executions(status);
CREATE INDEX IF NOT EXISTS idx_service_executions_customer ON service_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_executions_scheduled_date ON service_executions(scheduled_date);

CREATE TABLE IF NOT EXISTS service_execution_photos (
  id serial PRIMARY KEY,
  execution_id integer NOT NULL REFERENCES service_executions(id) ON DELETE CASCADE,
  kind service_execution_photo_kind NOT NULL DEFAULT 'proof',
  url text NOT NULL,
  caption text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_execution_photos_execution ON service_execution_photos(execution_id);

CREATE TABLE IF NOT EXISTS service_execution_notes (
  id serial PRIMARY KEY,
  execution_id integer NOT NULL REFERENCES service_executions(id) ON DELETE CASCADE,
  kind service_execution_note_kind NOT NULL DEFAULT 'technician',
  body text NOT NULL,
  author_staff_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_execution_notes_execution ON service_execution_notes(execution_id);

CREATE TABLE IF NOT EXISTS service_execution_checklist_items (
  id serial PRIMARY KEY,
  execution_id integer NOT NULL REFERENCES service_executions(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_execution_checklist_execution ON service_execution_checklist_items(execution_id);

CREATE TABLE IF NOT EXISTS service_execution_location_logs (
  id serial PRIMARY KEY,
  execution_id integer NOT NULL REFERENCES service_executions(id) ON DELETE CASCADE,
  event_type service_execution_location_event NOT NULL DEFAULT 'gps_ping',
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  recorded_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_execution_location_execution ON service_execution_location_logs(execution_id);
