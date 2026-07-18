-- Phase 5.4: Field Execution — enum extensions + timeline + signature columns
-- NOTE: Do not UPDATE rows to new enum values in this same file (PG requires commit first).

DO $$ BEGIN
  ALTER TYPE service_execution_status ADD VALUE IF NOT EXISTS 'ready_for_execution';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE service_execution_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE service_execution_status ADD VALUE IF NOT EXISTS 'resumed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE execution_timeline_event_type AS ENUM (
    'EXECUTION_READY',
    'EXECUTION_STARTED',
    'EXECUTION_PAUSED',
    'EXECUTION_RESUMED',
    'EXECUTION_COMPLETED',
    'EXECUTION_CANCELLED',
    'BEFORE_PHOTOS_UPLOADED',
    'AFTER_PHOTOS_UPLOADED',
    'CHECKLIST_UPDATED',
    'CHECKLIST_COMPLETED',
    'NOTE_ADDED',
    'SIGNATURE_CAPTURED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE service_executions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_signed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS execution_timeline (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER NOT NULL,
  event_type execution_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_id INTEGER,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_timeline_execution ON execution_timeline (execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_timeline_event ON execution_timeline (event_type);
