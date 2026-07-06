/**
 * Verify session persistence: login → cookie → stale bearer + cookie fallback.
 */
import "./load-env.js";
import { readAdminCredentials } from "./adminEnv.js";

const API = process.env.API_URL ?? "http://127.0.0.1:8080";

async function login(phone: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Login failed (${res.status})`);
  const setCookie = res.headers.get("set-cookie");
  return { token: body.token as string, setCookie, user: body.user };
}

async function authMe(opts: { bearer?: string; cookie?: string }) {
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  const res = await fetch(`${API}/api/auth/me`, {
    headers,
    ...(opts.cookie ? { headers: { ...headers, Cookie: opts.cookie } } : {}),
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  const { phone, password } = readAdminCredentials();

  console.log("1. Login...");
  const { token, setCookie } = await login(phone, password);
  console.log(`   token length: ${token.length}`);
  console.log(`   set-cookie: ${setCookie ? "yes" : "NO — cookie missing!"}`);

  if (!setCookie) {
    console.error("FAIL: login did not set cwp_session cookie");
    process.exit(1);
  }

  const cookieHeader = setCookie.split(";")[0] ?? "";

  console.log("2. /auth/me with bearer only...");
  const bearerOnly = await authMe({ bearer: token });
  console.log(`   status: ${bearerOnly.status}`);

  console.log("3. /auth/me with cookie only...");
  const cookieOnly = await authMe({ cookie: cookieHeader });
  console.log(`   status: ${cookieOnly.status}`);

  console.log("4. /auth/me with STALE bearer + valid cookie (simulates refresh bug)...");
  const staleBearer = "0".repeat(64);
  const res = await fetch(`${API}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${staleBearer}`,
      Cookie: cookieHeader,
    },
  });
  console.log(`   status: ${res.status} ${res.ok ? "OK" : "FAIL"}`);

  if (!cookieOnly.ok || !res.ok) {
    console.error("\nFAIL: session fallback broken");
    process.exit(1);
  }

  console.log("\nPASS: cookie session works; stale bearer no longer blocks cookie auth.");
}

main().catch(e => { console.error(e); process.exit(1); });
