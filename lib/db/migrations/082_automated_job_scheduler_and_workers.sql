-- ============================================================================
-- Migration 082: Automated Job Scheduler, Background Workers & Automation Reliability Framework
-- Phase 22: Universal Multi-City Background Job Execution & Automation Reliability
-- ============================================================================

-- 1. Enhance loyalty_ledger with consumed_points to support FIFO points expiry
ALTER TABLE loyalty_ledger ADD COLUMN IF NOT EXISTS consumed_points INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS loyalty_ledger_expiry_idx ON loyalty_ledger (expires_at, transaction_type, status);
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_expiry_idx ON loyalty_ledger (customer_id, expires_at);

-- 2. Core Scheduled Jobs Table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id SERIAL PRIMARY KEY,
  job_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'recurring_interval', -- 'one_time', 'recurring_interval', 'recurring_cron'
  cron_expression TEXT,
  interval_seconds INTEGER,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  payload JSONB DEFAULT '{}'::jsonb,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'failed', 'cancelled'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  last_run_status TEXT, -- 'success', 'failed', 'running'
  last_run_duration_ms INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  backoff_base_seconds INTEGER NOT NULL DEFAULT 30,
  backoff_max_seconds INTEGER NOT NULL DEFAULT 3600,
  idempotency_key TEXT UNIQUE,
  locked_by TEXT,
  locked_at TIMESTAMP,
  lease_expires_at TIMESTAMP,
  last_error TEXT,
  error_details JSONB,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  alert_threshold_failures INTEGER NOT NULL DEFAULT 3,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_jobs_poll_idx ON scheduled_jobs (status, next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS scheduled_jobs_type_idx ON scheduled_jobs (job_type);
CREATE INDEX IF NOT EXISTS scheduled_jobs_city_branch_idx ON scheduled_jobs (city_id, branch_id);
CREATE INDEX IF NOT EXISTS scheduled_jobs_lease_idx ON scheduled_jobs (status, lease_expires_at);

-- 3. Job Execution History Table
CREATE TABLE IF NOT EXISTS job_execution_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  job_key TEXT NOT NULL,
  job_type TEXT NOT NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- 'running', 'success', 'failed', 'cancelled', 'retrying'
  attempt INTEGER NOT NULL DEFAULT 1,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'retry'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  worker_id TEXT,
  sanitized_payload JSONB,
  result_summary JSONB,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_execution_history_job_idx ON job_execution_history (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS job_execution_history_status_idx ON job_execution_history (status);
CREATE INDEX IF NOT EXISTS job_execution_history_city_idx ON job_execution_history (city_id);
CREATE INDEX IF NOT EXISTS job_execution_history_type_idx ON job_execution_history (job_type);

-- 4. Worker Heartbeats Table
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  hostname TEXT,
  pid INTEGER,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'stopping', 'dead'
  concurrency INTEGER NOT NULL DEFAULT 5,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS worker_heartbeats_status_idx ON worker_heartbeats (status, last_heartbeat_at);
