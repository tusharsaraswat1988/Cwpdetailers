import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const user = await pool.query(`SELECT id, name, email, phone, role, customer_id, staff_id FROM users WHERE id = 19 OR customer_id = 20`);
  console.log("user:", user.rows);
  const cust = await pool.query(`SELECT id, user_id, name, phone FROM customers WHERE id = 20`);
  console.log("customer:", cust.rows);
  const wt = await pool.query(`SELECT to_regclass('public.wallet_transactions') AS t`);
  console.log("wallet_transactions:", wt.rows[0]);
  await pool.end();
}

main();
