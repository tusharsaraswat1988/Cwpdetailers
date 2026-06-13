-- Migration 015: Web Push subscriptions and delivery log

ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'vehicle_assigned';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'route_updated';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'daily_route_available';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'feedback_requested';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'fraud_alert';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'negative_feedback';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'renewal_opportunity';
ALTER TYPE dcms_notification_event_type ADD VALUE IF NOT EXISTS 'high_missed_visits';

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(role);

CREATE TABLE IF NOT EXISTS push_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  notification_event_id INTEGER REFERENCES notification_events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL DEFAULT 'web_push',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_notifications_event ON push_notifications(notification_event_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON push_notifications(status) WHERE status = 'pending';
