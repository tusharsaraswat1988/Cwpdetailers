-- Migration 076: Core Service Operations & Booking-to-Execution Consistency (Phase 16)
-- Adds assigned, in_progress, completed, missed to booking_status enum
-- Adds assigned_staff_id, started_at, completed_at to bookings
-- Adds partial indexes for duplicate job and assignment prevention

DO $$
BEGIN
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'assigned';
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress';
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'completed';
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'missed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_assigned_staff_idx ON bookings(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_pending_service_assignments_contract_pending ON pending_service_assignments (contract_registry_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_service_executions_active_task ON service_executions (service_assignment_id, task_type) WHERE status NOT IN ('completed', 'cancelled', 'missed', 'rescheduled');
