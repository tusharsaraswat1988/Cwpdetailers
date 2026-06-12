# Phase 1 Verification Report

**Verification date:** 2026-06-12  
**Git HEAD:** `6bf9098` — *Merge remote main with local admin login and responsive layout updates.*  
**Workspace:** `CWPDETAILERS` (Windows 10, PowerShell)  
**Verifier:** Automated checks run in this session against working tree (uncommitted changes)

---

## Executive Summary

| Check | Result |
|-------|--------|
| `pnpm run typecheck` | **FAIL** (exit 1) |
| `pnpm run build` | **FAIL** (exit 1) |
| Direct `tsc` (api-server, cwp-platform, scripts) | **PASS** (exit 0 each) |
| Direct `tsc --build` (libs) | **PASS** (exit 0) |
| Direct api-server esbuild | **PASS** (exit 0) |
| Direct vite frontend build | **PASS** (exit 0, warnings) |
| Lint script | **NOT CONFIGURED** (no `lint` script in any `package.json`) |
| IDE linter on edited paths | **PASS** (0 diagnostics) |
| Automated test suite | **NOT PRESENT** (0 test files found) |
| `drizzle-kit push` | **FAIL** (exit 1) |
| `scripts/src/seed.ts` on Neon DB | **PARTIAL FAIL** (duplicate key; exit 0 despite error) |
| Live API smoke tests | **PARTIAL PASS** (see § API) |
| Screenshots | **NOT CAPTURED** (UI paths documented instead) |

**Bottom line:** Code changes are present in git and compile via direct tooling, but **root `pnpm` commands fail on Windows**, **DB push/seed verification failed on the connected Neon database**, and **pilot login accounts were not verified end-to-end** because seed did not complete on the existing DB.

---

## Global Git Evidence

### Working tree status (35 entries)

```
 M  artifacts/api-server/package.json
 M  artifacts/api-server/src/app.ts
 M  artifacts/api-server/src/index.ts
 D  artifacts/api-server/src/lib/objectAcl.ts
 D  artifacts/api-server/src/lib/objectStorage.ts
 M  artifacts/api-server/src/lib/passwords.ts
 M  artifacts/api-server/src/routes/auth.ts
 M  artifacts/api-server/src/routes/franchisees.ts
 M  artifacts/api-server/src/routes/staff.ts
 M  artifacts/api-server/src/routes/storage.ts
 M  artifacts/cwp-platform/src/lib/auth.tsx
 M  artifacts/cwp-platform/src/pages/customer/*.tsx (5 files)
 M  artifacts/cwp-platform/src/pages/staff/*.tsx (4 files)
 M  lib/object-storage-web/src/use-upload.ts
 M  pnpm-lock.yaml
 M  pnpm-workspace.yaml
 M  scripts/package.json
 M  scripts/src/seed.ts
??  .env.example
??  render.yaml
??  artifacts/api-server/src/lib/cloudinaryStorage.ts
??  artifacts/cwp-platform/src/lib/account-scope.ts
??  artifacts/cwp-platform/src/lib/media-url.ts
??  (+ planning docs: MASTER_PLAN.md, CWP_*.md, PHASE1_IMPLEMENTATION_REPORT.md)
```

### Aggregate diff summary

```
25 files changed, 579 insertions(+), 1288 deletions(-)
```

### New dependencies (manifest + lockfile)

| Package | Added to | Removed from | Lockfile resolved |
|---------|----------|--------------|-------------------|
| `argon2@^0.43.0` | `artifacts/api-server`, `scripts` | — | `argon2@0.43.1` |
| `cloudinary@^2.6.1` | `artifacts/api-server` | — | `cloudinary@2.10.0` |
| `@google-cloud/storage` | — | `artifacts/api-server` | **removed from lockfile** |

`pnpm-workspace.yaml` also adds `argon2` to `onlyBuiltDependencies`.

**Still present but unused:** `google-auth-library` in `artifacts/api-server/package.json` (not removed in Phase 1 diff).

