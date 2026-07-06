/** Remove incomplete Google customer sign-ups (user row without customer profile). */
import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const { rows } = await pool.query<{ id: number; phone: string; email: string | null }>(`
    SELECT id, phone, email FROM users
    WHERE role = 'customer' AND customer_id IS NULL
  `);
  console.log(`Found ${rows.length} orphan customer user(s):`, rows);

  for (const row of rows) {
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [row.id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [row.id]);
    console.log(`  deleted user ${row.id} (${row.phone})`);
  }

  const pending = await pool.query(`DELETE FROM auth_pending_google`);
  console.log(`Cleared ${pending.rowCount ?? 0} pending Google sign-up(s).`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
