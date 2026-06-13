# CWP Current Project Status

**Report date:** 13 June 2026  
**Workspace:** `CWPDETAILERS`  
**Method:** Codebase review + existing implementation/verification reports (`PHASE1–4`, `SPRINT1–2`, `PWA_IMPLEMENTATION_REPORT`, `CONNECTIVITY_ARCHITECTURE.md`, `CWP_MVP_IMPLEMENTATION_PLAN.md`, `CWP_UI_IMPLEMENTATION_ROADMAP.md`)

This document states what exists in the repository today. It does not include plans or assumptions about production deployment unless verified in a report or script output.

---

## SECTION 1 — COMPLETED

### Authentication

| Field | Detail |
|-------|--------|
| **Status** | Implemented — login, register, sessions, RBAC, argon2 hashing, legacy SHA-256 upgrade on login |
| **Files involved** | `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/lib/passwords.ts`, `artifacts/api-server/src/middlewares/auth.ts`, `artifacts/cwp-platform/src/lib/auth.tsx`, `artifacts/cwp-platform/src/lib/account-scope.ts`, `artifacts/cwp-platform/src/pages/Login.tsx`, `Register.tsx`, `AdminLogin.tsx` |
| **Verification available** | `PHASE1_IMPLEMENTATION_REPORT.md` (T2, T4, T5, T6 marked Done). `PHASE1_VERIFICATION_REPORT.md` documents partial live verification (root `pnpm` build/typecheck failed on Windows; pilot seed on connected Neon DB partial fail). `.env.example` lists pilot credentials after seed |

---

### Customer Portal

| Field | Detail |
|-------|--------|
| **Status** | Implemented — dashboard, booking, assets, history, invoices, complaints, wallet, services, account stub; auth-scoped via `useAccountScope()` |
| **Files involved** | `artifacts/cwp-platform/src/pages/customer/*.tsx`, `artifacts/cwp-platform/src/components/layout/CustomerLayout.tsx`, routes in `artifacts/cwp-platform/src/App.tsx` |
| **Verification available** | `PHASE1_IMPLEMENTATION_REPORT.md` (T4). `SPRINT1_IMPLEMENTATION_REPORT.md`, `SPRINT2_IMPLEMENTATION_REPORT.md`. Screenshots in `docs/screenshots/sprint1-verification/` |

---

### Staff Portal

| Field | Detail |
|-------|--------|
| **Status** | Implemented — dashboard (job workflow + photos), schedule, attendance, performance; auth-scoped via `useAccountScope()` |
| **Files involved** | `artifacts/cwp-platform/src/pages/staff/*.tsx`, `artifacts/cwp-platform/src/components/layout/StaffLayout.tsx`, `PanelShell.tsx` |
| **Verification available** | `PHASE1_IMPLEMENTATION_REPORT.md` (T5). `SPRINT1_IMPLEMENTATION_REPORT.md` (UI quick wins). Screenshots: `docs/screenshots/sprint1-verification/01-staff-dashboard*.png` |

---

### Admin Portal

| Field | Detail |
|-------|--------|
| **Status** | Implemented — 30+ admin routes including customers, staff, bookings, subscriptions, invoices, daily ops, communications, settings, operations wall, founder dashboard |
| **Files involved** | `artifacts/cwp-platform/src/pages/admin/*.tsx`, `artifacts/cwp-platform/src/components/layout/AdminLayout.tsx`, `AdminSidebar.tsx`, routes in `App.tsx` |
| **Verification available** | `SPRINT1_IMPLEMENTATION_REPORT.md`. Screenshots: `docs/screenshots/sprint1-verification/03-dailyops-*.png`, `04-operations-wall.png`, `05-founder-role-gate.png` |

---

### Booking System

| Field | Detail |
|-------|--------|
| **Status** | Implemented — customer booking UI; API state machine (`pending → confirmed → scheduled → en_route → in_progress → completed`); staff transitions; admin booking management |
| **Files involved** | `artifacts/cwp-platform/src/pages/customer/BookService.tsx`, `artifacts/api-server/src/routes/bookings.ts`, `lib/db/src/schema/bookings.ts`, `booking-events.ts`, `artifacts/cwp-platform/src/pages/admin/Bookings.tsx`, `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx` |
| **Verification available** | Code paths documented in `CWP_ARCHITECTURE_AUDIT.md`. No dedicated Phase 2 implementation report or booking-specific HTTP verify script. `scripts/src/phase4-http-verify.ts` exercises subscription/booking automation indirectly |

