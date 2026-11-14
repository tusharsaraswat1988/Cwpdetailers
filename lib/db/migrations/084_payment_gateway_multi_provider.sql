-- Migration 084: Payment Gateway Multi-Provider & Razorpay Integration
-- Idempotently extends payment_attempts to support multiple payment gateways (Razorpay, Cashfree)
-- Configurable via ACTIVE_PAYMENT_GATEWAY environment variable with zero downtime.

DO $$
BEGIN
  -- 1. Ensure payment_method enum exists and includes 'razorpay' and 'cashfree'
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

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'razorpay';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cashfree';

-- 2. Add gateway_provider column to payment_attempts
ALTER TABLE payment_attempts 
ADD COLUMN IF NOT EXISTS gateway_provider TEXT NOT NULL DEFAULT 'cashfree';

-- 3. Relax cf_order_id NOT NULL constraint for non-Cashfree orders
ALTER TABLE payment_attempts 
ALTER COLUMN cf_order_id DROP NOT NULL;

-- 4. Add generic and Razorpay tracking columns
ALTER TABLE payment_attempts 
ADD COLUMN IF NOT EXISTS rzp_order_id TEXT,
ADD COLUMN IF NOT EXISTS rzp_payment_id TEXT,
ADD COLUMN IF NOT EXISTS rzp_signature TEXT,
ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;

-- 5. Backfill gateway_order_id for existing Cashfree records
UPDATE payment_attempts 
SET gateway_order_id = cf_order_id 
WHERE gateway_order_id IS NULL AND cf_order_id IS NOT NULL;

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS payment_attempts_gateway_provider_idx ON payment_attempts(gateway_provider);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_rzp_order_id_idx ON payment_attempts(rzp_order_id) WHERE rzp_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_attempts_gateway_order_id_idx ON payment_attempts(gateway_order_id);
