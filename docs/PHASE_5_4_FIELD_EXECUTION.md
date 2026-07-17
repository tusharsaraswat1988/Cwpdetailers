# Phase 5.4 — Field Execution

**Status:** READY FOR REVIEW  
**Business question:** *How is an assigned service executed?*  
**Starts when:** Assignment reaches `ready_for_execution` (handoff creates / leaves execution ready)  
**Ends when:** Execution is `completed`  
**Do not start Phase 5.5 until approved.**

---

## 1. Architecture Summary

Field Execution owns on-site job performance only.

```
Assignment (Phase 5.3) → ready_for_execution
        ↓
Execution ready_for_execution
        ↓
Start → started
        ↓
Pause ↔ Resume (paused / resumed)
        ↓
Checklist · Before/After photos · Notes · Signature (optional)
        ↓
completed   ← Phase 5.4 ends here
```

**Owns:** job execution status, start/pause/resume/complete/cancel, photos, checklist, notes, signature, execution timeline, domain events (publish-only).

**Does not own:** Booking, Assignment, routes, attendance, salary, billing, inventory, CRM.

---

## 2. Audit Findings

| Area | Finding |
|------|---------|
| `service_executions` | Sprint 7 core already existed (photos, notes, checklist, location logs) |
| Statuses (pre-5.4) | `scheduled → started → completed \| missed \| cancelled \| rescheduled` — no pause/resume |
| Job cards | **None** — staff “Jobs” UI is not a job-card entity |
| Staff UI | Dual-path bookings + executions; DCMS daily clean parallel |
| Signatures | Missing before 5.4 |
| Timeline / events | Missing on execution (Assignment had them) |
| Handoff | Assignment still eagerly calls `createScheduledExecutionForAssignment` (frozen — not changed) |
| Debt | Auth under `bookings`; booking staff transitions mostly dead vs frozen Booking |

---

## 3. Existing Components Reused

- `service_executions` + photos / notes / checklist / location_logs  
- `executionService.ts` (extended)  
- `/api/service-executions/*` routes (extended)  
- Staff Jobs flow (`StaffServiceJobFlow`, `useStaffJobsData`, `GeoPhotoSlotGrid`)  
- Tenant scope + feature flag  

---

## 4. New Components Created

| Component | Purpose |
|-----------|---------|
| `052_field_execution_phase54.sql` | Statuses, timeline, signature columns |
| `execution-timeline.ts` schema | Audit timeline |
| `domainEvents.ts` | Publish-only execution events |
| `executionTimeline.ts` | Record / load timeline |
| `executionValidation.ts` | Technician match, ready/terminal helpers |
| `executionValidation.test.ts` | Unit tests |

---

## 5. Database Changes

Migrations:

- `052_field_execution_phase54.sql` — enum values `ready_for_execution`, `paused`, `resumed`; columns `paused_at`, `resumed_at`, `customer_signature_url`, `customer_signed_at`; table `execution_timeline`  
- `053_execution_ready_backfill.sql` — backfill `scheduled` → `ready_for_execution` (separate file required: Postgres must commit new enum values before use)

Legacy statuses `scheduled`, `missed`, `rescheduled` retained for history.

**Why timeline table:** Execution history must not live on Booking or Assignment.

---

## 6. APIs Added / Extended

| Method | Path | Action |
|--------|------|--------|
| POST | `/service-executions/:id/start` | ready → started |
| POST | `/service-executions/:id/pause` | started/resumed → paused |
| POST | `/service-executions/:id/resume` | paused → resumed |
| POST | `/service-executions/:id/photos` | before/after (+ events) |
| POST | `/service-executions/:id/notes` | technician notes |
| POST | `/service-executions/:id/checklist` | save/toggle checklist |
| POST | `/service-executions/:id/signature` | customer signature |
| POST | `/service-executions/:id/complete` | → completed (must be in progress) |
| GET | `/service-executions/:id/timeline` | history |
| POST | cancel / miss / reschedule | retained |

### Validation

- Tenant isolation  
- Assigned technician match (staff role)  
- Linked assignment active (`ready_for_execution` \| `assigned`) when present  
- Reject completed / wrong technician / photos while paused  
- Duplicate active execution rejected on create  
- Complete no longer allowed from ready without start  

### Domain events (publish only)

`ExecutionStarted`, `ExecutionPaused`, `ExecutionResumed`, `ExecutionCompleted`, `ExecutionCancelled`, `ChecklistCompleted`, `BeforePhotosUploaded`, `AfterPhotosUploaded`

---

## 7. UI Changes

Staff technician flow (existing design system):

- Ready jobs → Accept → On my way → Start work  
- In progress → before photos → service → after photos → notes → complete  
- **Pause / Resume** on execution jobs  
- Execution complete now **persists notes**  
- Status mapping: `ready_for_execution` → scheduled UI; `started`/`resumed` → in_progress; `paused` → paused  

Assignment admin UI **not** redesigned.

---

## 8. Technical Debt

1. Assignment still eagerly creates executions (Phase 5.3 frozen — handoff ownership incomplete).  
2. Auth resource still `bookings`.  
3. Booking-era staff transitions remain in UI for legacy path.  
4. Daily clean still primarily DCMS visits.  
5. Reassign/remove in Assignment still do not sync executions (pre-existing; Assignment frozen).  
6. No dedicated job-card entity (not required for 5.4).  

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Enum backfill of `scheduled` | Migration updates rows; UI maps both |
| Complete-without-start regression | Explicitly blocked |
| Wrong technician | `assertAssignedTechnician` |
| Duplicate execution | Create-time check |

---

## 10. QA Checklist

- [ ] Start from ready_for_execution → started + timeline  
- [ ] Pause → resume → completed  
- [ ] Before/after photos with geo  
- [ ] Checklist seeded on start; save updates  
- [ ] Notes saved on complete  
- [ ] Optional signature  
- [ ] Wrong technician rejected  
- [ ] Completed job cannot restart  
- [ ] Duplicate active execution rejected  
- [ ] Booking / Assignment / Billing unchanged  
- [ ] Unit tests pass  

---

## Explicit non-goals (honored)

- No Booking / Assignment / Pricing / Billing / Inventory / CRM changes  
- No Route Planning  
- No notification delivery  

---

**Phase 5.4 status: READY FOR REVIEW**  
Await approval before Phase 5.5.
