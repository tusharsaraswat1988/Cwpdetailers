-- Migration 016: Rich push delivery logs (who, when, why)

ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS recipient_role TEXT;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS recipient_name TEXT;

CREATE INDEX IF NOT EXISTS idx_push_notifications_event_type ON push_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_push_notifications_sent_at ON push_notifications(sent_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status_created ON push_notifications(status, created_at DESC);
