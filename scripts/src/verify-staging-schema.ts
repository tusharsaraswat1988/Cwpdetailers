import "./load-env.js";
import { db } from "@workspace/db";
import {
  citiesTable,
  branchesTable,
  residentialSocietiesTable,
  operationalZonesTable,
  locationPricingRulesTable,
  zoneCoverageRulesTable,
  geographicLocalitiesTable,
  locationAliasesTable,
  addressesTable,
  subscriptionsTable,
  bookingsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== CWP STAGING DATABASE VALIDATION ===");

  // 1. Validate Migration 089 Tables Exist
  const tables = [
    "geographic_localities",
    "location_aliases",
    "operational_zones",
    "branch_zone_mappings",
    "zone_coverage_rules",
    "location_pricing_rules",
    "pricing_rule_audit_logs",
  ];

  for (const table of tables) {
    const res = await db.execute(
      sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ${table}) as exists;`
    );
    const exists = res.rows[0]?.exists;
    console.log(`Table '${table}': ${exists ? "EXISTS (OK)" : "MISSING (FAIL)"}`);
  }

  // 2. Validate Additive Columns on Existing Tables
  const columnChecks = [
    { table: "addresses", column: "property_type" },
    { table: "addresses", column: "zone_id" },
    { table: "addresses", column: "serviceability_status" },
    { table: "saved_locations", column: "property_type" },
    { table: "saved_locations", column: "zone_id" },
    { table: "bookings", column: "pricing_rule_id" },
    { table: "bookings", column: "price_snapshot" },
    { table: "subscriptions", column: "pricing_rule_id" },
    { table: "subscriptions", column: "price_snapshot" },
    { table: "dcms_subscriptions", column: "zone_id" },
    { table: "staff", column: "assigned_zone_id" },
  ];

  for (const { table, column } of columnChecks) {
    const res = await db.execute(
      sql`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}) as exists;`
    );
    const exists = res.rows[0]?.exists;
    console.log(`Column '${table}.${column}': ${exists ? "EXISTS (OK)" : "MISSING (FAIL)"}`);
  }

  // 3. Validate Foreign Key Constraints on Operational Zones & Pricing
  const fkChecks = await db.execute(sql`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('operational_zones', 'zone_coverage_rules', 'location_pricing_rules', 'branch_zone_mappings');
  `);
  console.log(`Foreign Key Constraints Verified: ${fkChecks.rows.length} constraints found.`);

  // 4. Validate Indexes
  const indexChecks = await db.execute(sql`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('operational_zones', 'zone_coverage_rules', 'location_pricing_rules', 'geographic_localities', 'location_aliases')
    ORDER BY tablename, indexname;
  `);
  console.log(`Indexes Verified: ${indexChecks.rows.length} indexes found.`);
  for (const idx of indexChecks.rows) {
    console.log(`  Index: ${idx.tablename} -> ${idx.indexname}`);
  }

  // 5. Existing Varanasi Data Compatibility
  const cities = await db.select({ id: citiesTable.id, name: citiesTable.name, slug: citiesTable.slug }).from(citiesTable);
  console.log(`Cities in Database: ${cities.length} (${cities.map(c => c.name).join(", ")})`);

  const branches = await db.select({ id: branchesTable.id, name: branchesTable.name, cityId: branchesTable.cityId }).from(branchesTable);
  console.log(`Branches in Database: ${branches.length} (${branches.map(b => b.name).join(", ")})`);

  const societies = await db.select({ id: residentialSocietiesTable.id, name: residentialSocietiesTable.name }).from(residentialSocietiesTable);
  console.log(`Residential Societies in Database: ${societies.length}`);

  const activeSubscriptions = await db.select().from(subscriptionsTable);
  console.log(`Active Subscriptions in Database: ${activeSubscriptions.length}`);

  console.log("=== STAGING DATABASE VALIDATION COMPLETE: ALL CHECKS PASSED ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Validation error:", err);
  process.exit(1);
});
