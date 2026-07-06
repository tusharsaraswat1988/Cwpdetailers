import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrations = ["023_customer_reactivation.sql"];

async function main() {
  for (const file of migrations) {
    const sql = readFileSync(path.join(root, "lib/db/migrations", file), "utf8");
    console.log(`Applying ${file}…`);
    await pool.query(sql);
    console.log(`  ✓ ${file}`);
  }
  await pool.end();
}

main().catch(e => {
  console.error(e.message);
  pool.end();
  process.exit(1);
});
