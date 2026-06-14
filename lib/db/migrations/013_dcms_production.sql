-- Migration 013: DCMS production phase — missed logs, pause, feedback, events, subscription type

DO $$ BEGIN
  CREATE TYPE dcms_subscription_type AS ENUM (
    'daily_cleaning', 'solar_amc', 'housekeeping', 'driver_service', 'security_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dcms_pause_action AS ENUM (
    'pause', 'resume', 'pause_requested', 'pause_approved', 'pause_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dcms_pause_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dcms_notification_event_type AS ENUM (
    'visit_completed', 'visit_rejected', 'subscription_paused', 'subscription_resumed',
    'renewal_eligible', 'missed_visit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS subscription_type dcms_subscription_type NOT NULL DEFAULT 'daily_cleaning';
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS pause_start_date DATE;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS pause_end_date DATE;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS dcms_missed_visit_logs (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT 'no_cleaning_completed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, visit_date)
);

CREATE TABLE IF NOT EXISTS dcms_pause_history (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
  action dcms_pause_action NOT NULL,
  pause_start_date DATE,
  pause_end_date DATE,
  pause_reason TEXT,
  approval_status dcms_pause_approval_status,
  performed_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dcms_visit_feedback (
  id SERIAL PRIMARY KEY,
  visit_id INTEGER NOT NULL REFERENCES dcms_visits(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('yes', 'no')),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (visit_id)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id SERIAL PRIMARY KEY,
  event_type dcms_notification_event_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_event_logs (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'created',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dcms_missed_logs_date ON dcms_missed_visit_logs(visit_date);
CREATE INDEX IF NOT EXISTS idx_dcms_pause_history_sub ON dcms_pause_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dcms_pause_history_pending ON dcms_pause_history(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_customer ON dcms_visit_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_rating ON dcms_visit_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_dcms_subscriptions_type ON dcms_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_dcms_subscriptions_pause ON dcms_subscriptions(status) WHERE status = 'paused';
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_unprocessed ON notification_events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dcms_visits_sub_date ON dcms_visits(subscription_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_dcms_visits_staff_status ON dcms_visits(staff_id, status);
