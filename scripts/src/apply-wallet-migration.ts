import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const sql = readFileSync(path.join(root, "lib/db/migrations/036_wallet_transactions.sql"), "utf8");
  await pool.query(sql);
  console.log("✓ wallet_transactions table ready");

  const sessions = await pool.query(`
    SELECT s.id, s.user_id, u.email, u.customer_id, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
    ORDER BY s.id DESC LIMIT 5
  `);
  console.log("active sessions:", sessions.rows);

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
