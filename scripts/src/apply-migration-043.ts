import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(
  path.join(root, "lib/db/migrations/043_auth_otp_codes.sql"),
  "utf8",
);

async function main() {
  console.log("Applying 043_auth_otp_codes.sql…");
  await pool.query(sql);
  console.log("Done.");

  const table = await pool.query(
    `SELECT to_regclass('public.auth_otp_codes') AS table_name`,
  );
  console.log("auth_otp_codes:", table.rows[0]?.table_name ?? "missing");

  await pool.end();
}

main().catch(e => {
  console.error(e.message);
  pool.end();
  process.exit(1);
});
