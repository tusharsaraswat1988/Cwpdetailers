# Phase 5.2 — Booking Engine (Clean Domain)

**Status:** FROZEN (pre-freeze architecture validation complete)  
**Domain version:** `BookingDomainV2` / `BookingCapabilityV2`  
**Question this platform answers:** *When and where will this service be performed?*

---

## 1. Architecture summary

Booking is a **schedule-only** platform. It owns date, time, location, status, timeline, reschedule, cancel, capacity, conflicts, customer confirmation, and internal notes.

It does **not** own pricing, staff assignment, routes, job cards, billing, payments, photos, checklists, or execution.

```
Service Request (Phase 5.1: book-services → customer_contracts)
        ↓
Booking Engine (schedule)
        ↓
waiting_assignment   ← Phase 5.2 ends here
        ⇢ Assignment → Execution → Billing (later phases)
```

---

## 2. Architectural decisions (ADRs)

### ADR-1: Single scheduling status enum
**Decision:** Replace dual `booking_status` + `booking_platform_status` with:

`draft | scheduled | confirmed | waiting_assignment | rescheduled | cancelled`

**Why:** Dual machines caused status drift and mixed scheduling with field ops.

### ADR-2: Terminal happy path is `waiting_assignment`
**Decision:** Booking stops when the schedule is confirmed and ready for Assignment.

**Why:** Enforces platform separation.

### ADR-3: Contract owns sale; Booking owns schedule
**Decision:** Add `contract_registry_id` on `bookings`. One-time Book Services creates the contract first, then calls the Booking Engine.

**Why:** Inverted ownership made Booking a commercial + schedule god-object.

### ADR-4: Drop execution / pricing / staff columns from `bookings`
**Decision:** Remove `staff_id`, `amount`, photos, rating, timestamps, recurrence, platform/coverage snapshot columns.

**Why:** Those concerns already have homes. App not launched — prefer clean schema.

### ADR-5: PricingRequiredRule removed from Booking
**Decision:** Booking create does not resolve or require amount.

**Why:** Pricing belongs to Quotation / Invoice (Phase 5.1 commercial path).

### ADR-6: Slot + conflict + capacity inside Booking
**Decision:** Implement `SlotService`, `ConflictDetector`, `CapacityPolicy`, `DuplicateBookingGuard`.

**Why:** Without these, Booking cannot truthfully answer “when and where.”

### ADR-7: Keep `booking_timeline` for schedule audit
**Decision:** Retain timeline with `from_status` / `to_status`.

**Why:** Audit without a second history table.

### ADR-8: Minimal Phase 5.1 touch
**Decision:** Change only `createOneTimeContract` handoff. Book Services UI frozen.

### ADR-9: Staff execution not migrated in 5.2
**Decision:** Remove execution from Booking APIs. Staff Jobs UX onto `service_executions` is a later phase.

### ADR-10: SchedulingDomainService is the single scheduling orchestrator
**Decision:** Conflict, capacity, slots, duplicates, and time-window resolution go through `SchedulingDomainService`. `BookingService` is the domain orchestrator for lifecycle; it must not call conflict/slot helpers directly.

**Why:** Prevents unrelated-module drift while keeping a clear domain boundary.

### ADR-11: Canonical time window (start/end + duration)
**Decision:** Add `scheduledStartAt`, `scheduledEndAt`, `durationMinutes`. Keep `scheduledDate`/`scheduledTime` as denormalized UX/filter fields. Conflicts use interval overlap, not fixed one-hour equality.

**Why:** Services have variable duration; fixed hourly slots are a discovery UX convenience, not the domain model.

### ADR-12: Booking type (why it exists)
**Decision:** Add `bookingType`: `one_time | subscription_visit | contract_visit | inspection | follow_up | other`. Independent of catalog `serviceType`.

**Why:** Long-term ERP needs to know why a schedule exists without embedding product-line logic in the engine.

