import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const sql = readFileSync(path.join(root, "lib/db/migrations/005_legal_cms.sql"), "utf8");
  await pool.query(sql);
  console.log("✓ legal CMS tables (business_info, legal_pages, etc.) ready");

  const r = await pool.query(`SELECT id, business_name, state, gst_number FROM business_info WHERE id = 1`);
  console.log("business_info row:", r.rows[0]);

  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
