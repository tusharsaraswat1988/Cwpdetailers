-- Phase 5.5: Job Orchestration — ops lifecycle on service_executions (Job = execution)
-- ADR: No separate Job Card entity. Canonical Job ID = service_executions.id.

DO $$ BEGIN
  CREATE TYPE job_ops_status AS ENUM (
    'in_field',
    'pending_quality_review',
    'reopened',
    'approved',
    'ready_for_billing',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_orchestration_timeline_event_type AS ENUM (
    'JOB_ENTERED_QUALITY_REVIEW',
    'JOB_REOPENED',
    'JOB_ESCALATED',
    'JOB_DE_ESCALATED',
    'JOB_PRIORITY_CHANGED',
    'JOB_APPROVED',
    'JOB_READY_FOR_BILLING',
    'JOB_CANCELLED',
    'JOB_OWNERSHIP_CHANGED',
    'JOB_DEPENDENCY_SET',
    'JOB_DEPENDENCY_CLEARED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE service_executions
  ADD COLUMN IF NOT EXISTS ops_status job_ops_status NOT NULL DEFAULT 'in_field',
  ADD COLUMN IF NOT EXISTS priority job_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS depends_on_execution_id INTEGER,
  ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_by INTEGER,
  ADD COLUMN IF NOT EXISTS ops_owner_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS quality_review_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS ready_for_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
  ADD COLUMN IF NOT EXISTS ops_cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ops_cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_service_executions_ops_status ON service_executions (ops_status);
CREATE INDEX IF NOT EXISTS idx_service_executions_priority ON service_executions (priority);
CREATE INDEX IF NOT EXISTS idx_service_executions_escalated ON service_executions (is_escalated);
CREATE INDEX IF NOT EXISTS idx_service_executions_depends_on ON service_executions (depends_on_execution_id);

CREATE TABLE IF NOT EXISTS job_orchestration_timeline (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER NOT NULL,
  event_type job_orchestration_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_id INTEGER,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_orch_timeline_execution ON job_orchestration_timeline (execution_id);
CREATE INDEX IF NOT EXISTS idx_job_orch_timeline_event ON job_orchestration_timeline (event_type);

-- Completed field work that never entered ops review → pending quality review
UPDATE service_executions
SET ops_status = 'pending_quality_review',
    quality_review_started_at = COALESCE(quality_review_started_at, completed_at, NOW())
WHERE status = 'completed'
  AND ops_status = 'in_field';

UPDATE service_executions
SET ops_status = 'cancelled',
    ops_cancelled_at = COALESCE(ops_cancelled_at, updated_at, NOW()),
    ops_cancel_reason = COALESCE(ops_cancel_reason, cancellation_reason)
WHERE status = 'cancelled'
  AND ops_status = 'in_field';