### ADR-13: CapacityProvider
**Decision:** Capacity limits come from `CapacityProvider` (`DefaultCapacityProvider` today). Algorithms never embed max-concurrent constants.

**Why:** Business Settings can later back the provider without rewriting scheduling math.

### ADR-14: Required domain events
**Decision:** Booking publishes infrastructure-independent events:
`BookingCreated`, `BookingScheduled`, `BookingConfirmed`, `BookingRescheduled`, `BookingCancelled`.

**Why:** Future Assignment/Execution/Billing modules consume events, not Booking internals.

---

## Pre-freeze validation improvements (final)

| # | Improvement |
|---|---|
| 1 | Introduced `SchedulingDomainService` as sole scheduling orchestration point |
| 2 | Added canonical `scheduledStartAt` / `scheduledEndAt` / `durationMinutes` |
| 3 | Conflict + duplicate detection use window overlap (variable duration) |
| 4 | Slot discovery evaluates candidates against requested duration |
| 5 | Added `bookingType` enum (why booking exists) |
| 6 | Extracted `CapacityProvider` / `DefaultCapacityProvider` (no hardcoded capacity in algorithms) |
| 7 | Domain events: `BookingCreated`, `BookingScheduled`, `BookingConfirmed`, `BookingRescheduled`, `BookingCancelled` |
| 8 | Migration `050_booking_time_model_and_type.sql` applied |
| 9 | Domain version bumped to V2 |

**Production-ready confirmation:** Phase 5.2 Booking Engine is frozen for schedule-only ownership through `waiting_assignment`. No further Booking redesign until Phase 5.3 instructions.

**Do not begin:** Staff Assignment, Route Planning, Job Cards, or Billing from Booking.

## 3. Audit findings (Step 1)

- Substantial booking stack existed but mixed pricing, assignment, execution, billing.
- No capacity, conflict detection, or server-side slot API.
- Phase 5.1 had no `service_requests` table — intake is Book Services → `customer_contracts`.
- One-time path inserted `bookings` before the contract (inverted ownership).
- Dual status machines (`booking_status` + `platform_status`) spanned field ops.

---

## 4. Existing components reused

- `bookings` table (slimmed)
- `booking_timeline` / `booking_snapshots` (schedule audit)
- `bookingCapability` facade + policies + coverage validation dependency
- Address / Coverage platforms as dependencies
- Admin Bookings list + customer schedule shell
- `bookings` permissions + tenant scoping
- `ScheduleProvider` / `SlotProvider` extension interfaces (now wired)

---

## 5. New components created

| Component | Path |
|---|---|
| Conflict detector | `artifacts/api-server/src/lib/booking/scheduling/ConflictDetector.ts` |
| Capacity policy | `.../scheduling/CapacityPolicy.ts` |
| Slot service | `.../scheduling/SlotService.ts` |
| Duplicate guard | `.../scheduling/DuplicateBookingGuard.ts` |
| Schedule validator | `.../scheduling/index.ts` |
| Slim state machine | `.../domain/stateMachine.ts` |
| Migration 049 | `lib/db/migrations/049_booking_engine_phase52.sql` |
| Unit tests | `.../domain/stateMachine.test.ts` |

---

## 6. Database changes

Migration: `lib/db/migrations/049_booking_engine_phase52.sql` (registered in `scripts/src/run-pending-migrations.ts`).

| Change | Purpose |
|---|---|
| New `booking_status` enum | Slim scheduling lifecycle |
| Status data remap | Legacy execution statuses → `waiting_assignment` or `cancelled` |
| `contract_registry_id` + backfill | Forward FK to commercial intent |
| `customer_confirmed_at` | Explicit confirmation |
| Timeline `from_status` / `to_status` | Replace platform status columns |
| Drop obsolete columns | Remove pricing/staff/execution ownership |
| Scheduling indexes | Conflict/slot query performance |

