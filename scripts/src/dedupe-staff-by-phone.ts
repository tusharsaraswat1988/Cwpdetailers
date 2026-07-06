import "./load-env.js";
import { pool } from "@workspace/db";

type StaffRow = {
  id: number;
  name: string;
  phone: string;
  user_id: number | null;
  is_active: boolean;
  created_at: Date;
};

/** Match migration 027 normalize_indian_mobile(). */
function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  let mobile: string | null = null;
  if (digits.length === 10) mobile = digits;
  else if (digits.length === 12 && digits.startsWith("91")) mobile = digits.slice(-10);
  else if (digits.length === 11 && digits.startsWith("0")) mobile = digits.slice(-10);
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) return null;
  return mobile;
}

async function loadAllStaff(): Promise<StaffRow[]> {
  const { rows } = await pool.query<StaffRow>(
    `SELECT id, name, phone, user_id, is_active, created_at FROM staff ORDER BY id`,
  );
  return rows;
}

function groupByNormalizedPhone(rows: StaffRow[]): Map<string, StaffRow[]> {
  const groups = new Map<string, StaffRow[]>();
  for (const row of rows) {
    const norm = normalizeIndianMobile(row.phone) ?? row.phone.trim();
    const list = groups.get(norm) ?? [];
    list.push(row);
    groups.set(norm, list);
  }
  return groups;
}

/** Prefer staff with login account, then active, then lowest id. */
function pickKeeper(rows: StaffRow[]): StaffRow {
  const withUser = rows.filter(r => r.user_id != null);
  if (withUser.length === 1) return withUser[0]!;
  if (withUser.length > 1) {
    const active = withUser.filter(r => r.is_active);
    return (active[0] ?? withUser[0])!;
  }
  const active = rows.filter(r => r.is_active);
  return (active[0] ?? rows[0])!;
}

async function reassignAndDelete(keeperId: number, loserId: number) {
  const updates: string[] = [
    `UPDATE bookings SET staff_id = $1 WHERE staff_id = $2`,
    `UPDATE attendance SET staff_id = $1 WHERE staff_id = $2`,
    `UPDATE complaints SET related_staff_id = $1 WHERE related_staff_id = $2`,
    `UPDATE complaints SET assigned_supervisor_id = $1 WHERE assigned_supervisor_id = $2`,
    `UPDATE leads SET assigned_to_staff_id = $1 WHERE assigned_to_staff_id = $2`,
    `UPDATE staff SET reporting_manager_id = $1 WHERE reporting_manager_id = $2`,
    `UPDATE users SET staff_id = $1 WHERE staff_id = $2`,
  ];

  const optional: string[] = [
    `UPDATE vehicles SET assigned_staff_id = $1 WHERE assigned_staff_id = $2`,
    `UPDATE staff_location_logs SET staff_id = $1 WHERE staff_id = $2`,
    `UPDATE dcms_staff_assignments SET staff_id = $1 WHERE staff_id = $2`,
    `UPDATE dcms_visits SET staff_id = $1 WHERE staff_id = $2`,
    `UPDATE service_assignments SET assigned_staff_id = $1 WHERE assigned_staff_id = $2`,
    `UPDATE service_executions SET assigned_staff_id = $1 WHERE assigned_staff_id = $2`,
    `UPDATE service_executions SET author_staff_id = $1 WHERE author_staff_id = $2`,
    `UPDATE invoices SET received_by_staff_id = $1 WHERE received_by_staff_id = $2`,
  ];

  for (const sql of updates) {
    await pool.query(sql, [keeperId, loserId]);
  }

  for (const sql of optional) {
    const table = sql.match(/UPDATE (\w+)/)?.[1];
    if (!table) continue;
    const { rows } = await pool.query(
      `SELECT to_regclass('public.${table}') AS reg`,
    );
    if (!rows[0]?.reg) continue;
    try {
      await pool.query(sql, [keeperId, loserId]);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "42703") continue; // column missing on this schema version
      throw err;
    }
  }

  const { rows: loserStaff } = await pool.query<{ user_id: number | null }>(
    `SELECT user_id FROM staff WHERE id = $1`,
    [loserId],
  );
  const loserUserId = loserStaff[0]?.user_id ?? null;

  await pool.query(
    `UPDATE staff SET user_id = NULL WHERE id = $1`,
    [loserId],
  );

  const userIds = new Set<number>();
  if (loserUserId != null) userIds.add(loserUserId);
  const { rows: byStaffId } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE staff_id = $1`,
    [loserId],
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

  await pool.query(`DELETE FROM staff WHERE id = $1`, [loserId]);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const allStaff = await loadAllStaff();
  const dupGroups = [...groupByNormalizedPhone(allStaff).entries()]
    .filter(([, rows]) => rows.length > 1)
    .sort(([a], [b]) => a.localeCompare(b));

  if (dupGroups.length === 0) {
    console.log("No duplicate staff phone numbers found.");
    return;
  }

  console.log(`Found ${dupGroups.length} phone number(s) with duplicate staff:\n`);

  let deleted = 0;
  for (const [normPhone, staffRows] of dupGroups) {
    const keeper = pickKeeper(staffRows);
    const losers = staffRows.filter(r => r.id !== keeper.id);

    console.log(`Phone ${normPhone}:`);
    console.log(`  KEEP   id=${keeper.id}  ${keeper.name}  user_id=${keeper.user_id ?? "—"}`);
    for (const l of losers) {
      console.log(`  DELETE id=${l.id}  ${l.name}  user_id=${l.user_id ?? "—"}`);
    }

    if (!dryRun) {
      for (const l of losers) {
        await reassignAndDelete(keeper.id, l.id);
        deleted++;
      }
    }
    console.log("");
  }

  if (dryRun) {
    console.log(`Dry run — would delete ${dupGroups.reduce((n, [, rows]) => n + rows.length - 1, 0)} duplicate staff row(s).`);
    console.log("Re-run without --dry-run to apply.");
  } else {
    console.log(`Deleted ${deleted} duplicate staff row(s).`);
    const after = [...groupByNormalizedPhone(await loadAllStaff()).values()].filter(r => r.length > 1);
    console.log(after.length === 0 ? "No duplicates remain." : `Warning: ${after.length} duplicate group(s) still remain.`);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
