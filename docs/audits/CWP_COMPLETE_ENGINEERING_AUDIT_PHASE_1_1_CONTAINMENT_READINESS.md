# CWP COMPLETE ENGINEERING AUDIT — PHASE 1.1: SECURITY CONTAINMENT STATUS & HOTFIX READINESS

**Project:** CWP Detailers Multi-City Automotive & Solar Detailing Platform  
**Repository:** `tusharsaraswat1988/Cwpdetailers`  
**Current HEAD SHA:** `6377bbe16568aac15495bbbad205bb55db66878c`  
**Audit Date:** November 25, 2026  
**Audit Mode:** STRICT READ-ONLY SECURITY ASSESSMENT & HOTFIX READINESS  
**Auditor Role:** Principal Software Architect, Staff Engineer, Database Architect & Security Auditor  

---

## 1. CURRENT REPOSITORY BASELINE & INTEGRITY

A comprehensive check of Git repository metadata and working tree state was conducted:

| Parameter | Current State | Verification Evidence |
| :--- | :--- | :--- |
| **Repository Root** | `d:\cwpdetailersapp` | Monorepo root |
| **Current Branch** | `main` | Verified via `git status` |
| **Current HEAD SHA** | `6377bbe16568aac15495bbbad205bb55db66878c` | Verified via `git log -1` |
| **Commit Timestamp** | Wed Nov 25 11:40:55 2026 +0530 | `git log -1 --format="%cd"` |
| **Commit Subject** | `feat(deploy): implement 100% automated zero-config database deployment & self-healing schema provisioning` | `git log -1 --format="%s"` |
| **Remote Tracking Status** | Up to date with `origin/main` (`0` ahead, `0` behind) | `git status -uno` |
| **Working Tree Modifications**| None (Clean working tree) | Verified |
| **Untracked Audit Artifacts** | `docs/audits/CWP_COMPLETE_ENGINEERING_AUDIT_PHASE_0.md`<br>`docs/audits/CWP_COMPLETE_ENGINEERING_AUDIT_PHASE_1_SECURITY.md` | Non-mutating audit reports only |

**Integrity Confirmation:** No application files, database connections, environment files, or branch states have been modified.

---

## 2. EXISTING WORKING-TREE STATE & DIVERGENCE ANALYSIS

- **Comparison to Phase 1 Audit State:** The working tree remains in the exact state as analyzed in Phase 1.
- **Local Modifications:** Zero modified files (`M`), zero staged files (`A`/`M`), zero deleted files (`D`).
- **Untracked Files:** Only the Phase 0 and Phase 1 engineering audit markdown reports exist in `docs/audits/`.
- **Divergence:** Zero divergence from `origin/main`.

---

## 3. CREDENTIAL CONTAINMENT STATUS MATRIX

> [!CAUTION]
> In accordance with strict audit rules, all passwords, keys, tokens, and secrets are redacted using safe notation (`[REDACTED]`). Under no circumstances are live credentials tested or probed against external infrastructure in this audit.

| Credential / Asset | Exposure Location | Current Source Status | Production Revocation Status | Containment Status | Next Required Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Neon Production DB Password** | `scripts/src/inspect-prod-db.ts#L4`<br>`scripts/src/reset-production-db.ts#L8` | **STILL ACTIVE IN HEAD** | **PENDING / UNKNOWN** | **NOT CONTAINED** | 1. Rotate password in Neon Console.<br>2. Remove hardcoded strings from code. |
| **Neon Production DB History** | Git Commit `0d1700f` (`.env`) | **STILL IN GIT HISTORY** | **PENDING / UNKNOWN** | **NOT CONTAINED** | Purge Git history using `git-filter-repo` or BFG Repo-Cleaner after rotation. |
| **Cloudinary Full Secret URL** | Git Commit `0d1700f` (`.env`) | **STILL IN GIT HISTORY** | **PENDING / UNKNOWN** | **NOT CONTAINED** | Rotate API Secret for cloud `dhfphz6nv` in Cloudinary Console. |
| **Platform SESSION_SECRET** | Git Commit `0d1700f` (`.env`) | **STILL IN GIT HISTORY** | **PENDING / UNKNOWN** | **NOT CONTAINED** | Generate fresh 64-byte base64 secret in deployment environment variables. |
| **Supabase Project Credentials**| Git Commit `0d1700f` (`.env`) | **STILL IN GIT HISTORY** | **PENDING / UNKNOWN** | **NOT CONTAINED** | Verify whether staging Supabase project is still active; delete or cycle keys. |
| **Railway / Render Env Vars** | Production Platform Settings | External | **PENDING / UNKNOWN** | **NOT CONTAINED** | Update `DATABASE_URL` and `SESSION_SECRET` on Railway dashboard after rotation. |
| **Default Super Admin Password**| `scripts/src/reset-production-db.ts#L162` | **STILL ACTIVE IN HEAD** | `admin123` fallback active | **NOT CONTAINED** | Fail closed if `ADMIN_PASSWORD` is unset; remove `"admin123"` fallback. |

