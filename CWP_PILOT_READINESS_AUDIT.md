# CWP Pilot Readiness Audit

**Audit date:** 13 June 2026  
**Scope:** Varanasi pilot readiness — code review + existing verification reports only  
**Method:** Repository inspection (`artifacts/`, `lib/`, `scripts/`), `PHASE1–4` reports, `SPRINT1–3` reports, `PHASE1_VERIFICATION_REPORT.md`, `phase3/phase4-http-verify.ts` outputs, Sprint 3 browser verification (staff login `9011001001`)

No new code was run for this audit beyond documents already in the repo.

---

## Executive answers

| Question | Answer | One-line reason |
|----------|--------|-----------------|
| **1. Can a real Varanasi customer use it today?** | **Partial** | Customer portal flows exist and self-registration links `customerId`, but production deploy/seed/SMS/legal content are unverified; admin-created customers have no login path. |
| **2. Can a real staff member use it today?** | **Partial** | Sprint 3 mobile staff app works locally; job workflow + photos require Cloudinary config and assigned jobs; no production E2E proof. |
| **3. Can a city manager operate daily cleaning today?** | **Partial** | Daily Ops UI + scheduler code verified via `phase4-http-verify.ts` on local API; Render cron reliability, env vars, and Sprint 4 inline-assign gaps remain. |
| **4. Can Tushar operate the business today?** | **Partial** | Admin portal is feature-complete for MVP ops, but T26 smoke test absent, production env incomplete, and non-MVP nav still exposed. |

---

## Environment assumption

| Environment | Evidence |
|-------------|----------|
| **Local dev** (`pnpm dev`, API `:8080`, web `:21456`) | Sprint 3 staff UI verified; Phase 3/4 HTTP scripts documented PASS against local API |
| **Production (Render)** | `render.yaml` exists; **no successful deploy verification** in repo; `PHASE1_VERIFICATION_REPORT.md` reports DB seed/push failures on connected Neon |

Unless stated otherwise, “Yes” below means **implemented in code and usable on a correctly configured local/staging stack**. “Verified” means **documented automated or browser evidence exists**.

---

## Workflow verification

### CUSTOMER

| Workflow | Code status | E2E verified | Pilot-ready today | Notes |
|----------|-------------|--------------|-------------------|-------|
| **Register / Login** | ✅ Implemented | ⚠️ Partial | **Partial** | `POST /auth/register` creates user + customer + `customerId` link (`auth.ts`). `/register` → dashboard. Pilot seed accounts in `logindetails.md`. Production login not verified. |
| **Add vehicle** | ✅ Implemented | ❌ No script | **Partial** | `MyAssets.tsx` → `useCreateVehicle`. Requires linked `customerId`. |
| **Add solar site** | ✅ Implemented | ❌ No script | **Partial** | `MyAssets.tsx` → `useCreateSolarSite`. |
| **Book service** | ✅ Implemented | ❌ No Phase 2 report | **Partial** | `BookService.tsx` — car wash, detailing, solar; vehicle/solar selection; `useCreateBooking`. |
| **View wallet** | ✅ Implemented | ✅ Phase 3 scripts | **Yes*** | `/customer/wallet` + dashboard card; ledger API. *On stack with seed + schema applied. |
| **View invoice** | ✅ Implemented | ⚠️ Manual Phase 3 | **Partial** | `/customer/invoices`; PDF via `/api/invoices/:id/pdf`. |
| **Raise complaint** | ✅ Implemented | ❌ No E2E | **Partial** | `/customer/complaints` (linked from Account hub); `useCreateComplaint`. Not in bottom nav — via Account. |

**Customer blockers (summary):** Admin “Add Customer” creates a **customer record only** — no user/login (`POST /customers` in `customers.ts`). Real customers must **self-register** at `/register` or use pre-seeded accounts. Wallet top-up is **admin-only** (by MVP design — customer sees balance + contact note).

---

### STAFF

