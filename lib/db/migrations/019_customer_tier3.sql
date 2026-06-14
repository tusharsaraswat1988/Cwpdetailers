-- Tier 3: B2B billing + referral linking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_customer_id INTEGER REFERENCES customers(id);

COMMENT ON COLUMN customers.billing_name IS 'Legal / invoice billing name for B2B customers';
COMMENT ON COLUMN customers.referred_by_customer_id IS 'Customer who referred this account';

CREATE INDEX IF NOT EXISTS customers_referred_by_idx ON customers(referred_by_customer_id);
