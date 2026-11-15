-- Migration 088: Dynamic Operational Calendar, Working Hours & Variable-Duration Slot Engine
-- Requirements: OPS-006, OPS-007, OPS-008, CUX-019

-- 1. Dynamic Working Hours & Weekly Offs Table
CREATE TABLE IF NOT EXISTS operating_hours (
  id SERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'global', -- 'global', 'city', 'branch'
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TEXT NOT NULL DEFAULT '08:00',
  close_time TEXT NOT NULL DEFAULT '18:00',
  slot_step_minutes INTEGER NOT NULL DEFAULT 15,
  max_concurrent_slots INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operating_hours_scope_global 
  ON operating_hours (day_of_week) 
  WHERE scope_type = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uq_operating_hours_scope_city 
  ON operating_hours (city_id, day_of_week) 
  WHERE scope_type = 'city';

CREATE UNIQUE INDEX IF NOT EXISTS uq_operating_hours_scope_branch 
  ON operating_hours (branch_id, day_of_week) 
  WHERE scope_type = 'branch';

CREATE INDEX IF NOT EXISTS idx_operating_hours_lookup 
  ON operating_hours (scope_type, city_id, branch_id, day_of_week);

-- Seed default global operating hours (Mon-Sat 08:00-18:00, Sun off)
INSERT INTO operating_hours (scope_type, day_of_week, is_working_day, open_time, close_time, slot_step_minutes, max_concurrent_slots)
VALUES
  ('global', 0, FALSE, '08:00', '18:00', 15, 8), -- Sunday (Default Weekly Off)
  ('global', 1, TRUE,  '08:00', '18:00', 15, 8), -- Monday
  ('global', 2, TRUE,  '08:00', '18:00', 15, 8), -- Tuesday
  ('global', 3, TRUE,  '08:00', '18:00', 15, 8), -- Wednesday
  ('global', 4, TRUE,  '08:00', '18:00', 15, 8), -- Thursday
  ('global', 5, TRUE,  '08:00', '18:00', 15, 8), -- Friday
  ('global', 6, TRUE,  '08:00', '18:00', 15, 8)  -- Saturday
ON CONFLICT DO NOTHING;

-- 2. Operational Closures, Holidays & Calamity Declarations Table
CREATE TABLE IF NOT EXISTS operational_closures (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'govt_holiday', 'casual_holiday', 'natural_calamity',
    'staff_absenteeism', 'operational_issue', 'overbooking_freeze', 'other'
  )),
  customer_reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_full_day BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TEXT, -- e.g. '08:00' if partial day
  end_time TEXT,   -- e.g. '13:00' if partial day
  scope_type TEXT NOT NULL DEFAULT 'global', -- 'global', 'city', 'branch'
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  exempt_segments JSONB NOT NULL DEFAULT '["daily_cleaning"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_closures_dates ON operational_closures(start_date, end_date, is_active);
CREATE INDEX IF NOT EXISTS idx_operational_closures_scope ON operational_closures(scope_type, city_id, branch_id);