---

### Asset Management

| Field | Detail |
|-------|--------|
| **Status** | Implemented — customer vehicle + solar site CRUD; admin customer detail management |
| **Files involved** | `artifacts/cwp-platform/src/pages/customer/MyAssets.tsx`, `artifacts/api-server/src/routes/vehicles.ts`, `solar-sites.ts`, `lib/db/src/schema/vehicles.ts`, `solar-sites.ts` |
| **Verification available** | `BookService.tsx` and `MyAssets.tsx` consume vehicle/solar APIs. No standalone T8 verification script |

---

### Wallet

| Field | Detail |
|-------|--------|
| **Status** | Implemented — ledger-first wallet; admin credit; customer dashboard + dedicated wallet page; low-balance metadata |
| **Files involved** | `artifacts/api-server/src/lib/wallet/service.ts`, `artifacts/api-server/src/routes/wallet.ts`, `lib/db/src/schema/wallet-transactions.ts`, `artifacts/cwp-platform/src/pages/customer/Wallet.tsx`, `Dashboard.tsx`, `lib/customer-wallet.ts`, `artifacts/cwp-platform/src/pages/admin/CustomerDetail.tsx` |
| **Verification available** | `PHASE3_IMPLEMENTATION_REPORT.md` (T13, T15). `scripts/src/phase3-verify.ts`, `scripts/src/phase3-http-verify.ts` |

---

### Ledger

| Field | Detail |
|-------|--------|
| **Status** | Implemented — append-only `wallet_transactions` table; `customers.walletBalance` as cache synced from ledger |
| **Files involved** | `lib/db/src/schema/wallet-transactions.ts`, `artifacts/api-server/src/lib/wallet/service.ts`, `artifacts/api-server/src/routes/wallet.ts`, `customers.ts` |
| **Verification available** | `PHASE3_IMPLEMENTATION_REPORT.md`. `scripts/src/phase3-verify.ts` reports ledger sum vs balance PASS |

---

### Invoices

| Field | Detail |
|-------|--------|
| **Status** | Implemented — GST-inclusive create/view/PDF; admin record payment; customer invoice list + PDF download |
| **Files involved** | `artifacts/api-server/src/routes/payments.ts`, `billing.ts`, `artifacts/cwp-platform/src/pages/customer/Invoices.tsx`, `artifacts/cwp-platform/src/pages/admin/Invoices.tsx`, `lib/db/src/schema/invoices.ts` |
| **Verification available** | `PHASE3_IMPLEMENTATION_REPORT.md` (T16). Manual UI checks listed in Phase 3 report |

---

### Notifications

| Field | Detail |
|-------|--------|
| **Status** | Implemented (backend + admin UI) — in-app notifications; SMS dispatcher (FAST2SMS primary, MSG91 fallback); triggers on booking confirm/complete; low-balance SMS in Phase 4 |
| **Files involved** | `artifacts/api-server/src/lib/notifications/dispatcher.ts`, `channels/sms.ts`, `artifacts/api-server/src/routes/notifications.ts`, `bookings.ts`, `subscriptions/dailyScheduler.ts`, `artifacts/cwp-platform/src/pages/admin/Notifications.tsx` |
| **Verification available** | `PHASE3_IMPLEMENTATION_REPORT.md` (T17, T18 partial). `PHASE4_IMPLEMENTATION_REPORT.md` (low-balance alerts). `POST /api/notifications/test-sms` exists. Live SMS delivery requires `FAST2SMS_API_KEY` in environment (documented in `.env.example`; not present in `render.yaml`) |

---

### Daily Cleaning

| Field | Detail |
|-------|--------|
| **Status** | Implemented — daily scheduler, auto-pause/resume, Wednesday off-day, admin daily ops dashboard, in-process midnight IST tick bootstrap |
| **Files involved** | `artifacts/api-server/src/subscriptions/dailyScheduler.ts`, `service.ts`, `artifacts/api-server/src/routes/subscriptions.ts`, `artifacts/api-server/src/index.ts`, `artifacts/cwp-platform/src/pages/admin/DailyOps.tsx`, `lib/db/src/schema/subscriptions.ts`, `vehicles.ts` |
| **Verification available** | `PHASE4_IMPLEMENTATION_REPORT.md` (T19–T22). `scripts/src/phase4-http-verify.ts` — ALL PASS output documented in report |

