/**
 * Clear all staff task assignments from the unified Assign Services flow.
 * Removes service_executions (+ child rows via CASCADE), service_assignments,
 * and resets pending_service_assignments back to pending.
 */
import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  const before = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM service_assignments) AS assignments,
      (SELECT COUNT(*)::int FROM service_executions) AS executions,
      (SELECT COUNT(*)::int FROM pending_service_assignments WHERE status = 'assigned') AS pending_assigned,
      (SELECT COUNT(*)::int FROM pending_service_assignments WHERE status = 'pending') AS pending_open
  `);
  console.log("Before:", before.rows[0]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const execDel = await client.query("DELETE FROM service_executions");
    console.log(`Deleted service_executions: ${execDel.rowCount ?? 0}`);

    const assignDel = await client.query("DELETE FROM service_assignments");
    console.log(`Deleted service_assignments: ${assignDel.rowCount ?? 0}`);

    const pendingReset = await client.query(`
      UPDATE pending_service_assignments
      SET status = 'pending', updated_at = NOW()
      WHERE status = 'assigned'
    `);
    console.log(`Reset pending queue to pending: ${pendingReset.rowCount ?? 0}`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const after = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM service_assignments) AS assignments,
      (SELECT COUNT(*)::int FROM service_executions) AS executions,
      (SELECT COUNT(*)::int FROM pending_service_assignments WHERE status = 'assigned') AS pending_assigned,
      (SELECT COUNT(*)::int FROM pending_service_assignments WHERE status = 'pending') AS pending_open
  `);
  console.log("After:", after.rows[0]);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
