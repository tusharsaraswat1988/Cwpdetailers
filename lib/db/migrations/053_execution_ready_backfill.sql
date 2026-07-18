-- Phase 5.4 follow-up: backfill legacy scheduled → ready_for_execution
-- Must run in a separate migration after 052 enum values are committed.

UPDATE service_executions
SET status = 'ready_for_execution', updated_at = NOW()
WHERE status = 'scheduled';
