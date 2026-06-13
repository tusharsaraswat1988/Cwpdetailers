/**
 * Verifies LM-1 through LM-6: schema, parse, validate, dry-run import, login.
 * Usage: pnpm --filter @workspace/scripts run verify:migration-lm6
 */
import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const samplePath = path.join(root, "fixtures/legacy-migration-sample.xlsx");
const BASE = process.env.API_URL ?? "http://localhost:8080/api";

async function main() {
  const { pool } = await import("@workspace/db");
  const {
    previewWorkbook,
    importCustomers,
    resolvePackageSlug,
    MIGRATION_PACKAGE_MAP,
  } = await import("../../artifacts/api-server/src/lib/migration/legacyImportEngine.ts");
  const { grantEntitlementWithBalance } = await import("../../artifacts/api-server/src/lib/catalog/entitlementEngine.ts");

  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];

  // LM-1: schema columns + tables
  const customerCols = [
    "photo_url", "last_payment_date", "customer_since",
    "historical_wash_count", "historical_solar_visit_count", "operational_notes",
  ];
  for (const col of customerCols) {
    const r = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = $1
      ) AS ok`,
      [col],
    );
    checks.push({ name: `LM-1 customers.${col}`, pass: r.rows[0]?.ok === true });
  }
  for (const tbl of ["migration_batches", "migration_entity_map", "migration_row_log"]) {
    const r = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS ok`,
      [tbl],
    );
    checks.push({ name: `LM-1 table ${tbl}`, pass: r.rows[0]?.ok === true });
  }

  // LM-2: package map
  checks.push({
    name: "LM-2 resolvePackageSlug",
    pass: resolvePackageSlug("4 wash package") === "4-wash-package",
    detail: `${Object.keys(MIGRATION_PACKAGE_MAP).length} legacy names mapped`,
  });

  // LM-4: grantEntitlementWithBalance exists
  checks.push({
    name: "LM-4 grantEntitlementWithBalance",
    pass: typeof grantEntitlementWithBalance === "function",
  });

  let buffer: Buffer;
  try {
    buffer = readFileSync(samplePath);
    checks.push({ name: "Sample workbook exists", pass: true, detail: samplePath });
  } catch {
    checks.push({ name: "Sample workbook exists", pass: false, detail: `Run migration:sample first — ${samplePath}` });
    printResults(checks);
    await pool.end();
    process.exit(1);
  }

  // LM-3/5: parse + preview
  const preview = await previewWorkbook(buffer);
  checks.push({
    name: "LM-3 parse workbook",
    pass: preview.summary.customers >= 2,
    detail: `${preview.summary.customers} customers parsed`,
  });
  checks.push({
    name: "LM-5 validate customers",
    pass: preview.canImport || preview.summary.errors === 0,
    detail: `${preview.summary.errors} errors, ${preview.summary.warnings} warnings`,
  });

  // LM-6: dry-run import
  const dryRun = await importCustomers(buffer, {
    filename: "legacy-migration-sample.xlsx",
    citySlug: "varanasi",
    dryRun: true,
  });
  checks.push({
    name: "LM-6 dry-run import",
    pass: dryRun.created + dryRun.updated >= 2 && dryRun.issues.length === 0,
    detail: `created=${dryRun.created} updated=${dryRun.updated} users=${dryRun.usersCreated}`,
  });

  // LM-6: commit import (idempotent upsert)
  const committed = await importCustomers(buffer, {
    filename: "legacy-migration-sample.xlsx",
    citySlug: "varanasi",
    dryRun: false,
  });
  checks.push({
    name: "LM-6 commit import",
    pass: committed.issues.length === 0,
    detail: `created=${committed.created} updated=${committed.updated}`,
  });

  // Login smoke for imported customer
  try {
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9009009001", password: "legacy9001" }),
    });
    const loginBody = await loginRes.json().catch(() => ({})) as { token?: string };
    checks.push({
      name: "LM-6 imported customer login",
      pass: loginRes.ok && !!loginBody.token,
      detail: loginRes.ok ? "token received" : `HTTP ${loginRes.status}`,
    });

    if (loginBody.token) {
      const meRes = await fetch(`${BASE}/customers/me`, {
        headers: { Authorization: `Bearer ${loginBody.token}` },
      });
      const me = await meRes.json().catch(() => ({})) as { totalDues?: string; operationalNotes?: string };
      checks.push({
        name: "LM-6 customer profile fields",
        pass: meRes.ok && parseFloat(me.totalDues ?? "0") === 1200.5 && !!me.operationalNotes,
        detail: meRes.ok ? `dues=${me.totalDues}` : `HTTP ${meRes.status}`,
      });
    }
  } catch (err) {
    checks.push({
      name: "LM-6 imported customer login",
      pass: false,
      detail: err instanceof Error ? err.message : "API unreachable — start pnpm dev",
    });
  }

  printResults(checks);
  await pool.end();
  process.exit(checks.every(c => c.pass) ? 0 : 1);
}

function printResults(checks: Array<{ name: string; pass: boolean; detail?: string }>) {
  console.log("\n=== LM-1–LM-6 Verification ===\n");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  const passed = checks.filter(c => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