| Workflow | Code status | E2E verified | Pilot-ready today | Notes |
|----------|-------------|--------------|-------------------|-------|
| **Login** | ✅ Implemented | ✅ Sprint 3 browser | **Partial** | Phone login at `/login`; role `staff`; `useAccountScope().staffId`. Unlinked staff shows “Account not linked”. |
| **See assigned jobs** | ✅ Implemented | ✅ Sprint 3 browser | **Partial** | `useGetTodayBookings({ staffId })` + `/staff/jobs`. Verified: Done tab shows completed job; Today empty on audit date. |
| **Start job** | ✅ Implemented | ⚠️ Code only | **Partial** | `scheduled` → `en_route` via `StaffJobActions` / hero on `/staff/dashboard`. |
| **Upload before photo** | ✅ Implemented | ⚠️ Needs Cloudinary | **Partial** | Cloudinary presign → `beforePhotoUrl` update. Returns **503** if `CLOUDINARY_*` unset (`storage.ts`). |
| **Upload after photo** | ✅ Implemented | ⚠️ Needs Cloudinary | **Partial** | Same flow for `afterPhotoUrl`. |
| **Complete job** | ✅ Implemented | ⚠️ Code only | **Partial** | `in_progress` + after photo → `completed`; wallet debit for daily cleaning on server. |

**Staff blockers (summary):** Staff account must be created via admin (`/admin/credentials` or seed) with `staffId` on user. Photo workflow **blocked without Cloudinary**. No documented full chain: assign → staff photo → customer history photo visible.

---

### ADMIN

| Workflow | Code status | E2E verified | Pilot-ready today | Notes |
|----------|-------------|--------------|-------------------|-------|
| **Create customer** | ✅ Implemented | ❌ No E2E | **Partial** | `Customers.tsx` → `useCreateCustomer`. **Does not create login.** |
| **Create contract** | ✅ Implemented | ⚠️ Seed + UI | **Partial** | `Subscriptions.tsx` — “Create daily wash contract” (`daily_wash`). Requires customer + vehicle first. |
| **Assign staff** | ✅ Implemented | ✅ Phase 4 HTTP | **Partial** | Vehicle `assignedStaffId` on `CustomerDetail.tsx`; booking assign via staff ID number in `Bookings.tsx`. Daily Ops links to customer detail (no inline popover — Sprint 4). |
| **Recharge wallet** | ✅ Implemented | ✅ Phase 3 scripts | **Yes*** | `CustomerDetail.tsx` → `POST /customers/:id/wallet/credit`. Ledger-first. |
| **View Daily Ops** | ✅ Implemented | ✅ `phase4-http-verify.ts` | **Partial** | `/admin/daily-ops` — KPIs, run schedule/tick, unassigned, due washes, blockers. |
| **Resolve complaint** | ✅ Implemented | ❌ No E2E | **Partial** | `Complaints.tsx` — status `in_progress` / `resolved` buttons. |

**Admin blockers (summary):** Booking staff assign UX uses **raw Staff ID** input. Daily tick on Render free tier may not run while service is spun down (in-process scheduler in `index.ts` only runs when server is up).

---

## Role-specific detail

### 1. Real Varanasi customer — **Partial**

**Works in code:**
- Self-service register/login with scoped data (`useAccountScope` on all customer pages)
- Asset onboarding, booking, wallet, invoices, complaints
- PWA install banner on customer layout

**Does not work or unverified for a real outsider today:**
- Production URL / HTTPS deploy not proven in repo
- Customers created by admin cannot log in without a separate account-linking flow
- SMS on book/complete requires `FAST2SMS_API_KEY` (not in `render.yaml`)
- Legal pages fetch `/api/legal/pages/:slug` — show “Page Not Found” if Legal CMS not seeded (`LegalPageLayout.tsx`)
- No `MVP_SMOKE_TEST.md` or T26 sign-off

---

### 2. Real staff member — **Partial**

