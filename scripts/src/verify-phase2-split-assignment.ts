/**
 * Phase 2 verification — split assignment task types + substitute executions.
 */
import "./load-env.js";
import { pool } from "@workspace/db";

async function main() {
  console.log("=== Phase 2: Split assignment task types ===\n");

  const pending = await pool.query(`
    SELECT psa.id, psa.status, cc.product_line, cc.summary_json,
           c.name AS customer_name
    FROM pending_service_assignments psa
    JOIN customer_contracts cc ON cc.id = psa.contract_registry_id
    JOIN customers c ON c.id = psa.customer_id
    WHERE psa.status IN ('pending', 'assigned')
    ORDER BY psa.id DESC
    LIMIT 20
  `);

  if (!pending.rows.length) {
    console.log("No pending/assigned queue items found.");
  } else {
    for (const row of pending.rows) {
      const summary = row.summary_json ?? {};
      const allocatedWashes = Number(summary.allocatedWashes ?? summary.remainingWashes ?? 0);
      const required =
        row.product_line === "daily_cleaning" && allocatedWashes > 0
          ? ["daily_cleaning", "car_wash"]
          : [row.product_line === "daily_cleaning" ? "daily_cleaning" : row.product_line];

      const assignments = await pool.query(
        `SELECT sa.task_type, s.name AS staff_name
         FROM service_assignments sa
         JOIN staff s ON s.id = sa.assigned_staff_id
         WHERE sa.pending_assignment_id = $1`,
        [row.id],
      );

      const assignedTypes = assignments.rows.map((a: { task_type: string }) => a.task_type);
      const missing = required.filter((t: string) => !assignedTypes.includes(t));

      console.log(`Pending #${row.id} — ${row.customer_name} (${row.product_line})`);
      console.log(`  Required tasks: ${required.join(", ")}`);
      if (assignments.rows.length) {
        for (const a of assignments.rows) {
          console.log(`  ✓ ${a.task_type} → ${a.staff_name}`);
        }
      } else {
        console.log("  (no assignments yet)");
      }
      if (missing.length) {
        console.log(`  ⚠ Still needs: ${missing.join(", ")}`);
      } else {
        console.log("  ✓ All tasks assigned");
      }
      console.log("");
    }
  }

  console.log("=== Recent substitute executions ===\n");

  const subs = await pool.query(`
    SELECT se.id, se.task_type, se.scheduled_date, se.status,
           sub.name AS substitute_name, prim.name AS regular_name,
           c.name AS customer_name
    FROM service_executions se
    JOIN staff sub ON sub.id = se.assigned_staff_id
    LEFT JOIN staff prim ON prim.id = se.substitute_for_staff_id
    JOIN customers c ON c.id = se.customer_id
    WHERE se.is_substitute = true
    ORDER BY se.created_at DESC
    LIMIT 10
  `);

  if (!subs.rows.length) {
    console.log("No substitute executions yet — use Assign Services → Staff assigned → Substitute today.");
  } else {
    for (const row of subs.rows) {
      console.log(
        `• Execution #${row.id} — ${row.task_type} on ${row.scheduled_date}: `
        + `${row.substitute_name} covering for ${row.regular_name ?? "?"} `
        + `(${row.customer_name}, ${row.status})`,
      );
    }
  }

  console.log("\n=== Schema check ===\n");
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'service_assignments' AND column_name = 'task_type'
  `);
  console.log(cols.rows.length ? "✓ service_assignments.task_type exists" : "✗ task_type column missing — run migration 039");

  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE indexname = 'service_assignments_pending_task_unique'
  `);
  console.log(idx.rows.length ? "✓ pending+task_type unique index exists" : "✗ unique index missing");

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
