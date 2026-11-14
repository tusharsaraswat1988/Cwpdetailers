-- Phase 26: Financial Command Center, Payment Ledger, Refunds & Reconciliation (PAY-007, PAY-008)

-- 1. Create payment_refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
  id SERIAL PRIMARY KEY,
  refund_id TEXT NOT NULL UNIQUE,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  attempt_id INTEGER REFERENCES payment_attempts(id) ON DELETE SET NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  gateway_provider TEXT NOT NULL DEFAULT 'cashfree',
  cf_refund_id TEXT,
  rzp_refund_id TEXT,
  gateway_refund_id TEXT,
  raw_gateway_payload JSONB,
  initiated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_refund_id_idx ON payment_refunds (refund_id);
CREATE INDEX IF NOT EXISTS payment_refunds_payment_id_idx ON payment_refunds (payment_id);
CREATE INDEX IF NOT EXISTS payment_refunds_attempt_id_idx ON payment_refunds (attempt_id);
CREATE INDEX IF NOT EXISTS payment_refunds_customer_id_idx ON payment_refunds (customer_id);
CREATE INDEX IF NOT EXISTS payment_refunds_booking_id_idx ON payment_refunds (booking_id);
CREATE INDEX IF NOT EXISTS payment_refunds_invoice_id_idx ON payment_refunds (invoice_id);
CREATE INDEX IF NOT EXISTS payment_refunds_status_idx ON payment_refunds (status);
CREATE INDEX IF NOT EXISTS payment_refunds_created_at_idx ON payment_refunds (created_at);
CREATE INDEX IF NOT EXISTS payment_refunds_gateway_provider_idx ON payment_refunds (gateway_provider);

-- 2. Alter payment_attempts table with booking link, refund status, and reconciliation columns
ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'unreconciled',
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

CREATE INDEX IF NOT EXISTS payment_attempts_booking_id_idx ON payment_attempts (booking_id);
CREATE INDEX IF NOT EXISTS payment_attempts_refund_status_idx ON payment_attempts (refund_status);
CREATE INDEX IF NOT EXISTS payment_attempts_reconciliation_status_idx ON payment_attempts (reconciliation_status);

-- 3. Alter payments table with booking link, refund status, and reconciliation columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'unreconciled',
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_refund_status_idx ON payments (refund_status);
CREATE INDEX IF NOT EXISTS payments_reconciliation_status_idx ON payments (reconciliation_status);
