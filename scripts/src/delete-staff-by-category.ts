import "./load-env.js";
import { pool } from "@workspace/db";

type StaffTarget = {
  id: number;
  name: string;
  phone: string;
  staff_category: string;
  user_id: number | null;
};

async function loadStaffByCategory(category: string): Promise<StaffTarget[]> {
  const { rows } = await pool.query<StaffTarget>(
    `SELECT id, name, phone, staff_category, user_id
     FROM staff WHERE staff_category = $1 ORDER BY id`,
    [category],
  );
  return rows;
}

async function deleteStaffPermanently(staffId: number) {
  const nullify: string[] = [
    `UPDATE bookings SET staff_id = NULL WHERE staff_id = $1`,
    `UPDATE complaints SET related_staff_id = NULL WHERE related_staff_id = $1`,
    `UPDATE complaints SET assigned_supervisor_id = NULL WHERE assigned_supervisor_id = $1`,
    `UPDATE leads SET assigned_to_staff_id = NULL WHERE assigned_to_staff_id = $1`,
    `UPDATE staff SET reporting_manager_id = NULL WHERE reporting_manager_id = $1`,
    `UPDATE users SET staff_id = NULL WHERE staff_id = $1`,
  ];

  const deleteRows: string[] = [
    `DELETE FROM attendance WHERE staff_id = $1`,
  ];

  const optionalNullify: string[] = [
    `UPDATE vehicles SET assigned_staff_id = NULL WHERE assigned_staff_id = $1`,
    `UPDATE invoices SET received_by_staff_id = NULL WHERE received_by_staff_id = $1`,
  ];

  const optionalDelete: string[] = [
    `DELETE FROM staff_location_logs WHERE staff_id = $1`,
    `DELETE FROM dcms_staff_assignments WHERE staff_id = $1`,
    `DELETE FROM dcms_visits WHERE staff_id = $1`,
    `DELETE FROM service_assignments WHERE assigned_staff_id = $1`,
    `DELETE FROM service_executions WHERE assigned_staff_id = $1`,
  ];

  for (const sql of nullify) {
    await pool.query(sql, [staffId]);
  }
  for (const sql of deleteRows) {
    await pool.query(sql, [staffId]);
  }

  for (const sql of optionalNullify) {
    const table = sql.match(/UPDATE (\w+)/)?.[1];
    if (!table) continue;
    const { rows } = await pool.query(`SELECT to_regclass('public.${table}') AS reg`);
    if (!rows[0]?.reg) continue;
    try {
      await pool.query(sql, [staffId]);
    } catch (err) {
      if ((err as { code?: string }).code === "42703") continue;
      throw err;
    }
  }

  for (const sql of optionalDelete) {
    const table = sql.match(/DELETE FROM (\w+)/)?.[1];
    if (!table) continue;
    const { rows } = await pool.query(`SELECT to_regclass('public.${table}') AS reg`);
    if (!rows[0]?.reg) continue;
    try {
      await pool.query(sql, [staffId]);
    } catch (err) {
      if ((err as { code?: string }).code === "42703") continue;
      throw err;
    }
  }

  const { rows: staffRow } = await pool.query<{ user_id: number | null }>(
    `SELECT user_id FROM staff WHERE id = $1`,
    [staffId],
  );
  const linkedUserId = staffRow[0]?.user_id ?? null;

  await pool.query(`UPDATE staff SET user_id = NULL WHERE id = $1`, [staffId]);

  const userIds = new Set<number>();
  if (linkedUserId != null) userIds.add(linkedUserId);
  const { rows: byStaffId } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE staff_id = $1`,
    [staffId],
  );
  for (const u of byStaffId) userIds.add(u.id);

  for (const uid of userIds) {
    const { rows: fn } = await pool.query(
      `SELECT to_regprocedure('clear_user_references(integer)') IS NOT NULL AS ok`,
    );
    if (fn[0]?.ok) {
      await pool.query(`SELECT clear_user_references($1)`, [uid]);
    } else {
      await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [uid]);
    }
    await pool.query(`DELETE FROM users WHERE id = $1`, [uid]);
  }

  await pool.query(`DELETE FROM staff WHERE id = $1`, [staffId]);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cleaningCount = Number(process.argv.find(a => a.startsWith("--cleaning="))?.split("=")[1] ?? 5);
  const supervisorCount = Number(process.argv.find(a => a.startsWith("--supervisors="))?.split("=")[1] ?? 1);

  const cleaning = await loadStaffByCategory("cleaning_staff");
  const supervisors = await loadStaffByCategory("supervisor");

  const toDeleteCleaning = cleaning.slice(-cleaningCount);
  const toDeleteSupervisors = supervisors.slice(-supervisorCount);

  if (toDeleteCleaning.length === 0 && toDeleteSupervisors.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  console.log(`Will delete ${toDeleteCleaning.length} cleaning staff + ${toDeleteSupervisors.length} supervisor(s):\n`);

  for (const s of [...toDeleteCleaning, ...toDeleteSupervisors]) {
    console.log(`  DELETE id=${s.id}  ${s.name}  ${s.phone}  [${s.staff_category}]  user_id=${s.user_id ?? "—"}`);
  }

  if (dryRun) {
    console.log("\nDry run — re-run without --dry-run to apply.");
    return;
  }

  for (const s of [...toDeleteCleaning, ...toDeleteSupervisors]) {
    await deleteStaffPermanently(s.id);
  }

  console.log(`\nPermanently deleted ${toDeleteCleaning.length + toDeleteSupervisors.length} staff row(s).`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
