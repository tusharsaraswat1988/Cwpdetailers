/**
 * One-shot backfill: populate company_id / franchisee_id on operational rows
 * using existing branch -> franchisee mappings. Safe to re-run (idempotent).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Backfilling tenant fields…");

  // Ensure at least one default company exists
  const c = await db.execute(sql`
    INSERT INTO companies (name, gstin, address)
    SELECT 'CWP Detailers', NULL, 'Varanasi, India'
    WHERE NOT EXISTS (SELECT 1 FROM companies)
    RETURNING id;
  `);
  console.log("Companies seeded:", c.rows?.length ?? 0);

  const tables = [
    "customers", "vehicles", "solar_sites", "subscriptions",
    "bookings", "staff", "invoices", "complaints",
    "notifications", "branches", "franchisees", "users",
  ];

  for (const t of tables) {
    await db.execute(sql.raw(`
      UPDATE ${t}
      SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
      WHERE company_id IS NULL;
    `));
  }
  console.log("company_id backfilled across", tables.length, "tables.");

  // franchisee_id <- via branch_id mapping
  const tablesWithBranch = ["customers", "vehicles", "solar_sites", "subscriptions", "bookings", "staff", "invoices", "complaints", "notifications"];
  for (const t of tablesWithBranch) {
    await db.execute(sql.raw(`
      UPDATE ${t} AS t
      SET franchisee_id = f.id
      FROM franchisees f
      WHERE t.branch_id IS NOT NULL
        AND f.branch_id = t.branch_id
        AND t.franchisee_id IS NULL;
    `));
  }
  console.log("franchisee_id backfilled via branch mapping.");

  console.log("Done.");
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