---

## 4. CONFIRMED STILL-OPEN CRITICAL FINDINGS

The following critical vulnerabilities were re-verified at commit `6377bbe16568aac15495bbbad205bb55db66878c` and confirmed to be active and unpatched:

### 4.1 SEC-001: Plain-Text Production DB Credentials in Script Source Code
- **Status:** **STILL ACTIVE**
- **Evidence:** `scripts/src/inspect-prod-db.ts` line 4 and `scripts/src/reset-production-db.ts` line 8 still contain:
  ```typescript
  "postgresql://neondb_owner:[REDACTED]@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
  ```
- **Hazard:** Complete administrative compromise of the production PostgreSQL database.

### 4.2 SEC-002: Unguarded Production CASCADE Wipe Script (`reset-production-db.ts`)
- **Status:** **STILL ACTIVE**
- **Evidence:** `scripts/src/reset-production-db.ts` lines 5-8:
  ```typescript
  const targetUrl =
    process.env.TARGET_DATABASE_URL ||
    process.argv[2] ||
    "postgresql://neondb_owner:[REDACTED]@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  ```
- **Execution Surface:** `pnpm --filter @workspace/scripts run db:reset-fresh` executes immediately without confirmation, truncating 105 core tables with `RESTART IDENTITY CASCADE`.

### 4.3 SEC-003: Reflective Origin CORS with Ambient Credentials
- **Status:** **STILL ACTIVE**
- **Evidence:** `artifacts/api-server/src/app.ts` line 100:
  ```typescript
  app.use(cors({ origin: true, credentials: true }));
  ```
- **Hazard:** Any third-party site can make credentialed AJAX/fetch requests on behalf of authenticated admins or customers.

### 4.4 SEC-004: Broken Function-Level Authorization on Operational Mutations
- **Status:** **STILL ACTIVE**
- **Evidence:**
  - `POST /api/location-pricing`, `PATCH /api/location-pricing/:id`, `DELETE /api/location-pricing/:id` in `routes/location-pricing.ts` lack role checks, allowing any customer to alter pricing rules company-wide.
  - `POST /api/societies`, `PATCH /api/societies/:id`, `POST /api/societies/:id/towers` in `routes/societies.ts` lack role checks.
  - `POST /api/zones`, `PATCH /api/zones/:id` in `routes/zones.ts` bypass branch authorization when caller has no `user.branchId` (e.g. customers).

### 4.5 SEC-005: Unauthenticated Public DDL Execution (`/payments/schema-repair`)
- **Status:** **STILL ACTIVE**
- **Evidence:** `artifacts/api-server/src/routes/payment-gateway.ts` lines 100-128:
  ```typescript
  router.get("/payments/schema-repair", async (_req: Request, res: Response) => { ... });
  ```
- **Hazard:** Unauthenticated GET request executes 15 raw `ALTER TABLE` statements against the live database and returns internal database statuses.

---

## 5. FINDINGS REQUIRING FURTHER TECHNICAL VERIFICATION

The following items are identified from static analysis but require technical verification during containment execution:

1. **Active Connection Count to Production Neon Instance:**
   - *Unknown:* Are external automated scrapers or unauthorized IPs currently connecting to the exposed database endpoint?
   - *Verification Requirement:* Inspect Neon Console connection metrics and active connection IP logs.
2. **Presence of Production Data in Truncation List:**
   - *Unknown:* Are all 105 tables in `DATA_TABLES_TO_TRUNCATE` present in production, or are some historical/deprecated?
   - *Verification Requirement:* Safe read-only schema inspection (without connecting in this phase).
3. **Frontend Dependency on Query Parameter Authentication (`?token=...`):**
   - *Unknown:* Does any mobile webview or native wrapper rely on passing `?token=` on initial app launch?
   - *Verification Requirement:* Static inspection of `artifacts/cwp-platform/` and Android wrapper source for query-string token launches before removing query token support in `sessionCookie.ts`.

---

## 6. PRODUCTION WIPE PROTECTION DEEP DIVE

### 6.1 Invocation Path Audit
- **`scripts/package.json`:** `"db:reset-fresh": "tsx ./src/reset-production-db.ts"` (Direct invocation point).
- **`railway.json`:** `"preDeployCommand": "pnpm --filter @workspace/scripts run db:deploy-auto"` (Safe; does NOT call `reset-production-db.ts`).
- **`.github/workflows/ci.yml`:** Does NOT call `reset-production-db.ts`.
- **Root `package.json`:** Does NOT directly map `db:reset-fresh`.

### 6.2 Smallest Safest Containment Change
There are two options for containment:

#### Option 1: Temporary Script Disabling (Fastest, Zero Risk)
Replace lines 1-9 of `scripts/src/reset-production-db.ts` with:
```typescript
console.error("❌ SCRIPT DISABLED FOR SAFETY: reset-production-db.ts is disabled to prevent accidental production truncation.");
process.exit(1);
```
- **Pros:** 100% guarantee against accidental truncation; zero chance of targeting production; 1-minute execution.
- **Cons:** Developers cannot use it for fresh local testing until restored.

#### Option 2: Fail-Closed Parameterization with Interactive Safety Guard
```typescript
const targetUrl = process.env.TARGET_DATABASE_URL || process.argv[2];
if (!targetUrl) {
  console.error("❌ Refusing to run: TARGET_DATABASE_URL environment variable or target argument is required.");
  process.exit(1);
}
if (targetUrl.includes("neon.tech") || targetUrl.includes("aws") || process.env.NODE_ENV === "production") {
  if (process.env.ALLOW_DATABASE_PURGE !== "I_CONFIRM_DESTRUCTIVE_PURGE") {
    console.error("❌ BLOCKED: Destructive purge of remote database requires ALLOW_DATABASE_PURGE=I_CONFIRM_DESTRUCTIVE_PURGE.");
    process.exit(1);
  }
}
```
- **Pros:** Retains local developer utility while completely eliminating default production targeting and requiring explicit confirmation.

---

## 7. CRITICAL ENDPOINT CONTAINMENT READINESS MATRIX