---

### Solar AMC

| Field | Detail |
|-------|--------|
| **Status** | Implemented — solar booking with panel pricing; customer Services page shows solar AMC cards (visits done/remaining, next visit); subscription APIs |
| **Files involved** | `artifacts/cwp-platform/src/pages/customer/Services.tsx`, `BookService.tsx`, `lib/solar-pricing.ts`, `artifacts/api-server/src/routes/subscriptions.ts`, `solar-sites.ts` |
| **Verification available** | `Services.tsx` implements `solar_amc` display. MVP plan T23 marked P1 in Phase 4 scope. No dedicated solar AMC HTTP verify script |

---

### Scheduling

| Field | Detail |
|-------|--------|
| **Status** | Implemented — daily auto-schedule + manual triggers; staff today/upcoming views; due-wash detection for packages/AMC |
| **Files involved** | `artifacts/api-server/src/subscriptions/dailyScheduler.ts`, `routes/subscriptions.ts`, `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`, `Schedule.tsx`, `DailyOps.tsx` |
| **Verification available** | `PHASE4_IMPLEMENTATION_REPORT.md`. `scripts/src/phase4-http-verify.ts` |

---

### PWA

| Field | Detail |
|-------|--------|
| **Status** | Implemented (installable PWA layer; not offline-first business logic) — see Section 4 |
| **Files involved** | `artifacts/cwp-platform/vite.config.ts`, `main.tsx`, `src/lib/pwa/*`, `src/components/pwa/PwaInstallBanner.tsx`, `public/manifest-*.json`, `public/pwa/*`, layout integrations |
| **Verification available** | `PWA_IMPLEMENTATION_REPORT.md` — production build PASS, desktop Chrome preview PASS; Android install flow NOT TESTED |

---

### UI/UX Sprints

| Sprint | Status | Files involved | Verification available |
|--------|--------|----------------|------------------------|
| **Sprint 1** | Complete | 11 files per `SPRINT1_IMPLEMENTATION_REPORT.md` — staff/customer/admin quick wins, `EmptyState`, `OperationsWall`, `FounderDashboard` | Report marked ✅ COMPLETE, TypeScript 0 errors. 11 screenshots in `docs/screenshots/sprint1-verification/` |
| **Sprint 2** | Complete | `Wallet.tsx`, `Services.tsx`, `Account.tsx`, `customer-wallet.ts`, `CustomerLayout.tsx`, `App.tsx` | `SPRINT2_IMPLEMENTATION_REPORT.md` — ✅ COMPLETE, TypeScript 0 errors |
| **Sprint 11** (Operations Wall) | Page exists (delivered early in Sprint 1) | `pages/admin/OperationsWall.tsx` | Screenshot `04-operations-wall.png` |
| **Sprint 12** (Founder Dashboard) | Page exists (delivered early in Sprint 1) | `pages/admin/FounderDashboard.tsx` | Screenshot `05-founder-role-gate.png` |
| **Sprints 3–10, M** | Not complete | See Section 3 | — |

---

## SECTION 2 — IN PROGRESS

### MVP Phase 2 (T8–T12) — Field Operations Core

| Field | Detail |
|-------|--------|
| **Percent complete** | ~85% (code present; no Phase 2 report or dedicated verify script) |
| **Files changed** | `BookService.tsx`, `MyAssets.tsx`, `staff/Dashboard.tsx`, `admin/CustomerDetail.tsx`, `bookings.ts`, `vehicles.ts`, `subscriptions.ts` |
| **What remains** | Formal Phase 2 completion report absent. `MVP_SMOKE_TEST.md` referenced in MVP plan does not exist. End-to-end booking → staff photos → customer history flow not captured in an automated verify script |

---

### Connectivity & Offline Queue Architecture

| Field | Detail |
|-------|--------|
| **Percent complete** | ~40% |
| **Files changed** | `CONNECTIVITY_ARCHITECTURE.md`, `services/connectivityService.ts`, `ConnectivityContext.tsx`, `offlineQueue.ts`, `queuedApi.ts`, `draftService.ts`, `useFormDraft.ts`, `ConnectivityBanner.tsx`, `SyncStatusIndicator.tsx`, `SystemStatus.tsx`; `App.tsx` uses `ConnectivityProvider` |
| **What remains** | `queuedFetch` wired only in `Expenses.tsx` and not in staff photo/booking flows. `useFormDraft` wired in `BookService.tsx` and `Expenses.tsx` only. `OfflineScreen.tsx` removed (per architecture doc). Staff offline queue listed as backlog in roadmap |

