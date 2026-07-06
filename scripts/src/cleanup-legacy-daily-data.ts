/**
 * Remove legacy daily-clean bookings and duplicate active DCMS subscriptions.
 *
 * Usage:
 *   pnpm exec tsx src/cleanup-legacy-daily-data.ts --dry-run
 *   pnpm exec tsx src/cleanup-legacy-daily-data.ts --confirm
 */
import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const confirm = process.argv.includes("--confirm");

const LEGACY_BOOKINGS_SQL = `
  SELECT b.id, b.customer_id, b.service_type, b.status, b.amount, b.scheduled_date,
         c.name AS customer_name, s.name AS service_name
  FROM bookings b
  LEFT JOIN customers c ON c.id = b.customer_id
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.service_type = 'daily_cleaning'
     OR (
       b.service_type = 'one_time_wash'
       AND s.id IS NOT NULL
       AND lower(s.name) LIKE '%daily%'
       AND (lower(s.name) LIKE '%clean%' OR lower(s.name) LIKE '%exterior%')
     )
  ORDER BY b.id
`;

const DUPLICATE_SUBS_SQL = `
  SELECT s.id, s.customer_id, s.vehicle_id, s.plan_id, s.status, c.name AS customer_name, p.name AS plan_name,
         (SELECT count(*)::int FROM dcms_visits v WHERE v.subscription_id = s.id) AS visit_count
  FROM dcms_subscriptions s
  JOIN customers c ON c.id = s.customer_id
  JOIN dcms_plans p ON p.id = s.plan_id
  JOIN (
    SELECT customer_id, vehicle_id, plan_id
    FROM dcms_subscriptions
    WHERE status = 'active'
    GROUP BY customer_id, vehicle_id, plan_id
    HAVING count(*) > 1
  ) d ON d.customer_id = s.customer_id AND d.vehicle_id = s.vehicle_id AND d.plan_id = s.plan_id
  WHERE s.status = 'active'
  ORDER BY s.customer_id, s.vehicle_id, s.plan_id, s.id
`;

async function main() {
  if (!dryRun && !confirm) {
    console.log("Pass --dry-run to preview or --confirm to delete.");
    process.exit(1);
  }

  const { rows: legacyBookings } = await pool.query(LEGACY_BOOKINGS_SQL);
  const { rows: duplicateSubs } = await pool.query(DUPLICATE_SUBS_SQL);

  console.log(`\nLegacy daily-clean bookings: ${legacyBookings.length}`);
  for (const row of legacyBookings as Array<Record<string, unknown>>) {
    console.log(
      `  #${row.id} ${row.customer_name} — ${row.service_name ?? row.service_type} ₹${row.amount ?? "?"} (${row.status}, ${row.scheduled_date})`,
    );
  }

  console.log(`\nDuplicate active DCMS subscriptions: ${duplicateSubs.length}`);
  for (const row of duplicateSubs as Array<Record<string, unknown>>) {
    console.log(
      `  sub #${row.id} ${row.customer_name} — ${row.plan_name} (visits: ${row.visit_count})`,
    );
  }

  if (legacyBookings.length === 0 && duplicateSubs.length === 0) {
    console.log("\nNothing to clean.");
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log("\nDry run — no changes made. Re-run with --confirm to apply migration 042.");
    await pool.end();
    return;
  }

  const sql = readFileSync(path.join(root, "lib/db/migrations/042_remove_legacy_daily_booking_data.sql"), "utf8");
  await pool.query(sql);
  console.log("\nCleanup complete (migration 042 applied).");
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
