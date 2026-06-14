/** HTTP API smoke test for subscription + DCMS daily cleaning */
import "./load-env.js";
import { readAdminCredentials } from "./adminEnv.js";

const BASE = "http://127.0.0.1:8080/api";

async function login(phone: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = await res.json();
  return { ok: res.ok, token: body.token as string, body };
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log("=== Phase 4 HTTP API Verification ===\n");
  const results: string[] = [];

  const adminCreds = readAdminCredentials();
  const admin = await login(adminCreds.phone, adminCreds.password);
  results.push(`Admin login: ${admin.ok ? "PASS" : "FAIL"}`);

  const dueWashes = await get("/subscriptions/due-washes", admin.token);
  results.push(`GET /subscriptions/due-washes: ${dueWashes.status === 200 ? "PASS" : "FAIL"} (count=${dueWashes.body?.total})`);

  const dcmsDashboard = await get("/daily-cleaning/admin/dashboard", admin.token);
  results.push(`GET /daily-cleaning/admin/dashboard: ${dcmsDashboard.status === 200 ? "PASS" : "FAIL"}`);

  const customer = await login("9001001001", "customer123");
  const cid = customer.body?.user?.customerId ?? 1;
  const wallet = await get(`/customers/${cid}/wallet`, customer.token);
  results.push(`GET wallet: ${wallet.status === 200 && typeof wallet.body?.balance === "number" ? "PASS" : "FAIL"} (balance=${wallet.body?.balance})`);

  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.includes("FAIL")).length;
  console.log(`\n=== ${failed === 0 ? "ALL PASS" : `${failed} FAILED`} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