---

### Communication Center — Phase 3 Conversational CRM

| Field | Detail |
|-------|--------|
| **Percent complete** | ~70% backend; ~50% admin UI |
| **Files changed** | `artifacts/api-server/src/routes/communications-phase3.ts`, `communications-phase2.ts`, `communications.ts`, `lib/communications/*` (inbox, conversation, SLA, journey, CSAT services), `lib/db/migrations/003_comm_phase3_conversational_crm.sql`, `features/communications/components/ConversationInbox.tsx`, `CommunicationCenter.tsx`, `api.ts` |
| **What remains** | `ConversationInbox.tsx` exists but is **not** imported or tabbed in `CommunicationCenter.tsx` (tabs: Dashboard, Templates, Campaigns, Audience, DLT, Providers, History only). Phase 3 SQL migrations require DB apply. Redis/BullMQ optional per migration docs |

---

### Legal CMS & Platform Branding

| Field | Detail |
|-------|--------|
| **Percent complete** | ~90% code |
| **Files changed** | `artifacts/api-server/src/routes/legal.ts`, `branding.ts`, `lib/brandIdentityService.ts`, `lib/db/src/schema/legal-cms.ts`, `platform-branding.ts`, `migrations/003_platform_branding.sql`, `005_legal_cms.sql`, admin pages `LegalCMS.tsx`, `BrandIdentity.tsx`, `BusinessInfo.tsx`, `ComplianceSettings.tsx`, `SeoSettings.tsx`, public `pages/legal/*.tsx`, `LegalPageLayout.tsx` |
| **What remains** | Git status shows several of these as new/untracked. Public legal pages fetch `/api/legal/pages/:slug` — require DB seed/migration for published content. No dedicated legal/branding verification report |

---

### PWA (Sprint 10 overlap)

| Field | Detail |
|-------|--------|
| **Percent complete** | ~75% of combined PWA + Sprint 10 scope |
| **Files changed** | Full PWA stack per `PWA_IMPLEMENTATION_REPORT.md` |
| **What remains** | Sprint 10 items not done: `BeforeAfterSlider`, `AlertBanner`, admin dark mode toggle, standardized motion design system. Android/iOS install runtime verification pending |

---

### Production Deployment & Environment

| Field | Detail |
|-------|--------|
| **Percent complete** | ~80% config |
| **Files changed** | `render.yaml`, `.env.example`, `artifacts/api-server/src/index.ts`, `app.ts` |
| **What remains** | `PHASE1_VERIFICATION_REPORT.md` documents failed root `pnpm run build`/`typecheck` on Windows and partial DB seed failure on connected Neon. `render.yaml` includes `MSG91_*` but not `FAST2SMS_*` or `WALLET_LOW_BALANCE_DAYS` or `DAILY_CLEANING_OFF_DAYS`. No evidence in repo of successful Render production deploy |

---

## SECTION 3 — NOT STARTED

### UI Roadmap Sprints (per `CWP_UI_IMPLEMENTATION_ROADMAP.md`)

| Item | Roadmap scope | Current state |
|------|---------------|---------------|
| **Sprint 3** | Staff App Shell + bottom nav, job focus mode, `/staff/jobs`, `/staff/earnings`, `/staff/profile` | Staff still uses `StaffLayout` sidebar nav (`/staff/schedule`, `/staff/attendance`, `/staff/performance`). No `StaffAppShell.tsx`. Routes `/staff/jobs`, `/staff/earnings`, `/staff/profile` absent from `App.tsx` |
| **Sprint 4** | DailyOps monitoring upgrade: inline staff assign, admin alert banner, dashboard cleaning strip | Partial overlap: `CompletionRing` in DailyOps from Sprint 1 (QW-07). No `AlertBanner.tsx`. No inline staff popover on DailyOps. No daily-ops strip on admin Dashboard |
| **Sprint 5** | Customer booking step wizard | `BookService.tsx` remains single-page form |
| **Sprint 6** | Admin dashboard alerts + finance hub | Not started |
| **Sprint 7** | Admin side panel + bookings board (DnD) | Not started |
| **Sprint 8** | Command palette + domain tab dashboard | Not started |
| **Sprint 9** | Customer account hub + IA restructure | `/customer/account` is stub only; full hub not built |
| **Sprint 10** | PWA polish, before/after slider, motion system, dark mode | PWA core done separately; Sprint 10 deliverables mostly absent (see Section 2) |
| **Sprint M** | Legacy migration tools (`/admin/migration`) | No route or admin UI |