---

## Per-Task Verification (T1–T7)

---

### T1 — Production deploy foundation

#### 1. Exact files modified

| Status | Path |
|--------|------|
| NEW (untracked) | `render.yaml` (41 lines) |
| NEW (untracked) | `.env.example` (26 lines) |
| MODIFIED | `artifacts/api-server/src/index.ts` |
| MODIFIED | `artifacts/api-server/src/app.ts` |

#### 2. Git diff summary

```
 artifacts/api-server/src/index.ts | 2 +-
 artifacts/api-server/src/app.ts   | 13 +++++++++++++
 render.yaml                       | (untracked, not in diff)
 .env.example                      | (untracked, not in diff)
```

Key diff hunk (`index.ts`):

```diff
-app.listen(port, (err) => {
+app.listen(port, "0.0.0.0", (err) => {
```

Key diff hunk (`app.ts`): adds `STATIC_ROOT` + `express.static` + SPA fallback when `NODE_ENV=production`.

#### 3. New dependencies added

None for T1 specifically.

#### 4. Screenshots / UI paths affected

**Screenshots:** None captured.

**UI paths (unchanged routes; deploy affects all):**

| Path | Page |
|------|------|
| `/` | Landing |
| `/login`, `/register`, `/admin/login` | Auth |
| `/customer/dashboard`, `/customer/bookings`, `/customer/history`, `/customer/invoices`, `/customer/complaints` | Customer portal |
| `/staff/dashboard`, `/staff/schedule`, `/staff/attendance`, `/staff/performance` | Staff portal |
| `/admin/*` | Admin portal |

Production serving: API + static bundle from `artifacts/cwp-platform/dist/public` when `STATIC_ROOT` is set (per `app.ts`).

#### 5. API endpoints tested

| Endpoint | Result |
|----------|--------|
| `GET /api/healthz` | **200** `{"status":"ok"}` |

Render deploy itself **not executed** in this verification session (no Render apply).

#### 6. Test results

No automated tests. Manual API smoke: health check **PASS**.

#### 7. Build result

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm run build` | **1** | Blocked by preinstall (see § Build output) |
| `node artifacts/api-server/build.mjs` | **0** | `dist/index.mjs` 5.4mb |
| `BASE_PATH=/ vite build` (cwp-platform) | **0** | `dist/public/index.html` + assets |

#### 8. Typecheck result

| Command | Exit |
|---------|------|
| `pnpm run typecheck` | **1** (preinstall) |
| `npx tsc -p artifacts/api-server` | **0** |
| `npx tsc -p artifacts/cwp-platform` | **0** |

#### 9. Lint result

No project lint script. IDE lints on edited files: **0 issues**.

#### 10. Database push result

```
npx drizzle-kit push --config lib/db/drizzle.config.ts
Error  No schema files found for path config ['...\lib\db\src\schema\index.ts']
DRIZZLE_EXIT:1
```

**FAIL** — schema file exists on disk but drizzle-kit could not load it in this environment.

---

### T2 — Secure password hashing (Argon2)

#### 1. Exact files modified

| Status | Path |
|--------|------|
| MODIFIED | `artifacts/api-server/src/lib/passwords.ts` |
| MODIFIED | `artifacts/api-server/src/routes/auth.ts` |
| MODIFIED | `artifacts/api-server/src/routes/staff.ts` |
| MODIFIED | `artifacts/api-server/src/routes/franchisees.ts` |
| MODIFIED | `scripts/src/seed.ts` |
| MODIFIED | `scripts/package.json` |

#### 2. Git diff summary

```
 artifacts/api-server/src/lib/passwords.ts | 48 +++++ overhaul (SHA-256 → argon2 + legacy upgrade)
 artifacts/api-server/src/routes/auth.ts   | 45 +++++ (verifyPasswordWithUpgrade, async hash)
 artifacts/api-server/src/routes/staff.ts  | 2 +- (await hashPassword)
 artifacts/api-server/src/routes/franchisees.ts | 2 +- (await hashPassword)
 scripts/src/seed.ts                       | 263 +++++ rewritten (argon2 in seed)
 scripts/package.json                     | +argon2
