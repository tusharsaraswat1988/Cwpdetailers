/**
 * Verifies Service Catalog Engine tables and public APIs.
 * Usage: pnpm --filter @workspace/scripts run verify:catalog
 */
import "./load-env.js";

const BASE = process.env.API_URL ?? "http://localhost:8080/api";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const { pool } = await import("@workspace/db");
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];

  const tables = [
    "catalog_settings", "service_city_availability", "solar_pricing_slabs",
    "service_addons", "service_addon_links", "catalog_packages",
    "catalog_package_entitlements", "customer_entitlements", "homepage_sections",
  ];

  for (const t of tables) {
    const r = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS ok`,
      [t],
    );
    checks.push({ name: `table:${t}`, pass: r.rows[0]?.ok === true });
  }

  const endpoints = [
    "/catalog/settings",
    "/catalog/packages?citySlug=varanasi",
    "/catalog/homepage",
    "/catalog/addons",
  ];

  for (const ep of endpoints) {
    const r = await get(ep);
    checks.push({
      name: `GET ${ep}`,
      pass: r.ok,
      detail: r.ok ? undefined : `status ${r.status}`,
    });
  }

  await pool.end();

  const failed = checks.filter(c => !c.pass);
  for (const c of checks) {
    console.log(c.pass ? "✓" : "✗", c.name, c.detail ?? "");
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
