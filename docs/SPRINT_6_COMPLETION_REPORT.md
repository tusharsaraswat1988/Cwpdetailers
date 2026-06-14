# Sprint 6 Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Sprint:** 6 — Assign Services  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 6, [`DATA_RELATIONSHIP_V1.md`](./DATA_RELATIONSHIP_V1.md), Sprint 5 approval gate  

**Status:** Approved with conditions (15 June 2026) — see [`SPRINT_7_PLANNING.md`](./SPRINT_7_PLANNING.md)

---

## 1. Objective

Create a unified manual assignment system that consumes `pending_service_assignments` (Sprint 4C) and produces first-class `service_assignments` records. Lifecycle stops at **Assigned** — no execution states, routes, GPS, or staff-app workflow changes.

```text
Pending Assignment → Manual Assign → Assigned
```

---

## 2. Database Changes

### Migration

| File | Purpose |
|------|---------|
| `lib/db/migrations/033_sprint6_service_assignments.sql` | Creates `service_assignments` table and indexes |

Registered in `scripts/src/run-pending-migrations.ts` after `032_sprint4c_billing_integration.sql`.

### New table: `service_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Assignment ID |
| `pending_assignment_id` | integer FK → `pending_service_assignments` | Unique — one assignment per pending row |
| `customer_id` | integer | Denormalized for tenant scope / audit |
| `service_location_id` | integer | Location-first anchor (required on assign) |
| `asset_id` | integer | Optional asset context |
| `contract_id` | integer FK → `customer_contracts` | Contract registry link |
| `service_id` | integer | Optional catalog service id |
| `assigned_staff_id` | integer | Staff assigned manually |
| `assigned_at` | timestamp | When assignment occurred |
| `status` | enum | `pending` \| `assigned` only |
| `service_label` | text | Snapshot at assign time |
| `product_line` | text | Snapshot for filtering |
| Tenant cols | integer | `company_id`, `franchisee_id`, `branch_id` |
| Timestamps | timestamp | `created_at`, `updated_at` |

**Indexes:** unique on `pending_assignment_id`; indexes on `status`, `assigned_staff_id`, `service_location_id`, `contract_id`.

### Drizzle schema

| File | Export |
|------|--------|
| `lib/db/src/schema/service-assignments.ts` | `serviceAssignmentsTable`, `serviceAssignmentStatusEnum` |
| `lib/db/src/schema/index.ts` | Re-export added |

### Unchanged tables (consumed, not duplicated)

- `pending_service_assignments` — single source of truth for pending queue (Sprint 4C)
- On assign: pending row `status` updated from `pending` → `assigned`

---

## 3. APIs Created

Router: `artifacts/api-server/src/routes/assignments.ts`  
Guard: `bookings` resource (`GET` = view, `POST …/assign` = edit)  
Feature flag: `ENABLE_SERVICE_ASSIGNMENTS` (default **on**; set `false` to disable)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/assignments/pending` | List pending queue with joins (customer, location, asset, service) |
| `POST` | `/api/assignments/:pendingId/assign` | Manual assign — body `{ staffId }` |
| `GET` | `/api/assignments/assigned` | Read-only assigned queue |
| `GET` | `/api/assignments/:id` | Assignment detail (history / audit) |

**Query filters (all list endpoints):** `serviceType`, `serviceLocationId`, `staffId`, `dateFrom`, `dateTo`

**Not implemented (by design):** execution, completion, reschedule, GPS, route optimization, auto-assign.

### Service layer

| File | Role |
|------|------|
| `artifacts/api-server/src/lib/assignments/assignmentService.ts` | Queue reads, manual assign transaction, detail |
| `artifacts/api-server/src/lib/assignments/featureFlag.ts` | `isServiceAssignmentsEnabled()` |

**Assign rules enforced:**

- Pending row must exist and be `status = pending`
- Service location required (Founder Rule #5)
- Staff must be active and not suspended
- Creates `service_assignments` row — never writes staff onto booking/contract/subscription/entitlement
- Marks pending row `assigned` (preserves queue history via FK)

---

## 4. Assignment Workflow

```text
Book Service (Sprint 4B)
  ↓
Contract created
  ↓
Quotation / Invoice (Sprint 4C)
  ↓
pending_service_assignments row (status: pending)
  ↓
/admin/assign-services — Pending Queue
  ↓
Operator selects staff → POST assign
  ↓
service_assignments row (status: assigned)
  ↓
pending_service_assignments.status → assigned
  ↓
