import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(
  path.join(root, "lib/db/migrations/035_auth_google_password_reset.sql"),
  "utf8",
);

async function main() {
  console.log("Applying 035_auth_google_password_reset.sql…");
  await pool.query(sql);
  console.log("Done.");

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('google_id','auth_provider')`,
  );
  console.log("users columns:", cols.rows);

  await pool.end();
}

main().catch(e => {
  console.error(e.message);
  pool.end();
  process.exit(1);
});
