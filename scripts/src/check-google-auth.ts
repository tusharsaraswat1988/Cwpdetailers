import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('google_id','auth_provider')`,
  );
  console.log("users columns:", cols.rows);

  const tbl = await pool.query(`SELECT to_regclass('auth_pending_google') as t`);
  console.log("auth_pending_google:", tbl.rows[0]);

  const email = await pool.query(
    `SELECT id, email, role, google_id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    ["tusharsaraswat1988@gmail.com"],
  );
  console.log("user by email:", email.rows);

  await pool.end();
}

main().catch(e => {
  console.error(e.message);
  pool.end();
  process.exit(1);
});
