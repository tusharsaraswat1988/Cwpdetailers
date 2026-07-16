# Phase 3: Intelligent Booking Platform

## Overview

The Booking Platform transforms booking from a CRUD module into an **orchestration layer** that coordinates Customer → Address → Coverage → Business Rules → Pricing → Staff → Schedule → Execution.

It builds exclusively on the frozen platforms:
- **Location Intelligence Platform** (`lib/location-intelligence/`)
- **Address Management Platform** (`lib/address/`)
- **Coverage Engine** (`lib/coverage/`)

**Never bypass these platforms.** All booking operations consume them through their public APIs.

## Architecture Stack

```
Authentication Platform
        ↓
Location Intelligence Platform  (FROZEN)
        ↓
Address Management Platform     (FROZEN)
        ↓
Booking Platform                (Phase 3)
        ↓
Pricing / Workforce / Subscription (Phase 4+)
```

## Module Structure

```
lib/booking/
├── index.ts                    # Public API — consume BookingCapability only
├── versioning.ts               # BookingDomainV1, BookingCapabilityV1
├── BookingContext.ts           # Standard booking object for all consumers
├── BookingService.ts           # Internal orchestrator (@deprecated externally)
├── capability/
│   └── BookingCapability.ts    # Public facade
├── correlation/
│   └── BookingTraceContext.ts
├── domain/
│   ├── stateMachine.ts         # Platform + legacy state machines
│   └── events/                   # Publish-only domain events
├── policies/                     # Booking policies (execute business rules)
├── businessRules/                # Business Rules Engine
├── repositories/                 # Booking, Timeline, Snapshot repos
├── timeline/                     # Immutable booking timeline
├── snapshots/                    # Address/Location/Coverage/Price snapshots
├── services/
│   ├── AddressSelectionService.ts
│   └── ServiceDiscoveryService.ts
├── search/                       # BookingSearchProvider interface
├── extensions/                   # Phase 4 provider interfaces (stubs)
└── metrics/                      # Structured booking metrics
```

## Booking Capability

**Entry point:** `bookingCapability` from `lib/booking`

Future modules must consume `BookingCapability`, not `BookingService` or route handlers directly.

```typescript
import { bookingCapability } from "../lib/booking";

const result = await bookingCapability.createBooking(input, {
  traceId, requestId, logger
});
```

### Methods

| Method | Description |
|--------|-------------|
| `createBooking()` | Orchestrated create with coverage, rules, snapshots, timeline, events |
| `transitionBooking()` | Validated state transition with audit trail |
| `getBookingContext()` | Full BookingContext for a booking |
| `getTimeline()` | Immutable timeline entries |
| `getSnapshots()` | All snapshots for a booking |
| `search()` | Search via BookingSearchProvider |

## Booking Context Specification

Every module receives a single `BookingContext` instead of many parameters:

```typescript
type BookingContext = {
  booking: BookingRecordSummary;
  customer?: { id, name, phone };
  addressContext?: AddressContext;
  locationContext?: LocationContext;
  coverageResult?: CoverageResult;
  schedule: BookingScheduleContext;
  pricing: BookingPricingContext;
  staff: BookingStaffContext;
  timeline?: BookingTimelineEntry[];
  state: { platformStatus, legacyStatus };
  metadata: { version: "BookingDomainV1" };
  correlation: BookingTraceContext;
};
```

## Business Rules Engine

Booking never contains pricing/coverage/coupon/holiday logic directly. Instead:

```
Booking → BusinessRulesEngine → Rules
  ├── CoverageAvailabilityRule
  ├── ServiceUnavailableBlockRule
  ├── PricingRequiredRule
  ├── SubscriptionActiveRule
  ├── CouponValidityRule (stub)
  ├── HolidayBlockRule (stub)
  ├── WorkingHoursRule
  ├── CancellationWindowRule (stub)
  └── RefundEligibilityRule (stub)
```

Future rules plug into `businessRulesEngine.register()`.

## State Machine

### Platform States

```
DRAFT → VALIDATED → CONFIRMED → PAYMENT_PENDING → ASSIGNED → ACCEPTED
  → TRAVELLING → ARRIVED → STARTED ⇄ PAUSED/RESUMED → COMPLETED
  → REVIEW_PENDING → REVIEWED → ARCHIVED

Branches: CANCELLED, FAILED at multiple points
```

### Legacy Compatibility

| Legacy Status | Platform Status |
|---------------|-----------------|
| pending | DRAFT |
| scheduled | CONFIRMED |
| confirmed | CONFIRMED |
| en_route | TRAVELLING |
| in_progress | STARTED |
| completed | COMPLETED |
| cancelled | CANCELLED |
| missed | FAILED |

Existing APIs continue using legacy `status`. New `platformStatus` column tracks the enterprise state machine.

## Timeline Architecture

Every booking builds a **permanent, immutable timeline** in `booking_timeline`:

```
Booking Created → Coverage Validated → Address Snapshot Created
  → Price Calculated → Booking Confirmed → Assigned → Accepted
  → Travelling → Arrived → Started → Completed → Reviewed
```

Each entry carries: `traceId`, `requestId`, `bookingOperationId`, `addressIdentityId`, `addressSnapshotId`, `coverageValidationId`.

## Snapshots

