# CWP DETAILERS — MASTER REMEDIATION TRACKER
**Single Source of Truth for Engineering Audit Remediations**

**Repository:** `tusharsaraswat1988/Cwpdetailers`  
**Baseline Commit:** `6377bbe16568aac15495bbbad205bb55db66878c`  
**Current HEAD:** `a0bf3dea7dea24fa53d58d18077b1817c6eecd06`  
**Last Updated:** 2026-11-26  
**Status Lifecycle:** `OPEN` -> `IN_PROGRESS` -> `FIXED` -> `VERIFIED` -> `DEFERRED` -> `OBSOLETE`

---

## 1. MASTER REMEDIATION SUMMARY

| Priority Level | Total Identified | Verified Fixed | In Progress | Open | Blocked / Deferred |
|---|---|---|---|---|---|
| **Priority 0 (Critical Security & Data Integrity)** | 9 | 9 | 0 | 0 | 0 |
| **Priority 1 (Operational Reliability & Access Control)** | 12 | 0 | 0 | 12 | 0 |
| **Priority 2 (Performance, Data Quality & Core UX)** | 14 | 0 | 0 | 14 | 0 |
| **Priority 3 (Long-Term Architecture & Polish)** | 5 | 0 | 0 | 5 | 0 |
| **TOTALS** | **40** | **9** | **0** | **31** | **0** |