### MVP Tasks Not Started (per `CWP_MVP_IMPLEMENTATION_PLAN.md`)

| Task | Description | Evidence |
|------|-------------|----------|
| **T25** | Admin ops checklist + hide non-MVP nav | `AdminSidebar.tsx` still shows Leads, Franchisees, Churned Customers |
| **T26** | End-to-end pilot smoke test | No `MVP_SMOKE_TEST.md`. No `phase2-*` or `mvp-smoke*` verify script |

### Roadmap Backlog Items (explicitly deferred in roadmap)

- Customer 360 timeline (R-07)
- Post-registration onboarding wizard (R-09)
- Customer live booking tracking (map/ETA)
- Push notification integration (PWA push)
- Staff offline queue with background sync (beyond current partial offline queue)
- Franchisee portal parity with customer portal

### Out-of-Scope MVP Items (documented as NOT in MVP — not started by design)

Patna/multi-city, Razorpay, geofencing, coupons, franchisee portal as primary ops surface, WhatsApp beyond SMS infrastructure, CRM/leads for pilot ops

---

## SECTION 4 — PWA STATUS

| Check | Status |
|-------|--------|
| **vite-plugin-pwa installed?** | **Yes** — `vite-plugin-pwa@^1.3.0` in `artifacts/cwp-platform/package.json` |
| **Manifest created?** | **Yes** — primary `manifest.webmanifest` generated by VitePWA in `vite.config.ts`; static portal manifests: `public/manifest-customer.json`, `manifest-staff.json`, `manifest-admin.json`, `manifest-franchisee.json`; runtime swap via `usePortalManifest.ts`; additional dynamic manifests at `/api/branding/public/manifest/:portal` |
| **Icons generated?** | **Yes** — `public/pwa/icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`, `icon-source.svg`; regenerate via `pnpm --filter @workspace/cwp-platform run generate-pwa-icons` |
| **Service worker configured?** | **Yes** — Workbox `generateSW`, `registerType: "autoUpdate"`, registration in `main.tsx` via `virtual:pwa-register`; precache + navigation fallback to `offline.html`; dev SW enabled |
| **Install prompt implemented?** | **Yes** — `PwaInstallBanner.tsx` + `usePwaInstall.ts` in customer, staff, admin (mobile), franchisee (mobile), and landing layouts |
| **Build verified?** | **Yes (desktop)** — `PWA_IMPLEMENTATION_REPORT.md`: production build PASS (~38s), typecheck PASS, `vite preview` on localhost:4173 — SW active, manifest linked, icons 200. **Android install flow: NOT TESTED**. **`beforeinstallprompt` did not fire in automated desktop Chrome** (documented as browser-controlled) |

### Complete vs Pending (PWA)

| Complete | Pending |
|----------|---------|
| Plugin, manifests, icons, SW, offline.html, install banner UI, safe-area layout hooks, portal-specific manifests | Real-device Android "Add to Home Screen" verification |
| Production build generates `sw.js` + precache | iOS Safari Add to Home Screen verification |
| Desktop preview confirms SW registration | Sprint 10: `BeforeAfterSlider`, motion polish, dark mode |
| | Offline business logic (booking/wallet/billing) explicitly excluded per PWA report |

---

## SECTION 5 — MVP READINESS

### Before Varanasi Pilot

Based on `CWP_MVP_IMPLEMENTATION_PLAN.md` exit criteria and verification artifacts:

| Requirement | Current state |
|-------------|---------------|
| Production deploy with Postgres + HTTPS | `render.yaml` exists; no successful deploy verification in repo |
| Cloudinary configured for staff photos | Code complete (`cloudinaryStorage.ts`); env vars documented; production upload not verified in reports after Phase 1 partial failures |
| Pilot seed accounts (admin, customers, staff) | `scripts/src/seed.ts` idempotent Varanasi seed exists; Phase 1 verification reported partial seed failure on existing Neon DB |
| Daily cleaning automation | Phase 4 code + `phase4-http-verify.ts` PASS |
| SMS on book/complete/low balance | Dispatcher code complete; requires live `FAST2SMS_API_KEY` (not in `render.yaml`) |
| **T26 end-to-end smoke test** | **Not started** — checklist file absent |
| Admin operates daily ops without manual booking entry | Scheduler + Daily Ops UI exist; cron documented as optional (in-process IST tick in `index.ts`) |

