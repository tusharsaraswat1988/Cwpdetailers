import "./load-env.js";
import { pg } from "@workspace/db";
import argon2 from "argon2";

const targetUrl =
  process.env.TARGET_DATABASE_URL ||
  process.argv[2] ||
  "postgresql://neondb_owner:npg_WXJ8KqZO9Aud@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Operational and business data tables to truncate
const DATA_TABLES_TO_TRUNCATE = [
  // Bookings & Executions
  "service_execution_photos",
  "service_execution_notes",
  "service_execution_checklist_items",
  "service_execution_location_logs",
  "service_executions",
  "service_assignments",
  "pending_service_assignments",
  "service_contracts",
  "booking_events",
  "booking_platform_sessions",
  "bookings",
  "jobs",
  "system_jobs",

  // DCMS Daily Cleaning & Subscriptions
  "dcms_visits",
  "dcms_staff_assignments",
  "dcms_exceptions",
  "dcms_activity_logs",
  "dcms_subscription_locations",
  "dcms_plan_addons",
  "dcms_subscriptions",
  "dcms_plans",
  "subscription_items",
  "subscriptions",

  // Billing & Finance
  "invoice_items",
  "invoices",
  "quotation_items",
  "quotations",
  "expenses",
  "refunds",
  "wallet_transactions",
  "wallets",
  "payment_webhook_events",
  "payment_attempts",
  "payments",

  // Customer, Vehicles, Assets & Locations
  "vehicles",
  "solar_sites",
  "assets",
  "service_locations",
  "saved_locations",
  "addresses",
  "customers",

  // Staff & Attendance
  "staff_location_logs",
  "staff_attendance",
  "staff_payouts",
  "staff",
  "branch_user_assignments",

  // Network, Branches, Societies & Geography
  "zone_coverage_rules",
  "pricing_rule_audit_logs",
  "location_pricing_rules",
  "branch_zone_mappings",
  "operational_zones",
  "location_aliases",
  "geographic_localities",
  "society_towers",
  "residential_societies",
  "service_branch_overrides",
  "service_city_availability",
  "service_availability_matrix",
  "service_areas",
  "pincodes",
  "operating_hours",
  "operational_closures",
  "branches",
  "cities",

  // CRM, Communications, Leads & Audit
  "complaints",
  "support_tickets",
  "lead_activities",
  "lead_ingestion_log",
  "leads",
  "marketing_campaigns",
  "loyalty_rewards",
  "push_notification_logs",
  "admin_audit_logs",
  "extra_service_requests",

  // Auth, Sessions & Users
  "sessions",
  "auth_otp",
  "password_resets",
  "users",
];

async function main() {
  const maskedUrl = targetUrl.replace(/:[^:@]+@/, ":****@");
  console.log("==================================================================");
  console.log("CWP DETAILERS — PRODUCTION DATABASE PURGE & FRESH STAGE BOOTSTRAP");
  console.log("==================================================================");
  console.log(`Target Database: ${maskedUrl}`);

  const client = new pg.Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL database successfully.");
  } catch (err: any) {
    if (err.code === "53000" || err.message?.includes("quota")) {
      console.error("\n❌ NEON COMPUTE SUSPENDED (SQLSTATE 53000):");
      console.error("Neon has blocked database connections with message:");
      console.error(`"${err.message}"`);
      console.error("\nReason: The Neon Free tier allowance (compute hours or data transfer) has exceeded its quota limit.");
      console.error("\nHow to unblock on Neon Console (takes 30 seconds):");
      console.error("1. Go to Neon Console: https://console.neon.tech");
      console.error("2. Navigate to: Billing -> Change plan.");
      console.error("3. Upgrade temporarily to 'Launch' plan (or reset monthly allowances), which instantly reactivates the database compute.");
      console.error("4. Alternatively, provide a fresh/active Neon database connection string.");
      process.exit(1);
    }
    throw err;
  }

  try {
    // 1. Fetch list of existing tables in public schema
    const existingTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const existingTableNames = new Set(existingTablesRes.rows.map((r: any) => r.table_name));

    console.log(`\nFound ${existingTableNames.size} total tables in public schema.`);

    // 2. Identify tables that actually exist in the database to truncate
    const validTablesToTruncate = DATA_TABLES_TO_TRUNCATE.filter((t) => existingTableNames.has(t));

    if (validTablesToTruncate.length > 0) {
      // Execute multi-table TRUNCATE with CASCADE to handle foreign key dependencies natively without requiring superuser replication role
      const truncateSql = `TRUNCATE TABLE ${validTablesToTruncate.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`;
      await client.query(truncateSql);
      console.log(`✓ Truncated ${validTablesToTruncate.length} operational & business data tables (RESTART IDENTITY CASCADE).`);
    }

    // 3. Seed / Bootstrap Default Super Admin in users table
    if (existingTableNames.has("users")) {
      const adminPhone = process.env.ADMIN_PHONE || "9999999999";
      const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
      const adminName = process.env.ADMIN_NAME || "Super Admin";
      const adminEmail = process.env.ADMIN_EMAIL || "admin@cwpdetailers.in";

      const passwordHash = await argon2.hash(adminPassword);
      const now = new Date();

      await client.query(
        `
        INSERT INTO users (phone, password_hash, name, email, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'super_admin', true, $5, $6)
        ON CONFLICT (phone) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = 'super_admin',
          is_active = true,
          updated_at = EXCLUDED.updated_at;
      `,
        [adminPhone, passwordHash, adminName, adminEmail, now, now],
      );

      console.log(`\n✓ Bootstrapped Super Admin login:`);
      console.log(`  - Portal: Admin (/admin/login)`);
      console.log(`  - Phone: ${adminPhone}`);
      console.log(`  - Password: ${adminPassword}`);
      console.log(`  - Role: super_admin`);
    }

    console.log("\n==================================================================");
    console.log("DATABASE PURGE COMPLETE — DATABASE IS FRESH AND READY FOR GO-LIVE!");
    console.log("==================================================================");
  } catch (err: any) {
    console.error("Purge error:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