```

#### 3. New dependencies added

- `argon2@^0.43.0` → lockfile `argon2@0.43.1`

#### 4. Screenshots / UI paths affected

None directly. Login flows at `/login`, `/admin/login`, `/register`.

#### 5. API endpoints tested

| Endpoint | Body | Result |
|----------|------|--------|
| `POST /api/auth/login` | `9999999999` / `admin123` | **200** (legacy SHA-256 still in DB; upgrade path in code) |
| `POST /api/auth/login` | `9999999999` / `wrong` | **401** (expected) |
| `GET /api/auth/me` | Bearer admin token | **200** `id=1` |

**Not verified:** argon2 hash persisted after login upgrade (no post-login DB inspection run).

#### 6. Test results

No unit tests. API smoke above: **partial pass**.

#### 7–10. Build / typecheck / lint / DB

Same as global section. Seed uses argon2 (see T7 for seed failure).

---

### T3 — Cloudinary storage (no local/Replit)

#### 1. Exact files modified

| Status | Path |
|--------|------|
| NEW | `artifacts/api-server/src/lib/cloudinaryStorage.ts` (79 lines) |
| NEW | `artifacts/cwp-platform/src/lib/media-url.ts` (51 lines) |
| MODIFIED | `artifacts/api-server/src/routes/storage.ts` |
| MODIFIED | `artifacts/api-server/package.json` |
| MODIFIED | `lib/object-storage-web/src/use-upload.ts` |
| MODIFIED | `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx` |
| DELETED | `artifacts/api-server/src/lib/objectStorage.ts` (267 lines) |
| DELETED | `artifacts/api-server/src/lib/objectAcl.ts` (137 lines) |

#### 2. Git diff summary

```
 artifacts/api-server/src/routes/storage.ts | 130 +++------- (Cloudinary presign; 410 on legacy)
 artifacts/api-server/package.json          | -@google-cloud/storage +cloudinary +argon2
 lib/object-storage-web/src/use-upload.ts   | 141 +++++------ (multipart Cloudinary upload)
 artifacts/api-server/src/lib/objectStorage.ts | DELETED 267 lines
 artifacts/api-server/src/lib/objectAcl.ts     | DELETED 137 lines
 cloudinaryStorage.ts, media-url.ts          | untracked NEW
 staff/Dashboard.tsx                        | Cloudinary upload + resolveMediaUrl
```

#### 3. New dependencies added

- `cloudinary@^2.6.1` → lockfile `cloudinary@2.10.0`
- Removed: `@google-cloud/storage` (no matches in `pnpm-lock.yaml` after change)

#### 4. Screenshots / UI paths affected

**Screenshots:** None captured.

**UI path:** `/staff/dashboard` — in-progress job → **Add Photos** file input → Cloudinary upload flow.

Also: `/customer/history` — proof thumbnails via `resolveMediaUrl()`.

#### 5. API endpoints tested

Server env: `CLOUDINARY_CLOUD_NAME=dhfphz6nv`, `CLOUDINARY_API_KEY=***`, `CLOUDINARY_API_SECRET=***` (from local `.env` / Cloudinary URL).

| Endpoint | Result |
|----------|--------|
| `POST /api/storage/uploads/request-url` | **200** — `uploadURL=https://api.cloudinary.com/v1_1/dhfphz6nv/...` |
| `GET /api/storage/objects/test.jpg` | **410** — body empty in PowerShell capture |

**Not tested:** Full browser multipart upload to Cloudinary + `POST /bookings/:id/proof` persistence.

#### 6. Test results

API presign + legacy 410: **PASS**. End-to-end photo on booking: **NOT RUN**.

#### 7–10. Build / typecheck / lint / DB

