-- Migration 063: Cashfree Payment Gateway Integration
-- Idempotently extends payment_method enum and provisions payment_attempts table with indexes.

-- 1. Ensure payment_method enum exists and includes 'cashfree'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM (
      'cash',
      'upi',
      'card',
      'bank_transfer',
      'wallet',
      'razorpay',
      'cashfree'
    );
  END IF;
END $$;

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cashfree';

-- 2. Create payment_attempts table
CREATE TABLE IF NOT EXISTS payment_attempts (
  id SERIAL PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE,
  cf_order_id TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  invoice_id INTEGER REFERENCES invoices(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  cf_payment_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  cf_payment_id TEXT,
  payment_method TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  raw_webhook_payload JSONB,
  raw_verification_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS payment_attempts_customer_id_idx ON payment_attempts (customer_id);
CREATE INDEX IF NOT EXISTS payment_attempts_invoice_id_idx ON payment_attempts (invoice_id);
CREATE INDEX IF NOT EXISTS payment_attempts_status_idx ON payment_attempts (status);
CREATE INDEX IF NOT EXISTS payment_attempts_attempt_id_idx ON payment_attempts (attempt_id);
CREATE INDEX IF NOT EXISTS payment_attempts_cf_order_id_idx ON payment_attempts (cf_order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_idempotency_key_idx ON payment_attempts (idempotency_key);
