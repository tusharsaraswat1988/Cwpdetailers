# Phase 5.5 — Job Orchestration

**Status:** READY FOR REVIEW  
**Business question:** *How are execution jobs managed throughout their operational lifecycle?*  
**Starts when:** Field execution reaches `completed` (or job is still `in_field` for priority / escalate / cancel)  
**Ends when:** Job is `ready_for_billing`  
**Do not start Phase 5.6 until approved.**

---

## 1. Architecture Summary

```
Field Execution completed (Phase 5.4 — frozen)
        ↓
ops_status → pending_quality_review   (+ JobCompleted)
        ↓
   Reopen (optional) → field ready_for_execution, ops reopened
        ↓
   Approve → ops approved   (+ JobApproved)
        ↓
   Ready for Billing → ops ready_for_billing   (+ JobReadyForBilling)
        ↓
   Phase 5.5 ends (Billing is NOT implemented here)
```

**Canonical Job ID** = `service_executions.id`  
**ADR:** Architecture A — no separate Job Card. See `docs/ADR_PHASE_5_5_JOB_CARD.md`.

**Owns:** operational job lifecycle, job queue views, priority, dependencies, reopen, escalate, ops cancel, ops ownership, operational history, Job* domain events (publish-only).

**Does not own:** Booking, Assignment, technician field performance, routes, attendance, payroll, billing, inventory, CRM, notification delivery.

---

## 2. Audit Findings

| Area | Finding |
|------|---------|
| `service_executions` | Already the field job aggregate (staff, schedule, status, evidence) |
| Job cards | **None** — Staff Jobs UI is a DTO over executions |
| Work queue | Assignment `pending_service_assignments` owns pre-field queue |
| Priority | Assignment had age-based computed priority only; executions had none |
| Reopen / escalate / approve | Did not exist on executions |
| Post-complete workflow | Field ended at `completed`; no quality review / ready-for-billing |
| `system_jobs` | Background jobs only — unrelated |

---

## 3. ADR: Is Job Card Required?

**No.** Decision: **Architecture A — `service_executions` ONLY.**

Full write-up: [`docs/ADR_PHASE_5_5_JOB_CARD.md`](./ADR_PHASE_5_5_JOB_CARD.md).

---

## 4. Existing Components Reused

- `service_executions` as Job entity  
- Field `execution_timeline` (read-only merge into ops timeline)  
- `ExecutionCompleted` / `ExecutionCancelled` publishers (subscribe only)  
- Tenant scope helpers  
- Admin design system (Cards, Tabs, Dialogs)  
- Auth resource `bookings` (same debt as Assignment / Execution)

---

## 5. New Components

| Component | Purpose |
|-----------|---------|
| `054_job_orchestration_phase55.sql` | Ops columns + `job_orchestration_timeline` |
| `job-orchestration-timeline.ts` schema | Ops audit timeline |
| `lib/job-orchestration/*` | Validation, service, events, bootstrap |
| `routes/jobs.ts` | Job lifecycle APIs |
| `features/job-orchestration/api.ts` | Frontend client |
| `JobOrchestrationPage.tsx` | Ops management UI |
| `jobValidation.test.ts` | Unit tests |

---

## 6. Database Changes

Migration `054_job_orchestration_phase55.sql`:

**On `service_executions` (extend Job row — not a new parent entity):**

- `ops_status` — `in_field` \| `pending_quality_review` \| `reopened` \| `approved` \| `ready_for_billing` \| `cancelled`  
- `priority` — `low` \| `normal` \| `high` \| `urgent`  
- `depends_on_execution_id`  
- Escalation: `is_escalated`, `escalation_reason`, `escalated_at`, `escalated_by`  
- Ownership: `ops_owner_user_id`  
- Review / approve / billing handoff timestamps  
- Reopen / ops cancel fields  

**New table:** `job_orchestration_timeline` (ops history; field timeline stays Phase 5.4 owned).

**Backfill:** completed field rows → `pending_quality_review`; cancelled field rows → ops `cancelled`.

**Why no Job Card table:** Would duplicate job identity already on `service_executions`.

---

## 7. APIs

| Method | Path | Action |
|--------|------|--------|
| GET | `/jobs?queue=` | List (active / completed / escalated / reopened / quality_review / ready_for_billing / all) |
| GET | `/jobs/:id` | Job detail (`:id` = execution id) |
| GET | `/jobs/:id/timeline` | Merged field + ops timeline |
| POST | `/jobs/:id/reopen` | Reopen after quality review / approved |
| POST | `/jobs/:id/escalate` | Escalate (reason required) |
| POST | `/jobs/:id/priority` | Change priority |
| POST | `/jobs/:id/approve` | Quality approve |
| POST | `/jobs/:id/ready-for-billing` | Handoff flag (no billing) |
| POST | `/jobs/:id/cancel` | Ops cancel |
| POST | `/jobs/:id/ownership` | Ops owner user |
| POST | `/jobs/:id/dependency` | Set / clear dependency |

### Domain events (publish only)

`JobCompleted`, `JobReopened`, `JobEscalated`, `JobApproved`, `JobCancelled`, `JobReadyForBilling`, `JobPriorityChanged`

`JobCompleted` is published when field completion enters quality review (orchestration acknowledgment).

### Permissions

- Admin / manager / superadmin for mutations (`assertAdminOpsActor`)  
- Staff / customer blocked from orchestration actions  
- Tenant isolation via `tenantFilters` / `rowInScope`  
- Route guard still under `bookings` (documented debt)

---

## 8. UI

Admin **Job Orchestration** (`/admin/jobs`):

- Queues: Active, Quality review, Reopened, Escalated, Completed (field), Ready for billing, All  
- Priority badges, escalate / reopen / approve / cancel / ready-for-billing  
- Operational timeline (field + ops)  

Staff technician UI **not** redesigned (Field Execution frozen).

---

## 9. Technical Debt

1. Auth resource still `bookings` (shared with Assignment / Execution).  
2. Assignment reassign/remove still does not sync executions (Phase 5.3 frozen).  
3. Eager execution create inside Assignment unchanged.  
4. Dual staff UI path (booking + execution) unchanged.  
5. OpenAPI still missing jobs / service-executions / assignments paths.  
6. Dependency graph is single-parent only (`depends_on_execution_id`).  

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Mixing field `status` and `ops_status` | Kept orthogonal; reopen is the only orchestration write that resets field status |
| Double cancel events | Subscriber skips when `metadata.source === "orchestration"` |
| Approving blocked by unmet dependency | `assertDependencySatisfied` before approve |
| Accidental billing implementation | Ready-for-billing is a flag + event only |

---

## 11. QA Checklist

- [ ] Field complete → job enters quality review + `JobCompleted`  
- [ ] Approve from quality review → `approved` + `JobApproved`  
- [ ] Ready for billing from approved → `ready_for_billing` + event  
- [ ] Reopen from review/approved → field `ready_for_execution`, ops `reopened`  
- [ ] Escalate requires reason; sets `is_escalated`  
- [ ] Change priority persists + timeline  
- [ ] Cancel from ops (in-field and post-complete)  
- [ ] Timeline merges field + ops events  
- [ ] Staff cannot call orchestration mutations  
- [ ] Cross-tenant job id returns not found  
- [ ] Regression: start/pause/complete field flow still works  
- [ ] Booking / Assignment / Billing modules untouched  

---

## Freeze

Do not modify Booking, Assignment, or Field Execution cores for Phase 5.6 until this phase is approved.
