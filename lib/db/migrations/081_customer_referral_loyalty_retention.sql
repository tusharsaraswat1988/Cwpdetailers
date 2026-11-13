-- ============================================================================
-- Migration 081: Customer Referral, Loyalty Rewards & Retention Automation Engine
-- Phase 21: Universal Multi-City Customer Loyalty, Referrals & Retention
-- ============================================================================

-- 1. Enhance customers table with referral_code and loyalty_points_balance
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS customers_referral_code_idx ON customers (referral_code);

-- 2. Customer Referrals Table
CREATE TABLE IF NOT EXISTS customer_referrals (
  id SERIAL PRIMARY KEY,
  referrer_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  referee_customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE RESTRICT,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rejected', 'flagged_fraud'
  attributed_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  booking_completed_at TIMESTAMP,
  referrer_reward_points INTEGER NOT NULL DEFAULT 0,
  referee_reward_points INTEGER NOT NULL DEFAULT 0,
  reward_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'rewarded', 'forfeited', 'reversed'
  reward_issued_at TIMESTAMP,
  fraud_flag_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_referrals_referrer_idx ON customer_referrals (referrer_customer_id);
CREATE INDEX IF NOT EXISTS customer_referrals_referee_idx ON customer_referrals (referee_customer_id);
CREATE INDEX IF NOT EXISTS customer_referrals_code_idx ON customer_referrals (referral_code);
CREATE INDEX IF NOT EXISTS customer_referrals_status_idx ON customer_referrals (status);

-- 3. Loyalty Programs Configuration Table
CREATE TABLE IF NOT EXISTS loyalty_programs_config (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  points_per_100_spent INTEGER NOT NULL DEFAULT 5,
  first_booking_bonus_points INTEGER NOT NULL DEFAULT 50,
  referrer_reward_points INTEGER NOT NULL DEFAULT 200,
  referee_reward_points INTEGER NOT NULL DEFAULT 100,
  redemption_rupees_per_point NUMERIC(10, 2) NOT NULL DEFAULT '1.00',
  min_redemption_points INTEGER NOT NULL DEFAULT 50,
  max_redemption_points_per_order INTEGER NOT NULL DEFAULT 500,
  max_redemption_percentage_order INTEGER NOT NULL DEFAULT 50,
  points_validity_days INTEGER NOT NULL DEFAULT 180,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_config_city_idx ON loyalty_programs_config (city_id);
CREATE INDEX IF NOT EXISTS loyalty_config_branch_idx ON loyalty_programs_config (branch_id);

-- 4. Loyalty Points Ledger (Immutable Financial History)
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL, -- 'credit', 'debit', 'reversal', 'expiry'
  points INTEGER NOT NULL,
  rupee_equivalent NUMERIC(10, 2) NOT NULL DEFAULT '0.00',
  balance_after INTEGER NOT NULL,
  source_reference TEXT NOT NULL, -- 'booking_completion', 'first_booking_bonus', 'referral_reward', 'referral_welcome', 'checkout_redemption', 'admin_adjustment', 'retention_campaign', 'expiry', 'refund_reversal'
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  referral_id INTEGER REFERENCES customer_referrals(id) ON DELETE SET NULL,
  reversal_of_id INTEGER REFERENCES loyalty_ledger(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'reversed', 'expired'
  idempotency_key TEXT UNIQUE,
  expires_at TIMESTAMP,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON loyalty_ledger (customer_id);
CREATE INDEX IF NOT EXISTS loyalty_ledger_booking_idx ON loyalty_ledger (booking_id);
CREATE INDEX IF NOT EXISTS loyalty_ledger_type_idx ON loyalty_ledger (transaction_type);
CREATE INDEX IF NOT EXISTS loyalty_ledger_created_at_idx ON loyalty_ledger (created_at DESC);

-- 5. Customer Retention & Re-engagement Automations
CREATE TABLE IF NOT EXISTS retention_automations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'registered_no_booking', 'inactive_customer', 'subscription_expiring', 'booking_followup', 'points_expiring'
  delay_days INTEGER NOT NULL DEFAULT 7,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  coupon_code TEXT,
  reward_points INTEGER NOT NULL DEFAULT 0,
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  frequency_cap_days INTEGER NOT NULL DEFAULT 30,
  channel TEXT NOT NULL DEFAULT 'in_app', -- 'in_app', 'sms', 'whatsapp'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_evaluated_count INTEGER NOT NULL DEFAULT 0,
  total_triggered_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS retention_automations_trigger_idx ON retention_automations (trigger_type);
CREATE INDEX IF NOT EXISTS retention_automations_active_idx ON retention_automations (is_active);

-- 6. Retention Automation Execution Logs
CREATE TABLE IF NOT EXISTS retention_execution_logs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES retention_automations(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- 'sent', 'skipped_frequency_cap', 'skipped_consent', 'failed'
  message_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS retention_logs_automation_idx ON retention_execution_logs (automation_id);
CREATE INDEX IF NOT EXISTS retention_logs_customer_idx ON retention_execution_logs (customer_id);
CREATE INDEX IF NOT EXISTS retention_logs_created_at_idx ON retention_execution_logs (created_at DESC);

-- 7. Seed Default Global Loyalty Program Configuration
INSERT INTO loyalty_programs_config (
  name, city_id, branch_id, points_per_100_spent, first_booking_bonus_points,
  referrer_reward_points, referee_reward_points, redemption_rupees_per_point,
  min_redemption_points, max_redemption_points_per_order, max_redemption_percentage_order,
  points_validity_days, is_active
) VALUES (
  'CWP Universal Loyalty Rewards', NULL, NULL, 5, 50, 200, 100, 1.00, 50, 500, 50, 180, TRUE
) ON CONFLICT DO NOTHING;

-- 8. Seed Default Retention Automations
INSERT INTO retention_automations (
  name, trigger_type, delay_days, city_id, branch_id, service_id, coupon_code,
  reward_points, title_template, message_template, frequency_cap_days, channel, is_active
) VALUES
  ('Welcome Nudge - No Booking', 'registered_no_booking', 3, NULL, NULL, NULL, 'WELCOME50', 50, 'Ready for your first shine?', 'Hi {customerName}, welcome to CWP Detailers! Use code {couponCode} for ₹50 off your first doorstep wash.', 30, 'in_app', TRUE),
  ('We Miss You - 30 Day Inactive', 'inactive_customer', 30, NULL, NULL, NULL, 'RECONNECT10', 25, 'Give your car the care it deserves', 'Hi {customerName}, it has been over a month since your last vehicle service. Book today and earn 25 bonus points!', 30, 'in_app', TRUE),
  ('Subscription Renewal Reminder', 'subscription_expiring', 3, NULL, NULL, NULL, NULL, 0, 'Keep your daily shine uninterrupted', 'Hi {customerName}, your daily cleaning plan has only a few cleanings left. Renew today to keep your morning slot guaranteed.', 15, 'in_app', TRUE),
  ('Points Expiry Alert', 'points_expiring', 7, NULL, NULL, NULL, NULL, 0, 'Your loyalty points are expiring soon', 'Hi {customerName}, you have {points} loyalty points expiring in 7 days! Redeem them on your next wash to save.', 30, 'in_app', TRUE)
ON CONFLICT DO NOTHING;
