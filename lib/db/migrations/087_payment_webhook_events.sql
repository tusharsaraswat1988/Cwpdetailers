-- Migration 087: Payment Webhook Events Deduplication & Audit Log (PAY-006, PAY-007)

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  gateway_provider TEXT NOT NULL DEFAULT 'razorpay',
  event_type TEXT NOT NULL,
  order_id TEXT,
  payment_id TEXT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'processed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_event_id_idx ON payment_webhook_events (event_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_order_id_idx ON payment_webhook_events (order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_id_idx ON payment_webhook_events (payment_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_created_at_idx ON payment_webhook_events (created_at);
