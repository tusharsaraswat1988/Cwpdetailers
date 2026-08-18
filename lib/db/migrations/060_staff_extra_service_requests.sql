-- Staff-initiated extra Car Wash with customer approval + request-bound OTP.
-- Phase 2: extra_car_wash only. Pattern is reusable for later service kinds.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extra_service_request_type') THEN
    CREATE TYPE extra_service_request_type AS ENUM ('extra_car_wash');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extra_service_request_status') THEN
    CREATE TYPE extra_service_request_status AS ENUM (
      'pending_customer_approval',
      'customer_approved',
      'otp_verified',
      'rejected',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extra_service_commercial_source') THEN
    CREATE TYPE extra_service_commercial_source AS ENUM ('DCC_INCLUDED', 'PAID_EXTRA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS extra_service_requests (
  id serial PRIMARY KEY,
  request_type extra_service_request_type NOT NULL DEFAULT 'extra_car_wash',
  status extra_service_request_status NOT NULL DEFAULT 'pending_customer_approval',
  customer_id integer NOT NULL,
  staff_id integer NOT NULL,
  vehicle_id integer NOT NULL,
  service_id integer NOT NULL,
  addon_ids json NOT NULL DEFAULT '[]',
  commercial_source extra_service_commercial_source NOT NULL,
  dcms_subscription_id integer,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  request_fingerprint text NOT NULL,
  consent_snapshot json NOT NULL,
  otp_code_hash text,
  otp_code text,
  otp_expires_at timestamp,
  otp_attempt_count integer NOT NULL DEFAULT 0,
  otp_verified_at timestamp,
  otp_verified_by_staff_id integer,
  customer_approved_at timestamp,
  customer_rejected_at timestamp,
  entitlement_consumed_at timestamp,
  booking_id integer,
  execution_id integer,
  company_id integer,
  franchisee_id integer,
  branch_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extra_svc_req_customer_status_idx
  ON extra_service_requests (customer_id, status);

CREATE INDEX IF NOT EXISTS extra_svc_req_staff_status_idx
  ON extra_service_requests (staff_id, status);

CREATE INDEX IF NOT EXISTS extra_svc_req_execution_idx
  ON extra_service_requests (execution_id);

CREATE UNIQUE INDEX IF NOT EXISTS extra_svc_req_booking_unique
  ON extra_service_requests (booking_id)
  WHERE booking_id IS NOT NULL;

-- One identical open proposal per staff + customer (backend idempotency).
CREATE UNIQUE INDEX IF NOT EXISTS extra_svc_req_open_identical
  ON extra_service_requests (staff_id, customer_id, request_fingerprint)
  WHERE status IN ('pending_customer_approval', 'customer_approved');
