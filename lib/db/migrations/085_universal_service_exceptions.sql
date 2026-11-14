-- Phase 25: Universal Service Exception Management (DB-003, ADMIN-012)
CREATE TABLE IF NOT EXISTS service_exceptions (
  id SERIAL PRIMARY KEY,
  exception_code TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  execution_id INTEGER REFERENCES service_executions(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES dcms_subscriptions(id) ON DELETE SET NULL,
  complaint_id INTEGER REFERENCES complaints(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  dedupe_key TEXT,
  evidence_url TEXT,
  acknowledged_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolution_action TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_exceptions_code ON service_exceptions (exception_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_exceptions_dedupe ON service_exceptions (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_status ON service_exceptions (status);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_category ON service_exceptions (category);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_city_branch ON service_exceptions (city_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_booking ON service_exceptions (booking_id);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_customer ON service_exceptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_staff ON service_exceptions (staff_id);
CREATE INDEX IF NOT EXISTS idx_service_exceptions_created ON service_exceptions (created_at);