*Note: 4 P0 security findings (Hotfix A+B: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`) were implemented, independently verified with test suites, and committed in HEAD `a0bf3de`.*

---

## 2. MASTER FINDINGS REGISTER & STATUS TRACKER

### Priority 0 — Critical Security & Data Integrity

| ID | Domain | Description | Affected Files | Status | Target Fix | Verification Requirement | Evidence / Notes |
|---|---|---|---|---|---|---|---|
| `SEC-001` | Security | Unprotected location pricing mutations | `routes/location-pricing.ts` | **VERIFIED** | Added `requireAuth` + `requireRole` (`admin`, `superadmin`, `city_admin`) + Zod | Unit test in `hotfix-a-b-remediation.test.ts` | Committed in `a0bf3de` |
| `SEC-002` | Security | Unprotected operational zone mutations | `routes/zones.ts` | **VERIFIED** | Added `requireAuth` + `requireRole` + Zod schemas | Unit test in `hotfix-a-b-remediation.test.ts` | Committed in `a0bf3de` |
| `SEC-003` | Security | Unprotected residential society mutations | `routes/societies.ts` | **VERIFIED** | Added `requireAuth` + `requireRole` + city scoping | Unit test in `hotfix-a-b-remediation.test.ts` | Committed in `a0bf3de` |
| `SEC-004` | Security | Unprotected payment webhook mock endpoint | `routes/payment-gateway.ts` | **VERIFIED** | Blocked mock route in production (`NODE_ENV === "production"`) | Unit test in `hotfix-a-b-remediation.test.ts` | Committed in `a0bf3de` |
| `SEC-P0-01` | Security | Address IDOR & authorization bypass | `artifacts/api-server/src/routes/addresses.ts`, `routes/index.ts`, `middlewares/auth.ts` | **VERIFIED** | Router-level `requireAuth`, path prefix routing, tenant scoping via `loadIfInScope`, customer ownership check | 14/14 unit tests passing in `address-idor-remediation.test.ts` (162/162 total security tests pass) | Remediated & verified in active remediation |
| `SEC-P0-02` | Security | Unauthenticated operational calendar mutations | `artifacts/api-server/src/routes/operational-calendar.ts` | **VERIFIED** | Router-level `requireAuth` + `requireCalendarRole` + strict tenant scoping (`assertCalendarScope`) on hours & closures | 14/14 unit tests passing in `operational-calendar-remediation.test.ts` (176/176 total security tests pass) | Remediated & verified in active remediation |
| `ARCH-P0-03` | Data Integrity | Booking slot double-booking concurrency race condition | `lib/db/src/schema/bookings.ts`, `BookingService.ts`, `BookingRepository.ts`, `DuplicateBookingGuard.ts`, `scheduling/index.ts`, `routes/bookings.ts` | **VERIFIED** | Partial unique indexes for active bookings, transactional advisory locking (`pg_advisory_xact_lock`), HTTP 409 conflict mapping | Concurrency test suite `booking-concurrency-double-booking.test.ts` (5/5 tests pass: 20 concurrent requests serialized, 1 created, 19 rejected with 409) | Remediated & verified in active remediation |
| `ARCH-P0-01` | Distributed Reliability | In-process scheduler duplicate execution hazard | `artifacts/api-server/src/index.ts`, `lib/scheduler/jobRegistry.ts` | **VERIFIED** | Purged uncoordinated naked in-process `setTimeout` loops; unified all Tier 1 cron/schedulers (`subscription_daily_tick`, `dcms_missed_visit_eod`, `morning_route_notify_daily`, `gps_retention_purge_6h`) into `backgroundWorker` using PostgreSQL `FOR UPDATE SKIP LOCKED` and distributed lease locking | Multi-instance simulation test `scheduler-unification.test.ts` (3/3 passing tests verifying atomic claim, 0 duplicate execution, dry-run safety; full suite 74 files 809 tests pass) | Remediated & verified in active remediation |
| `ARCH-P0-02` | Reliability | Database connection pool starvation & defective healthz | `lib/db/src/index.ts`, `routes/health.ts` | **VERIFIED** | Explicit pool config (`max: 30`, `idleTimeout: 30s`, `connectionTimeout: 5s`, `statement_timeout: 10s`); active `SELECT 1` ping in `/api/healthz` with 2000ms timeout boundary returning 503 on pool starvation / failure | Unit test suite `healthz-pool.test.ts` (4/4 passing tests verifying 200 on success, 503 on pool error, 503 on starvation timeout, ?shallow=true bypass) | Remediated & verified in active remediation |

---

### Priority 1 — Operational Reliability & Access Control

| ID | Domain | Description | Affected Files | Status | Target Fix | Verification Requirement | Evidence / Notes |
|---|---|---|---|---|---|---|---|
| `SEC-P1-01` | Access Control | Commercial billing role lockout for `branch_manager` | `routes/commercial-billing.ts:34` | **OPEN** | Add `branch_manager` and `city_admin` to authorized roles | Unit test: `branch_manager` can view branch billing | Discovered in Phase 6 |
| `SEC-P1-02` | Security | Cashfree test fixture mock lookup in production | `routes/payment-gateway.ts:68` | **OPEN** | Restrict `rec_idem` fixture bypass strictly to `development` / `test` | Unit test: Production rejects mock lookup | Discovered in Phase 6 |
| `SEC-P1-03` | Tenant Isolation | Franchisee analytics tenant data leak | `routes/franchisees.ts:122` | **OPEN** | Enforce `franchiseeId` filter on retention & customer analytics | Unit test: Franchisee A cannot see Franchisee B data | Discovered in Phase 6 |
| `SEC-P1-04` | Operations | Staff attendance punch-out impossible due to status check | `routes/attendance.ts:85` | **OPEN** | Fix status transition check to allow punch-out from `"present"` or `"half_day"` | Integration test: Staff can punch in and punch out | Discovered in Phase 6 |
| `ARCH-P1-02` | Offline Sync | Offline queue infinite retry loop on 4xx validation errors | `artifacts/cwp-platform/src/services/offlineQueue.ts:75, 125` | **OPEN** | Quarantine 4xx client errors into Dead Letter Queue (DLQ) after 3 retries | Unit test: 400 error moves item to DLQ | Discovered in Phase 5 / Phase 7 |
| `ARCH-P1-03` | Session Security | React Query cache not cleared on logout | `artifacts/cwp-platform/src/lib/auth.tsx:120`, `App.tsx:15` | **OPEN** | Invoke `queryClient.clear()` in `logout()` handler | Unit test: Query cache emptied upon logout | Discovered in Phase 7 |
| `ARCH-P1-04` | Reliability | Dynamic `process.env` mutation in Fast2SMS service | `artifacts/api-server/src/lib/communications/fastSmsService.ts:32-34` | **OPEN** | Pass API credentials directly to adapter instance, avoiding `process.env` | Unit test: Concurrent SMS calls use isolated config | Discovered in Phase 7 |
| `UX-P0-05` | Mobile Shell | Android hardware back button terminates Capacitor app | `artifacts/cwp-platform/src/App.tsx`, `main.tsx` | **OPEN** | Register `@capacitor/app` `backButton` listener to pop Wouter history | Mobile test: Hardware back button navigates back | Discovered in Phase 8 |
| `UX-P0-03` | Customer UX | 15-Minute booking slot affordance failure & hidden GST | `BookService.tsx`, `ScheduleServiceStep.tsx` | **OPEN** | Visual hatch styling for unavailable slots; upfront GST breakdown | Visual & snapshot test | Discovered in Phase 8 |
| `UX-P0-04` | Staff UX | Outdoor sunlight readability failure on staff cleaning screens | `StaffDailyRouteSimplified.tsx` | **OPEN** | Replace pale amber/blue badges with high-contrast variants | Contrast ratio >= 4.5:1 test | Discovered in Phase 8 |
| `UX-P1-01` | Admin UX | Administrative dashboard 29-card action overload | `AdminDashboard.tsx` | **OPEN** | Restructure into 3 prioritized tabs ("Exceptions", "Operations", "Analytics") | Component rendering test | Discovered in Phase 8 |
| `UX-P1-04` | Accessibility | 14 icon-only action buttons missing accessible names | 14 files across `artifacts/cwp-platform/src` | **OPEN** | Add `aria-label` to all icon buttons | Accessibility scan: 0 missing accessible names | Discovered in Phase 8 |

---

### Priority 2 — Performance, Data Quality & Core UX

| ID | Domain | Description | Affected Files | Status | Target Fix | Verification Requirement | Evidence / Notes |
|---|---|---|---|---|---|---|---|
| `ARCH-P1-01` | Performance | Monolithic 3.55 MB uncompressed frontend bundle | `artifacts/cwp-platform/src/App.tsx:28-85` | **OPEN** | Lazy-load 50+ admin pages via `React.lazy()`; shrink root bundle < 500 KB | Build verification: `index-*.js` < 500 KB | Discovered in Phase 7 |
| `ARCH-P2-01` | Data Quality | Hardcoded single-city `"Varanasi"` fallbacks in ledger/auth | `reconciliationService.ts:176`, `routes/auth.ts:882, 966` | **OPEN** | Replace `"Varanasi"` / `cityId: 1` fallbacks with required tenant scope lookups | Unit test: Noida customers not defaulted to Varanasi | Discovered in Phase 7 |
| `ARCH-P2-02` | Database | Missing indexes on `attendance`, `payment_attempts`, `wallet` | `schema/attendance.ts`, `schema/payment-attempts.ts` | **OPEN** | Add indexes on `(staff_id, attendance_date)` and `(order_id)` | Drizzle schema verification test | Discovered in Phase 7 |
| `ARCH-P2-03` | DevOps | Unversioned `push-force` in `render.yaml:33` | `render.yaml` | **OPEN** | Replace `push-force` with versioned `db:deploy-auto` migration script | Render deploy configuration check | Discovered in Phase 7 |
| `UX-P0-01` | Design System | 1,746 `lucide-react` icons across 304 files | 304 files across `artifacts/cwp-platform/src` | **OPEN** | Migrate to Google Material Symbols (`@/components/ui/material-symbol.tsx`) | AST scan: 0 lucide imports in migrated modules | Discovered in Phase 8 |
| `UX-P0-02` | Design System | 1,676 arbitrary Tailwind colors & 199 raw hex colors | 164 files across `artifacts/cwp-platform/src` | **OPEN** | Replace with semantic tokens (`CUSTOMER_COLORS`, `STAFF_COLORS`, `ADMIN_DS`) | Regex check: 0 raw hex in core components | Discovered in Phase 8 |
| `UX-P1-02` | Mobile | 3.55 MB bundle cold-start freeze on staff Android phones | Capacitor APK assets | **OPEN** | Isolate Staff PWA bundle from heavy admin dashboards | Cold start time < 1.5s on test device | Discovered in Phase 8 |
| `UX-P1-03` | Localization | Zero Hindi localization in Customer portal | Customer Portal (`/customer/*`) | **OPEN** | Implement bilingual Hindi/English customer dictionary | Language toggle test | Discovered in Phase 8 |
| `UX-P1-05` | Customer UX | Missing city serviceability pre-check on registration | `Register.tsx`, `Login.tsx` | **OPEN** | Prompt for city & society prior to OTP submission | Registration flow test | Discovered in Phase 8 |
| `UX-P1-06` | Customer UX | Promotional banner noise competing with car wash status | `CustomerDashboard.tsx` | **OPEN** | De-emphasize promotions below active daily service status card | Visual layout test | Discovered in Phase 8 |
| `UX-P1-07` | Localization | Devanagari Hindi text matra clipping in fixed-height buttons | `StaffDailyRouteSimplified.tsx` | **OPEN** | Use flexible button heights (`min-h-[44px] h-auto py-2.5`) | Visual rendering test on Devanagari labels | Discovered in Phase 8 |
| `UX-P2-01` | Forms | Submission-gated form validation triggering error cascade | Form components (24 forms) | **OPEN** | Implement inline validation on blur via `react-hook-form` | Form interaction test | Discovered in Phase 8 |
| `UX-P2-02` | UI Controls | Missing search filter on 50+ item society dropdowns | `AssignServicesPage.tsx` | **OPEN** | Replace native select with searchable combobox (`Command` primitive) | Combobox search test | Discovered in Phase 8 |
| `UX-P2-03` | Data Tables | Missing sticky headers on high-volume administrative tables | 16 administrative data tables | **OPEN** | Enforce `sticky top-0 bg-background z-10` on all table headers | CSS visual test | Discovered in Phase 8 |

---

### Priority 3 — Long-Term Architecture & Refinement

| ID | Domain | Description | Affected Files | Status | Target Fix | Verification Requirement | Evidence / Notes |
|---|---|---|---|---|---|---|---|
| `ARCH-P3-01` | Architecture | Synchronous Cloudinary upload path | `lib/cloudinaryStorage.ts:50` | **OPEN** | Direct client-to-S3 presigned upload with client-side WebP compression | Upload latency & cost benchmark | Discovered in Phase 7 |
| `UX-P3-01` | UI Polish | Decorative glow shadows adding visual noise | Admin card components | **OPEN** | Replace colored glow with standard elevation tokens (`--shadow-sm`) | Visual polish check | Discovered in Phase 8 |
| `ARCH-P3-02` | Architecture | Monthly table partitioning on `dcms_visits` | `lib/db/src/schema/dcms.ts` | **OPEN** | Partition by month (`PARTITION BY RANGE (visit_date)`) | DB migration test | Discovered in Phase 7 |
| `ARCH-P3-03` | Architecture | Redis caching for catalog, societies & pricing rules | `api-server` | **OPEN** | Deploy Redis cache with invalidation hooks on admin updates | Cache hit ratio test | Discovered in Phase 7 |
| `ARCH-P3-04` | Architecture | PostgreSQL read-replicas for commercial reporting | `lib/db/src/index.ts` | **OPEN** | Route analytics and reporting queries to read replicas | Read query routing test | Discovered in Phase 7 |

---

## 3. DEPENDENCY & EXECUTION ORDER

```mermaid
graph TD
    subgraph P0_Security["P0: Security & Integrity (IMMEDIATE)"]
        P0_1["1. Fix SEC-P0-01<br/>(Address Ownership IDOR & Inverted Logic)"]
        P0_2["2. Fix SEC-P0-02<br/>(Operational Calendar Auth & Role Guard)"]
        P0_3["3. Fix ARCH-P0-03<br/>(Booking Double-Booking Concurrency Lock)"]
        P0_4["4. Fix ARCH-P0-02<br/>(pg.Pool Sizing, Timeouts & DB Ping in /healthz)"]
        P0_5["5. Fix ARCH-P0-01<br/>(Unify Tier 1 Schedulers into DB-Leased Worker)"]
    end

    subgraph P1_Reliability["P1: Operational Reliability"]
        P1_1["6. Fix SEC-P1-01 (Role Lockout: branch_manager in billing)"]
        P1_2["7. Fix SEC-P1-04 (Staff Attendance Punch-out Logic)"]
        P1_3["8. Fix SEC-P1-03 (Franchisee Analytics Tenant Isolation)"]
        P1_4["9. Fix ARCH-P1-02 (Offline Queue Dead Letter Queue)"]
        P1_5["10. Fix ARCH-P1-03 (React Query Cache Clear on Logout)"]
        P1_6["11. Fix UX-P0-05 (Android Hardware Back-Button Hook)"]
    end

    subgraph P2_Performance["P2: Performance & Design System Modernization"]
        P2_1["12. Fix ARCH-P1-01 (Frontend Code Splitting < 500 KB)"]
        P2_2["13. Fix ARCH-P2-01 (Purge Hardcoded Varanasi Fallbacks)"]
        P2_3["14. Fix UX-P0-01 (Material Symbols Migration)"]
        P2_4["15. Fix UX-P0-02 (Semantic Color Token Enforcement)"]
    end

    P0_1 --> P0_2 --> P0_3 --> P0_4 --> P0_5
    P0_5 --> P1_1 --> P1_2 --> P1_3 --> P1_4 --> P1_5 --> P1_6
    P1_6 --> P2_1 --> P2_2 --> P2_3 --> P2_4
```

---

## 4. COMPLETED REMEDIATION LOG

| Entry # | Date | Finding ID(s) | Files Changed | Summary of Change | Test Evidence | Commit Hash |
|---|---|---|---|---|---|---|
| **001** | 2026-11-20 | `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004` | `location-pricing.ts`, `zones.ts`, `societies.ts`, `payment-gateway.ts` | Hotfix A+B: Added RBAC guards, city scoping, production webhook protection | `hotfix-a-b-remediation.test.ts` (14 passing tests) | `a0bf3de` |
| **002** | 2026-11-20 | `SEC-031`, `SEC-032`, `SEC-033` | `reset-production-db.ts`, `inspect-prod-db.ts` | Production DB safety: blocked destructive resets in production | `purge-script-safety.test.ts` (8 passing tests) | `a0bf3de` |
| **003** | 2026-11-26 | `SEC-P0-01` | `routes/addresses.ts`, `routes/index.ts`, `middlewares/auth.ts` | Address ownership IDOR fix: mounted requireAuth, corrected customer ownership check & tenant scoping | `address-idor-remediation.test.ts` (14/14 passing) | Working tree |
| **004** | 2026-11-26 | `SEC-P0-02` | `routes/operational-calendar.ts` | Operational calendar auth: added requireAuth + requireCalendarRole + assertCalendarScope | `operational-calendar-remediation.test.ts` (14/14 passing) | Working tree |
| **005** | 2026-11-26 | `ARCH-P0-03` | `lib/db/src/schema/bookings.ts`, `BookingService.ts`, `BookingRepository.ts`, `DuplicateBookingGuard.ts`, `scheduling/index.ts`, `routes/bookings.ts` | Concurrency & double-booking elimination: partial unique indexes on active bookings, pg_advisory_xact_lock transaction serialization, HTTP 409 conflict responses | `booking-concurrency-double-booking.test.ts` (5/5 passing, full suite 72/72 files 802/802 passing) | Working tree |
| **006** | 2026-11-26 | `ARCH-P0-02` | `lib/db/src/index.ts`, `routes/health.ts` | Database connection pool hardening & active /healthz ping: configured max: 30, idle: 30s, connectionTimeout: 5s, statement_timeout: 10s; added active SELECT 1 database ping in /healthz with 2s timeout returning 503 on pool starvation / disconnection | `healthz-pool.test.ts` (4/4 passing), `ssl-https-hardening.test.ts` (10/10 passing) | Working tree |
| **007** | 2026-11-26 | `ARCH-P0-01` | `artifacts/api-server/src/index.ts` | Scheduler unification: removed competing naked setTimeout/setInterval loops; unified Tier 1 operational workloads into backgroundWorker with PostgreSQL FOR UPDATE SKIP LOCKED distributed leases | `scheduler-unification.test.ts` (3/3 passing, full suite 74/74 files 809/809 passing) | Working tree |

---

## 5. ACTIVE REMEDIATION TASK QUEUE

1. **Current Active Task:** `SEC-P0-01` — Address Ownership IDOR & Inverted Logic in `artifacts/api-server/src/routes/addresses.ts`
2. **Next Task:** `SEC-P0-02` — Operational Calendar Auth & Role Guard in `artifacts/api-server/src/routes/operational-calendar.ts`
3. **Subsequent Task:** `ARCH-P0-03` — Booking Double-Booking Concurrency Lock in `lib/db/src/schema/bookings.ts` & `routes/bookings.ts`
