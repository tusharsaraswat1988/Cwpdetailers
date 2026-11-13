import { pool } from "@workspace/db";
import { logger } from "./logger";

export const STARTUP_MIGRATION_LOCK_ID = 884729104;

/**
 * Ensures critical schema migrations are applied on server startup.
 * 100% idempotent and non-destructive.
 * PRD v4.2 (DB-001): Serialized using PostgreSQL session-level advisory lock to eliminate multi-pod startup race conditions.
 */
export async function ensureStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    logger.info("Acquiring startup migration advisory lock...");
    await client.query("SELECT pg_advisory_lock($1)", [STARTUP_MIGRATION_LOCK_ID]);
    lockAcquired = true;
    logger.info("Startup migration advisory lock acquired. Verifying and ensuring database schema migrations...");

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

    // 6. Franchise Branches & Media Purge Audit (Migration 068)
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE franchisee_status ADD VALUE IF NOT EXISTS 'onboarding';
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        ALTER TYPE franchisee_status ADD VALUE IF NOT EXISTS 'suspended';
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_company_operated BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS code TEXT;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS service_availability JSONB;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS operational_notes TEXT;

      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS agreement_number TEXT;
      ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 15.00;

      ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS cloudinary_deletion_status TEXT;
      ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS media_purged_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 7. Admin Audit Logs (Migration 069)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        city_id INTEGER,
        branch_id INTEGER,
        performed_by INTEGER NOT NULL,
        reason TEXT,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_branch ON admin_audit_logs(branch_id);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
    `);

    // 8. Customer Payment Integrity & Subscription Lifecycle (Migration 070)
    await client.query(`
      ALTER TYPE dcms_subscription_status ADD VALUE IF NOT EXISTS 'pending_payment';
      ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS city_id INTEGER;
      ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS branch_id INTEGER;
      ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS subscription_id INTEGER;
      ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS legal_entity_id INTEGER;
      ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS metadata JSONB;
      CREATE INDEX IF NOT EXISTS payment_attempts_subscription_id_idx ON payment_attempts(subscription_id);
      CREATE INDEX IF NOT EXISTS payment_attempts_city_id_idx ON payment_attempts(city_id);
      CREATE INDEX IF NOT EXISTS payment_attempts_branch_id_idx ON payment_attempts(branch_id);
    `);

    // 9. Notifications & Support Tickets (Migration 071)
    await client.query(`
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_initiated';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_success';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_activated';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_paused';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_resumed';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_cancelled';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_renewal_due';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_completed';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_cna';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_missed';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'exception_resolved';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_created';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_updated';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_resolved';
      ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_assigned';

      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS city_id INTEGER;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id INTEGER;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_message TEXT;

      ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'assigned';
      ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'awaiting_customer';
      ALTER TYPE complaint_priority ADD VALUE IF NOT EXISTS 'urgent';
      ALTER TYPE complaint_type ADD VALUE IF NOT EXISTS 'subscription';

      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ticket_number TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS city_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS subscription_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS visit_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS invoice_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS operational_exception_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo_url TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS internal_notes TEXT;

      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_id INTEGER,
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN NOT NULL DEFAULT FALSE,
        attachment_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE dcms_operational_exceptions ADD COLUMN IF NOT EXISTS complaint_id INTEGER;
    `);

    // 10. Service Quality, SLA Policies & Retention (Migration 072)
    await client.query(`
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS subscription_id INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS staff_id INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS city_id INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS branch_id INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS rating_score INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS issue_reported BOOLEAN DEFAULT FALSE;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS complaint_id INTEGER;
      ALTER TABLE dcms_visit_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS sla_policies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city_id INTEGER,
        service_type TEXT,
        category TEXT NOT NULL DEFAULT 'all',
        priority TEXT NOT NULL DEFAULT 'all',
        response_target_minutes INTEGER NOT NULL DEFAULT 720,
        resolution_target_minutes INTEGER NOT NULL DEFAULT 1440,
        pause_on_customer_response BOOLEAN NOT NULL DEFAULT TRUE,
        escalation_level_1_minutes INTEGER,
        escalation_level_2_minutes INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        company_id INTEGER,
        branch_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sla_escalation_logs (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER,
        operational_exception_id INTEGER,
        sla_policy_id INTEGER,
        escalation_level INTEGER NOT NULL,
        reason TEXT NOT NULL,
        escalated_to_role TEXT NOT NULL,
        escalated_to_user_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sla_policy_id INTEGER;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMP;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMP;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMP;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sla_total_paused_minutes INTEGER DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'on_track';
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;

      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS cancellation_feedback TEXT;
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS churn_risk_level TEXT DEFAULT 'low';
      ALTER TABLE dcms_subscriptions ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP;

      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_marketing BOOLEAN DEFAULT FALSE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sensitive_masked BOOLEAN DEFAULT FALSE;
    `);

    // Helper to execute steps with per-step error isolation (DB-002)
    const execStep = async (stepName: string, sql: string) => {
      try {
        await client.query(sql);
      } catch (err) {
        logger.error({ err, step: stepName }, `Startup migration step "${stepName}" encountered error (isolated)`);
      }
    };

    // 11. Branch Governance, Assignments & Scoping (Migration 073, PRD v3.0, DB-002)
    // Add user_role enum values independently so they are committed before DML execution
    for (const val of ["central_admin", "branch_manager", "supervisor", "city_admin"]) {
      try {
        await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${val}'`);
      } catch (e) {
        logger.warn({ err: e, val }, `Note: user_role enum addition for ${val}`);
      }
    }

    await execStep("073_branch_assignments_ddl", `
      CREATE TABLE IF NOT EXISTS branch_user_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        assignment_role TEXT NOT NULL DEFAULT 'branch_manager',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        effective_until TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revocation_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_user_active ON branch_user_assignments(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_branch_active ON branch_user_assignments(branch_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_user_branch ON branch_user_assignments(user_id, branch_id);

      CREATE TABLE IF NOT EXISTS service_branch_overrides (
        id SERIAL PRIMARY KEY,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        base_price_override NUMERIC(10, 2),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        custom_settings JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT service_branch_overrides_service_branch_unique UNIQUE (service_id, branch_id)
      );

      CREATE INDEX IF NOT EXISTS idx_service_branch_overrides_branch ON service_branch_overrides(branch_id);
      CREATE INDEX IF NOT EXISTS idx_service_branch_overrides_service ON service_branch_overrides(service_id);
    `);

    await execStep("073_branch_managers_backfill", `
      -- Backfill existing branch managers into branch_user_assignments using ::text cast
      INSERT INTO branch_user_assignments (user_id, branch_id, assignment_role, is_active, assigned_at, created_at, updated_at)
      SELECT u.id, u.branch_id, 'branch_manager', TRUE, NOW(), NOW(), NOW()
      FROM users u
      WHERE u.role::text IN ('manager', 'branch_manager')
        AND u.branch_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM branch_user_assignments bua
          WHERE bua.user_id = u.id AND bua.branch_id = u.branch_id
        );
    `);

    // 12. Universal Multi-City Lifecycle, Configuration & City Admin (Migration 074, DB-002)
    await execStep("074_city_lifecycle_ddl", `
      DO $$ BEGIN
        CREATE TYPE city_status AS ENUM (
          'draft',
          'setup_in_progress',
          'ready_for_launch',
          'active',
          'suspended',
          'archived'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE cities ADD COLUMN IF NOT EXISTS status city_status NOT NULL DEFAULT 'active';
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS code TEXT;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-IN';
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS contact_email TEXT;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS operational_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS content_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS launched_at TIMESTAMP;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      ALTER TABLE cities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

      UPDATE cities SET code = 'VNS', status = 'active' WHERE slug = 'varanasi' AND (code IS NULL OR code = '');
      UPDATE cities SET code = 'NOI', status = 'active' WHERE slug = 'noida' AND (code IS NULL OR code = '');
      UPDATE cities SET code = UPPER(SUBSTRING(slug, 1, 3)) || id::text WHERE code IS NULL OR code = '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_code ON cities(code) WHERE code IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cities_status ON cities(status);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id);
      CREATE INDEX IF NOT EXISTS idx_users_city_id ON users(city_id);
    `);

    // 13. Universal Multi-City Staff Compensation & Payout Ledger (Migration 075, DB-002)
    await execStep("075_staff_payout_ledgers_ddl", `
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
    `);

    // 14. Verification and guaranteed fallback for users.city_id (DB-002)
    try {
      await client.query("SELECT city_id FROM users LIMIT 1");
    } catch {
      logger.warn("users.city_id column missing on startup check; executing explicit fallback DDL");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_users_city_id ON users(city_id)");
    }

    // 15. Core Service Operations & Booking-to-Execution Consistency (Migration 076 / Phase 16)
    try {
      await client.query(`
        DO $$
        BEGIN
          ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'assigned';
          ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress';
          ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'completed';
          ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'missed';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;

        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS bookings_assigned_staff_idx ON bookings(assigned_staff_id);
        CREATE INDEX IF NOT EXISTS idx_pending_service_assignments_contract_pending ON pending_service_assignments (contract_registry_id) WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_service_executions_active_task ON service_executions (service_assignment_id, task_type) WHERE status NOT IN ('completed', 'cancelled', 'missed', 'rescheduled');
      `);
    } catch (mig76Err) {
      logger.warn({ err: mig76Err }, "Phase 16 migration DDL check failed (non-fatal, continuing)");
    }

    // 16. Customer Rescheduling, Dispatch Notifications & Technician ETA Foundation (Migration 077 / Phase 17)
    try {
      await client.query(`
        DO $$
        BEGIN
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'technician_en_route';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_started';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_reassigned';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'schedule_changed';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_cancelled';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'makeup_booking_confirmed';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_failure';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'repeated_execution_failure';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reschedule_approval_required';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'general';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;

        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_from_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_to_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_makeup_booking BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS makeup_eligibility_status TEXT;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS technician_en_route_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS eta_minutes INTEGER;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_known_latitude DOUBLE PRECISION;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_known_longitude DOUBLE PRECISION;

        CREATE INDEX IF NOT EXISTS bookings_rescheduled_from_idx ON bookings(rescheduled_from_booking_id);
        CREATE INDEX IF NOT EXISTS bookings_rescheduled_to_idx ON bookings(rescheduled_to_booking_id);

        ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
        ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;
        ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS eta_minutes INTEGER;
        ALTER TABLE service_executions ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;
      `);
    } catch (mig77Err) {
      logger.warn({ err: mig77Err }, "Phase 17 migration DDL check failed (non-fatal, continuing)");
    }

    // 17. Supervisor Makeup Approval Queue & GPS Retention Indexes (Migration 078, Phase 18)
    try {
      await execStep("078_makeup_approval_requests_and_gps_retention", `
        DO $$ BEGIN
          CREATE TYPE makeup_approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS makeup_approval_requests (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          contract_registry_id INTEGER REFERENCES customer_contracts(id) ON DELETE SET NULL,
          requested_date DATE NOT NULL,
          requested_time VARCHAR(32) NOT NULL,
          requested_notes TEXT,
          reason TEXT NOT NULL,
          status makeup_approval_status NOT NULL DEFAULT 'pending',
          decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          decided_at TIMESTAMPTZ,
          decision_reason TEXT,
          created_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
          previous_makeups_count INTEGER NOT NULL DEFAULT 0,
          applicable_quota INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS makeup_approvals_status_idx ON makeup_approval_requests(status);
        CREATE INDEX IF NOT EXISTS makeup_approvals_city_branch_idx ON makeup_approval_requests(city_id, branch_id);
        CREATE INDEX IF NOT EXISTS makeup_approvals_booking_idx ON makeup_approval_requests(booking_id);
        CREATE INDEX IF NOT EXISTS makeup_approvals_customer_idx ON makeup_approval_requests(customer_id);

        CREATE INDEX IF NOT EXISTS service_execution_location_logs_recorded_at_idx ON service_execution_location_logs(recorded_at);
      `);
    } catch (mig78Err) {
      logger.warn({ err: mig78Err }, "Phase 18 migration DDL check failed (non-fatal, continuing)");
    }

    // 18. Universal Service Catalog, Pricing Matrix & Subscription Packages (Migration 079, Phase 19)
    try {
      await execStep("079_universal_service_catalog_pricing_matrix", `
        ALTER TABLE services ADD COLUMN IF NOT EXISTS code TEXT;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS supported_vehicle_categories JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS applicable_booking_modes JSONB DEFAULT '["one_time"]'::jsonb;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS default_config JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

        UPDATE services SET code = slug WHERE code IS NULL AND slug IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS services_code_unique_idx ON services (code) WHERE code IS NOT NULL;

        CREATE TABLE IF NOT EXISTS service_availability_matrix (
          id SERIAL PRIMARY KEY,
          service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          booking_modes JSONB NOT NULL DEFAULT '["one_time"]'::jsonb,
          effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          effective_until TIMESTAMPTZ,
          base_price_override NUMERIC(10, 2),
          package_config_id INTEGER,
          operational_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
          admin_notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_sam_city_branch_service ON service_availability_matrix (city_id, branch_id, service_id);
        CREATE INDEX IF NOT EXISTS idx_sam_service ON service_availability_matrix (service_id);
        CREATE INDEX IF NOT EXISTS idx_sam_effective ON service_availability_matrix (effective_from, effective_until);
        CREATE INDEX IF NOT EXISTS idx_sam_active ON service_availability_matrix (is_active);

        ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
        ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE service_pricing ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS idx_service_pricing_branch ON service_pricing (branch_id);
        CREATE INDEX IF NOT EXISTS idx_service_pricing_effective ON service_pricing (effective_from, effective_until);

        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'recurring_monthly';
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS included_visits INTEGER DEFAULT 1;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS complimentary_visits INTEGER DEFAULT 0;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS service_frequency TEXT DEFAULT 'daily';
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS vehicle_category_ids JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS is_renewal_eligible BOOLEAN DEFAULT TRUE;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS renewal_discount_percent NUMERIC(5, 2) DEFAULT '0';
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE catalog_packages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

        CREATE INDEX IF NOT EXISTS idx_catalog_packages_branch ON catalog_packages (branch_id);
        CREATE INDEX IF NOT EXISTS idx_catalog_packages_service ON catalog_packages (service_id);
        CREATE INDEX IF NOT EXISTS idx_catalog_packages_effective ON catalog_packages (effective_from, effective_until);

        INSERT INTO service_availability_matrix (
          service_id, city_id, branch_id, is_active, base_price_override, booking_modes, created_at, updated_at
        )
        SELECT
          sca.service_id,
          sca.city_id,
          NULL,
          sca.is_active,
          sca.base_price_override,
          '["one_time", "subscription"]'::jsonb,
          sca.created_at,
          sca.updated_at
        FROM service_city_availability sca
        WHERE NOT EXISTS (
          SELECT 1 FROM service_availability_matrix sam
          WHERE sam.service_id = sca.service_id
            AND sam.city_id = sca.city_id
            AND sam.branch_id IS NULL
        );

        INSERT INTO service_availability_matrix (
          service_id, city_id, branch_id, is_active, base_price_override, booking_modes, operational_constraints, created_at, updated_at
        )
        SELECT
          sbo.service_id,
          b.city_id,
          sbo.branch_id,
          sbo.is_active,
          sbo.base_price_override,
          '["one_time", "subscription"]'::jsonb,
          COALESCE(sbo.custom_settings, '{}'::jsonb),
          sbo.created_at,
          sbo.updated_at
        FROM service_branch_overrides sbo
        JOIN branches b ON b.id = sbo.branch_id
        WHERE b.city_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM service_availability_matrix sam
            WHERE sam.service_id = sbo.service_id
              AND sam.city_id = b.city_id
              AND sam.branch_id = sbo.branch_id
          );
      `);
    } catch (mig79Err) {
      logger.warn({ err: mig79Err }, "Phase 19 migration DDL check failed (non-fatal, continuing)");
    }

    // 19. Phase 20: City/Branch-Wise Marketing, Homepage CMS & Campaign Management (Migration 080)
    try {
      await client.query(`
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS campaign_id INTEGER;
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS alt_text TEXT;
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS desktop_image_url TEXT;
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'all';
        ALTER TABLE promotions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';

        CREATE TABLE IF NOT EXISTS homepage_sections (
          id SERIAL PRIMARY KEY,
          section_key VARCHAR(60) NOT NULL,
          title VARCHAR(255),
          subtitle TEXT,
          city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          content JSONB DEFAULT '{}'::jsonb,
          scheduled_publish_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketing_campaigns (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          offer_type VARCHAR(50) NOT NULL DEFAULT 'percentage_discount',
          discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
          min_order_amount NUMERIC(10, 2) DEFAULT 0,
          max_discount_amount NUMERIC(10, 2),
          applicable_service_ids JSONB DEFAULT '[]'::jsonb,
          applicable_package_ids JSONB DEFAULT '[]'::jsonb,
          applicable_vehicle_categories JSONB DEFAULT '[]'::jsonb,
          usage_limit INTEGER,
          used_count INTEGER NOT NULL DEFAULT 0,
          per_customer_limit INTEGER DEFAULT 1,
          eligibility_rule VARCHAR(50) DEFAULT 'all',
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          terms_and_conditions TEXT,
          banner_id INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS city_landing_pages (
          id SERIAL PRIMARY KEY,
          city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          slug VARCHAR(100) NOT NULL,
          page_title TEXT NOT NULL,
          seo_title TEXT,
          seo_description TEXT,
          seo_keywords TEXT,
          canonical_url TEXT,
          og_title TEXT,
          og_description TEXT,
          og_image TEXT,
          hero_headline TEXT,
          hero_subheadline TEXT,
          custom_faqs JSONB DEFAULT '[]'::jsonb,
          custom_testimonials JSONB DEFAULT '[]'::jsonb,
          localized_content JSONB DEFAULT '{}'::jsonb,
          is_published BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketing_media_assets (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          alt_text TEXT,
          file_url TEXT NOT NULL,
          thumbnail_url TEXT,
          file_type VARCHAR(50),
          file_size_bytes INTEGER,
          width INTEGER,
          height INTEGER,
          tags JSONB DEFAULT '[]'::jsonb,
          city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketing_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          banner_id INTEGER,
          campaign_id INTEGER,
          city_id INTEGER,
          branch_id INTEGER,
          customer_id INTEGER,
          session_id TEXT,
          order_id TEXT,
          conversion_value NUMERIC(10, 2),
          metadata JSONB DEFAULT '{}'::jsonb,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } catch (mig80Err) {
      logger.warn({ err: mig80Err }, "Phase 20 marketing CMS DDL check failed (non-fatal, continuing)");
    }

    // 20. Phase 21: Customer Referral, Loyalty Rewards & Retention Automation Engine (Migration 081)
    try {
      await client.query(`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS customer_referrals (
          id SERIAL PRIMARY KEY,
          referrer_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
          referee_customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE RESTRICT,
          referral_code TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attributed_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
          booking_completed_at TIMESTAMP,
          referrer_reward_points INTEGER NOT NULL DEFAULT 0,
          referee_reward_points INTEGER NOT NULL DEFAULT 0,
          reward_status TEXT NOT NULL DEFAULT 'pending',
          reward_issued_at TIMESTAMP,
          fraud_flag_reason TEXT,
          idempotency_key TEXT UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS loyalty_ledger (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
          city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          transaction_type TEXT NOT NULL,
          points INTEGER NOT NULL,
          rupee_equivalent NUMERIC(10, 2) NOT NULL DEFAULT '0.00',
          balance_after INTEGER NOT NULL,
          source_reference TEXT NOT NULL,
          booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
          referral_id INTEGER REFERENCES customer_referrals(id) ON DELETE SET NULL,
          reversal_of_id INTEGER REFERENCES loyalty_ledger(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'active',
          idempotency_key TEXT UNIQUE,
          expires_at TIMESTAMP,
          notes TEXT,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS retention_automations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          delay_days INTEGER NOT NULL DEFAULT 7,
          city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
          coupon_code TEXT,
          reward_points INTEGER NOT NULL DEFAULT 0,
          title_template TEXT NOT NULL,
          message_template TEXT NOT NULL,
          frequency_cap_days INTEGER NOT NULL DEFAULT 30,
          channel TEXT NOT NULL DEFAULT 'in_app',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          total_evaluated_count INTEGER NOT NULL DEFAULT 0,
          total_triggered_count INTEGER NOT NULL DEFAULT 0,
          last_run_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS retention_execution_logs (
          id SERIAL PRIMARY KEY,
          automation_id INTEGER NOT NULL REFERENCES retention_automations(id) ON DELETE CASCADE,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
          channel TEXT NOT NULL,
          notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
          status TEXT NOT NULL,
          message_payload JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    } catch (mig81Err) {
      logger.warn({ err: mig81Err }, "Phase 21 loyalty & retention DDL check failed (non-fatal, continuing)");
    }

    logger.info("Startup schema migrations verified successfully.");
  } catch (err) {
    logger.error({ err }, "Startup schema migration error (non-fatal, continuing)");
  } finally {
    if (lockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [STARTUP_MIGRATION_LOCK_ID]);
        logger.info("Startup migration advisory lock released successfully.");
      } catch (unlockErr) {
        logger.error({ err: unlockErr }, "Failed to release startup migration advisory lock");
      }
    }
    client.release();
  }
}
