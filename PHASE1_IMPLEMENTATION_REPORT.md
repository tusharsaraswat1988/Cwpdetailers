# Phase 1 Implementation Report

**Project:** CWP Detailers — Varanasi MVP  
**Phase:** 1 only (T1–T7) — Deployable & Authenticated  
**Status:** Complete — awaiting approval before Phase 2  
**Date:** 2026-06-12

---

## Summary

Phase 1 delivers a Render-deployable foundation with secure auth, Cloudinary-only media uploads, account-scoped customer/staff portals, and a Varanasi-only pilot seed. All hardcoded `customerId = 1` / `staffId = 1` demo shortcuts were removed from portal pages in favor of `useAccountScope()` aligned with asset-first architecture (account owns assets; no customer-centric ID hacks).

---

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| T1 | Production deploy foundation (`render.yaml`, `.env.example`, `0.0.0.0:$PORT`, static SPA serving) | Done |
| T2 | Argon2 password hashing + legacy SHA-256 upgrade on login | Done |
| T3 | Cloudinary signed uploads (no local/Replit/temp storage) | Done |
| T4 | Customer portal wired to `user.customerId` | Done |
| T5 | Staff portal wired to `user.staffId` | Done |
| T6 | Staff login linkage on create-account (verified existing + argon2) | Done |
| T7 | Varanasi-only pilot seed with linked accounts | Done |

**Phase 2 was not started.**

---

## Files Changed

### New files

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint: Postgres + single web service |
| `.env.example` | Documented env vars + pilot credentials |
| `artifacts/api-server/src/lib/cloudinaryStorage.ts` | Cloudinary signed upload signatures |
| `artifacts/cwp-platform/src/lib/account-scope.ts` | Account-scoped `customerId` / `staffId` hook |
| `artifacts/cwp-platform/src/lib/media-url.ts` | `resolveMediaUrl()` + `uploadFileToCloudinary()` |

### Modified files

| File | Change |
|------|--------|
| `artifacts/api-server/package.json` | Added `argon2`, `cloudinary`; removed `@google-cloud/storage` |
| `artifacts/api-server/src/index.ts` | Bind `0.0.0.0:$PORT` |
| `artifacts/api-server/src/app.ts` | Serve static frontend in production (`STATIC_ROOT`) |
| `artifacts/api-server/src/lib/passwords.ts` | Argon2 + legacy hash detection/upgrade |
| `artifacts/api-server/src/routes/auth.ts` | Async verify/hash; upgrade legacy passwords on login |
| `artifacts/api-server/src/routes/staff.ts` | `await hashPassword()` on create-account |
| `artifacts/api-server/src/routes/franchisees.ts` | `await hashPassword()` on create-account |
| `artifacts/api-server/src/routes/storage.ts` | Cloudinary presign; legacy routes return 410 |
| `artifacts/cwp-platform/src/lib/auth.tsx` | Refresh user from `GET /auth/me` on bootstrap |
| `artifacts/cwp-platform/src/pages/customer/*.tsx` | Account-scoped queries (5 pages) |
| `artifacts/cwp-platform/src/pages/staff/*.tsx` | Account-scoped queries + Cloudinary uploads (4 pages) |
| `lib/object-storage-web/src/use-upload.ts` | Cloudinary multipart upload flow |
| `scripts/package.json` | Added `argon2` for seed |
| `scripts/src/seed.ts` | Varanasi-only pilot data with linked logins |
| `pnpm-workspace.yaml` | Added `argon2` to `onlyBuiltDependencies` |

### Removed files

| File | Reason |
|------|--------|
| `artifacts/api-server/src/lib/objectStorage.ts` | Replit GCS — replaced by Cloudinary |
| `artifacts/api-server/src/lib/objectAcl.ts` | Replit GCS ACL — no longer used |

---

## Database Changes

**Schema:** No migrations. No Drizzle schema changes.

**Data (seed only):** `scripts/src/seed.ts` now seeds:

- 1 branch: CWP Varanasi
- 5 services (wash, detailing, solar)
- 3 pilot customers with linked user accounts
- 2 verified staff with linked user accounts
- Sample vehicles, subscriptions, bookings, attendance, complaints, invoices

**Re-seed required** on fresh or existing DBs to get argon2 hashes and linked accounts. Existing SHA-256 seed users can still log in once (auto-upgraded to argon2 on login).

---

