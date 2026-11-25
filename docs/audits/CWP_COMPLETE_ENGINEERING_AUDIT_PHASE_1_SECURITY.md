# CWP COMPLETE ENGINEERING AUDIT — PHASE 1: SECURITY FORENSICS, SECRET EXPOSURE, PRODUCTION DATABASE SAFETY & ATTACK SURFACE

**Project:** CWP Detailers Multi-City Automotive & Solar Detailing Platform  
**Repository:** `tusharsaraswat1988/Cwpdetailers`  
**Current HEAD Commit:** `6377bbe16568aac15495bbbad205bb55db66878c`  
**Preceding Phase 0 Baseline Commit:** `f87bd420f0e641e3cee5dd7d75fbd8223e40a13b`  
**Audit Date:** November 25, 2026  
**Audit Mode:** STRICT READ-ONLY SECURITY FORENSIC INVESTIGATION  
**Auditor Role:** Principal Software Architect, Staff Engineer, Database Architect, Security Auditor & DevOps Lead  

---

## 1. EXECUTIVE SUMMARY & FORENSIC ASSESSMENT

A thorough, read-only security forensic audit of the CWP Detailers platform repository was conducted at commit `6377bbe16568aac15495bbbad205bb55db66878c`.

The investigation established **existential P0 security, data safety, and operational hazards** alongside sophisticated architectural controls. The codebase exhibits a stark dichotomy: robust server-side multi-tenant scoping and cryptographic webhook verification exist side-by-side with hardcoded production database connection strings containing live passwords in plain text, an unguarded script capable of instantly wiping 105 core business tables in production with zero confirmation, permissive CORS allowing arbitrary cross-origin credentialed requests, unauthenticated public DDL endpoints, and broken function-level authorization allowing regular customers to alter location pricing rules and operational zones company-wide.

### Summary of Critical Forensic Discoveries:

1. **Active Secret Exposure in Code & Git History (P0):**
   - Active, plain-text production PostgreSQL credentials (Neon AWS Singapore cluster) with username, password, hostname, and database name are hardcoded directly in `scripts/src/inspect-prod-db.ts` (line 4) and `scripts/src/reset-production-db.ts` (line 8).
   - In commit `0d1700f` (`Tue Jun 9 02:40:53 2026`), the complete `.env` file was committed directly to Git, exposing the live Neon production database URL and password, the full Cloudinary secret URL (`cloudinary://[API_KEY]:[SECRET]@[CLOUD_NAME]`), a 64-byte base64 `SESSION_SECRET`, and Supabase credentials. While `.env` was removed from git tracking in commit `c5ce494`, the secrets remain unredacted in Git history, and the database credentials were re-introduced into HEAD source code.

2. **Existential Production Database Wipe Hazard (P0):**
   - The script `scripts/src/reset-production-db.ts` (mapped to npm script `"db:reset-fresh"` in `scripts/package.json`) executes `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` across **105 core database tables** (all bookings, payments, subscriptions, customers, vehicles, staff, cities, branches, zones, users, and audit logs).
   - When executed without arguments, it defaults to the hardcoded live production database URL. It requires **zero confirmation flags**, has **no dry-run safeguard**, and lacks any production environment guardrail (such as checking `NODE_ENV !== 'production'` or `ALLOW_PRODUCTION_PURGE=true`). A developer or automated pipeline running `pnpm run db:reset-fresh` will wipe the live production database instantly.

3. **CORS Reflective Origin Vulnerability (P0):**
   - In `artifacts/api-server/src/app.ts` (line 100), Express is configured with `app.use(cors({ origin: true, credentials: true }))`.
   - This dynamically reflects the incoming `Origin` header from any requesting domain while permitting ambient authentication credentials (cookies). Any third-party malicious website visited by an authenticated admin, staff member, or customer can execute authenticated API requests and read sensitive tenant data.

4. **Unauthenticated Public DDL Execution Endpoint (P0/P1):**
   - In `artifacts/api-server/src/routes/payment-gateway.ts` (lines 100-128), `GET /api/payments/schema-repair` is exposed to the public Internet without authentication or authorization.
   - It executes 15 raw DDL queries (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) against the database on HTTP GET, and returns raw database engine execution statuses and error messages to anonymous callers.

5. **Broken Function-Level Authorization & Privilege Escalation (P0/P1):**
   - While core resources (customers, bookings, invoices, staff) are protected by RBAC permissions, auxiliary routers (`societies.ts`, `zones.ts`, `location-pricing.ts`) omitted permission middleware.
   - `POST /api/location-pricing`, `PATCH /api/location-pricing/:id`, and `DELETE /api/location-pricing/:id` lack role checks. Any authenticated customer can create, manipulate, slash to ₹1, or delete location pricing rules across all cities and branches.
   - `POST /api/societies`, `PATCH /api/societies/:id`, and `POST /api/societies/:id/towers` lack role checks, allowing any customer or staff member to modify residential societies and gate security notes.
   - `POST /api/zones` and `PATCH /api/zones/:id` allow any user with no assigned `branchId` (such as a customer) to bypass branch checks and create or deactivate operational zones.

6. **Insecure Session & Authentication Controls (P1):**
   - In `artifacts/cwp-platform/src/lib/auth.tsx`, session tokens are stored in browser `localStorage`, negating `httpOnly` cookie protection against Cross-Site Scripting (XSS).
   - In `artifacts/api-server/src/lib/sessionCookie.ts`, session tokens are accepted via GET query parameters (`?token=...`), leaking bearer tokens into proxy logs, browser histories, and Referer headers.
   - In `artifacts/api-server/src/lib/googleAuth.ts`, 6-digit OTP codes are generated using `Math.random()` rather than `crypto.randomInt()`.
   - In `artifacts/api-server/src/lib/authOtp.ts`, OTP verification lacks an attempt-lockout mechanism against repeated incorrect guesses within the 15-minute expiration window.
   - In `artifacts/api-server/src/lib/userPassword.ts`, password policy permits passwords as short as 6 characters with zero complexity requirements.

---

## 2. REPOSITORY & COMMIT BASELINE VERIFICATION

The forensic investigation was conducted at the following Git state:

| Parameter | Current Forensic State | Notes |
| :--- | :--- | :--- |
| **Repository** | `tusharsaraswat1988/Cwpdetailers` | Monorepo root |
| **Branch** | `main` | Production branch |
| **Current HEAD SHA** | `6377bbe16568aac15495bbbad205bb55db66878c` | Wed Nov 25 11:40:55 2026 +0530 |
| **Commit Message** | `feat(deploy): implement 100% automated zero-config database deployment & self-healing schema provisioning` | Added `deploy-auto.ts` & preDeploy hooks |
| **Preceding Commit** | `f87bd420f0e641e3cee5dd7d75fbd8223e40a13b` | Phase 0 baseline commit |
| **Working Tree State** | Clean (untracked: `docs/audits/CWP_COMPLETE_ENGINEERING_AUDIT_PHASE_0.md`) | Verified via `git status` |
| **Divergence from Remote** | `0 / 0` (local `main` tracking `origin/main` at HEAD) | Clean remote alignment |

