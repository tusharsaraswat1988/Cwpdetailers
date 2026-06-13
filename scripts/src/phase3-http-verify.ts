/** HTTP API smoke test for Phase 3 endpoints */
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

async function post(path: string, token: string, data: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log("=== Phase 3 HTTP API Verification ===\n");

  const adminCreds = readAdminCredentials();
  const admin = await login(adminCreds.phone, adminCreds.password);
  console.log(`Admin login: ${admin.ok ? "PASS" : "FAIL"} (${admin.body?.user?.role})`);

  const customer = await login("9001001001", "customer123");
  console.log(`Customer login: ${customer.ok ? "PASS" : "FAIL"} (customerId=${customer.body?.user?.customerId})`);

  const cid = customer.body?.user?.customerId ?? 1;

  const wallet = await get(`/customers/${cid}/wallet`, customer.token);
  console.log(`GET /customers/:id/wallet [customer]: ${wallet.status} balance=₹${wallet.body?.balance}`);

  const txs = await get(`/customers/${cid}/wallet/transactions`, customer.token);
  console.log(`GET wallet/transactions [customer]: ${txs.status} count=${txs.body?.total}`);

  const credit = await post(`/customers/${cid}/wallet/credit`, admin.token, {
    amount: 1000,
    paymentMode: "cash",
    notes: "HTTP API verification",
  });
  console.log(`POST wallet/credit [admin]: ${credit.status} balanceAfter=₹${credit.body?.balance}`);

  const customerBlocked = await post(`/customers/${cid}/wallet/credit`, customer.token, {
    amount: 100,
    paymentMode: "cash",
  });
  console.log(`POST wallet/credit [customer blocked]: ${customerBlocked.status} (expect 403)`);

  const inv = await post("/invoices", admin.token, {
    customerId: cid,
    gstInclusive: true,
    items: [{ description: "Solar AMC 12 months", quantity: 1, unitPrice: 14999, total: 14999 }],
  });
  console.log(`POST /invoices: ${inv.status} invoice#=${inv.body?.invoiceNumber} total=₹${inv.body?.totalAmount}`);

  const pdf = await fetch(`${BASE}/invoices/${inv.body?.id}/pdf`, { headers: { Authorization: `Bearer ${admin.token}` } });
  console.log(`GET /invoices/:id/pdf: ${pdf.status} content-type=${pdf.headers.get("content-type")}`);

  const smsTest = await post("/notifications/test-sms", admin.token, {
    phone: "9001001001",
    message: "CWP Phase 3 test",
  });
  console.log(`POST /notifications/test-sms: ${smsTest.status} adapter=${smsTest.body?.adapter} success=${smsTest.body?.success} error=${smsTest.body?.error ?? "none"}`);

  console.log("\n=== HTTP verification complete ===");
}

main().catch(console.error);