Stored in `booking_snapshots` with types:
- **ADDRESS** — via `createBookingAddressSnapshot()` from Address Platform
- **LOCATION** — LocationContext at booking time
- **COVERAGE** — CoverageResult at validation
- **PRICE** — Amount, addons, entitlement at booking time
- **STAFF, VEHICLE, COUPON** — interfaces prepared for Phase 4

Booking history never changes — snapshots are append-only.

## Domain Events (Publish Only)

| Event | Trigger |
|-------|---------|
| BookingCreated | After orchestrated create |
| BookingValidated | Coverage + rules pass |
| BookingConfirmed | Status → confirmed |
| BookingAssigned | Staff assigned |
| BookingAccepted | Staff accepts |
| BookingStarted | Service begins |
| BookingPaused / BookingResumed | Pause cycle |
| BookingCompleted | Service done |
| BookingCancelled | Cancelled |
| BookingFailed | Failed/missed |
| BookingReviewed | Customer review |
| BookingArchived | Archived |
| BookingAddressChanged | Address updated |
| BookingSnapshotCreated | Snapshot stored |
| BookingPaymentPending / Completed | Payment lifecycle |

No consumers wired in Phase 3.

## Policies

| Policy | Role |
|--------|------|
| BookingCreationPolicy | Runs business rules engine |
| BookingValidationPolicy | Wraps Coverage Engine |
| AssignmentPolicy | Staff role validation |
| SchedulingPolicy | Date/time validation |
| CancellationPolicy | Cancel window rules |
| CompletionPolicy | Proof requirements |
| ReviewPolicy | Rating validation |
| PaymentPolicy | Payment/entitlement check |

## Address Integration

Bookings **never store raw address as the source of truth**. Flow:

```
Booking → addressId → createBookingAddressSnapshot()
  → addressIdentityId + addressSnapshotId + locationContextSnapshot
  → coverageStatus + coverageValidationId + confidenceScore
```

Legacy inline fields (`address`, `area`, `location_lat/lng`) remain for API compatibility but are populated from snapshots when `addressId` is provided.

## Service Discovery

`POST /booking-platform/services/discover` returns:

```json
{
  "services": [
    { "serviceName": "Daily Cleaning", "availability": "AVAILABLE" },
    { "serviceName": "Solar Cleaning", "availability": "AVAILABLE" },
    { "serviceName": "PPF", "availability": "COMING_SOON" },
    { "serviceName": "Bike Wash", "availability": "UNAVAILABLE" }
  ]
}
```

Booking cannot proceed for unavailable services.

## API Endpoints

### Existing (backward compatible)
- All `/bookings/*` endpoints unchanged
- `POST /bookings` now orchestrates via BookingCapability
- `GET /bookings/:id/timeline` — new timeline endpoint

### New Booking Platform APIs
- `GET /booking-platform/address-selection/:customerId`
- `POST /booking-platform/address-selection/validate`
- `POST /booking-platform/services/discover`
- `GET /booking-platform/bookings/:id/context`
- `GET /booking-platform/bookings/:id/timeline`
- `GET /booking-platform/bookings/:id/snapshots`
- `POST /booking-platform/bookings/search`

## Correlation

Every operation flows:
- `traceId` — request trace (from header or generated)
- `requestId` — HTTP request ID
- `bookingOperationId` — unique per booking operation
- `bookingId`, `addressIdentityId`, `addressSnapshotId`, `coverageValidationId`

Through: Policies → Events → Logs → Metrics → Timeline

## Performance

Single execution per request:
- One coverage validation (cached within request)
- One address snapshot creation
- One price snapshot
- Reuses AddressContext / LocationContext / BookingContext

## Database Changes

Migration: `048_booking_platform.sql`

**New columns on `bookings`:**
- `platform_status` (enum)
- `coverage_status`, `coverage_validation_id`, `confidence_score`
- `location_context_snapshot` (JSONB)

**New tables:**
- `booking_timeline` — immutable audit trail
- `booking_snapshots` — typed snapshots

## Extension Interfaces (Phase 4)

Prepared but not implemented:
- AssignmentProvider, PricingProvider, ScheduleProvider, SlotProvider
- PaymentProvider, ReviewProvider, RecommendationProvider
- RouteOptimizationProvider, NotificationProvider, AnalyticsProvider

Register via `bookingExtensionRegistry`.

## Integration Guide for Future Modules

1. Import from `lib/booking/index.ts` only
2. Use `bookingCapability.getBookingContext()` — never raw DB
3. For address: use `addressCapability` / `createBookingAddressSnapshot()`
4. For coverage: use `coverageEngine.validateForBooking()` or pre-validated context
5. Subscribe to `bookingDomainEventPublisher` for reactive workflows
6. Pass `traceId` / `requestId` through all operations

## Remaining Work (Phase 4)

- Job Orchestrator (daily scheduler, auto-assign, due-wash auto-book)
- Wallet hold/debit on confirm/complete
- Full PricingProvider / WorkforceProvider implementation
- Unified execution model (bookings ↔ service_executions sync)
- UI for address selection and service discovery
- Event consumers (notifications, billing, analytics)
- Coupon, holiday, refund rule implementations
- Staff/Vehicle/Coupon snapshot capture
- `assigned` / `accepted` dedicated legacy status values
