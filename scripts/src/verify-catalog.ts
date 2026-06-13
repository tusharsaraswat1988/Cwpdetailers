/**
 * Verifies Service Catalog Engine tables and public APIs.
 * Usage: pnpm --filter @workspace/scripts run verify:catalog
 */
import "./load-env.js";
import { readAdminCredentials } from "./adminEnv.js";

const BASE = process.env.API_URL ?? "http://localhost:8080/api";

async function get(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function login(phone: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { token?: string };
  return data.token ?? null;
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

  const publicEndpoints = [
    "/catalog/settings",
    "/catalog/packages?citySlug=varanasi",
    "/catalog/homepage",
    "/catalog/addons",
    "/catalog/pricing/quote?serviceId=2&citySlug=varanasi&vehicleModelId=1",
  ];

  let apiOnline = true;
  for (const ep of publicEndpoints) {
    try {
      const r = await get(ep);
      checks.push({
        name: `GET ${ep}`,
        pass: r.ok,
        detail: r.ok ? undefined : `status ${r.status}`,
      });
      if (ep.includes("pricing/quote") && r.ok) {
        const amount = (r.body as { amount?: number }).amount;
        checks.push({
          name: "pricing/quote returns amount",
          pass: typeof amount === "number" && amount > 0,
          detail: typeof amount === "number" ? undefined : "missing amount",
        });
      }
    } catch {
      apiOnline = false;
      checks.push({ name: `GET ${ep}`, pass: false, detail: "API not running (skip if offline)" });
    }
  }

  if (apiOnline) {
    const adminPerms = await pool.query(
      `SELECT resource, action FROM permissions WHERE role = 'admin' AND allow = true AND resource IN ('masters','catalog','pricing','packages','addons') ORDER BY resource, action`,
    );
    for (const resource of ["masters", "catalog", "pricing", "packages", "addons"]) {
      const rows = adminPerms.rows.filter((r: { resource: string }) => r.resource === resource);
      checks.push({
        name: `admin permission:${resource}`,
        pass: rows.length >= 5,
        detail: rows.length >= 5 ? undefined : `only ${rows.length} actions seeded`,
      });
    }

    const adminCreds = readAdminCredentials();
    const token = await login(adminCreds.phone, adminCreds.password);
    if (token) {
      const adminEndpoints = [
        "/masters/service-categories",
        "/catalog/addons",
        "/catalog/packages?citySlug=varanasi",
        "/catalog/homepage",
        "/catalog/pricing/quote?serviceId=2&citySlug=varanasi&vehicleModelId=1",
      ];
      for (const ep of adminEndpoints) {
        const r = await get(ep, token);
        checks.push({
          name: `admin GET ${ep.split("?")[0]}`,
          pass: r.ok,
          detail: r.ok ? undefined : `status ${r.status}`,
        });
      }
    } else {
      checks.push({ name: "admin login", pass: false, detail: "could not authenticate" });
    }
  }

  await pool.end();

  const failed = checks.filter(c => !c.pass);
  const dbFailed = failed.filter(c => c.name.startsWith("table:"));
  const adminPermFailed = failed.filter(c => c.name.startsWith("admin permission:"));
  for (const c of checks) {
    console.log(c.pass ? "✓" : "✗", c.name, c.detail ?? "");
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (dbFailed.length || adminPermFailed.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

