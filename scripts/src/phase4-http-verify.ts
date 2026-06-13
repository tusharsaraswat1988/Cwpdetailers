/** HTTP API smoke test for Phase 4 daily cleaning automation */
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

async function post(path: string, token: string, data: unknown = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function patch(path: string, token: string, data: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log("=== Phase 4 HTTP API Verification ===\n");
  const results: string[] = [];

  const adminCreds = readAdminCredentials();
  const admin = await login(adminCreds.phone, adminCreds.password);
  results.push(`Admin login: ${admin.ok ? "PASS" : "FAIL"}`);

  const dailyOps = await get("/subscriptions/daily-ops", admin.token);
  results.push(`GET /subscriptions/daily-ops: ${dailyOps.status === 200 ? "PASS" : "FAIL"} (active=${dailyOps.body?.activeDailyContracts})`);

  const dueWashes = await get("/subscriptions/due-washes", admin.token);
  results.push(`GET /subscriptions/due-washes: ${dueWashes.status === 200 ? "PASS" : "FAIL"} (count=${dueWashes.body?.total})`);

  const schedule = await post("/subscriptions/daily-schedule", admin.token);
  results.push(`POST /subscriptions/daily-schedule: ${schedule.status === 200 ? "PASS" : "FAIL"} (created=${schedule.body?.created}, skipped=${schedule.body?.skipped})`);

  const tick = await post("/subscriptions/daily-tick", admin.token, { force: true });
  results.push(`POST /subscriptions/daily-tick (force): ${tick.status === 200 ? "PASS" : "FAIL"} (skipped=${tick.body?.skipped ?? false})`);

  const vehicles = await get("/vehicles?customerId=1", admin.token);
  const vehicleId = vehicles.body?.[0]?.id;
  if (vehicleId) {
    const assign = await patch(`/vehicles/${vehicleId}`, admin.token, { assignedStaffId: 1 });
    results.push(`PATCH /vehicles/:id assignedStaffId: ${assign.status === 200 ? "PASS" : "FAIL"}`);
  } else {
    results.push("PATCH /vehicles/:id: SKIP (no vehicle)");
  }

  const customer = await login("9001001001", "customer123");
  const cid = customer.body?.user?.customerId ?? 1;
  const wallet = await get(`/customers/${cid}/wallet`, customer.token);
  results.push(`GET wallet (low balance fields): ${wallet.status === 200 && "isLowBalance" in (wallet.body ?? {}) ? "PASS" : "FAIL"} (isLowBalance=${wallet.body?.isLowBalance})`);

  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.includes("FAIL")).length;
  console.log(`\n=== ${failed === 0 ? "ALL PASS" : `${failed} FAILED`} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
