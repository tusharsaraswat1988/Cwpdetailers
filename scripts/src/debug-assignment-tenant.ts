/**
 * Debug tenant scope vs assignment visibility.
 */
import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const admins = await pool.query(
    `SELECT id, name, role, company_id, branch_id FROM users WHERE role IN ('admin','superadmin','manager') ORDER BY id`,
  );
  console.log("Admin users:", admins.rows);

  const assignments = await pool.query(
    `SELECT id, company_id, branch_id, assigned_staff_id, task_type, assigned_at FROM service_assignments ORDER BY id`,
  );
  console.log("All assignments:", assignments.rows);

  const pending = await pool.query(`
    SELECT psa.id, psa.company_id, cc.company_id AS contract_company, c.company_id AS customer_company
    FROM pending_service_assignments psa
    JOIN customer_contracts cc ON cc.id = psa.contract_registry_id
    JOIN customers c ON c.id = psa.customer_id
    ORDER BY psa.id
  `);
  console.log("Pending tenant fields:", pending.rows);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
