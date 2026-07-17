# Phase 5.3 — Staff Assignment

**Status:** FROZEN  
**Business question:** *Who should perform this scheduled service?*  
**Terminal happy path:** Assigned → `ready_for_execution`  
**Phase ends here.** Execution begins in a later phase.

Do **not** start Phase 5.4 until this phase is approved.

---

## 1. Architecture Summary

Staff Assignment is a dedicated platform that answers only who performs a scheduled service.

```
Booking (Phase 5.2) → waiting_assignment
        ↓
Pending Assignment Queue (pending_service_assignments)
        ↓
Assign / Reassign / Remove staff (service_assignments)
        ↓
ready_for_execution   ← Phase 5.3 ends here
        ⇢ Execution / Job Cards / Routes (later)
```

**Owns:** work queue, available staff selection, assignment, reassignment, remove, assignment status, notes, timeline/history, domain events (publish-only), future-ready auto-assignment hooks.

**Does not own:** booking schedule, pricing, billing, job cards, route planning, attendance, salary, leave, execution.

---

## 2. Audit Findings

| Area | Finding |
|------|---------|
| Staff / employees / users | Reused `staff` table + operational roles (`staff_role_assignments`). No duplicate staff model. |
| Branches | `staff.branchId` vs job `branchId` — branch match validation added. |
| Skills / territories | Capability via operational role slugs per task type. **No territory tables** in schema — territory validation N/A. |
| Existing assignment | Already had `pending_service_assignments`, `service_assignments`, `/api/assignments/*`, Assign Services admin UI. |
| Booking | Frozen Phase 5.2 — Assignment **reads** booking schedule when `source_system=booking`; never writes booking staff/status. |
| Notifications | Existing push notify on assign kept as bridge; Phase 5.3 adds **domain event publisher** (no delivery). |
| Duplicate risk | Did **not** create parallel employees/users/staff tables. Extended existing assignment tables. |

### Gaps closed in 5.3

1. Reassign / remove APIs  
2. `assignment_timeline` + history on detail  
3. Domain events: `AssignmentCreated`, `AssignmentChanged`, `AssignmentRemoved`, `AssignmentReadyForExecution`  
4. Branch validation  
5. Booking schedule projection on waiting queue (read-only)  
6. Status `ready_for_execution` (phase terminal) + `removed`  
7. Assignment notes  

---

## 3. Existing Components Reused

- `pending_service_assignments` — waiting queue  
- `service_assignments` — assignment records  
- `staff` + operational roles — capability checks  
- `artifacts/api-server/src/lib/assignments/assignmentService.ts` — extended  
- `artifacts/api-server/src/routes/assignments.ts` — extended  
- Admin `/admin/assign-services` (`AssignServicesPage`) — enhanced  
- Enqueue adapters from contracts/bookings/DCMS (unchanged ownership)  
- Tenant scope middleware (`tenantFilters` / `rowInScope`)  
- Auth via existing `guardResource("bookings", …)` (pre-existing smell; documented debt)

---

## 4. New Components Created

| Component | Purpose |
|-----------|---------|
| `lib/db/src/schema/assignment-timeline.ts` | Timeline / audit events |
| `lib/db/migrations/051_assignment_platform_phase53.sql` | Timeline table + status/notes/booking_id |
| `assignmentValidation.ts` | Staff active + branch checks |
| `domainEvents.ts` | Publish-only assignment events |
| `assignmentTimeline.ts` | Record / load timeline |
| `assignmentValidation.test.ts` | Unit tests for validation + events |

---

## 5. Database Changes

Migration: `051_assignment_platform_phase53.sql`

- Enum values: `ready_for_execution`, `removed` on `service_assignment_status`  
- Columns on `service_assignments`: `notes`, `booking_id`  
- Table `assignment_timeline` (event types: CREATED / CHANGED / REMOVED / READY_FOR_EXECUTION / NOTE_ADDED)  
- Backfill `booking_id` from pending when `source_system = 'booking'`  

**Why new table:** Assignment history must not live on Booking or Execution. Timeline is Assignment-owned audit.

**Not duplicated:** employees, users, staff.

---

## 6. APIs Added / Extended

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/assignments/pending` | Waiting queue (+ booking schedule projection) |
| GET | `/api/assignments/assigned` | Active assignments (`assigned` \| `ready_for_execution`) |
| GET | `/api/assignments/:id` | Detail + timeline |
| GET | `/api/assignments/:id/timeline` | Timeline only |
| POST | `/api/assignments/:pendingId/assign` | Manual assign (+ optional notes) |
| POST | `/api/assignments/:id/reassign` | Change staff |
| POST | `/api/assignments/:id/remove` | Remove → queue reopened |
| POST | `/api/assignments/substitute` | Existing same-day cover (unchanged intent) |

All use tenant isolation + permission guards. Domain events published on create/change/remove/ready.

### Validation enforced

- Staff exists & active (not suspended)  
- Correct branch (when job branch set)  
- Correct service capability (operational role for task type)  
- No duplicate active assignment per pending + task type  
- Booking status allows assignment when source is booking  
- Territory: N/A (no territory model)  
- Attendance: **not** validated (out of scope)

---

## 7. UI Changes

Admin **Staff Assignment** (`/admin/assign-services`):

- Waiting Assignment Queue (schedule column when booking-linked)  
- Staff Selection panel + optional notes  
- Assigned list with Ready for execution status  
- Reassign dialog  
- Remove (returns to waiting queue)  
- Assignment Details + Timeline dialog  

Booking UI **not** redesigned.

---

## 8. Technical Debt

1. **Auth resource** still `bookings` for assignment routes — should become dedicated `assignments` permission later.  
2. **Execution bridge:** assign still creates a `service_executions` scheduled row via existing helper — separation smell; keep until Execution phase owns handoff.  
3. **Substitute** still creates execution cover jobs — pre-existing; not Assignment’s long-term ownership.  
4. **Auto-assignment** not implemented — events/API shape are future-ready only.  
5. **Territory** validation blocked until territory model exists.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Branch null on legacy pending rows | Branch check skipped when job branch null |
| Re-assign after remove | Unique (pending, taskType) preserved; removed rows reactivated |
| Booking cancelled mid-queue | Assign blocked if booking cancelled |
| Regression on Booking | Assignment only reads bookings; no Booking writes |

---

## 10. QA Checklist

- [ ] Assign staff from waiting queue → status `ready_for_execution`  
- [ ] Timeline shows ASSIGNMENT_CREATED + READY_FOR_EXECUTION  
- [ ] Reassign changes staff → ASSIGNMENT_CHANGED event/timeline  
- [ ] Remove → status `removed`, job back in waiting queue  
- [ ] Invalid / inactive staff rejected  
- [ ] Cross-branch staff rejected when branches set  
- [ ] Duplicate task assignment returns 409  
- [ ] Unauthorized user cannot assign (permission guard)  
- [ ] Booking-linked pending shows schedule (read-only)  
- [ ] Booking UI / Pricing / Billing / Job Cards unchanged  
- [ ] Unit tests: `assignmentValidation.test.ts` pass  

---

## Explicit non-goals (honored)

- No Booking Engine changes  
- No Billing / Pricing changes  
- No Route Planning  
- No Job Cards  
- No Staff Attendance / Salary  
- No notification delivery (events only)

---

**Phase 5.3 status: READY FOR REVIEW**  
Await approval before Phase 5.4.