| Endpoint & Method | Current Auth | Current Authz | Tenant / Branch Scoping | P0 Open? | Proposed Minimal Fix | Regression Risk & Client Impact |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `GET /api/payments/schema-repair` | None | None | None (Global DB) | **YES** | **Remove route completely.** All 15 columns are already in SQL migrations (`055_...sql`). | **Zero.** Frontend does not call this route (`git grep` confirmed 0 usages). |
| `GET /api/payments/gateway-diagnostics` | None | None | None | **YES (P2)** | Guard with `requireAuth, requirePermission("settings", "view")`. | **Zero.** Frontend does not call this route (operator tool only). |
| `POST /api/location-pricing` | `requireAuth` | Flawed branch check | Bypassed when `req.user.branchId` is null | **YES** | Enforce `requirePermission("services", "edit")` and reject non-admin roles (`customer`, `staff`). | **Zero.** Only used by admin portal `LocationPricingPage.tsx`. |
| `PATCH /api/location-pricing/:id` | `requireAuth` | None | None | **YES** | Enforce `requirePermission("services", "edit")` and `assertBranchAccess(req, existing.branchId)`. | **Zero.** Only used by admin portal `LocationPricingPage.tsx`. |
| `DELETE /api/location-pricing/:id` | `requireAuth` | Flawed branch check | Bypassed when `req.user.branchId` is null | **YES** | Enforce `requirePermission("services", "edit")` and `assertBranchAccess(req, existing.branchId)`. | **Zero.** Only used by admin portal `LocationPricingPage.tsx`. |
| `POST /api/societies` | `requireAuth` | None | Stamped if admin, but not enforced | **YES** | Enforce `requirePermission("branches", "edit")` or restrict to admin/manager roles. | **Zero.** Only used by `admin/SocietiesPage.tsx`. Customers use `GET`. |
| `PATCH /api/societies/:id` | `requireAuth` | None | None | **YES** | Enforce `requirePermission("branches", "edit")`. | **Zero.** Only used by `admin/SocietiesPage.tsx`. |
| `POST /api/societies/:id/towers` | `requireAuth` | None | None | **YES** | Enforce `requirePermission("branches", "edit")`. | **Zero.** Only used by `admin/SocietiesPage.tsx`. |
| `POST /api/zones` | `requireAuth` | Flawed branch check | Bypassed when `req.user.branchId` is null | **YES** | Restrict to admin roles and enforce `assertBranchAccess(req, effectiveBranchId)`. | **Zero.** Only used by `admin/OperationalZonesPage.tsx`. |
| `PATCH /api/zones/:id` | `requireAuth` | Flawed branch check | Bypassed when `req.user.branchId` is null | **YES** | Restrict to admin roles and enforce `assertBranchAccess(req, existing.branchId)`. | **Zero.** Only used by `admin/OperationalZonesPage.tsx`. |

---

## 8. PRIORITIZED MINIMAL SECURITY HOTFIX EXECUTION PLAN

```
================================================================================
HOTFIX SEQUENCE ORDER:
HOTFIX A (Immediate Safety) ➜ HOTFIX B (Authorization) ➜ HOTFIX C (Perimeter)
➜ HOTFIX D (Credentials & Sessions) ➜ HOTFIX E (OTP & Abuse Controls)
================================================================================
```

### HOTFIX A — Production Safety & Data Protection (Day 1 / Immediate)
1. **A.1:** In `scripts/src/reset-production-db.ts`: Remove hardcoded production database connection string; require `TARGET_DATABASE_URL` and `ALLOW_DATABASE_PURGE=I_CONFIRM_DESTRUCTIVE_PURGE`.
2. **A.2:** In `scripts/src/inspect-prod-db.ts`: Remove hardcoded production database connection string; require `DATABASE_URL` environment variable.
3. **A.3:** In `artifacts/api-server/src/routes/payment-gateway.ts`: Delete or comment out `GET /api/payments/schema-repair`.
4. **A.4:** In `artifacts/api-server/src/routes/payment-gateway.ts`: Add `requireAuth, requirePermission("settings", "view")` to `GET /api/payments/gateway-diagnostics`.

### HOTFIX B — Broken Function-Level Authorization (Day 1–2)
1. **B.1:** In `artifacts/api-server/src/routes/location-pricing.ts`: Add `requirePermission("services", "edit")` on `POST /`, `PATCH /:id`, and `DELETE /:id`. Ensure `assertBranchAccess` validates the rule's branch.
2. **B.2:** In `artifacts/api-server/src/routes/societies.ts`: Add `requirePermission("branches", "edit")` on `POST /`, `PATCH /:id`, and `POST /:id/towers`.
3. **B.3:** In `artifacts/api-server/src/routes/zones.ts`: Add `requirePermission("branches", "edit")` on `POST /` and `PATCH /:id`. Ensure unassigned branch users cannot operate outside central admin scope.

