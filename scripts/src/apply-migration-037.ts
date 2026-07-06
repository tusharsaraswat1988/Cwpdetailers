import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const sql = readFileSync(path.join(root, "lib/db/migrations/037_vehicles_assigned_staff.sql"), "utf8");
  await pool.query(sql);
  console.log("✓ vehicles.assigned_staff_id column ready");
  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
