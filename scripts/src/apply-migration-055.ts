import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const { pool } = await import("@workspace/db");
  const sql = readFileSync(
    path.join(root, "lib/db/migrations/055_billing_commercial_closure_phase56.sql"),
    "utf8",
  );
  await pool.query(sql);
  console.log("Applied 055_billing_commercial_closure_phase56.sql");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
