import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMP`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS legacy_segment TEXT`);
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name IN ('legacy_segment','reactivated_at')`,
  );
  console.log("columns:", rows);
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