---

## 3. COMPREHENSIVE SECRET EXPOSURE FORENSICS

### 3.1 Discovered Credentials & Exposure Inventory

> [!CAUTION]
> In accordance with strict audit rules, all passwords, keys, tokens, and secrets have been redacted using safe notation (`[REDACTED]`). Under no circumstances are raw credentials reproduced in this report.

| Ref ID | Category | Exposed Asset | Location | Git Status | Exposure Mechanism | Production Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-EXP-01** | Database Credential | Neon AWS PostgreSQL Connection String (User: `neondb_owner`) | `scripts/src/inspect-prod-db.ts#L4` | Current HEAD | Hardcoded in source code | **Critical:** Complete read/write access to production database |
| **SEC-EXP-02** | Database Credential | Neon AWS PostgreSQL Connection String (User: `neondb_owner`) | `scripts/src/reset-production-db.ts#L8` | Current HEAD | Hardcoded in source code | **Critical:** Truncates 105 production tables if executed |
| **SEC-EXP-03** | Database Credential | Neon AWS PostgreSQL Connection String (User: `neondb_owner`) | Historical Commit `0d1700f` (`.env`) | Git History | Committed plain-text `.env` | **Critical:** Permanently stored in Git commit object history |
| **SEC-EXP-04** | Cloud Storage | Cloudinary Full Secret URL (`cloudinary://87265774...:[REDACTED]@dhfphz6nv`) | Historical Commit `0d1700f` (`.env`) | Git History | Committed plain-text `.env` | **Critical:** Full read/write/delete control over Cloudinary media bucket |
| **SEC-EXP-05** | Session Cryptography | 64-byte Base64 Session Secret (`SESSION_SECRET`) | Historical Commit `0d1700f` (`.env`) | Git History | Committed plain-text `.env` | **High:** Potential cryptographic forgery of signed cookies if shared |
| **SEC-EXP-06** | Third-Party Auth | Supabase Project URL & Anon Public Key | Historical Commit `0d1700f` (`.env`) | Git History | Committed plain-text `.env` | **Medium:** Historical staging Supabase project access |
| **SEC-EXP-07** | Bootstrap Admin | Default Super Admin Phone & Password (`admin123`) | `scripts/src/reset-production-db.ts#L162` | Current HEAD | Hardcoded fallback credentials | **High:** Well-known default password if bootstrapped without env vars |
| **SEC-EXP-08** | Legacy Password Hash | Static Password Salt (`"cwp_salt"`) | `artifacts/api-server/src/lib/passwords.ts#L4` | Current HEAD | Hardcoded legacy salt | **Medium:** Static salt for legacy SHA-256 password verification |

### 3.2 Git History Timeline of the Exposure

1. **Commit `0d1700f` (`Tue Jun 9 02:40:53 2026`)**:
   - The developer committed `.env` directly into Git.
   - Exposed: Plain-text Neon PostgreSQL connection string (`postgresql://neondb_owner:[REDACTED]@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`), Cloudinary API Key and Secret, and base64 `SESSION_SECRET`.
2. **Commit `c5ce494` (`Fri Jun 12 19:28:38 2026`)**:
   - The developer deleted `.env` from tracking and added it to `.gitignore`.
   - **Flaw:** Git history was not rewritten. The commit object `0d1700f` remained accessible in the repository packfiles and GitHub remote history.
3. **Commit `f87bd42` (`Phase 0 Baseline Commit`)**:
   - The developer introduced `scripts/src/inspect-prod-db.ts` and `scripts/src/reset-production-db.ts`.
   - The exact same active Neon connection string and password were copy-pasted directly into TypeScript source code files.
4. **Commit `6377bbe` (`Current HEAD`)**:
   - Both files remain in HEAD with live plain-text credentials intact.

### 3.3 Target Database Analysis

The connection string specifies:
- **Provider:** Neon Serverless PostgreSQL
- **Host:** `ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech` (AWS Singapore, `ap-southeast-1`)
- **Database:** `neondb`
- **Role:** `neondb_owner` (Database owner role with full DDL, DML, TRUNCATE, and schema alteration privileges)
- **Pooler:** PgBouncer connection pooler endpoint enabled

---

## 4. PRODUCTION DATABASE SAFETY & WIPE SCRIPT AUDIT

### 4.1 Forensic Analysis of `scripts/src/reset-production-db.ts`

The script `reset-production-db.ts` was forensically analyzed line by line:

```typescript
// Target resolution logic:
const targetUrl =
  process.env.TARGET_DATABASE_URL ||
  process.argv[2] ||
  "postgresql://neondb_owner:[REDACTED]@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
```

#### Catastrophic Design Flaws:
1. **Hardcoded Fallback to Production:** If neither `TARGET_DATABASE_URL` nor a command-line argument is supplied, the script silently targets the live production database.
2. **Zero Interactive Confirmation:** There is no `readline` prompt asking `"Are you sure you want to truncate the production database?"`.
3. **Zero Safety Flags:** Unlike `delete-all-customers.ts` (which checks `--confirm`), this script executes unconditionally.
4. **Multi-Table CASCADE Truncation:** Line 154 executes:
   ```sql
   TRUNCATE TABLE [105 tables] RESTART IDENTITY CASCADE;
   ```
   This wipes every operational, transactional, CRM, financial, and master data record in the system and resets all auto-increment sequences to 1.
5. **Tables Targeted (105 Total):**
   - **Bookings & Operations:** `bookings`, `booking_events`, `service_executions`, `service_execution_photos`, `service_contracts`, `service_assignments`, `jobs`, `system_jobs`.
   - **DCMS Daily Operations:** `dcms_visits`, `dcms_subscriptions`, `dcms_plans`, `dcms_exceptions`, `dcms_staff_assignments`, `dcms_activity_logs`.
   - **Financials:** `payments`, `payment_attempts`, `payment_webhook_events`, `invoices`, `invoice_items`, `quotations`, `expenses`, `refunds`, `wallets`, `wallet_transactions`.
   - **Customers & Assets:** `customers`, `vehicles`, `solar_sites`, `assets`, `addresses`, `saved_locations`.
   - **Staff & Operations:** `staff`, `staff_attendance`, `staff_payouts`, `staff_location_logs`.
   - **Multi-City Network:** `cities`, `branches`, `operational_zones`, `residential_societies`, `society_towers`, `operating_hours`, `location_pricing_rules`.
   - **Identity & Access:** `users`, `sessions`, `auth_otp`, `password_resets`.