---

### Before First Real Customer

| Requirement | Current state |
|-------------|---------------|
| Customer auth + scoped data (T4) | Done per Phase 1 |
| Register → add assets → book service (T8–T10) | UI + API code present; no Phase 2 verify script |
| Wallet view + transaction history (T15) | Done — Dashboard + `/customer/wallet` |
| Invoices visible + PDF (T16) | Done |
| Service history with photos (T24 partial) | Sprint 1: 80px photos + lightbox in History |
| SMS on booking events (T18) | Code done; live SMS env required |
| Low balance visibility | Dashboard banner when `isLowBalance` (Phase 4) |
| Legal/compliance pages | CMS code exists; requires published DB content |

---

### Before First Real Staff User

| Requirement | Current state |
|-------------|---------------|
| Staff login linked to staff record (T6) | Done per Phase 1 |
| Staff sees only assigned jobs (T5) | Done — `useAccountScope().staffId` |
| Job workflow: photos → complete (T11) | Done in `staff/Dashboard.tsx` — before/after upload + transitions |
| Cloudinary upload on production host (T3) | Code done; production verification incomplete per Phase 1 report |
| Mobile-friendly staff UX (Sprint 3) | **Not started** — sidebar `StaffLayout`, not bottom-nav app shell |
| PWA install on staff phone | PWA code complete; Android install not runtime-tested |

---

## SECTION 6 — TOP PRIORITIES

Ranked by business impact for Varanasi pilot. Priority labels from `CWP_MVP_IMPLEMENTATION_PLAN.md`.

| Priority | Item | Rationale (factual gap) |
|----------|------|-------------------------|
| **P0** | T26 — End-to-end pilot smoke test | Explicit P0 in MVP plan; no `MVP_SMOKE_TEST.md` or script; Phase 1 verification reported partial failures |
| **P0** | Production SMS configuration (`FAST2SMS_*`) | Notification triggers exist; `.env.example` documents keys; `render.yaml` omits FAST2SMS vars; live SMS not verified |
| **P0** | Production deploy verification (Render + Cloudinary + seed) | Phase 1 config exists; Phase 1 verification reported build/seed issues |
| **P1** | Sprint 3 — Staff App Shell + mobile job UX | Next approved UI sprint; staff portal still uses desktop sidebar layout |
| **P1** | T25 — Hide non-MVP admin nav | Leads, franchisees, churned still visible in `AdminSidebar.tsx`; MVP plan marks as P1 |
| **P1** | Legal CMS DB content publish | Public legal routes depend on `/api/legal/pages/:slug`; pages show "not available" without seed |
| **P2** | Sprint 4 — DailyOps monitoring polish | Core DailyOps functional from Phase 4 + Sprint 1; inline assign and admin alerts not built |
| **P2** | Communication Center inbox UI wiring | Backend + `ConversationInbox.tsx` exist; not exposed in admin Communication Center tabs |
| **P2** | Connectivity offline queue rollout | Infrastructure exists; only admin Expenses uses `queuedFetch` |
| **P2** | Sprint 5 booking wizard | Current booking form works; wizard is UX enhancement |
| **P2** | Sprint M legacy migration tools | Required before full customer rollout per roadmap; not before pilot per roadmap schedule |
| **P2** | Android/iOS PWA install verification | PWA build verified on desktop only |

---

## SECTION 7 — RECOMMENDED NEXT TASK

**Sprint 3 — Staff App Shell + Job Focus Mode** (`CWP_UI_IMPLEMENTATION_ROADMAP.md`)

Sprint 2 is marked complete. Staff field workflow code exists (`staff/Dashboard.tsx` job transitions and photo uploads), but the staff portal still uses `StaffLayout` with sidebar navigation and separate Schedule/Attendance/Performance pages — not the mobile bottom-nav shell defined for Sprint 3. This is the next item in the approved UI sprint sequence and directly affects the device experience for the first real staff user in Varanasi.

Single scope: create `StaffAppShell` with bottom nav, migrate `StaffDashboard` first, add `/staff/jobs` (unified today/upcoming/done), then `/staff/earnings` and `/staff/profile`.

---

*Generated from repository state on 13 June 2026. No code changes were made.*