Build/typecheck **PASS** via direct commands. DB unchanged for T3.

---

### T4 — Wire customer portal to auth

#### 1. Exact files modified

| Path |
|------|
| NEW `artifacts/cwp-platform/src/lib/account-scope.ts` |
| MODIFIED `artifacts/cwp-platform/src/lib/auth.tsx` |
| MODIFIED `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` |
| MODIFIED `artifacts/cwp-platform/src/pages/customer/BookService.tsx` |
| MODIFIED `artifacts/cwp-platform/src/pages/customer/History.tsx` |
| MODIFIED `artifacts/cwp-platform/src/pages/customer/Invoices.tsx` |
| MODIFIED `artifacts/cwp-platform/src/pages/customer/Complaints.tsx` |

#### 2. Git diff summary

```
 artifacts/cwp-platform/src/lib/auth.tsx            | 58 +++--
 customer/Dashboard.tsx   | 36 +-
 customer/BookService.tsx  | 27 +-
 customer/History.tsx      | 21 +-
 customer/Invoices.tsx     | 18 +-
 customer/Complaints.tsx   | 20 +-
 account-scope.ts         | NEW (untracked)
```

**Grep verification (working tree):** no matches for `customerId = 1`, `customerId: 1`, or `customerId: "1"` in `artifacts/cwp-platform/**/*.tsx`.

#### 3. New dependencies added

None.

#### 4. Screenshots / UI paths affected

**Screenshots:** None.

| Route | Component |
|-------|-----------|
| `/customer/dashboard` | `Dashboard.tsx` |
| `/customer/bookings` | `BookService.tsx` |
| `/customer/history` | `History.tsx` |
| `/customer/invoices` | `Invoices.tsx` |
| `/customer/complaints` | `Complaints.tsx` |

Unlinked account UI: inline message *"Account not linked"* when `user.customerId == null`.

#### 5. API endpoints tested

| Endpoint | Result |
|----------|--------|
| `POST /api/auth/login` pilot `9001001001` / `customer123` | **401 FAIL** |
| `POST /api/auth/login` pilot `9001001001` / `any` | **401 FAIL** |

**Reason:** No linked pilot customer user in DB (seed did not complete). Cannot verify portal isolation via API in this session.

#### 6. Test results

Code removal of hardcoded IDs: **PASS** (grep).  
Runtime customer login + scoped data: **FAIL** on current DB.

#### 7–10. Build / typecheck / lint / DB

Frontend `tsc`: **PASS**. Lint: **N/A**. DB seed: **FAIL** (see T7).

---

### T5 — Wire staff portal to auth

#### 1. Exact files modified

| Path |
|------|
| `artifacts/cwp-platform/src/lib/account-scope.ts` |
| `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx` |
| `artifacts/cwp-platform/src/pages/staff/Schedule.tsx` |
| `artifacts/cwp-platform/src/pages/staff/Attendance.tsx` |
| `artifacts/cwp-platform/src/pages/staff/Performance.tsx` |

#### 2. Git diff summary

```
 staff/Dashboard.tsx   | 62 +++--
 staff/Schedule.tsx    | 18 +-
 staff/Attendance.tsx  | 23 +-
 staff/Performance.tsx | 31 +-
```

**Grep verification:** no `staffId = 1` or `staffId: "1"` in cwp-platform TSX.

#### 3. New dependencies added

None.

#### 4. Screenshots / UI paths affected

**Screenshots:** None.

| Route | Component |
|-------|-----------|
| `/staff/dashboard` | `Dashboard.tsx` |
| `/staff/schedule` | `Schedule.tsx` |
| `/staff/attendance` | `Attendance.tsx` |
| `/staff/performance` | `Performance.tsx` |

#### 5. API endpoints tested

| Endpoint | Result |
|----------|--------|
| `POST /api/auth/login` pilot `9011001001` / `staff123` | **401 FAIL** |
| `POST /api/auth/login` legacy `9876543210` / `staff123` | **200** but response `staffId=` **empty** |

