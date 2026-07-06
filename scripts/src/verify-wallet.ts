import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const bal = await pool.query(
    `SELECT coalesce(sum(case when type = 'credit' then amount::numeric else -amount::numeric end), 0) AS balance FROM wallet_transactions WHERE customer_id = 20`,
  );
  console.log("wallet balance for customer 20:", bal.rows[0]);
  await pool.end();
}

main();