**Works in code:**
- Sprint 3 mobile-first shell (bottom nav: Today / Jobs / Earnings / Profile)
- Active job hero + full workflow buttons on `/staff/dashboard`
- Staff-scoped job lists; earnings from completed bookings

**Does not work or unverified today:**
- Cloudinary mandatory for photos in field
- Production PWA install on Android not runtime-tested (`PWA_IMPLEMENTATION_REPORT.md`)
- Legacy staff accounts without `staffId` link (e.g. old seed `9876543210` per `logindetails.md`) see “Account not linked”
- End-to-end job completion with wallet debit + customer SMS not documented on real phones

---

### 3. City manager — daily cleaning — **Partial**

**Works in code:**
- `/admin/daily-ops` dashboard
- `POST /subscriptions/daily-schedule`, `POST /subscriptions/daily-tick`
- Vehicle→staff assignment on customer detail
- Auto-pause/resume, Wednesday off-day (`DAILY_CLEANING_OFF_DAYS`), low-balance helpers

**Does not work or unverified today:**
- `manager` role exists in RBAC but pilot seed only documents **one admin** (`9999999999`) — no separate manager account seeded
- Sprint 4 inline assign on Daily Ops **not built** — manager must open customer detail
- Scheduler idempotency verified on local API only (`phase4-http-verify.ts` ALL PASS)
- Render free spin-down + missing `FAST2SMS_*` / `WALLET_LOW_BALANCE_DAYS` in blueprint → automation may silently fail in production

---

### 4. Tushar (business owner) — **Partial**

**Works in code:**
- Full admin portal: customers, subscriptions, bookings, wallet, invoices, complaints, daily ops, founder dashboard, operations wall
- Phase 3 money flows + Phase 4 daily automation code complete

**Does not work or unverified today:**
- T26 / 7-day real pilot not executed
- Admin sidebar still shows Leads, Franchisees, Churned (T25 not done) — noise for MVP ops
- Production secrets: `SESSION_SECRET` documented in `.env.example` but **not** in `render.yaml`
- Phase 1 verification: root `pnpm build/typecheck` failed on Windows; Neon seed partial fail
- Communication Center / Legal CMS / Branding code present but DB migrations and content seed unverified for pilot

---

## Every blocker (complete list)

| ID | Blocker | Affects |
|----|---------|---------|
| B01 | No verified production deployment (Render blueprint not proven end-to-end) | All roles |
| B02 | `SESSION_SECRET` not in `render.yaml` | Auth/sessions in production |
| B03 | `CLOUDINARY_*` required for staff photos; 503 if missing | Staff complete-job flow |
| B04 | `FAST2SMS_*` not in `render.yaml`; SMS adapters no-op without keys | Customer/staff notifications |
| B05 | No T26 / `MVP_SMOKE_TEST.md` — no signed end-to-end pilot checklist | Go-live decision |
| B06 | Admin `Add Customer` does not create portal login | Customers created by admin |
| B07 | `PHASE1_VERIFICATION_REPORT.md`: DB push/seed failed on connected Neon | Pilot accounts on target DB |
| B08 | Render free tier spin-down — in-process daily tick may not fire overnight | Daily cleaning automation |
| B09 | Legal CMS pages require DB content; otherwise public legal routes 404 | Register/compliance trust |
| B10 | Admin booking assign uses Staff ID number, not staff picker | Manager UX / errors |
| B11 | Daily Ops “Assign staff” links to customer detail (Sprint 4 inline assign not done) | Manager daily workflow speed |
| B12 | No automated proof: book → assign → staff photos → customer history | Full service line |
| B13 | Wallet recharge admin-only (cash/UPI) — customer cannot self-top-up online | Customer daily cleaning continuity |
| B14 | Legacy/unlinked staff users cannot use portal | Staff onboarding |
| B15 | `HistoryPanel.tsx` typecheck errors fail root `pnpm typecheck` | CI/release hygiene |
| B16 | PWA Android install not verified on physical devices | Staff/customer mobile adoption |
| B17 | Admin nav not trimmed (Leads, Franchisees, Churned visible) | Tushar MVP focus |
| B18 | Sprint M migration tools absent | Legacy customer onboarding at scale |
| B19 | `MSG91_*` in render.yaml but primary SMS code path is FAST2SMS | Misconfigured prod SMS |
| B20 | Customer complaints/invoices/history not in bottom nav (Account links only) | Customer discoverability |

