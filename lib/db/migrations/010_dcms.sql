-- Migration 010: Daily Cleaning Management System (DCMS)

DO $$ BEGIN
  CREATE TYPE dcms_subscription_status AS ENUM ('active', 'paused', 'completed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dcms_visit_type AS ENUM ('cleaning', 'wash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dcms_visit_status AS ENUM ('completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dcms_plans (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC(10,2) NOT NULL,
  included_cleanings  INTEGER NOT NULL,
  included_washes     INTEGER NOT NULL DEFAULT 0,
  weekly_offs         INTEGER NOT NULL DEFAULT 1,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  company_id          INTEGER,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dcms_subscriptions (
  id                    SERIAL PRIMARY KEY,
  customer_id           INTEGER NOT NULL,
  vehicle_id            INTEGER NOT NULL,
  plan_id               INTEGER NOT NULL REFERENCES dcms_plans(id),
  start_date            DATE NOT NULL,
  allocated_cleanings   INTEGER NOT NULL,
  allocated_washes      INTEGER NOT NULL DEFAULT 0,
  used_cleanings        INTEGER NOT NULL DEFAULT 0,
  used_washes           INTEGER NOT NULL DEFAULT 0,
  remaining_cleanings   INTEGER NOT NULL,
  remaining_washes      INTEGER NOT NULL DEFAULT 0,
  status                dcms_subscription_status NOT NULL DEFAULT 'active',
  company_id            INTEGER,
  franchisee_id         INTEGER,
  branch_id             INTEGER,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dcms_subscriptions_vehicle_idx ON dcms_subscriptions (vehicle_id);
CREATE INDEX IF NOT EXISTS dcms_subscriptions_customer_idx ON dcms_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS dcms_subscriptions_status_idx ON dcms_subscriptions (status);

CREATE TABLE IF NOT EXISTS dcms_subscription_locations (
  id               SERIAL PRIMARY KEY,
  subscription_id  INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  radius_meters    INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS dcms_subscription_locations_sub_idx
  ON dcms_subscription_locations (subscription_id);

CREATE TABLE IF NOT EXISTS dcms_staff_assignments (
  id               SERIAL PRIMARY KEY,
  subscription_id  INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
  staff_id         INTEGER NOT NULL,
  assigned_by      INTEGER,
  assigned_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS dcms_staff_assignments_staff_idx ON dcms_staff_assignments (staff_id, is_active);
CREATE INDEX IF NOT EXISTS dcms_staff_assignments_sub_idx ON dcms_staff_assignments (subscription_id);

CREATE TABLE IF NOT EXISTS dcms_visits (
  id               SERIAL PRIMARY KEY,
  subscription_id  INTEGER NOT NULL REFERENCES dcms_subscriptions(id),
  vehicle_id       INTEGER NOT NULL,
  staff_id         INTEGER NOT NULL,
  visit_type       dcms_visit_type NOT NULL DEFAULT 'cleaning',
  photo_url        TEXT,
  visit_time       TIMESTAMP NOT NULL DEFAULT NOW(),
  status           dcms_visit_status NOT NULL DEFAULT 'completed',
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  accuracy         DOUBLE PRECISION,
  rejection_reason TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dcms_visits_subscription_idx ON dcms_visits (subscription_id);
CREATE INDEX IF NOT EXISTS dcms_visits_staff_idx ON dcms_visits (staff_id);
CREATE INDEX IF NOT EXISTS dcms_visits_status_idx ON dcms_visits (status);
CREATE INDEX IF NOT EXISTS dcms_visits_visit_time_idx ON dcms_visits (visit_time);

CREATE TABLE IF NOT EXISTS dcms_activity_logs (
  id               SERIAL PRIMARY KEY,
  subscription_id  INTEGER,
  action           TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        INTEGER,
  performed_by     INTEGER,
  metadata_json    JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dcms_activity_logs_sub_idx ON dcms_activity_logs (subscription_id);
CREATE INDEX IF NOT EXISTS dcms_activity_logs_action_idx ON dcms_activity_logs (action);
