-- Migration 075: Universal Multi-City Staff Compensation & Payout Ledger
-- PRD v4.0 (STAFF-018)

DO $$ BEGIN
  CREATE TYPE staff_payout_status AS ENUM (
    'draft',
    'approved',
    'disbursed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS staff_payout_ledgers (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  period_month TEXT NOT NULL,
  employment_type staff_employment_type NOT NULL DEFAULT 'salaried',

  base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  per_wash_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  per_daily_cleaning_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  per_solar_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rate_per_km NUMERIC(10, 2) NOT NULL DEFAULT 0,

  completed_washes INTEGER NOT NULL DEFAULT 0,
  completed_daily_cleans INTEGER NOT NULL DEFAULT 0,
  completed_solar_visits INTEGER NOT NULL DEFAULT 0,
  distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,

  wash_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  daily_cleaning_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  solar_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  distance_allowance NUMERIC(10, 2) NOT NULL DEFAULT 0,

  gross_payout NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  incentives NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_payout_due NUMERIC(10, 2) NOT NULL DEFAULT 0,

  status staff_payout_status NOT NULL DEFAULT 'draft',
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  disbursed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  disbursed_at TIMESTAMPTZ,
  payment_method TEXT,
  transaction_reference TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staff_payout_ledgers_staff_month_unique UNIQUE (staff_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_staff_payout_ledgers_period_month ON staff_payout_ledgers(period_month);
CREATE INDEX IF NOT EXISTS idx_staff_payout_ledgers_branch ON staff_payout_ledgers(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_payout_ledgers_city ON staff_payout_ledgers(city_id);
CREATE INDEX IF NOT EXISTS idx_staff_payout_ledgers_status ON staff_payout_ledgers(status);
