# ADR — Phase 5.5: Is a Job Card Entity Required?

**Status:** Accepted  
**Date:** 2026-07-17  
**Phase:** 5.5 Job Orchestration

---

## Context

Phase 5.5 must answer how execution jobs are managed through their operational lifecycle (queue, priority, dependencies, reopen, escalate, cancel, ownership, ops history), ending at Ready for Billing.

Two architectures were evaluated:

| Option | Shape |
|--------|--------|
| **A** | `service_executions` is the Job entity (orchestration metadata + APIs on top) |
| **B** | Separate Job Card aggregate with Job → Execution |

---

## Decision

**Choose Architecture A: `service_executions` ONLY.**

A separate Job Card entity is **not** required.

Canonical Job ID = `service_executions.id`.

---

## Rationale

1. **Ownership already exists.** `service_executions` carries staff, schedule, task type, customer/contract/location/asset, tenant, and field status through `completed`.
2. **Technician “jobs” are already executions.** Staff UI maps `StaffJob` from executions (`executionToStaffJob`); there is no job-card table.
3. **Phases 5.3–5.4 explicitly deferred Job Cards.** Introducing a parent Job now would duplicate identity and fight frozen Assignment → Execution handoff.
4. **Post-completion ops needs are additive, not hierarchical.** Quality review, reopen, escalate, approve, priority, and ready-for-billing are orchestration *state* on the same job — not a second aggregate.
5. **No multi-execution card requirement** exists in the product brief (crew split / multi-day parent ticket). Without that, Job → Execution adds migration and dual IDs with no benefit.

---

## Consequences

### Do

- Extend `service_executions` with orchestration columns (`ops_status`, `priority`, escalation, approval, dependency, ops owner).
- Own operational APIs under `/api/jobs` where `:id` is the execution id.
- Publish Job* domain events; subscribe to `ExecutionCompleted` / `ExecutionCancelled` without rewriting Field Execution.
- Keep a dedicated `job_orchestration_timeline` for ops history (field timeline remains Phase 5.4 owned).

### Do not

- Create `job_cards` / `work_orders` / parent Job tables.
- Redesign Booking, Assignment, or Field Execution cores.
- Implement billing, inventory, or route planning in this phase.

### Rejected alternative (B)

Job → Execution would only be justified if product required one long-lived ops ticket spanning multiple field executions. That is out of scope for 5.5.

---

## Schema principle

> Prefer extending the existing Job row (`service_executions`) over inventing a parallel entity.