### HOTFIX C — Network Perimeter & CORS Restriction (Day 2)
1. **C.1:** In `artifacts/api-server/src/app.ts`: Replace `cors({ origin: true, credentials: true })` with an explicit origin allowlist:
   ```typescript
   const ALLOWED_ORIGINS = new Set([
     "https://cwpdetailers.in",
     "https://www.cwpdetailers.in",
     ...(process.env.NODE_ENV !== "production" ? ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080"] : []),
   ]);
   app.use(cors({
     origin: (origin, callback) => {
       if (!origin || ALLOWED_ORIGINS.has(origin)) callback(null, true);
       else callback(new Error("CORS origin not allowed by policy"));
     },
     credentials: true,
   }));
   ```

### HOTFIX D — Credential & Session Safety (Day 3)
1. **D.1:** In `artifacts/api-server/src/lib/sessionCookie.ts`: Remove query parameter token extraction (`req.query?.token`). Tokens must only be accepted via `HttpOnly` cookies or `Authorization: Bearer <token>` headers.
2. **D.2:** In `artifacts/api-server/src/lib/userPassword.ts`: Increase minimum password length to 8 characters and require at least one number.
3. **D.3:** In `artifacts/cwp-platform/src/lib/auth.tsx`: Prepare transition to rely on `HttpOnly` session cookies as primary auth, phasing out `localStorage` bearer token persistence.

### HOTFIX E — OTP & Abuse Controls (Day 4)
1. **E.1:** In `artifacts/api-server/src/lib/googleAuth.ts`: Replace `Math.random()` in `generateOtpCode()` with `crypto.randomInt(100000, 1000000)`.
2. **E.2:** In `artifacts/api-server/src/lib/authOtp.ts`: Reduce `OTP_TTL_MINUTES` from 15 to 5 minutes; add an attempt counter locking out after 3 failed verification attempts.

---

## 9. TEST, REGRESSION & VERIFICATION STRATEGY

### 9.1 Pre-Implementation Automated Test Suite
Before modifying any line of code, run the existing unit and integration suites to capture the clean baseline:
- `pnpm --filter @workspace/cwp-platform test` (All 712 tests must pass).
- `pnpm --filter @workspace/api-server test` (Serviceability and auth regression tests).

### 9.2 Hotfix Test Specifications (Tests to Write)

| Hotfix Item | Test File to Create / Update | Test Cases to Implement |
| :--- | :--- | :--- |
| **Hotfix A (Purge Guard)** | `scripts/src/__tests__/reset-db-guard.test.ts` | 1. Script throws error if `TARGET_DATABASE_URL` is omitted.<br>2. Script throws error if target is remote without confirmation flag. |
| **Hotfix A (Schema Repair)** | `artifacts/api-server/src/__tests__/security/schema-repair-disabled.test.ts` | 1. `GET /api/payments/schema-repair` returns 404 or 401/403. Anonymous call cannot execute DDL. |
| **Hotfix B (Pricing Authz)** | `artifacts/api-server/src/__tests__/security/location-pricing-authz.test.ts` | 1. Customer token to `POST /api/location-pricing` returns 403 Forbidden.<br>2. Staff token returns 403 Forbidden.<br>3. Admin token succeeds. |
| **Hotfix B (Societies Authz)**| `artifacts/api-server/src/__tests__/security/societies-authz.test.ts` | 1. Customer token to `POST /api/societies` returns 403.<br>2. Customer token to `PATCH /api/societies/:id` returns 403.<br>3. Admin token succeeds. |
| **Hotfix B (Zones Authz)** | `artifacts/api-server/src/__tests__/security/zones-authz.test.ts` | 1. Customer token to `POST /api/zones` returns 403.<br>2. Admin token succeeds. |
| **Hotfix C (CORS Whitelist)** | `artifacts/api-server/src/__tests__/security/cors-policy.test.ts` | 1. Request with `Origin: https://attacker.com` is rejected or does not return `Access-Control-Allow-Origin: https://attacker.com`.<br>2. Request with `Origin: https://cwpdetailers.in` succeeds with `Access-Control-Allow-Credentials: true`. |
| **Hotfix E (Crypto OTP)** | `artifacts/api-server/src/__tests__/security/otp-crypto-security.test.ts` | 1. Generated OTP is strictly 6 digits between 100000 and 999999.<br>2. OTP verification locks after 3 invalid attempts. |

