/**
 * Debug: compare service_assignments in DB vs /api/assignments/assigned response.
 */
import "./load-env.js";
import { readAdminCredentials } from "./adminEnv.js";
import { pool } from "@workspace/db";

const API = process.env.API_URL ?? "http://127.0.0.1:8080";

async function main() {
  const { phone, password } = readAdminCredentials();

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Portal": "admin" },
    body: JSON.stringify({ phone, password, portal: "admin" }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) throw new Error(login.error ?? "Login failed");

  const token = login.token as string;
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

  const assignedRes = await fetch(`${API}/api/assignments/assigned`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: cookie,
      "X-Auth-Portal": "admin",
    },
  });
  const assigned = await assignedRes.json();
  console.log("assigned API status:", assignedRes.status);
  console.log("assigned count from API:", Array.isArray(assigned) ? assigned.length : assigned);

  const db = await pool.query(
    "SELECT id, company_id, branch_id, assigned_staff_id, task_type, status FROM service_assignments ORDER BY id DESC LIMIT 10",
  );
  console.log("DB assignments:", db.rows);
  console.log("admin user companyId:", login.user?.companyId);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