---

## Blocker ranking

### P0 — Must resolve before Varanasi pilot

| ID | Blocker | Why P0 |
|----|---------|--------|
| B01 | Production deploy verified (HTTPS, healthz, frontend loads) | Real users need a stable URL |
| B02 | `SESSION_SECRET` set in production | Sessions otherwise insecure/broken |
| B03 | Cloudinary configured and upload tested on target host | Staff cannot complete jobs without photos |
| B05 | End-to-end smoke test executed and signed (T26) | No proof the chain works for real users |
| B07 | Target DB schema pushed + pilot seed idempotent run verified | Login accounts and sample data |
| B06 | Customer login path defined for pilot (self-register OR link accounts) | Real customers need portal access |
| B08 | Daily tick reliability (cron hitting `/subscriptions/daily-tick` or always-on service) | Daily cleaning is core pilot promise |

### P1 — Important before or during first week of pilot

| ID | Blocker | Why P1 |
|----|---------|--------|
| B04 | FAST2SMS (or MSG91) configured + test SMS to real phone | MVP promises booking/complete/low-balance alerts |
| B12 | Manual E2E: book → assign → staff complete → customer sees history | Validates primary revenue workflow |
| B09 | Legal CMS seeded (privacy, terms) | Customer trust / Play Store style compliance |
| B10 | Safer staff assignment UX (name picker vs raw ID) | Reduces manager errors |
| B14 | Both staff accounts linked (`staffId` + verified) | Field users must log in |
| B13 | Wallet top-up SOP for admin (when customer balance low) | Daily cleaning stops on empty wallet |

### P2 — Nice to have / post-pilot week 1

| ID | Blocker | Why P2 |
|----|---------|--------|
| B11 | Sprint 4 Daily Ops inline assign | Speed, not blocking |
| B17 | Trim admin nav (T25) | UX polish |
| B16 | Android PWA install verification | Adoption, not blocking browser use |
| B15 | Fix `HistoryPanel.tsx` typecheck | Communications module, not MVP ops |
| B18 | Sprint M legacy migration | Only if importing old spreadsheets |
| B20 | Customer IA / Account hub (Sprint 9) | Discoverability |
| B19 | Align render.yaml SMS env with FAST2SMS primary | Config cleanup |

---

## Verification evidence index

| Source | What it proves |
|--------|----------------|
| `PHASE3_IMPLEMENTATION_REPORT.md` + `phase3-http-verify.ts` | Wallet ledger, credit, invoice API |
| `PHASE4_IMPLEMENTATION_REPORT.md` + `phase4-http-verify.ts` | Daily ops API, schedule, tick, vehicle staff assign |
| `SPRINT3_IMPLEMENTATION_REPORT.md` + `docs/screenshots/sprint3-verification/` | Staff mobile UI, login, jobs, earnings, profile |
| `PWA_IMPLEMENTATION_REPORT.md` | PWA build on desktop; Android not tested |
| `PHASE1_VERIFICATION_REPORT.md` | Production readiness gaps on Windows/Neon |
| Sprint 3 browser session (13 Jun 2026) | Staff `9011001001` login; bottom nav; earnings ₹599 week view |

---

## Audit conclusion

The **software implements** the Varanasi MVP feature set in code (customer portal, staff field app, admin ops, wallet, daily automation). It is **not yet proven** for a real Varanasi pilot on production infrastructure with real phones, real SMS, and real paying customers.

**Pilot readiness verdict:** **Partial** across all four roles until P0 blockers are cleared and T26-style smoke test passes on the target environment.

---

*Audit only. Sprint 4 not implemented. No code changes in this document.*