6. **Insecure Default Admin Re-creation:** After wiping the entire database, lines 161-179 insert a super admin user with default fallback credentials:
   - Phone: `9999999999`
   - Password: `admin123` (hashed via Argon2)
7. **Invocation Surface in `scripts/package.json`:**
   - Line 46 defines `"db:reset-fresh": "tsx ./src/reset-production-db.ts"`.
   - Any developer typing `pnpm run db:reset-fresh` on any machine will instantly wipe production.

---

## 5. NETWORK PERIMETER, TRANSPORT SECURITY & HEADERS

### 5.1 Cross-Origin Resource Sharing (CORS) — Critical Finding

In `artifacts/api-server/src/app.ts` line 100:
```typescript
app.use(cors({ origin: true, credentials: true }));
```

#### Forensic Vulnerability Analysis:
- In the `cors` npm package, setting `origin: true` dynamically captures the `Origin` header from the incoming HTTP request and reflects it verbatim in the `Access-Control-Allow-Origin` response header.
- Combining `origin: true` with `credentials: true` instructs browsers that the caller's origin is trusted to make credentialed requests (sending cookies and HTTP authentication headers) and read the response.
- **Attack Vector:** An attacker hosts a malicious website (e.g., `attacker.com`). When an authenticated CWP admin, staff member, or customer visits `attacker.com`, client-side JavaScript on `attacker.com` executes a cross-origin `fetch("https://api.cwpdetailers.in/api/customers", { credentials: "include" })`.
- Because Express reflects `Access-Control-Allow-Origin: https://attacker.com` and `Access-Control-Allow-Credentials: true`, the browser allows the attacker's script to read the response payload, stealing customer PII, financial records, and operational data.

### 5.2 Cross-Site Request Forgery (CSRF)

- The API server employs **no CSRF token validation** (such as double-submit cookies or Synchronizer Token Pattern).
- While modern browsers default to `SameSite=Lax` for cookies, `SameSite=Lax` allows top-level GET navigations to send cookies, and the permissive CORS configuration eliminates cross-origin boundary protections for AJAX/fetch requests from malicious sites.

### 5.3 Security Headers & Content Security Policy (CSP)

In `artifacts/api-server/src/app.ts` lines 56-78:
- **Strict-Transport-Security (HSTS):** `max-age=31536000; includeSubDomains; preload` is set, but **only when `isProd` is true**. If `NODE_ENV` is unset or misconfigured, HSTS is omitted.
- **Content-Security-Policy (CSP):**
  ```text
  upgrade-insecure-requests; default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: wss:; font-src 'self' https: data:; img-src 'self' https: data: blob:; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' https: 'unsafe-inline'; frame-src 'self' https:;
  ```
  - **Weakness:** The CSP includes `'unsafe-inline'` and `'unsafe-eval'` in both `default-src` and `script-src`, and permits `https:` from any external host. This substantially weakens XSS protection by allowing execution of inline scripts and dynamic eval.
- **X-Content-Type-Options:** `nosniff` is properly set.
- **X-Frame-Options:** `SAMEORIGIN` is properly set.
- **Referrer-Policy:** `strict-origin-when-cross-origin` is properly set.
- **X-Powered-By:** `app.disable("x-powered-by")` is properly enforced.

---

## 6. AUTHENTICATION, SESSION & CRYPTOGRAPHY FORENSICS

### 6.1 Session Architecture & Token Leakage

The platform uses a hybrid session model consisting of server-managed sessions in the `sessions` table:
1. **Cookie Storage:** Cookies use `HttpOnly`, `SameSite: "lax"`, `Path: "/"`, with namespaced portal keys (`cwp_session_admin`, `cwp_session_customer`, `cwp_session_staff`).
2. **Local Storage Bearer Token Storage (Vulnerability):**
   - In `artifacts/cwp-platform/src/lib/auth.tsx` (lines 111-115), whenever a user logs in, the token is written to browser `localStorage`:
     ```typescript
     localStorage.setItem(tokenStorageKey(portal), token);
     ```
   - Storing bearer tokens in `localStorage` exposes them to complete theft via any Cross-Site Scripting (XSS) vulnerability, rendering the `HttpOnly` cookie safeguard ineffective.
3. **Query Parameter Token Acceptance (Vulnerability):**
   - In `artifacts/api-server/src/lib/sessionCookie.ts` (lines 96-99):
     ```typescript
     const queryToken = typeof req.query?.token === "string" ? req.query.token.trim() : null;
     if (queryToken && !tokens.includes(queryToken)) {
       tokens.push(queryToken);
     }
     ```
   - The API server accepts authentication tokens via the URL query string (`?token=...`). Any link clicked, shared, or logged in access logs, forward-proxy logs, browser history, or HTTP `Referer` headers will leak the active bearer session token.
4. **Session Lifetime:**
   - Sessions have an active validity of **30 days** (`SESSION_TTL_DAYS = 30`). There is no idle timeout.

### 6.2 Password Security & Policies

