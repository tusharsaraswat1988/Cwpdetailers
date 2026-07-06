/**
 * Phase 1 verification — staff operational roles + product-line role filtering.
 */
import "./load-env.js";
import { pool } from "@workspace/db";

const PRODUCT_LINES = [
  { line: "daily_cleaning", role: "daily_car_cleaner", label: "Daily Car Cleaner" },
  { line: "wash_package", role: "car_washer", label: "Car Washer" },
  { line: "monthly_wash", role: "car_washer", label: "Car Washer" },
  { line: "solar_amc", role: "solar_cleaner", label: "Solar Cleaner" },
  { line: "one_time_service", role: "car_washer", label: "Car Washer" },
];

async function main() {
  console.log("=== Phase 1: Staff operational roles ===\n");

  const staff = await pool.query(`
    SELECT s.id, s.name, s.is_active, s.verification_status,
           COALESCE(json_agg(json_build_object('slug', rm.slug, 'name', rm.name))
             FILTER (WHERE rm.id IS NOT NULL), '[]') AS roles
    FROM staff s
    LEFT JOIN staff_role_assignments sra ON sra.staff_id = s.id
    LEFT JOIN staff_role_master rm ON rm.id = sra.role_id AND rm.is_active = true
    WHERE s.staff_category = 'cleaning_staff'
    GROUP BY s.id
    ORDER BY s.name
  `);

  if (!staff.rows.length) {
    console.log("No cleaning staff found.");
  } else {
    for (const row of staff.rows) {
      const roles = row.roles as Array<{ slug: string; name: string }>;
      const roleStr = roles.length ? roles.map(r => r.name).join(", ") : "(no roles assigned)";
      console.log(`• ${row.name} [id=${row.id}] — ${roleStr}${row.is_active ? "" : " (inactive)"}`);
    }
  }

  console.log("\n=== Eligible staff by product line (for Assign Services filter) ===\n");

  for (const pl of PRODUCT_LINES) {
    const eligible = await pool.query(
      `SELECT DISTINCT s.id, s.name
       FROM staff s
       INNER JOIN staff_role_assignments sra ON sra.staff_id = s.id
       INNER JOIN staff_role_master rm ON rm.id = sra.role_id
       WHERE rm.slug = $1 AND rm.is_active = true
         AND s.is_active = true AND s.verification_status != 'suspended'
         AND s.staff_category = 'cleaning_staff'
       ORDER BY s.name`,
      [pl.role],
    );
    const names = eligible.rows.map(r => r.name).join(", ") || "(none)";
    console.log(`${pl.line} → requires ${pl.label}:`);
    console.log(`  ${names}\n`);
  }

  const multiRole = staff.rows.filter(r => (r.roles as unknown[]).length > 1);
  if (multiRole.length) {
    console.log("Multi-role staff (appear in multiple assignment filters):");
    for (const row of multiRole) {
      console.log(`  ${row.name}: ${(row.roles as Array<{ name: string }>).map(r => r.name).join(" + ")}`);
    }
  } else {
    console.log("No multi-role staff yet — use Staff profile → Roles & Skills to add multiple roles (e.g. Abhishek).");
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