STOP (Sprint 7 = execution)
```

**Priority:** Computed at read time — `high` if pending ≥ 3 days, else `normal`.

---

## 5. Queue Implementation

### Single unified queue

- **Pending:** reads `pending_service_assignments WHERE status = 'pending'`
- **Assigned:** reads `service_assignments WHERE status = 'assigned'`
- No separate DCMS / Solar / Doorstep queues created

### UI: `/admin/assign-services`

| File | Purpose |
|------|---------|
| `artifacts/cwp-platform/src/pages/admin/AssignServicesPage.tsx` | Main screen |
| `artifacts/cwp-platform/src/features/assign-services/api.ts` | Client API + types |

**Sections:**

1. **Pending Queue** — ID, Service, Customer, Service Location, Asset, Date Created, Priority  
2. **Assignment Panel** — Staff select + Assign button only  
3. **Assigned Queue** — ID, Staff, Assigned Date, Service, Location (read-only)

**Filters:** Service type, Location, Staff, Date range

**Navigation:** Operations → Assign Services (`adminNavConfig.ts`)  
**Route:** `App.tsx` — permission `bookings` / `edit` for assign action

---

## 6. Manual Assignment Implementation

1. User selects a pending row (location-first context shown in panel)
2. User picks staff from active, assignable staff list (`/api/staff?forAssignment=true`)
3. `POST /api/assignments/:pendingId/assign` creates immutable assignment record
4. Queues refresh; pending item leaves pending list; appears in assigned list

No auto-assignment, route order, or AI logic.

---

## 7. Backward Compatibility

| Area | Impact |
|------|--------|
| Customer 360 | **Unchanged** — no assign buttons or staff controls |
| Staff app | **Unchanged** — assignment APIs exposed for future Sprint 7 |
| `/admin/bookings` | Unchanged (legacy bookings list remains) |
| `/admin/daily-cleaning/assignments` | **Legacy DCMS assign UI still exists** — separate from unified queue (see conflicts) |
| Book Services flow | Unchanged; continues creating pending rows via `contractBillingService` |
| Existing bookings assign API | Unchanged — not used by Sprint 6 unified flow |

---

## 8. Rollback Strategy

1. Set `ENABLE_SERVICE_ASSIGNMENTS=false` — disables new APIs (503)
2. Hide nav item / route if needed (frontend-only)
3. DB rollback (pre-production only):
   - `DROP TABLE IF EXISTS service_assignments;`
   - `DROP TYPE IF EXISTS service_assignment_status;`
   - Reset `pending_service_assignments.status` from `assigned` → `pending` where no downstream execution exists
4. Remove migration `033` from runner if reverting codebase

**Safe forward rollback:** disabling flag leaves existing `service_assignments` rows intact for audit.

---

## 9. Acceptance Criteria Checklist

| Criterion | Status |
|-----------|--------|
| Single pending queue exists | ✅ |
| Pending queue uses `pending_service_assignments` | ✅ |
| `service_assignments` table exists | ✅ |
| Manual assignment works | ✅ |
| Assigned queue works | ✅ |
| Assignment history preserved | ✅ (`service_assignments` + pending FK) |
| Service Location visible in assignment workflow | ✅ |
| No auto-assignment | ✅ |
| No route optimization | ✅ |
| No execution states | ✅ (`pending` / `assigned` only) |
| No GPS logic | ✅ |
| Customer 360 unchanged | ✅ |

---

## 10. Architecture Conflicts Discovered

| Conflict | Detail | Recommendation |
|----------|--------|----------------|
| **Pending queue population scope** | Only Book Services → contract billing path creates `pending_service_assignments` today (`contractBillingService.createPendingAssignmentForContract`). DCMS subscriptions, Solar AMC, and legacy wash flows do not yet enqueue. | Sprint 6 UI/API is ready; enqueue adapters for other product lines should be added incrementally without new queues. |
| **Legacy DCMS assignments page** | `/admin/daily-cleaning/assignments` still assigns staff directly to DCMS subscriptions (pre-unified model). | Deprecate in favor of `/admin/assign-services` once DCMS enqueues to `pending_service_assignments`; not in Sprint 6 scope. |
| **Bookings assign endpoint** | `POST /api/bookings/:id/assign` still exists for legacy one-time bookings. | Sprint 7+ should migrate or bridge legacy bookings into contract + pending queue model. |
| **Priority field** | Spec lists Priority column; no DB column — computed from age (≥3 days = high). | Acceptable for Sprint 6; add explicit priority column later if ops needs manual override. |

---

## 11. Files Added / Modified (Summary)

### Added

- `lib/db/migrations/033_sprint6_service_assignments.sql`
- `lib/db/src/schema/service-assignments.ts`
- `artifacts/api-server/src/lib/assignments/assignmentService.ts`
- `artifacts/api-server/src/lib/assignments/featureFlag.ts`
- `artifacts/api-server/src/routes/assignments.ts`
- `artifacts/cwp-platform/src/features/assign-services/api.ts`
- `artifacts/cwp-platform/src/pages/admin/AssignServicesPage.tsx`
- `docs/SPRINT_6_COMPLETION_REPORT.md`

### Modified

- `lib/db/src/schema/index.ts`
- `scripts/src/run-pending-migrations.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/cwp-platform/src/App.tsx`
- `artifacts/cwp-platform/src/components/layout/adminNavConfig.ts`

---

## 12. Test Plan (Manual)

1. Run migration `033` on target database
2. Complete Book Services → create contract + quotation or invoice
3. Open `/admin/assign-services` — verify pending row appears with location, asset, service
4. Select row → assign active staff → confirm moves to Assigned queue
5. `GET /api/assignments/:id` returns detail with location and timestamps
6. Verify Customer 360 has no new assignment controls
7. Confirm no started/completed/missed states anywhere in new code

---

## 13. Post-Approval Updates (Sprint 6.1)

Conditional approval actions applied without redesigning Sprint 6:

| Action | Location |
|--------|----------|
| Canonical pending enqueue extracted | `pendingAssignmentEnqueue.ts` |
| Legacy path registry + HTTP deprecation headers | `legacyAssignmentDeprecation.ts` |
| `POST /api/bookings/:id/assign` deprecated | `routes/bookings.ts` |
| DCMS assignment endpoints deprecated | `routes/dcms.ts`, `subscriptionService.assignStaff` |
| Legacy UI banner | `DcmsAssignmentsPage.tsx`, `DcmsAdminNav.tsx` |
| Sprint 7 planning | `SPRINT_7_PLANNING.md` |

---

## 14. Next Gate

**Sprint 7 — Service Execution** is **not** authorized. Await Sprint 6 review and approval before execution states, staff app workflow, visit completion, or GPS.
