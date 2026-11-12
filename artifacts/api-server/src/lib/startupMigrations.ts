import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Ensures critical schema migrations are applied on server startup.
 * 100% idempotent and non-destructive.
 */
export async function ensureStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Verifying and ensuring database schema migrations...");

    // 1. Payment method enum & payment_attempts (Migration 063)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
          CREATE TYPE payment_method AS ENUM (
            'cash', 'upi', 'card', 'bank_transfer', 'wallet', 'razorpay', 'cashfree'
          );
        END IF;
      END $$;
      ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cashfree';

      CREATE TABLE IF NOT EXISTS payment_attempts (
        id SERIAL PRIMARY KEY,
        attempt_id TEXT NOT NULL UNIQUE,
        cf_order_id TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        invoice_id INTEGER REFERENCES invoices(id),
        amount NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        cf_payment_session_id TEXT,
        status TEXT NOT NULL DEFAULT 'initiated',
        cf_payment_id TEXT,
        payment_method TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        raw_webhook_payload JSONB,
        raw_verification_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS payment_attempts_customer_id_idx ON payment_attempts (customer_id);
      CREATE INDEX IF NOT EXISTS payment_attempts_invoice_id_idx ON payment_attempts (invoice_id);
      CREATE INDEX IF NOT EXISTS payment_attempts_status_idx ON payment_attempts (status);
      CREATE INDEX IF NOT EXISTS payment_attempts_cf_order_id_idx ON payment_attempts (cf_order_id);
    `);

    // 2. Multi-City & Societies (Migration 064)
    await client.query(`
      CREATE TABLE IF NOT EXISTS residential_societies (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
        service_area_id INTEGER REFERENCES service_areas(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        address TEXT NOT NULL,
        pincode TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        gate_security_notes TEXT,
        total_towers INTEGER DEFAULT 0,
        total_flats INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        franchisee_id INTEGER REFERENCES franchisees(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_societies_city ON residential_societies(city_id);

      CREATE TABLE IF NOT EXISTS society_towers (
        id SERIAL PRIMARY KEY,
        society_id INTEGER NOT NULL REFERENCES residential_societies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT,
        total_floors INTEGER,
        total_flats INTEGER,
        parking_levels TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_society_towers_society ON society_towers(society_id);

      ALTER TABLE branches ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_location_id INTEGER REFERENCES service_locations(id) ON DELETE SET NULL;

      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tower_id INTEGER REFERENCES society_towers(id) ON DELETE SET NULL;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS flat_number TEXT;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_level TEXT;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_bay TEXT;
      ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS parking_notes TEXT;

      ALTER TABLE dcms_plans ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS tower_id INTEGER REFERENCES society_towers(id) ON DELETE SET NULL;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS parking_bay TEXT;
    `);

    // 3. Legal Entities & Invoice Sequences (Migration 065)
    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_entities (
        id serial PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        trade_name text,
        entity_type text NOT NULL DEFAULT 'company',
        gstin text,
        pan_number text,
        state_code text NOT NULL DEFAULT '09',
        state_name text NOT NULL DEFAULT 'Uttar Pradesh',
        address_line1 text NOT NULL,
        address_line2 text,
        city text NOT NULL,
        pincode text NOT NULL,
        phone text,
        email text,
        website text,
        bank_account_name text,
        bank_name text,
        bank_account_number text,
        bank_ifsc text,
        bank_branch text,
        upi_id text,
        default_sac text DEFAULT '998533',
        invoice_prefix text NOT NULL DEFAULT 'CWP',
        is_active boolean NOT NULL DEFAULT true,
        is_default boolean NOT NULL DEFAULT false,
        terms_and_conditions json,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS invoice_number_sequences (
        id serial PRIMARY KEY,
        legal_entity_id integer NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
        document_type text NOT NULL DEFAULT 'tax_invoice',
        financial_year text NOT NULL,
        current_value integer NOT NULL DEFAULT 0,
        prefix text NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_seq_entity_type_fy 
        ON invoice_number_sequences (legal_entity_id, document_type, financial_year);

      ALTER TABLE branches ADD COLUMN IF NOT EXISTS legal_entity_id integer REFERENCES legal_entities(id);
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS legal_entity_id integer REFERENCES legal_entities(id);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legal_entity_id integer REFERENCES legal_entities(id);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legal_entity_snapshot json;
    `);

    // 4. Promotions (Migration 066)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE promotion_type AS ENUM ('percentage_discount', 'flat_discount', 'banner_only', 'bundle_deal');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE promotion_placement AS ENUM ('home_hero', 'service_catalog', 'checkout', 'booking_review', 'all');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT,
        badge_text TEXT,
        promotion_type promotion_type NOT NULL DEFAULT 'banner_only',
        placement promotion_placement NOT NULL DEFAULT 'home_hero',
        discount_percentage NUMERIC(5, 2),
        discount_amount NUMERIC(10, 2),
        min_order_amount NUMERIC(10, 2),
        max_discount_amount NUMERIC(10, 2),
        image_url TEXT,
        cta_text TEXT,
        cta_link TEXT,
        city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
        service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        franchisee_id INTEGER REFERENCES franchisees(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Operational Exceptions (Migration 067)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE dcms_exception_type AS ENUM (
          'car_not_available', 'vehicle_moved_bay', 'gate_access_denied',
          'staff_unavailable', 'missed_cleaning', 'customer_complaint',
          'reclean_requested', 'basement_gps_audit'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE dcms_exception_status AS ENUM (
          'open', 'investigating', 'resolved', 'dismissed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMP;
      ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS retention_hold BOOLEAN DEFAULT false;

      CREATE TABLE IF NOT EXISTS dcms_operational_exceptions (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES dcms_subscriptions(id) ON DELETE CASCADE,
        visit_id INTEGER REFERENCES dcms_visits(id) ON DELETE SET NULL,
        society_id INTEGER REFERENCES residential_societies(id) ON DELETE SET NULL,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
        exception_type dcms_exception_type NOT NULL,
        status dcms_exception_status NOT NULL DEFAULT 'open',
        reason TEXT NOT NULL,
        notes TEXT,
        evidence_photo_url TEXT,
        reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolution_action TEXT,
        resolution_notes TEXT,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        company_id INTEGER,
        branch_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    logger.info("Startup schema migrations verified successfully.");
  } catch (err) {
    logger.error({ err }, "Startup schema migration error (non-fatal, continuing)");
  } finally {
    client.release();
  }
}
