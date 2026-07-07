import "./load-env.js";
import { pool } from "@workspace/db";

const phone = "7054007733";
const email = "tabbytechsolutions@gmail.com";

async function q(label: string, sql: string, params: unknown[] = []) {
  const { rows } = await pool.query(sql, params);
  console.log(label, rows);
}

async function main() {
  await q("customers", `SELECT id, name, phone, email, user_id, status FROM customers WHERE phone = $1 OR lower(email) = lower($2)`, [phone, email]);
  await q("users", `SELECT id, name, phone, email, role, customer_id, staff_id, google_id FROM users WHERE phone = $1 OR lower(email) = lower($2)`, [phone, email]);
  await q("staff", `SELECT id, name, phone, email, user_id FROM staff WHERE phone = $1 OR lower(email) = lower($2)`, [phone, email]);
  await q("auth_pending", `SELECT id, email, google_id, expires_at FROM auth_pending_google WHERE lower(email) = lower($1)`, [email]);
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
