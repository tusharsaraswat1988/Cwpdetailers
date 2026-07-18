-- Phase 5.3: Staff Assignment — timeline + status extensions

DO $$ BEGIN
  CREATE TYPE assignment_timeline_event_type AS ENUM (
    'ASSIGNMENT_CREATED',
    'ASSIGNMENT_CHANGED',
    'ASSIGNMENT_REMOVED',
    'READY_FOR_EXECUTION',
    'NOTE_ADDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend service_assignment_status for Phase 5.3 lifecycle
DO $$ BEGIN
  ALTER TYPE service_assignment_status ADD VALUE IF NOT EXISTS 'ready_for_execution';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE service_assignment_status ADD VALUE IF NOT EXISTS 'removed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE service_assignments
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS booking_id INTEGER;

CREATE TABLE IF NOT EXISTS assignment_timeline (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL,
  pending_assignment_id INTEGER,
  event_type assignment_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  from_staff_id INTEGER,
  to_staff_id INTEGER,
  actor_id INTEGER,
  actor_name TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_timeline_assignment ON assignment_timeline (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_timeline_pending ON assignment_timeline (pending_assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_timeline_event ON assignment_timeline (event_type);
CREATE INDEX IF NOT EXISTS idx_service_assignments_booking ON service_assignments (booking_id);

-- Backfill booking_id from pending source when source_system = booking
UPDATE service_assignments sa
SET booking_id = psa.source_id
FROM pending_service_assignments psa
WHERE sa.pending_assignment_id = psa.id
  AND psa.source_system = 'booking'
  AND sa.booking_id IS NULL;