---

## 10. DEPLOYMENT & ROLLBACK STRATEGY

### 10.1 Deployment Prerequisites
1. Ensure all new security tests pass locally.
2. Build verification: `pnpm --filter @workspace/api-server run build` and `pnpm --filter @workspace/cwp-platform run build` must succeed with zero errors.
3. Review `git diff` to ensure zero unintended changes.

### 10.2 Deployment Sequence
1. Deploy Hotfix A and Hotfix B on a dedicated branch (`security/containment-hotfixes`).
2. Verify production staging environment:
   - Admin login works (`/admin/login`).
   - Customer login works (`/login`).
   - Staff login works (`/staff/login`).
   - Admin can still edit location pricing and societies.
   - Public catalog loads without auth.
3. Merge branch to `main` and monitor Railway automated build (`db:deploy-auto`).

### 10.3 Rollback Plan
- **Git Rollback:** If any unforeseen regression occurs, revert the hotfix commit (`git revert <COMMIT_SHA>`) and redeploy.
- **Zero Schema Mutation:** Hotfixes A, B, and C introduce **zero database schema migrations**, ensuring instant and safe rollback capability with zero database state corruption.

---

## 11. CONFIRMATION OF INSPECTED ARTIFACTS

The containment assessment was conducted by directly inspecting:
1. `scripts/src/reset-production-db.ts` (lines 1-50, 140-195)
2. `scripts/src/inspect-prod-db.ts` (lines 1-30)
3. `scripts/package.json` (line 46)
4. `railway.json` (lines 1-13)
5. `.github/workflows/ci.yml` (lines 1-54)
6. `artifacts/api-server/src/app.ts` (lines 95-135)
7. `artifacts/api-server/src/routes/payment-gateway.ts` (lines 30-135)
8. `artifacts/api-server/src/routes/location-pricing.ts` (lines 115-290)
9. `artifacts/api-server/src/routes/societies.ts` (lines 185-350)
10. `artifacts/api-server/src/routes/zones.ts` (lines 85-190)
11. `artifacts/cwp-platform/src/pages/admin/LocationPricingPage.tsx` (lines 160-255)
12. `artifacts/cwp-platform/src/pages/admin/SocietiesPage.tsx` (lines 100-160)
13. `artifacts/cwp-platform/src/features/societies/api.ts` (lines 50-120)
14. `artifacts/cwp-platform/src/pages/admin/OperationalZonesPage.tsx` (lines 150-205)

---

## 12. SUMMARY OF MUTATIONS & INTEGRITY ATTESTATION

- **Files Created:** Only this audit report: `docs/audits/CWP_COMPLETE_ENGINEERING_AUDIT_PHASE_1_1_CONTAINMENT_READINESS.md`.
- **Files Modified:** None.
- **Files Deleted:** None.
- **Database Operations:** Zero queries, zero connections, zero migrations, zero seeds.
- **Git Metadata:** Zero commits, zero pushes, zero branch switches, zero stash operations.
- **Credentials:** Zero secrets printed, zero credentials tested against live endpoints.

---

## 13. AUDITOR RECOMMENDATION & GATE VERDICT

> [!IMPORTANT]
> **GATE VERDICT: READY FOR CONTROLLED HOTFIX EXECUTION UPON USER APPROVAL**
> 
> The containment status and hotfix design are fully documented. The proposed Hotfix A and Hotfix B scopes carry **zero regression risk to valid user workflows** because the affected mutation endpoints are strictly admin-only interfaces.
> 
> **Execution Recommendation:**
> 1. Present this containment plan to the user.
> 2. STOP and wait for explicit authorization before modifying any code.
> 3. Upon approval, execute **Hotfix A (Production Safety)** and **Hotfix B (Authorization)** with dedicated automated test coverage.
