-- Migration 070: Customer Payment Integrity, Subscription Lifecycle & Multi-City Ledger Mapping

-- 1. Add pending_payment to dcms_subscription_status enum
ALTER TYPE dcms_subscription_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- 2. Extend payment_attempts with multi-city tenant and subscription identifiers
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS city_id INTEGER;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS subscription_id INTEGER;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS legal_entity_id INTEGER;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Indexes for fast payment reconciliation and tenant auditing
CREATE INDEX IF NOT EXISTS payment_attempts_subscription_id_idx ON payment_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS payment_attempts_city_id_idx ON payment_attempts(city_id);
CREATE INDEX IF NOT EXISTS payment_attempts_branch_id_idx ON payment_attempts(branch_id);
