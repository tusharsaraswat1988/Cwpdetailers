/**
 * Verify portal-scoped session persistence: login → cookie → stale bearer + cookie fallback.
 */
import "./load-env.js";
import { readAdminCredentials } from "./adminEnv.js";

const API = process.env.API_URL ?? "http://127.0.0.1:8080";

async function login(phone: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password, portal: "admin" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Login failed (${res.status})`);
  const setCookie = res.headers.get("set-cookie");
  return { token: body.token as string, setCookie, user: body.user };
}

async function authMe(opts: { bearer?: string; cookie?: string; portal?: string }) {
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  if (opts.portal) headers["X-Auth-Portal"] = opts.portal;
  const res = await fetch(`${API}/api/auth/me`, {
    headers,
    ...(opts.cookie ? { headers: { ...headers, Cookie: opts.cookie } } : {}),
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  const { phone, password } = readAdminCredentials();

  console.log("1. Admin portal login...");
  const { token, setCookie } = await login(phone, password);
  console.log(`   token length: ${token.length}`);
  console.log(`   set-cookie: ${setCookie ? "yes" : "NO — cookie missing!"}`);

  if (!setCookie?.includes("cwp_session_admin")) {
    console.error("FAIL: login did not set cwp_session_admin cookie");
    process.exit(1);
  }

  const cookieHeader = setCookie.split(";")[0] ?? "";

  console.log("2. /auth/me with bearer only (admin portal)...");
  const bearerOnly = await authMe({ bearer: token, portal: "admin" });
  console.log(`   status: ${bearerOnly.status}`);

  console.log("3. /auth/me with cookie only (admin portal)...");
  const cookieOnly = await authMe({ cookie: cookieHeader, portal: "admin" });
  console.log(`   status: ${cookieOnly.status}`);

  console.log("4. /auth/me with STALE bearer + valid cookie (admin portal)...");
  const staleBearer = "0".repeat(64);
  const res = await fetch(`${API}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${staleBearer}`,
      Cookie: cookieHeader,
      "X-Auth-Portal": "admin",
    },
  });
  console.log(`   status: ${res.status} ${res.ok ? "OK" : "FAIL"}`);

  if (!cookieOnly.ok || !res.ok) {
    console.error("\nFAIL: session fallback broken");
    process.exit(1);
  }

  console.log("\nPASS: portal-scoped cookie session works; stale bearer no longer blocks cookie auth.");
}

main().catch(e => { console.error(e); process.exit(1); });