Legacy staff user logs in but **`staffId` is null in DB** → staff portal would show *"Account not linked"* at runtime.

#### 6. Test results

Hardcoded ID removal: **PASS**.  
Staff-scoped jobs with linked `staffId`: **FAIL** on current DB.

#### 7–10. Build / typecheck / lint / DB

Frontend `tsc`: **PASS**. DB: see T7.

---

### T6 — Staff login linkage on create-account

#### 1. Exact files modified

| Path | Change in Phase 1 diff |
|------|------------------------|
| `artifacts/api-server/src/routes/staff.ts` | `await hashPassword(password)` only |
| `artifacts/api-server/src/routes/auth.ts` | `/auth/me` reads fresh row from DB |

`staffId: staffMember.id` on create-account **already present** at line 213 (not introduced in this diff).

#### 2. Git diff summary

```
 artifacts/api-server/src/routes/staff.ts | 2 +- (async hash only)
```

#### 3. New dependencies added

None (uses argon2 from T2).

#### 4. Screenshots / UI paths affected

Admin path: `/admin/staff` → create-account flow (UI not exercised in verification).

#### 5. API endpoints tested

| Test | Result |
|------|--------|
| `POST /staff/:id/create-account` | **NOT RUN** |
| `GET /auth/me` after legacy staff login | **200**, `staffId` empty |

#### 6. Test results

Code inspection: `staffId` set on insert — **PASS**.  
Live create-account + staff portal: **NOT VERIFIED**.

#### 7–10. Build / typecheck / lint / DB

api-server `tsc`: **PASS**.

---

### T7 — Varanasi seed + pilot accounts

#### 1. Exact files modified

| Path |
|------|
| `scripts/src/seed.ts` (263 lines changed in diff) |
| `scripts/package.json` (+argon2) |
| `.env.example` (pilot credentials documented) |

#### 2. Git diff summary

```
 scripts/src/seed.ts | 263 +++++++------- (Varanasi-only rewrite)
 scripts/package.json | +1 argon2
```

#### 3. New dependencies added

- `argon2@^0.43.0` in `scripts/package.json`

#### 4. Screenshots / UI paths affected

None. Documented logins in `.env.example`.

#### 5. API endpoints tested

Pilot logins after seed attempt — all **401** (see T4/T5).

#### 6. Test results — seed execution

Command:

```text
cd scripts && DATABASE_URL=<neon> npx tsx ./src/seed.ts
```

Output (abbreviated):

```text
Seeding Varanasi pilot database...
Branch created: Varanasi
Services created
DrizzleQueryError: duplicate key value violates unique constraint "users_email_unique"
  detail: Key (email)=(admin@cwpdetailers.com) already exists.
SEED_EXIT:0
```

**FAIL** — seed aborts on duplicate admin; process still exits **0** (`.finally(() => process.exit())` without error code).

Partial DB writes observed: new Varanasi branch + services inserted before failure.

#### 7–10. Build / typecheck / lint / DB

scripts `tsc`: **PASS**.  
Full pilot seed on clean DB: **NOT VERIFIED**.  
Re-seed on existing Neon DB: **FAIL**.

---

## API Endpoints Tested (Full Session)

Server: `node artifacts/api-server/dist/index.mjs` on `127.0.0.1:8080`  
Database: Neon Postgres from workspace `.env`

| # | Method | Path | Status | Evidence |
|---|--------|------|--------|----------|
| 1 | GET | `/api/healthz` | 200 | `{"status":"ok"}` |
| 2 | POST | `/api/auth/login` (admin) | 200 | `userId=1 role=admin` |
| 3 | POST | `/api/auth/login` (customer pilot) | 401 | No user / wrong hash |
| 4 | POST | `/api/auth/login` (staff pilot) | 401 | No user / wrong hash |
| 5 | GET | `/api/auth/me` (customer token) | not run | No customer token |
| 6 | GET | `/api/auth/me` (admin) | 200 | `id=1 customerId= staffId=` |
| 7 | POST | `/api/storage/uploads/request-url` | 200 | Cloudinary URL returned |
| 8 | GET | `/api/storage/objects/test.jpg` | 410 | Legacy route disabled |
| 9 | POST | `/api/auth/login` (legacy staff 9876543210) | 200 | `staffId` empty |
| 10 | POST | `/api/auth/login` (wrong password) | 401 | Expected |
| 11 | GET | `/api/bookings?customerId=1` (admin) | 200 | `len=1573` |