**Dropped columns:** `staff_id`, `amount`, `addon_ids`, proof/before/after photos, signature, technician notes, rating, `started_at`, `completed_at`, `platform_status`, coverage snapshot fields, `recurrence_rule`, `parent_booking_id`, `subscription_id`, `entitlement_id`.

---

## 7. APIs added or modified

### Added
- `GET /api/bookings/slots?date=&branchId=&assetId=&serviceLocationId=&customerId=`
- `POST /api/bookings/:id/confirm`

### Hardened
- `POST /api/bookings` — schedule create only (no amount/staff)
- `POST /api/bookings/:id/reschedule` — conflict/capacity re-check
- `POST /api/bookings/:id/cancel`
- `POST /api/bookings/:id/transition` — schedule statuses only (`toStatus`)
- `PATCH /api/bookings/:id` — notes/reschedule only; rejects staff/amount/photos

### Removed from Booking ownership
- Execution transitions (`en_route`, `in_progress`, `completed`)
- `POST /bookings/:id/proof`
- Staff assign / amount / rating on PATCH
- Recurrence regenerate
- Invoice-on-complete trigger from booking transitions

### Phase 5.1 handoff
- `createOneTimeContract` → contract first → `bookingCapability.createBooking` → link → pending queue → `waiting_assignment`

---

## 8. UI changes

- Admin Bookings: new status filters; confirm / waiting-assignment / reschedule / cancel; no en-route/complete/amount/photos
- Franchisee Bookings: schedule-only actions; assign via Assign Service link
- Customer schedule: `fetchAvailableSlots` → `GET /api/bookings/slots` (static fallback)
- Customer BookingDetail: cancellable statuses updated; draft replaces pending

---

## 9. Technical debt identified

1. OpenAPI `Booking` / `CreateBookingBody` / `UpdateBookingBody` still need a full regen pass for generated clients (`@workspace/api-client-react`).
2. Staff Jobs UI still partially expects legacy booking execution fields — intentionally deferred to Assignment/Execution phases.
3. `vehicleId` / `solarSiteId` / raw address columns remain as bridges until all writers always use `assetId` + address snapshots.
4. `source_system='booking'` on contracts remains as compatibility key; long-term commercial source naming can be cleaned in a contracts pass.
5. `maybeCreateInvoiceOnBookingComplete` still exists for Billing bridges but is no longer driven by Booking transitions.
6. Franchisee `/franchisee/assign-services` link assumes that route exists; verify nav alias if needed.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Staff portal job flow breaks for booking-based execution | Expected; executions API is the future home; documented as out of scope |
| Generated TypeScript client status enums lag OpenAPI | Runtime casts used; regen clients when convenient |
| Concurrent one-time contracts use provisional negative `source_id` briefly | Linked to booking id immediately after create |
| Capacity constant (8/slot) is hardcoded | Adequate for launch; make configurable in ops settings later |

---

## 11. QA checklist

- [x] Schema + migration 049 applied
- [x] State machine unit tests (22 tests incl. architecture freeze)
- [x] Capacity policy unit tests
- [ ] Manual: create booking via admin/customer
- [ ] Manual: confirm → waiting_assignment
- [ ] Manual: reschedule with conflict rejection
- [ ] Manual: cancel
- [ ] Manual: slots API returns availability
- [ ] Manual: Book Services one-time → contract + booking + pending assignment
- [ ] Manual: branch isolation / permissions
- [ ] Regression: no invoice created by booking transition
- [ ] Regression: no staffId written on booking create

---

## Status lifecycle (final)

```
draft → scheduled → confirmed → waiting_assignment
                 ↘ cancelled
scheduled | confirmed | waiting_assignment → rescheduled → confirmed → waiting_assignment
any non-terminal → cancelled
```

---

**Phase 5.2 FROZEN. Waiting for Phase 5.3 (Staff Assignment) instructions.**
Do not begin Route Planning, Job Cards, or Billing changes from Booking.
