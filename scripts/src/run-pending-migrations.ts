import "./load-env.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "lib/db/migrations");

/** Apply SQL migrations in numeric order (010+). Safe to re-run — migrations use IF NOT EXISTS. */
const PENDING = [
  "010_dcms.sql",
  "011_dcms_enhancements.sql",
  "012_vehicle_reference_photos.sql",
  "013_dcms_production.sql",
  "014_visit_plate_ocr.sql",
  "015_push_notifications.sql",
  "016_push_notification_logs.sql",
  "017_staff_location_logs.sql",
  "018_dcms_plan_vehicle_type.sql",
  "019_customer_tier3.sql",
  "020_dcms_plan_addons.sql",
  "021_staff_category.sql",
  "022_complaints_supervisor.sql",
  "023_customer_reactivation.sql",
  "024_remove_legacy_daily_wash.sql",
  "025_customer_contracts.sql",
  "026_products_homepage.sql",
  "027_contact_identity_unique.sql",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env");
  }

  const { pool } = await import("@workspace/db");
  const available = new Set(readdirSync(migrationsDir));

  try {
    for (const file of PENDING) {
      if (!available.has(file)) {
        console.warn(`Skip missing migration: ${file}`);
        continue;
      }
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}…`);
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    }
    console.log("All pending migrations applied.");
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