**Not tested:** `/auth/register`, `/auth/logout`, `/staff/:id/create-account`, Cloudinary multipart upload, booking proof attach, Render production deploy.

---

## `pnpm typecheck` Output (exact)

```text
> pnpm run typecheck

Scope: all 10 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date

. preinstall$ sh -c 'rm -f package-lock.json yarn.lock; case "$npm_config_user_agent" in pnpm/*) ;; *) echo "Use pnpm instead" >&2; exit 1 ;; esac'
. preinstall: 'sh' is not recognized as an internal or external command,
. preinstall: operable program or batch file.
. preinstall: Failed
[ELIFECYCLE] Command failed with exit code 1.
```

**Exit code: 1**

### Workaround typecheck (direct — PASS)

```text
npx tsc -p artifacts/api-server/tsconfig.json --noEmit  → EXIT:0
npx tsc -p artifacts/cwp-platform/tsconfig.json --noEmit → EXIT:0
npx tsc -p scripts/tsconfig.json --noEmit                → EXIT:0
npx tsc --build (repo root libs)                         → EXIT:0
```

---

## `pnpm build` Output (exact)

```text
> pnpm run build

Scope: all 10 workspace projects
...
. preinstall$ sh -c 'rm -f package-lock.json yarn.lock; ...'
. preinstall: 'sh' is not recognized as an internal or external command,
. preinstall: Failed
[ELIFECYCLE] Command failed with exit code 1.
```

**Exit code: 1** — same Windows preinstall failure; never reached `typecheck && pnpm -r build`.

### Workaround build outputs (PASS with warnings)

**API (`node artifacts/api-server/build.mjs`):**

```text
dist/index.mjs                   5.4mb
dist/pino-worker.mjs           153.5kb
...
Done in 2295ms
API_BUILD_EXIT:0
```

**Frontend (`vite build`, `PORT=21456`, `BASE_PATH=/`):**

```text
vite v7.3.2 building client environment for production...
src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
src/components/ui/label.tsx (2:0): Error when using sourcemap for reporting an error: ...
src/components/ui/select.tsx (2:0): Error when using sourcemap for reporting an error: ...
src/components/ui/sheet.tsx (2:0): Error when using sourcemap for reporting an error: ...
✓ 3212 modules transformed.
dist/public/index.html                     0.77 kB
dist/public/assets/index-D5hTY-tS.css    117.68 kB
dist/public/assets/index-C5VVIfJ7.js   1,290.90 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 23.13s
VITE_BUILD_EXIT:0
```

---

## Lint Result

| Check | Result |
|-------|--------|
| `pnpm run lint` | **Script does not exist** |
| ESLint / Biome config | **Not found in repo root search** |
| Cursor IDE lints on edited `src/` paths | **0 errors, 0 warnings** |

---

## Database Push Result

### Attempt 1 (no DATABASE_URL)

```text
DATABASE_URL, ensure the database is provisioned
DRIZZLE_EXIT:1
```

### Attempt 2 (DATABASE_URL set, cwd `lib/db`)

```text
Reading config file '...\lib\db\drizzle.config.ts'
Error  No schema files found for path config ['...\lib\db\src\schema\index.ts']
DRIZZLE_EXIT:1
```

### Attempt 3 (from repo root with `--config lib/db/drizzle.config.ts`)

Same **No schema files found** error.

**Note:** `lib/db/src/schema/index.ts` **exists** (25 schema modules). Failure appears to be drizzle-kit TS resolution in this environment, not missing files.

