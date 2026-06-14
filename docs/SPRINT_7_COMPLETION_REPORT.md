# Sprint 7 Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Sprint:** 7 — Service Execution Engine + Service Updates  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`SPRINT_7_PLANNING.md`](./SPRINT_7_PLANNING.md), Sprint 6 approval gate  

**Status:** Complete — awaiting Sprint 7 review gate (do not start Sprint 8)

---

## 1. Objective

Introduce the **execution domain** on top of the approved assignment architecture. Assignment remains frozen (`pending` → `assigned`). Execution handles field work (`scheduled` → `started` → `completed` | `missed` | `cancelled` | `rescheduled`).

```text
Contract → Pending Assignment → Assignment → Execution
```

Service Updates (`/admin/service-updates`) is a **read-only aggregate** — not source of truth.

---

## 2. Database Changes

### Migration

| File | Purpose |
|------|---------|
| `lib/db/migrations/034_sprint7_service_executions.sql` | Execution domain + evidence tables |

Registered in `scripts/src/run-pending-migrations.ts` after `033`.

### New tables

#### `service_executions`

Core execution entity. References `service_assignments.id` (required for new flow; nullable only for future legacy bridge columns `legacy_booking_id`, `legacy_dcms_visit_id`).

| Column | Notes |
|--------|-------|
| `service_assignment_id` | FK → assignment (Founder Rule #2) |
| `contract_id`, `customer_id`, `service_location_id`, `asset_id` | Denormalized context |
| `assigned_staff_id` | Staff at execution time |
| `scheduled_date`, `scheduled_time` | Operational schedule |
| `status` | Frozen enum: scheduled, started, completed, missed, cancelled, rescheduled |
| `started_at`, `completed_at` | Execution timestamps |
| `rescheduled_from_id` | Self-FK for reschedule chain (Founder Rule #4) |
| Tenant + audit cols | company, franchisee, branch, created/updated |

#### Evidence tables (Founder Rule #5)

| Table | Purpose |
|-------|---------|
| `service_execution_photos` | before / after / proof / other URLs |
| `service_execution_notes` | technician / customer / internal |
| `service_execution_checklist_items` | Checklist completion |
| `service_execution_location_logs` | check_in / check_out / gps_ping |

**Not modified:** `service_assignments` — no execution columns added (Founder Rule #1).

### Drizzle schema

`lib/db/src/schema/service-executions.ts` — exported from `lib/db/src/schema/index.ts`.

---

## 3. Execution Schema & State Machine

| Transition | Rule |
|------------|------|
| scheduled → started | `POST …/start` |
| started → completed | `POST …/complete` (+ optional photos/notes/checklist/GPS) |
| scheduled/started → missed | `POST …/miss` |
| scheduled/started → cancelled | `POST …/cancel` |
| scheduled/started → rescheduled | Old row `rescheduled`; **new** row `scheduled` with `rescheduled_from_id` |

Terminal states: completed, missed, cancelled, rescheduled — no further mutation.

---

## 4. API Implementation

### Execution router — `artifacts/api-server/src/routes/service-executions.ts`

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/service-executions/today` | Staff/admin today's work |
| `GET` | `/api/service-executions/:id` | Detail + evidence |
| `POST` | `/api/service-executions/:id/start` | Start (+ optional GPS check-in) |
| `POST` | `/api/service-executions/:id/complete` | Complete (+ photos/notes/checklist/GPS) |
| `POST` | `/api/service-executions/:id/miss` | Mark missed |
| `POST` | `/api/service-executions/:id/cancel` | Cancel |
| `POST` | `/api/service-executions/:id/reschedule` | Reschedule (new row) |

Guard: `bookings` resource. Feature flag: `ENABLE_SERVICE_EXECUTIONS` (default on).

### Service layer — `artifacts/api-server/src/lib/executions/executionService.ts`

- `createScheduledExecutionForAssignment()` — called from assignment flow (not from assignment table mutation)
- `listTodayWork`, `getExecutionDetail`
- State transition functions
- `getServiceUpdatesSummary()` — read model counts
- `listExecutionsForTimeline()` — timeline feed

### Operations timeline — extended

`GET /api/operations/timeline` now includes:
- `execution` channel items (canonical domain)
- `summary` block: pending, assigned, scheduled, started, completed, missed, cancelled
- Legacy booking/DCMS/due-wash items retained for bridge visibility

---

## 5. Enqueue Adapter Implementation (Phase B)

Canonical module: `artifacts/api-server/src/lib/assignments/enqueueAdapters.ts`

| Source | Trigger | Function |
|--------|---------|----------|
| Book Services | Contract billing (Sprint 4C) | `enqueuePendingFromContract` |
| Daily Cleaning | `createSubscription` | `enqueuePendingFromDcmsSubscription` |
| Wash / Solar subscriptions | `POST /subscriptions` | `enqueuePendingFromSubscription` |
| Package entitlements | `grantEntitlement` / `grantEntitlementWithBalance` | `enqueuePendingFromEntitlement` |
| Legacy bookings | `POST /bookings` | `bridgeLegacyBookingToContractAndQueue` |

All paths write to `pending_service_assignments` only — no parallel queues.

On manual assign (`assignmentService.assignPendingService`), a **scheduled execution** is spawned for today via `createScheduledExecutionForAssignment`.

---

## 6. Service Updates Implementation (Phase C)

| Route | Component | Role |
|-------|-----------|------|
| `/admin/service-updates` | `OperationsWall.tsx` | Read-only dashboard |
| `/admin/operations-wall` | Redirect → service-updates | Backward compat |

**UI additions:**
- Domain summary strip: Pending, Assigned, Scheduled, Started, Completed, Missed, Cancelled
- Execution channel in unified timeline
- Link to Assign Services for pending/assigned
- Explicit "read-only ops view" subtitle

Nav: Operations → Service Updates (existing `adminNavConfig.ts`).

---

## 7. Staff Workflow (Phase D — APIs only, Sprint 7A)

Staff execution APIs are live. Staff **mobile UI integration** can follow in Sprint 7B without architecture changes.

Staff actions mutate `service_executions` only — never `service_assignments`.

`GET /service-executions/today` filters by `req.scope.staffId` when caller is staff role.

---

## 8. Legacy Bridge & Deprecation (Founder Rule #7)

**Kept alive (LEGACY):**
- `POST /api/bookings/:id/assign`
- `GET/POST /api/daily-cleaning/assignments`
- `/admin/daily-cleaning/assignments` (banner + nav label)

**Bridge:**
- Legacy bookings enqueue via contract registry + pending queue
- Timeline still shows legacy booking/DCMS rows alongside execution domain
- `legacy_booking_id` / `legacy_dcms_visit_id` columns reserved on `service_executions` for future dual-write

**Not removed** — sunset after ops validates migration.

---

## 9. Backward Compatibility

| Area | Impact |
|------|--------|
| Sprint 6 assignment APIs/UI | Unchanged |
| `service_assignments` schema | Unchanged |
| Customer 360 | Unchanged |
| DCMS visit completion APIs | Unchanged (legacy path) |
| Bookings start/complete | Unchanged (legacy path) |
| Operations timeline | Extended, not breaking |

---

## 10. Rollback Strategy

1. Set `ENABLE_SERVICE_EXECUTIONS=false` — disables execution APIs (503)
2. Assignment + pending queue continue to work
3. DB rollback (pre-production):
   - Drop evidence tables, then `service_executions`, then enum types
4. Remove migration `034` from runner if reverting codebase
5. Enqueue adapters are additive — safe to leave pending rows

---

## 11. Acceptance Criteria Checklist

| Criterion | Status |
|-----------|--------|
| `service_executions` exists | ✅ |
| `service_assignments` unchanged | ✅ |
| Execution references assignment | ✅ |
| Reschedule creates new execution row | ✅ |
| Photos stored separately | ✅ |
| Notes stored separately | ✅ |
| GPS stored separately | ✅ |
| Service Updates dashboard works | ✅ |
| Staff can Start work (API) | ✅ |
| Staff can Complete work (API) | ✅ |
| Staff can Miss work (API) | ✅ |
| Staff can Cancel work (API) | ✅ |
| Legacy assignment APIs remain | ✅ |
| All major product lines enqueue to pending queue | ✅ |
| No parallel assignment systems | ✅ |

---

## 12. Architecture Conflicts Discovered

| Conflict | Detail | Mitigation |
|----------|--------|------------|
| Dual execution paths | Legacy `bookings` / `dcms_visits` still complete outside execution domain | Timeline shows both; Sprint 7B staff app should prefer execution APIs |
| Recurring DCMS | One assignment may need many scheduled executions over time | Current: one execution spawned on assign; cron for recurring visits is follow-up |
| Bookings without asset | Legacy bridge skips enqueue if no vehicle/solar/asset id | Book Services path remains canonical |
| Staff app UI | Not in Sprint 7 scope | APIs ready for Sprint 7B |

---

## 13. Files Added / Modified

### Added

- `lib/db/migrations/034_sprint7_service_executions.sql`
- `lib/db/src/schema/service-executions.ts`
- `artifacts/api-server/src/lib/executions/executionService.ts`
- `artifacts/api-server/src/lib/executions/featureFlag.ts`
- `artifacts/api-server/src/lib/assignments/enqueueAdapters.ts`
- `artifacts/api-server/src/routes/service-executions.ts`
- `docs/SPRINT_7_COMPLETION_REPORT.md`

### Modified

- `lib/db/src/schema/index.ts`
- `scripts/src/run-pending-migrations.ts`
- `artifacts/api-server/src/lib/assignments/assignmentService.ts` — spawn scheduled execution on assign
- `artifacts/api-server/src/lib/assignments/pendingAssignmentEnqueue.ts` — adapter status live
- `artifacts/api-server/src/lib/dcms/subscriptionService.ts` — DCMS enqueue
- `artifacts/api-server/src/lib/catalog/entitlementEngine.ts` — entitlement enqueue
- `artifacts/api-server/src/routes/subscriptions.ts` — subscription enqueue
- `artifacts/api-server/src/routes/bookings.ts` — legacy booking bridge
- `artifacts/api-server/src/routes/index.ts` — execution router
- `artifacts/api-server/src/routes/operations.ts` — summary in timeline response
- `artifacts/api-server/src/lib/operations/operationsTimeline.ts` — execution channel
- `artifacts/cwp-platform/src/pages/admin/OperationsWall.tsx` — Service Updates UI

---

## 14. Test Plan (Manual)

1. Run migration `034`
2. Create DCMS subscription → verify pending queue row
3. Create wash/solar subscription → verify pending row
4. Grant entitlement → verify pending row
5. Create legacy booking → verify contract + pending row
6. Assign via `/admin/assign-services` → verify `service_assignments` + scheduled execution
7. `POST …/start` → `POST …/complete` with photos → verify evidence tables
8. `POST …/reschedule` → verify old=rescheduled, new=scheduled, linked FK
9. Open `/admin/service-updates` → verify summary counts + timeline
10. Confirm legacy DCMS assignments page still works with LEGACY banner

---

## 15. Next Gate

**Sprint 8 — Billing Consolidation** is **not** authorized. Await Sprint 7 review.

**Optional Sprint 7B:** Staff app UI wired to execution APIs only.