1. **Hashing Algorithm:**
   - Current: `Argon2id` (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`). This is robust and complies with OWASP recommendations.
2. **Legacy Password Verification (Vulnerability):**
   - In `artifacts/api-server/src/lib/passwords.ts` (lines 4-13), backward compatibility is maintained for legacy SHA-256 hashes using a static, hardcoded salt:
     ```typescript
     const LEGACY_SALT = "cwp_salt";
     function legacyHashPassword(password: string): string {
       return crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
     }
     ```
   - Any historical account that has not logged in since migration retains a single-round SHA-256 hash salted with `"cwp_salt"`, which is trivially crackable via rainbow tables or GPU hashcat if the database is dumped.
3. **Password Policy (Vulnerability):**
   - In `artifacts/api-server/src/lib/userPassword.ts` (lines 28-32):
     ```typescript
     export function validateNewPassword(password: unknown) {
       if (typeof password !== "string" || password.length < 6) {
         return { ok: false, error: "Password must be at least 6 characters" };
       }
       return { ok: true, value: password };
     }
     ```
   - Passwords are permitted to be as short as **6 characters** with **zero complexity requirements** (no numbers, symbols, uppercase, or lowercase enforced). There is no validation against breached or common passwords (NIST SP 800-63B requires minimum 8 characters).

### 6.3 OTP Generation & Brute-Force Resilience

1. **Cryptographically Insecure PRNG (Vulnerability):**
   - In `artifacts/api-server/src/lib/googleAuth.ts` (lines 46-48):
     ```typescript
     export function generateOtpCode(): string {
       return String(Math.floor(100000 + Math.random() * 900000));
     }
     ```
   - `Math.random()` in V8/Node.js uses the `xorshift128+` pseudorandom algorithm, which is not cryptographically secure and can be predicted if internal state is reconstructed. It should be replaced with `crypto.randomInt(100000, 1000000)`.
2. **Missing Attempt Limiting / Lockout on OTP Verification (Vulnerability):**
   - In `artifacts/api-server/src/lib/authOtp.ts` (lines 157-187), `verifyAuthOtp` executes:
     ```typescript
     const [consumed] = await db
       .update(authOtpCodesTable)
       .set({ usedAt: now })
       .where(and(..., eq(authOtpCodesTable.codeHash, codeHash), ...))
       .returning();
     if (!consumed) return { ok: false, reason: "OTP_INVALID_OR_EXPIRED" };
     ```
   - When an incorrect OTP code is entered, the server does **not** increment a failure counter on the OTP record, nor does it invalidate the OTP after 3 or 5 failed attempts.
   - Because the OTP is valid for **15 minutes** (`OTP_TTL_MINUTES = 15`), an attacker who bypasses the client-side rate limiter can brute-force the 6-digit OTP code within 15 minutes.

### 6.4 Rate Limiting & DoS Protection

- In `artifacts/api-server/src/lib/authRateLimit.ts`:
  - Implemented using an **in-memory JavaScript `Map`**:
    ```typescript
    const buckets = new Map<string, { count: number; resetAt: number }>();
    ```
  - **Memory Leak Risk:** Buckets are never automatically pruned or garbage collected. Keys for clients that never return persist in memory indefinitely.
  - **Cluster / Multi-Instance Ineffectiveness:** Because the rate limiter is in-memory, requests routed across multiple load-balanced instances (e.g., on Railway or Render autoscaling) have independent rate limit buckets, allowing attackers to multiply their request volume.
  - **Key Masking Flaw:** The rate limit key uses `phone.slice(-4)` (only the last 4 digits of the phone number). Different phone numbers sharing the same last 4 digits collide on the same bucket.

---

## 7. AUTHORIZATION & MULTI-CITY TENANT ISOLATION FORENSICS

### 7.1 Architecture of Tenant Scoping

The multi-tenant architecture in `artifacts/api-server/src/middlewares/tenantScope.ts` provides good foundational primitives:
- `tenantFilters(req, opts)`: Injects SQL filters for `companyId`, `branchId`, `cityId`, `customerId`, and `staffId`.
- `tenantStamp(req, data)`: Overwrites client-supplied tenant identifiers on insertion.
- `rowInScope(req, row)`: Verifies entity ownership before returning or mutating single records.
- `assertBranchAccess(req, branchId)`: Throws HTTP 403 `BRANCH_UNAUTHORIZED` if a user attempts to operate on a branch outside their scope.

### 7.2 Critical Authorization Bypasses in Auxiliary Routers

While core CRUD routes (`customersRouter`, `bookingsRouter`, `invoicesRouter`) are wrapped in `guardResource(...)` in `routes/index.ts`, auxiliary routes registered directly without middleware contain severe authorization bypasses:

#### Vulnerability 1: Unauthorized Creation & Mutation of Location Pricing (`location-pricing.ts`)
- In `routes/location-pricing.ts`:
  - `POST /api/location-pricing` (lines 117-180):
    ```typescript
    let effectiveBranchId = branchId ? parseInt(branchId, 10) : null;
    if (!isSuperOrCentralAdmin(req) && req.user?.branchId) {
      effectiveBranchId = req.user.branchId;
    }
    ```
    If `req.user.role === 'customer'` or staff without a branchId, `req.user?.branchId` is `null`. The check is bypassed, and the client-supplied `branchId` and `cityId` are accepted.
  - `PATCH /api/location-pricing/:id` (lines 200-258): Contains **no role check whatsoever**.
  - `DELETE /api/location-pricing/:id` (lines 263-290):
    ```typescript
    if (!isSuperOrCentralAdmin(req) && req.user?.branchId && existing.branchId !== req.user.branchId) {
      return res.status(403).json(...);
    }
    ```
    Again, for a customer, `req.user?.branchId` is falsy, so the 403 condition is skipped!
  - **Impact:** Any registered customer can change service prices, set prices to ₹1, or delete pricing rules across all cities and branches.

#### Vulnerability 2: Unauthorized Creation & Mutation of Residential Societies (`societies.ts`)
- In `routes/societies.ts`:
  - `POST /api/societies` (line 189) has `requireAuth`, but **no role check**. Any customer or field staff can create societies.
  - `PATCH /api/societies/:id` (line 275) has `requireAuth`, but **no role check** and **no tenant scope check**. Any authenticated customer can modify society names, addresses, and gate security notes.
  - `POST /api/societies/:id/towers` (line 344) has **no role check**.

#### Vulnerability 3: Operational Zones Creation & Update Bypass (`zones.ts`)
- In `routes/zones.ts`:
  - `POST /api/zones` (line 90) and `PATCH /api/zones/:id` (line 156) allow any customer (who lacks a `branchId`) to bypass the authorization branch guard and modify operational zones and coverage radius.

---

## 8. PUBLIC ROUTES & ATTACK SURFACE INVENTORY

### 8.1 Publicly Accessible Routes (Unauthenticated)

A complete route survey identified the following unauthenticated endpoints:

| Endpoint | Method | Intended Purpose | Security Risk |
| :--- | :--- | :--- | :--- |
| `/api/healthz` | `GET` | Health check probe | Low (standard liveness) |
| `/api/coverage/check` | `POST` | Landing page serviceability check | Low (rate-limited by IP) |
| `/api/serviceability/check` | `POST` | Alias for coverage check | Low |
| `/api/branding` | `GET` | Public branding assets & metadata | Low |
| `/api/branding/public` | `GET` | Public branding assets cache | Low |
| `/api/branding/public/manifest/:portal` | `GET` | Dynamic PWA manifest generator | Low |
| `/api/legal/pages` | `GET` | List published legal pages | Low |
| `/api/legal/pages/:slug` | `GET` | View legal page content | Low |
| `/api/services` | `GET` | Public catalog (services & packages) | Low (whitelisted in auth) |
| `/api/branches` | `GET` | Public catalog (active branches) | Low (whitelisted in auth) |
| `/api/cities` | `GET` | Active cities list | Low |
| `/api/cities/:idOrSlug/content` | `GET` | Public city-specific landing content | Low |
| `/api/societies` | `GET` | Residential societies search | **Medium:** Unauthenticated PII lookup (society names, addresses, total flats) |
| `/api/societies/:id/towers` | `GET` | Tower list for society | **Medium:** Discloses tower names and floor layouts |
| `/api/payments/gateway-info` | `GET` | Returns active gateway name | Low |
| `/api/payments/gateway-diagnostics` | `GET` | Internal gateway diagnostics | **High:** Discloses build commit SHA, node version, presence of secrets |
| `/api/payments/schema-repair` | `GET` | Database schema patching | **Critical:** Unauthenticated DDL execution on production DB |
| `/api/push/vapid-public-key` | `GET` | Web Push VAPID public key | Low |
| `/api/communications/webhooks/*` | `POST` | External SMS/WhatsApp webhooks | Verified by provider signatures |
| `/api/payments/cashfree/webhook` | `POST` | Cashfree webhook listener | Verified via HMAC-SHA256 signature |

---

## 9. PAYMENT SECURITY & WEBHOOK INTEGRITY

### 9.1 Cashfree Payment Gateway Audit
- **Order Creation (`POST /payments/cashfree/create-order`):**
  - Requires customer authentication (`req.user.role === 'customer'`).
  - **Does NOT trust client-supplied amounts:** The server calculates outstanding dues directly from verified customer invoices and subscriptions in the database.
- **Webhook Verification (`POST /payments/cashfree/webhook`):**
  - Verifies `x-webhook-signature` using HMAC-SHA256 against `CASHFREE_SECRET_KEY` and raw request payload (`(req as any).rawBody`).
  - Verifies `x-webhook-timestamp` to prevent replay attacks (drift tolerance enforced).
  - Handles idempotency via `payment_webhook_events` tracking table.

### 9.2 Razorpay Payment Gateway Audit
- Configuration: `artifacts/api-server/src/lib/razorpay/razorpayConfig.ts`.
- Verifies `x-razorpay-signature` using HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`.
- Order amounts computed server-side in `unifiedPaymentService.ts`.

---

## 10. MEDIA & OBJECT STORAGE SECURITY

### 10.1 Cloudinary Storage Audit

1. **Upload Model:**
   - Client requests a presigned signature via `POST /api/storage/uploads/request-url`.
   - Client uploads directly from browser to Cloudinary via multipart form data.
2. **MIME Type Validation:**
   - Enforces `ALLOWED_UPLOAD_CONTENT_TYPES` (`image/*`, `video/*`, `application/pdf`).
3. **Signed File-Size Omission (Vulnerability):**
   - While `input.size` is received from the client, the signature parameters (`signParams`) generated in `createCloudinaryUploadSignature` do **not** sign a `max_file_size` parameter.
   - An authenticated user can request an upload signature for a 100KB file and proceed to upload a 5GB video file to Cloudinary, exhausting bandwidth and storage limits.
4. **Folder Parameter Manipulation (Vulnerability):**
   - `input.folder` allows the client to supply an arbitrary `folder` string (`typeof req.body?.folder === "string" ? req.body.folder : undefined`).
   - The server does not validate the folder name against an allowlist, allowing users to write into arbitrary Cloudinary folder namespaces.

---

## 11. DATABASE QUERY SECURITY & SQL INJECTION ANALYSIS

1. **Drizzle ORM Queries:**
   - The overwhelming majority of database queries utilize Drizzle ORM query builders (`db.select().from(...).where(eq(...))`), which compile to fully parameterized SQL queries (`$1, $2, ...`), preventing SQL injection.
2. **Raw SQL Construction in `sqlTenant` (Vulnerability):**
   - In `artifacts/api-server/src/middlewares/tenantScope.ts` line 130:
     ```typescript
     preds.push(`${cols.b} IN (${s.branchIds.join(", ")})`);
     ...
     return sql.raw(preds.join(" AND "));
     ```
   - While `branchIds` are integer IDs resolved from the database, using `sql.raw()` to construct SQL fragments rather than parameterized expressions is a dangerous pattern that bypasses Drizzle's parameter sanitization.
3. **Multi-Statement DDL Execution:**
   - In `artifacts/api-server/src/lib/startupMigrations.ts` (1,606 lines) and `scripts/src/deploy-auto.ts`, raw SQL DDL files are read from disk and executed directly via `pool.query(sql)`. While safe when reading controlled local files, these operations execute with full database privileges without tracking entries in `schema_migrations`.

---

## 12. CI/CD & DEPLOYMENT PIPELINE SECURITY

### 12.1 GitHub Actions Workflow (`.github/workflows/ci.yml`)

1. **Non-Frozen Lockfile (Vulnerability):**
   - Line 42: `pnpm install --frozen-lockfile=false`.
   - CI builds do not strictly enforce `pnpm-lock.yaml`. If transitive dependencies update upstream, CI builds may pull unvetted package versions, introducing supply chain vulnerabilities.
2. **Missing Static Analysis, Linting & Typecheck (Vulnerability):**
   - Neither `tsc --noEmit` nor `eslint` is executed in CI.
   - Consequently, `@workspace/api-server` and `@workspace/cwp-platform` have accumulated compile-time TypeScript errors that pass CI silently.
3. **Database Test Environment Disconnect:**
   - Line 21 specifies `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/cwp_test`, but no PostgreSQL service container (`services: postgres`) is provisioned in `ubuntu-latest`.
   - Any test that actually connects to PostgreSQL fails or must be mocked out.

### 12.2 Railway Deployment Configuration (`railway.json`)

- `preDeployCommand`: `pnpm --filter @workspace/scripts run db:deploy-auto`
- Runs `deploy-auto.ts` before launching the API server, applying pending migrations and seeding permissions and default branding.
- **Risk:** If `deploy-auto.ts` encounters an unhandled migration conflict on production, the entire Railway deployment crashes and rolls back.

---

## 13. FORMAL SECURITY FINDINGS (TOP 12 FINDINGS)

```
================================================================================
CRITICALITY SUMMARY:
- P0 (Catastrophic / Immediate Exploitation / Data Loss): 5 Findings
- P1 (High Severity / Authentication / Authorization Bypass): 5 Findings
- P2 (Medium Severity / Hardening / Defense-in-Depth): 2 Findings
================================================================================
```

### Finding SEC-001: Plain-Text Production Database Credentials Hardcoded in Repository
- **Severity:** P0 (Critical)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-312 (Cleartext Storage of Sensitive Information)
- **Evidence:**
  - `scripts/src/inspect-prod-db.ts#L4`
  - `scripts/src/reset-production-db.ts#L8`
  - Historical Commit `0d1700f` (`.env`)
- **Plain English:** Active production PostgreSQL connection strings with cleartext passwords are hardcoded in source code files committed to Git.
- **Risk Scenario:** Any party with read access to the Git repository (or third-party tools analyzing the repo) can connect directly to the production Neon PostgreSQL database, exfiltrating all customer PII, payments, vehicle records, and business data.
- **Exploitability Prerequisites:** Repository read access.
- **Impact:** Complete confidentiality, integrity, and availability compromise of all production data.
- **Recommended Remediation:**
  1. Immediately rotate the Neon PostgreSQL database password in the Neon Console.
  2. Remove hardcoded strings from `inspect-prod-db.ts` and `reset-production-db.ts`; fail closed if `process.env.DATABASE_URL` is unset.
  3. Purge historical commit `0d1700f` from Git history using `git-filter-repo` or BFG Repo-Cleaner.

---

### Finding SEC-002: Unguarded Production Database Wipe Script Executing CASCADE Truncation
- **Severity:** P0 (Critical)
- **CWE:** CWE-284 (Improper Access Control), CWE-400 (Uncontrolled Resource Consumption)
- **Evidence:** `scripts/src/reset-production-db.ts` (lines 5-10, 154-157); `scripts/package.json#L46` (`"db:reset-fresh"`)
- **Plain English:** A script intended for fresh staging setups targets the live production database by default and truncates 105 core tables with zero user confirmation or environment checks.
- **Risk Scenario:** A developer running `pnpm run db:reset-fresh` or an accidental CI/CD trigger will permanently obliterate all production bookings, payments, subscriptions, and customer accounts in seconds.
- **Exploitability Prerequisites:** Execution of the npm script in any shell.
- **Impact:** Catastrophic, irreversible data loss.
- **Recommended Remediation:**
  1. Add strict environment guards refusing execution if `process.env.NODE_ENV === 'production'` or if target URL matches the production host.
  2. Require explicit interactive confirmation and a safety environment variable (`ALLOW_DATABASE_PURGE=true`).
  3. Remove the hardcoded production fallback URL.

---

### Finding SEC-003: Permissive CORS Configuration with Credential Reflection
- **Severity:** P0 (Critical)
- **CWE:** CWE-942 (Permissive Cross-Domain Policy with Untrusted Domains)
- **Evidence:** `artifacts/api-server/src/app.ts#L100` (`cors({ origin: true, credentials: true })`)
- **Plain English:** The API server reflects any requesting domain as an authorized CORS origin and allows authenticated credentials (cookies) to accompany the request.
- **Risk Scenario:** An attacker creates a website that issues `fetch` requests to `https://api.cwpdetailers.in/api/customers`. When an authenticated admin visits the site, the browser executes the request with the admin's session cookies and permits the attacker's script to read the response.
- **Exploitability Prerequisites:** Victim must have an active session and visit an attacker-controlled site.
- **Impact:** Complete cross-origin bypass of authentication, leading to account hijacking and mass data exfiltration.
- **Recommended Remediation:**
  - Replace `origin: true` with a strict allowlist of authorized production and local development domains (`https://cwpdetailers.in`, `https://www.cwpdetailers.in`, and `http://localhost:*` for development).

---

### Finding SEC-004: Broken Function-Level Authorization in Location Pricing, Societies & Zones
- **Severity:** P0 (Critical)
- **CWE:** CWE-285 (Improper Authorization), CWE-639 (Insecure Direct Object Reference)
- **Evidence:**
  - `artifacts/api-server/src/routes/location-pricing.ts` (lines 117-180, 200-290)
  - `artifacts/api-server/src/routes/societies.ts` (lines 189-270, 275-320)
  - `artifacts/api-server/src/routes/zones.ts` (lines 90-151, 156-190)
- **Plain English:** Several administrative operational routes verify that a user is logged in, but never verify whether the user has administrative privileges, allowing ordinary customers to modify prices and operational zones.
- **Risk Scenario:** A customer registers a standard account, calls `POST /api/location-pricing` with `basePrice: 1`, and books premium car detailing across the entire city for ₹1.
- **Exploitability Prerequisites:** Any valid customer login.
- **Impact:** Financial loss, operational disruption, unauthorized tampering with company infrastructure.
- **Recommended Remediation:**
  - Enforce `requirePermission("pricing", "edit")`, `requirePermission("societies", "edit")`, and `requirePermission("zones", "edit")` on all mutation endpoints.

---

### Finding SEC-005: Unauthenticated Public DDL Execution Endpoint
- **Severity:** P0 (Critical)
- **CWE:** CWE-306 (Missing Authentication for Critical Function)
- **Evidence:** `artifacts/api-server/src/routes/payment-gateway.ts#L100-L128` (`GET /api/payments/schema-repair`)
- **Plain English:** A public GET endpoint executes 15 raw DDL queries against the live database without requiring any login.
- **Risk Scenario:** An unauthenticated anonymous caller sends automated GET requests to `/api/payments/schema-repair`, repeatedly locking tables during DDL alterations or causing resource exhaustion.
- **Exploitability Prerequisites:** None (public Internet access).
- **Impact:** Database table lock contention, operational instability, database error disclosure.
- **Recommended Remediation:**
  - Remove this endpoint from the public router immediately. Schema alterations must be handled exclusively through version-controlled database migrations.

---

### Finding SEC-006: Session Bearer Token Storage in Browser LocalStorage
- **Severity:** P1 (High)
- **CWE:** CWE-922 (Insecure Storage of Sensitive Information)
- **Evidence:** `artifacts/cwp-platform/src/lib/auth.tsx#L113` (`localStorage.setItem(tokenStorageKey(portal), token)`)
- **Plain English:** The frontend copies session bearer tokens into browser `localStorage`, bypassing `httpOnly` cookie protections.
- **Risk Scenario:** If an XSS vulnerability occurs anywhere in the frontend, an attacker's script reads `localStorage`, steals the bearer token, and achieves persistent account takeover.
- **Exploitability Prerequisites:** Any client-side XSS vulnerability.
- **Impact:** Account takeover immune to `httpOnly` cookie protection.
- **Recommended Remediation:**
  - Rely exclusively on `HttpOnly`, `SameSite: "lax"` cookies for browser sessions. Deprecate client-side storage of bearer tokens in `localStorage`.

---

### Finding SEC-007: Bearer Session Token Acceptance via Query Parameters
- **Severity:** P1 (High)
- **CWE:** CWE-598 (Use of GET Request Method With Sensitive Query Strings)
- **Evidence:** `artifacts/api-server/src/lib/sessionCookie.ts#L96-L99` (`req.query?.token`)
- **Plain English:** The API server accepts bearer session tokens as URL query parameters (`?token=...`).
- **Risk Scenario:** Users clicking or sharing links containing `?token=...` leak their session tokens into web server access logs, reverse-proxy logs, browser histories, and third-party Referer headers.
- **Exploitability Prerequisites:** User sharing or logging of URL.
- **Impact:** Session hijacking via token leakage.
- **Recommended Remediation:**
  - Disallow query parameter authentication. Only accept tokens via `Authorization: Bearer <token>` headers or `HttpOnly` cookies.

---

### Finding SEC-008: Insecure Cryptographic PRNG in OTP Generation
- **Severity:** P1 (High)
- **CWE:** CWE-338 (Use of Cryptographically Weak Pseudo-Random Number Generator)
- **Evidence:** `artifacts/api-server/src/lib/googleAuth.ts#L47` (`Math.floor(100000 + Math.random() * 900000)`)
- **Plain English:** 6-digit login OTP codes are generated using JavaScript's `Math.random()`, which is not cryptographically secure.
- **Risk Scenario:** An attacker observing a sequence of generated OTPs can reconstruct the internal state of the PRNG and predict future OTP codes for victim phone numbers.
- **Exploitability Prerequisites:** Statistical sequence analysis.
- **Impact:** Account takeover of customers using OTP login.
- **Recommended Remediation:**
  - Replace `Math.random()` with `crypto.randomInt(100000, 1000000)`.

---

### Finding SEC-009: Missing Attempt Throttling / Lockout on OTP Verification
- **Severity:** P1 (High)
- **CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **Evidence:** `artifacts/api-server/src/lib/authOtp.ts#L157-L187`
- **Plain English:** Entering an incorrect OTP does not increment an attempt counter or invalidate the OTP after multiple incorrect attempts.
- **Risk Scenario:** An attacker brute-forces all 900,000 possible 6-digit combinations against an active OTP during its 15-minute validity window.
- **Exploitability Prerequisites:** Network access to the OTP verify endpoint.
- **Impact:** Authentication bypass.
- **Recommended Remediation:**
  - Add an `attempts` counter to `auth_otp_codes`. Invalidate the code immediately after 3 failed attempts. Reduce TTL from 15 minutes to 3-5 minutes.

---

### Finding SEC-010: Inadequate Password Complexity Requirements
- **Severity:** P1 (High)
- **CWE:** CWE-521 (Weak Password Requirements)
- **Evidence:** `artifacts/api-server/src/lib/userPassword.ts#L29` (min length 6)
- **Plain English:** The system allows users to set 6-character passwords with no complexity rules.
- **Risk Scenario:** Staff or admin accounts choose weak passwords (e.g. `123456`, `admin1`), making them vulnerable to credential stuffing and dictionary attacks.
- **Exploitability Prerequisites:** Credential stuffing attacks.
- **Impact:** Account compromise of staff and admin accounts.
- **Recommended Remediation:**
  - Increase minimum length to 8 characters (12 for admin/staff) and enforce mixed character sets.

---

### Finding SEC-011: Public Operational Diagnostics Disclosing Infrastructure Details
- **Severity:** P2 (Medium)
- **CWE:** CWE-200 (Exposure of Sensitive Information)
- **Evidence:** `artifacts/api-server/src/routes/payment-gateway.ts#L37-L93` (`GET /api/payments/gateway-diagnostics`)
- **Plain English:** A public endpoint discloses the server's Git commit SHA, Node.js version, and credential presence for payment gateways.
- **Risk Scenario:** Attackers gain detailed reconnaissance about deployed commit versions and environment configurations to craft targeted exploits.
- **Impact:** Information disclosure.
- **Recommended Remediation:**
  - Restrict `/api/payments/gateway-diagnostics` to authenticated super-admins.

---

### Finding SEC-012: In-Memory Rate Limiting Without Cluster Synchronization or Pruning
- **Severity:** P2 (Medium)
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Evidence:** `artifacts/api-server/src/lib/authRateLimit.ts#L4`
- **Plain English:** Rate limiting is tracked in a local JavaScript `Map` that is lost on server restart, ineffective across multi-instance clusters, and leaks memory.
- **Risk Scenario:** An attacker bypasses rate limits by distributing requests across multiple backend instances or causes high memory consumption via unique IP generation.
- **Impact:** Ineffective DoS / brute-force protection.
- **Recommended Remediation:**
  - Back the rate limiter with Redis (already present as dependency via `ioredis`) or a PostgreSQL sliding-window table.

---

## 14. EXECUTIVE SECURITY SCORECARD ACROSS 14 DOMAINS

| Security Domain | Grade | Risk Level | Primary Assessment |
| :--- | :---: | :---: | :--- |
| **1. Secret Management & Storage** | **F** | **CRITICAL** | Production DB passwords and Cloudinary secrets hardcoded in source and committed to Git history. |
| **2. Production Database Safety** | **F** | **CRITICAL** | `reset-production-db.ts` truncates 105 production tables with CASCADE, defaulting to live production URL with zero confirmation. |
| **3. Network Perimeter & CORS** | **F** | **CRITICAL** | `cors({ origin: true, credentials: true })` completely reflects arbitrary origins with cookies enabled. |
| **4. Authorization & Privilege Escalation** | **D** | **HIGH** | Core CRUD routes well scoped, but `location-pricing`, `societies`, and `zones` allow customer privilege escalation. |
| **5. Public Endpoints & Attack Surface** | **D** | **HIGH** | Public unauthenticated DDL endpoint (`/payments/schema-repair`) and diagnostics disclosure. |
| **6. Authentication & Session Management** | **C-** | **HIGH** | Bearer tokens stored in `localStorage`, accepted via query string; weak 6-char password policy. |
| **7. OTP & MFA Cryptography** | **C-** | **HIGH** | `Math.random()` used for OTP generation; zero attempt lockout on wrong guesses; 15-minute validity window. |
| **8. Multi-City & Tenant Isolation** | **B+** | **LOW** | `tenantFilters` and `assertBranchAccess` primitives are well designed where applied. |
| **9. Payment Gateway Security** | **A-** | **LOW** | Cashfree & Razorpay verify HMAC-SHA256 signatures, validate timestamps, and compute order totals server-side. |
| **10. Media & Storage Security** | **C+** | **MEDIUM** | MIME types validated, but file size limits are not cryptographically signed; folder parameter unsanitized. |
| **11. Transport Security & Headers** | **B** | **LOW** | HSTS (1-year), X-Frame-Options, X-Content-Type-Options active in production; CSP allows `'unsafe-inline'`. |
| **12. Database Query Security (SQLi)** | **B+** | **LOW** | Drizzle ORM provides parameterization; minor raw string concatenation in `sqlTenant`. |
| **13. Rate Limiting & DoS Defense** | **C** | **MEDIUM** | In-memory `Map` lacks cluster synchronization, does not prune stale keys, and keying has phone collision flaw. |
| **14. CI/CD & Supply Chain Pipeline** | **D** | **HIGH** | Non-frozen lockfiles (`--frozen-lockfile=false`); zero typechecking or linting enforced in CI workflow. |

---

## 15. IMMEDIATE CONTAINMENT ACTIONS (CRITICAL FIRST STEPS)

The following containment actions must be executed in order prior to Phase 2:

1. **Rotate Production Database Credentials Immediately:**
   - In the Neon Console (`https://console.neon.tech`), generate a new password for role `neondb_owner`.
   - Update `DATABASE_URL` in Railway / Render production environment variables.
   - Do NOT commit the new password to any repository file.

2. **Defuse the Production Wipe Script (`reset-production-db.ts`):**
   - In `scripts/src/reset-production-db.ts`:
     - Delete the hardcoded fallback connection string.
     - Add an unconditional check:
       ```typescript
       if (process.env.NODE_ENV === "production" || !process.env.ALLOW_DATABASE_PURGE) {
         throw new Error("REFUSING TO RUN PURGE: ALLOW_DATABASE_PURGE=true required in non-production.");
       }
       ```
   - In `scripts/src/inspect-prod-db.ts`: Delete the hardcoded connection string fallback.

3. **Lock Down CORS in `app.ts`:**
   - Replace `cors({ origin: true, credentials: true })` with a strict origin whitelist:
     ```typescript
     const allowedOrigins = new Set([
       "https://cwpdetailers.in",
       "https://www.cwpdetailers.in",
       ...(process.env.NODE_ENV !== "production" ? ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080"] : [])
     ]);
     app.use(cors({
       origin: (origin, callback) => {
         if (!origin || allowedOrigins.has(origin)) callback(null, true);
         else callback(new Error("CORS policy violation"));
       },
       credentials: true,
     }));
     ```

4. **Disable Public DDL Execution (`payment-gateway.ts`):**
   - Remove or protect `GET /api/payments/schema-repair` with `requireAuth` and `requirePermission("settings", "edit")`.

5. **Rotate Cloudinary & Session Secrets:**
   - In Cloudinary Console, rotate the API secret for cloud `dhfphz6nv`.
   - Generate a fresh 64-byte random `SESSION_SECRET` in production environment settings.

---

## 16. PRIORITIZED REMEDIATION ROADMAP

### Phase 1A: Immediate Hotfixes (Day 1)
- [ ] Rotate Neon PostgreSQL password and Cloudinary secret.
- [ ] Remove hardcoded credentials from `inspect-prod-db.ts` and `reset-production-db.ts`.
- [ ] Guard `reset-production-db.ts` with `ALLOW_DATABASE_PURGE=true` requirement.
- [ ] Restrict CORS to explicit production origins in `artifacts/api-server/src/app.ts`.
- [ ] Remove unauthenticated `GET /api/payments/schema-repair` endpoint.

### Phase 1B: Authorization & Cryptography Hardening (Days 2–3)
- [ ] Add `requirePermission(...)` to `location-pricing.ts`, `societies.ts`, and `zones.ts` routes.
- [ ] Replace `Math.random()` with `crypto.randomInt` in `artifacts/api-server/src/lib/googleAuth.ts`.
- [ ] Add 3-attempt lockout and reduce TTL to 5 minutes in `artifacts/api-server/src/lib/authOtp.ts`.
- [ ] Remove query parameter token acceptance (`?token=...`) in `sessionCookie.ts`.
- [ ] Protect `/api/payments/gateway-diagnostics` with admin authentication.

### Phase 1C: Session & Client Storage Remediation (Days 4–5)
- [ ] Deprecate storing bearer tokens in `localStorage` in `artifacts/cwp-platform/src/lib/auth.tsx`.
- [ ] Enforce minimum 8-character password policy with complexity checks in `userPassword.ts`.
- [ ] Add `max_file_size` and folder allowlist validation in `cloudinaryStorage.ts`.

### Phase 1D: CI/CD & Pipeline Hardening (Days 6–7)
- [ ] Enforce `pnpm install --frozen-lockfile` in `.github/workflows/ci.yml`.
- [ ] Add `pnpm run typecheck` to CI workflow to catch TypeScript compile errors.
- [ ] Migrate in-memory rate limiting in `authRateLimit.ts` to Redis.
- [ ] Clean Git history using `git-filter-repo` to permanently erase commit `0d1700f`.

---

## 17. CONFIRMATION OF INSPECTED ARTIFACTS & EVIDENCE

The findings in this report were verified through direct source code inspection of the following files at HEAD commit `6377bbe16568aac15495bbbad205bb55db66878c`:

1. `scripts/src/reset-production-db.ts` (lines 1-203)
2. `scripts/src/inspect-prod-db.ts` (lines 1-101)
3. `scripts/src/deploy-auto.ts` (lines 1-226)
4. `scripts/src/adminEnv.ts` (lines 1-16)
5. `scripts/src/delete-all-customers.ts` (lines 1-50)
6. `scripts/package.json` (lines 1-62)
7. `railway.json` (lines 1-13)
8. `.github/workflows/ci.yml` (lines 1-54)
9. `artifacts/api-server/src/app.ts` (lines 1-199)
10. `artifacts/api-server/src/index.ts` (lines 1-60)
11. `artifacts/api-server/src/middlewares/auth.ts` (lines 1-460)
12. `artifacts/api-server/src/middlewares/tenantScope.ts` (lines 1-233)
13. `artifacts/api-server/src/lib/sessionCookie.ts` (lines 1-107)
14. `artifacts/api-server/src/lib/passwords.ts` (lines 1-49)
15. `artifacts/api-server/src/lib/userPassword.ts` (lines 1-33)
16. `artifacts/api-server/src/lib/authOtp.ts` (lines 1-189)
17. `artifacts/api-server/src/lib/googleAuth.ts` (lines 1-64)
18. `artifacts/api-server/src/lib/authRateLimit.ts` (lines 1-55)
19. `artifacts/api-server/src/lib/cloudinaryStorage.ts` (lines 1-213)
20. `artifacts/api-server/src/routes/index.ts` (lines 1-330)
21. `artifacts/api-server/src/routes/auth.ts` (lines 1-100)
22. `artifacts/api-server/src/routes/cashfree.ts` (lines 1-285)
23. `artifacts/api-server/src/routes/payment-gateway.ts` (lines 1-140)
24. `artifacts/api-server/src/routes/storage.ts` (lines 1-65)
25. `artifacts/api-server/src/routes/societies.ts` (lines 1-350)
26. `artifacts/api-server/src/routes/zones.ts` (lines 1-190)
27. `artifacts/api-server/src/routes/location-pricing.ts` (lines 1-290)
28. `artifacts/api-server/src/routes/cities.ts` (lines 1-240)
29. `artifacts/api-server/src/routes/config.ts` (lines 1-60)
30. `artifacts/api-server/src/routes/dcms.ts` (lines 1-60, 900-924)
31. `artifacts/cwp-platform/src/lib/auth.tsx` (lines 1-150)
32. `Git commit log objects`: `0d1700f`, `c5ce494`, `f87bd42`, `6377bbe`

---

## 18. RECOMMENDATION ON PHASE 2 READINESS

> [!WARNING]
> **GATE VERDICT: CONDITIONAL HOLD / CONTAINMENT REQUIRED BEFORE FEATURE COMMENCEMENT**
> 
> Proceeding to subsequent phases or executing any developer scripts in the current state poses an **immediate risk of production database destruction** via `reset-production-db.ts` and **active credential exposure**.
> 
> Before Phase 2 begins:
> 1. Containment steps 1 through 4 in Section 15 must be reviewed and scheduled.
> 2. Developers must be alerted immediately **never** to run `pnpm run db:reset-fresh`.
> 3. The audit team may proceed to **Phase 2 (Architecture, Domain Modeling & Multi-City Isolation)** in **STRICT READ-ONLY MODE** with the understanding that security containment actions will be prioritized on the product roadmap.