**Schema changes in Phase 1:** none intended — push should be no-op if it worked.

---

## Screenshots

| Item | Status |
|------|--------|
| Login page | **Not captured** |
| Customer dashboard scoped view | **Not captured** |
| Staff dashboard + photo upload | **Not captured** |
| Cloudinary uploaded image in UI | **Not captured** |

No browser automation was run in this verification session. Use UI paths in § T4/T5/T3 to manually capture screenshots.

---

## All Current Errors, Warnings, and Failing Tests

### Failures (blocking verification)

1. **`pnpm run typecheck`** — exit 1 (`sh` not found on Windows preinstall)
2. **`pnpm run build`** — exit 1 (same preinstall)
3. **`drizzle-kit push`** — exit 1 (cannot load schema TS path)
4. **`scripts/src/seed.ts` on existing Neon DB** — duplicate `users_email_unique`; exits 0 despite error
5. **Pilot customer login** `9001001001` / `customer123` — HTTP 401
6. **Pilot staff login** `9011001001` / `staff123` — HTTP 401
7. **T4/T5 runtime acceptance** — cannot verify scoped portals without linked pilot users in DB
8. **Legacy staff user** `9876543210` — logs in but `staffId` null → staff portal would block

### Warnings (non-fatal)

1. **Vite build:** sourcemap location warnings in Radix UI components (4 files)
2. **Vite build:** chunk size > 500 kB (`index-C5VVIfJ7.js` 1,290 kB)
3. **pg / Node:** SSL mode `require` treated as `verify-full` deprecation warning (seed + API server)
4. **Git:** CRLF line-ending warnings on `package.json`, `pnpm-lock.yaml`
5. **`.env` naming:** Cloudinary vars use non-standard keys (`Cloudinary_API_Key`) vs required `CLOUDINARY_*` — manual mapping needed for local dev unless `.env` is normalized
6. **`google-auth-library`** still listed in api-server deps (unused)
7. **Replit object storage env vars** still in `.env` (`PUBLIC_OBJECT_SEARCH_PATHS`, etc.) — obsolete after Phase 1

### Tests

| Category | Count | Result |
|----------|-------|--------|
| Unit tests | 0 files | **N/A** |
| Integration tests | 0 files | **N/A** |
| E2E tests | 0 files | **N/A** |
| API smoke tests (this session) | 11 calls | **7 pass, 4 fail/not run** |

---

## Verification Checklist vs Phase 1 Exit Criteria

| Criterion | Verified? | Evidence |
|-----------|-----------|----------|
| Deployable on Render | **Partial** | `render.yaml` exists (untracked); not applied |
| Argon2 passwords | **Partial** | Code + lockfile; admin still on legacy hash in DB |
| Cloudinary uploads | **Partial** | Presign 200; no E2E photo test |
| No hardcoded portal IDs | **Yes** | grep clean |
| Customer/staff see own data | **No** | Pilot logins 401; legacy staff unlinked |
| Varanasi seed accounts | **No** | Seed failed on duplicate admin |
| `pnpm build` / `pnpm typecheck` green | **No** | Fail on Windows preinstall |

---

## Recommended Actions Before Phase 2 Approval

1. Fix root `package.json` preinstall for Windows **or** document Linux/Render-only `pnpm` workflow.
2. Fix `drizzle-kit push` schema loading (e.g. bundle schema entry or use `tsx` runner).
3. Make `seed.ts` idempotent (upsert/clear) and exit non-zero on failure.
4. Reset or migrate Neon DB; run seed to completion; re-run pilot login API tests.
5. Backfill `users.staffId` / create pilot customer users for existing DB **or** use fresh DB.
6. Run manual UI verification on listed routes and attach screenshots.
7. Remove unused `google-auth-library` and Replit storage env vars.

---

*Report generated from live commands run on 2026-06-12 against uncommitted Phase 1 working tree.*
