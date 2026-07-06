import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const { rowCount } = await pool.query(`
    UPDATE users u
    SET
      name = s.name,
      phone = s.phone,
      email = s.email,
      branch_id = s.branch_id,
      company_id = s.company_id,
      franchisee_id = s.franchisee_id,
      staff_id = s.id,
      updated_at = NOW()
    FROM staff s
    WHERE u.id = s.user_id OR u.staff_id = s.id
  `);
  console.log(`Synced ${rowCount ?? 0} staff login user(s).`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
