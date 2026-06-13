-- Migration 007: CWP Staff Ecosystem v1.0
-- Operational staff master profile, roles, documents, notes

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE staff_gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_employment_type AS ENUM ('salaried', 'per_job', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_petrol_model AS ENUM ('included', 'per_km');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_availability AS ENUM ('available', 'unavailable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_vehicle_type AS ENUM ('two_wheeler', 'three_wheeler', 'four_wheeler', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_skill_level AS ENUM ('trainee', 'basic', 'intermediate', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_document_type AS ENUM (
    'aadhaar', 'pan', 'driving_license', 'address_proof', 'bank_cancelled_cheque', 'bank_passbook',
    'staff_consent_form', 'vehicle_insurance', 'vehicle_registration', 'police_verification', 'medical_certificate', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE staff_verification_status ADD VALUE IF NOT EXISTS 'suspended';

-- ─── Extend staff table ──────────────────────────────────────────────────────

ALTER TABLE staff ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender staff_gender;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS city_id INTEGER;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reporting_manager_id INTEGER;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type staff_employment_type DEFAULT 'salaried';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS per_wash_rate NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS per_daily_cleaning_rate NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS per_solar_panel_rate NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS per_solar_amc_visit_rate NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS owns_vehicle BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS vehicle_type staff_vehicle_type;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS vehicle_registration_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS petrol_model staff_petrol_model;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rate_per_km NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS availability staff_availability NOT NULL DEFAULT 'available';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_off TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS working_hours_start TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS working_hours_end TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_house_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_street TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_area TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_landmark TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_city TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_state TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS current_pincode TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_house_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_street TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_area TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_landmark TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_city TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_state TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_pincode TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permanent_same_as_current BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_completion_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS identity_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS documents_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_complete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS staff_employee_code_unique ON staff(employee_code) WHERE employee_code IS NOT NULL;

UPDATE staff SET emergency_contact_name = guardian_name WHERE emergency_contact_name IS NULL AND guardian_name IS NOT NULL;
UPDATE staff SET emergency_contact_phone = guardian_phone WHERE emergency_contact_phone IS NULL AND guardian_phone IS NOT NULL;
UPDATE staff SET current_street = local_address WHERE current_street IS NULL AND local_address IS NOT NULL;
UPDATE staff SET permanent_street = permanent_address WHERE permanent_street IS NULL AND permanent_address IS NOT NULL;
UPDATE staff SET employee_code = 'CWP-STF-' || LPAD(id::text, 5, '0') WHERE employee_code IS NULL;

-- ─── Role master ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_role_master (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO staff_role_master (name, slug, sort_order) VALUES
  ('Daily Car Cleaner', 'daily_car_cleaner', 1),
  ('Car Washer', 'car_washer', 2),
  ('Solar Cleaner', 'solar_cleaner', 3),
  ('Interior Detailer', 'interior_detailer', 4),
  ('Coating Detailer', 'coating_detailer', 5)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS staff_role_assignments (
  id          SERIAL PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES staff_role_master(id) ON DELETE CASCADE,
  skill_level staff_skill_level NOT NULL DEFAULT 'basic',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_staff ON staff_role_assignments(staff_id);

-- ─── Documents ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_documents (
  id                       SERIAL PRIMARY KEY,
  staff_id                 INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  document_type            staff_document_type NOT NULL,
  document_number          TEXT,
  title                    TEXT,
  description              TEXT,
  file_url                 TEXT NOT NULL,
  content_type             TEXT,
  file_size_bytes          INTEGER,
  expiry_date              DATE,
  uploaded_by_user_id      INTEGER REFERENCES users(id),
  uploaded_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  is_current               BOOLEAN NOT NULL DEFAULT TRUE,
  replaced_by_document_id  INTEGER,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_current ON staff_documents(staff_id, document_type) WHERE is_current = TRUE;

-- ─── Notes ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_notes (
  id              SERIAL PRIMARY KEY,
  staff_id        INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  author_user_id  INTEGER REFERENCES users(id),
  author_name     TEXT,
  note            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notes_staff ON staff_notes(staff_id);

-- Migrate legacy URLs into documents
INSERT INTO staff_documents (staff_id, document_type, file_url, is_current, uploaded_at)
SELECT id, 'bank_passbook', bank_passbook_url, TRUE, NOW()
FROM staff
WHERE bank_passbook_url IS NOT NULL AND bank_passbook_url <> ''
  AND NOT EXISTS (
    SELECT 1 FROM staff_documents d
    WHERE d.staff_id = staff.id AND d.document_type = 'bank_passbook' AND d.is_current = TRUE
  );

INSERT INTO staff_documents (staff_id, document_type, file_url, is_current, uploaded_at)
SELECT id, 'staff_consent_form', agreement_url, TRUE, NOW()
FROM staff
WHERE agreement_url IS NOT NULL AND agreement_url <> ''
  AND NOT EXISTS (
    SELECT 1 FROM staff_documents d
    WHERE d.staff_id = staff.id AND d.document_type = 'staff_consent_form' AND d.is_current = TRUE
  );