## Endpoints Changed

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/auth/login` | Argon2 verify; legacy SHA-256 upgrade on success |
| POST | `/api/auth/register` | Argon2 hash for new users; links `customerId` |
| GET | `/api/auth/me` | Unchanged shape; returns `customerId` / `staffId` |
| POST | `/api/storage/uploads/request-url` | Returns Cloudinary signed upload params |
| GET | `/api/storage/public-objects/*` | **410** — local storage disabled |
| GET | `/api/storage/objects/*` | **410** — local storage disabled |
| POST | `/api/staff/:id/create-account` | Argon2 hash (already set `staffId`) |

All other API routes unchanged in Phase 1.

---

## Deployment Instructions

### Prerequisites

- Git repo pushed to GitHub/GitLab/Bitbucket
- Render account
- Cloudinary account (free tier OK for pilot)
- Postgres (Render Blueprint provisions this)

### 1. Configure Cloudinary

In Cloudinary Dashboard, note:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional: set upload folder `CLOUDINARY_FOLDER=cwp/varanasi` (default in code).

### 2. Deploy via Blueprint

```bash
# Commit render.yaml and Phase 1 changes, then push
git add render.yaml .env.example
git commit -m "Phase 1: Render deploy, auth, Cloudinary, account-scoped portals"
git push origin main
```

In Render Dashboard:

1. **New → Blueprint** → connect repo
2. Apply Blueprint (`render.yaml`)
3. Set secrets marked `sync: false`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Wait for deploy; health check: `GET /api/healthz`

### 3. Push database schema + seed

From a machine with `DATABASE_URL` pointing at Render Postgres:

```bash
# Push Drizzle schema (project uses push-only, no migrations/)
pnpm --filter @workspace/db exec drizzle-kit push

# Seed Varanasi pilot data
pnpm --filter @workspace/scripts run seed
```

### 4. Verify production

- Open service URL → login page loads
- `GET https://<service>/api/healthz` → 200
- Admin login → admin dashboard
- Customer/staff logins → scoped data only

### Local development

Copy `.env.example` to `.env`, set `DATABASE_URL` and Cloudinary vars, then:

```bash
pnpm dev   # API :8080 + Vite :21456 (requires sh/Git Bash on Windows for preinstall)
```

---

## Testing Steps

### Auth (T2, T6, T7)

1. Run seed; log in as admin `9999999999` / `admin123`
2. Log in as customer `9001001001` / `customer123` → dashboard shows Arjun Sharma data
3. Log in as customer `9001001002` / `customer123` → different bookings/invoices
4. Log in as staff `9011001001` / `staff123` → today's jobs for Ravi Kumar only
5. Log in as staff `9011001002` / `staff123` → different job list
6. Admin: verify staff → create account → new staff login works with `staffId` on `/auth/me`

### Customer portal (T4)

- [ ] Dashboard summary matches logged-in customer
- [ ] History / Invoices / Complaints scoped to account
- [ ] Book Service uses `customerId` from auth (not hardcoded)
- [ ] Unlinked customer user shows "Account not linked" message

### Staff portal (T5, T3)

- [ ] Dashboard shows only assigned/today jobs for logged-in staff
- [ ] Schedule, Attendance, Performance scoped to `staffId`
- [ ] On in-progress job: upload photo → Cloudinary → image visible via `https://` URL
- [ ] Legacy `/api/storage/objects/...` returns 410

### Deploy (T1)

- [ ] Service binds `0.0.0.0:$PORT`
- [ ] Frontend + API on same Render web service
- [ ] Health check passes

### Password migration

- [ ] Existing legacy SHA-256 hash users can log in once; hash upgraded to argon2 in DB

---

## Pilot Accounts (after seed)

| Role | Phone | Password | Name |
|------|-------|----------|------|
| Admin | 9999999999 | admin123 | Admin CWP |
| Customer | 9001001001 | customer123 | Arjun Sharma |
| Customer | 9001001002 | customer123 | Sunita Patel |
| Customer | 9001001005 | customer123 | Rohit Agarwal |
| Staff | 9011001001 | staff123 | Ravi Kumar |
| Staff | 9011001002 | staff123 | Suresh Yadav |

---

## Blockers & Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| **Windows `pnpm` preinstall uses `sh`** | Medium (local dev) | Root `package.json` preinstall fails on Windows without Git Bash/WSL. Render (Linux) unaffected. Workaround: run `npx tsc` / `node build.mjs` directly or use WSL. |
| **Cloudinary required for photo upload** | Expected | Upload endpoint returns 503 if Cloudinary env vars missing. Must configure before staff photo testing in prod. |
| **Fresh DB requires seed** | Expected | Empty DB has no pilot accounts; run `seed` after schema push. |
| **Re-seed on existing multi-city DB** | Low | Old Lucknow/Kanpur seed data may remain if not resetting DB. Pilot ops should use fresh Postgres or truncate before re-seed. |
| **`google-auth-library` still in api-server deps** | Low | Unused after GCS removal; safe to remove in cleanup PR. |
| **OpenAPI / client drift** | Low | Not Phase 1 scope; ~30% route drift remains. |
| **MSG91 SMS** | Phase 3 | Env vars documented in `.env.example` but dispatcher not implemented until Phase 3. |

---

## Asset-First Alignment Notes

Phase 1 intentionally avoids customer-centric shortcuts that would conflict with the future Asset Engine:

- Portals scope by **authenticated account** (`customerId` / `staffId` on user), not hardcoded demo IDs
- Media URLs stored as **absolute Cloudinary `https://` links** on booking records (asset-ready references)
- No local object paths or Replit GCS sidecar
- Customer register flow creates customer profile + links `users.customerId` (account owns future assets)
- Phase 2 will add explicit asset onboarding (`assetId` on bookings) — not started here

---

## Approval Gate

Phase 1 is complete. **Do not proceed to Phase 2** (asset onboarding, booking flows, wallet, notifications, daily scheduler) until this report is reviewed and approved.

**Suggested approval checklist:**

- [ ] Render deploy verified with Postgres + Cloudinary
- [ ] Pilot logins tested (customer isolation + staff job scoping)
- [ ] Staff photo upload works end-to-end on Cloudinary
- [ ] Accept Varanasi-only seed strategy for pilot

---

*Generated at completion of Phase 1 implementation.*
