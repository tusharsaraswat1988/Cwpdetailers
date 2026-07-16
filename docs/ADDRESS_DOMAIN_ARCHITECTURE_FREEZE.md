# Address Domain — Architecture Freeze (Pre–Phase 3)

**Status:** FROZEN  
**Domain Version:** `AddressDomainV1`  
**Capability Version:** `AddressCapabilityV1`  
**Date:** July 2026

Phase 2 delivered a feature-complete Structured Address Management System. This document records the **final architecture hardening pass** that freezes the Address Domain so future modules (Booking, CRM, Staff App, Franchise, Marketplace, Analytics, Subscriptions, Solar, Car Wash, Detailing, Daily Cleaning) build **on top of** the domain — never inside or around it.

---

## Constraints (unchanged)

| Area | Status |
|------|--------|
| Database schema / migration `047_addresses.sql` | Unchanged |
| Location Intelligence Platform | Unchanged |
| Booking Engine | Unchanged |
| HTTP API routes & response shapes | Unchanged (additive fields only) |
| UI | Unchanged |
| Backward compatibility | Maintained |

All hardening work is **additive** TypeScript architecture inside `artifacts/api-server/src/lib/address/`.

---

## Module Map

```
artifacts/api-server/src/lib/address/
├── capability/
│   └── AddressCapability.ts       ← PUBLIC API for all future modules
├── AddressService.ts              ← @internal implementation (deprecated export)
├── AddressContext.ts              ← Standard cross-module context object
├── AddressSnapshotService.ts
├── versioning.ts
├── correlation/
│   └── AddressTraceContext.ts
├── confidence/
│   └── AddressConfidenceScorer.ts
├── domain/
│   ├── AddressPreparation.ts      ← Single-pass normalize/parse/dedup prep
│   ├── entities.ts                ← Domain entities (not DB rows)
│   └── events/
│       ├── types.ts
│       └── EventPublisher.ts
├── policies/
│   ├── CreateAddressPolicy.ts
│   ├── NormalizationPolicy.ts
│   ├── ValidationPolicy.ts
│   ├── DeduplicationPolicy.ts
│   └── MergePolicy.ts             ← includes SnapshotPolicy
├── search/
│   ├── types.ts                   ← AddressSearchProvider interface
│   └── RepositorySearchProvider.ts
├── extensions/
│   └── interfaces.ts              ← Stubs only — not implemented
├── metrics/
│   └── AddressMetrics.ts
├── repositories/                  ← Internal persistence
├── normalization/, parsing/, deduplication/, migration/
├── index.ts                       ← Public exports
├── address.test.ts
└── address-architecture-freeze.test.ts
```

---

## 1. Address Capability Layer

**Rule:** Future modules MUST import `addressCapability` from `@workspace/api-server` address module (or relative `lib/address`). They MUST NOT import `addressService` or repositories directly.

### Public facade

```typescript
import { addressCapability } from "../lib/address";

await addressCapability.createAddress(input, { traceId, requestId, logger });
await addressCapability.updateAddress(addressId, input, opts);
await addressCapability.getAddress(addressId, opts);
await addressCapability.listAddresses(customerId, opts);
await addressCapability.deleteAddress(addressId, opts);
await addressCapability.restoreAddress(addressId, opts);
await addressCapability.setDefaultAddress(addressId, opts);
await addressCapability.validateAddress(input, opts);
addressCapability.normalizeAddress(input, opts);
addressCapability.previewParsedAddress(input);
await addressCapability.checkDuplicates(input, opts);
await addressCapability.mergeAddresses(input, opts);
await addressCapability.getAddressHistory(addressId);
await addressCapability.searchAddresses(criteria, opts);
```

`AddressService` remains the internal orchestrator (policies + repositories). HTTP routes in `routes/addresses.ts` already delegate to `addressCapability`.

### Additive response fields

Capability methods may attach:

- `addressConfidenceScore` — Address-domain confidence (0–100)
- `addressContext` — Full `AddressContext` object
- `correlation` — Trace context on list responses

Existing Phase 2 response fields are preserved.

---

## 2. Address Context Specification

`AddressContext` is the **single object** future modules should pass and receive instead of scattering identity + address + history objects.

```typescript
type AddressContext = {
  identity: AddressIdentitySummary;
  currentVersion: number;
  currentAddress: AddressRecordSummary;
  verification: { status; source };
  addressConfidenceScore: number;      // Address domain (this freeze)
  locationConfidenceScore?: number;    // Location Intelligence (unchanged)
  isDefault: boolean;
  locationContext?: LocationContext;   // Snapshot from LIP at write time
  history?: AddressHistoryEntity[];
  snapshots?: Array<{ id; version; reason; createdAt }>;
  correlation: AddressTraceContext;
  metadata: { version: "AddressDomainV1"; addressOperationId; ... };
};
```

Build via `buildAddressContext()` or receive from capability responses.

---

## 3. Address Search Architecture

```
AddressCapability.searchAddresses()
        ↓
AddressSearchProvider (interface)
        ↓
RepositoryAddressSearchProvider (default)
        ↓
AddressRepository (internal)
```

### Search criteria (interface-ready)

Supports filtering by: nickname, area, landmark, postalCode (PIN), buildingName, street, locality, houseNumber, addressType, placeId, coordinates + radius, normalizedAddress, customerId, identityId.

### Swapping providers

Register alternate providers on `addressSearchRegistry.repository` without changing capability callers. No Elasticsearch or external engine in this freeze — repository SQL only.

Future: `AddressRankingProvider`, `AddressAutocompleteProvider` via `addressExtensionRegistry`.

---

## 4. Domain Events (publish-only)

Events are published through `addressDomainEventPublisher`. **No consumers** are registered in this freeze — CRM, Notifications, Analytics, and AI subscribe in Phase 3+.

| Event | When |
|-------|------|
| `AddressCreated` | After successful create |
| `AddressUpdated` | After successful update |
| `AddressDeleted` | After soft delete |
| `AddressRestored` | After restore |
| `AddressMerged` | After duplicate merge |
| `AddressSnapshotCreated` | After snapshot (incl. booking snapshots) |
| `DefaultAddressChanged` | After setDefault |
| `AddressValidated` | After LIP validation |
| `AddressNormalized` | After normalize preview |
| `DuplicateAddressDetected` | When duplicates found |

Every event carries: `traceId`, `requestId`, `addressOperationId`, `identityId`, `addressId`, `customerId`, `version: AddressDomainV1`.

Subscribe:

```typescript
import { addressDomainEventPublisher } from "../lib/address";

addressDomainEventPublisher.subscribe((event) => { /* Phase 3+ */ });
```

---

## 5. Policies

Business rules are encapsulated in policy objects executed by `AddressService`. Policies share a single `PreparedAddress` via `AddressPolicyContext` to avoid duplicate work.

| Policy | Responsibility |
|--------|----------------|
| `CreateAddressPolicy` | Create identity + address + history |
| `UpdateAddressPolicy` | Version bump + history |
| `NormalizationPolicy` | Parse/normalize preview |
| `ValidationPolicy` | Location Intelligence serviceability check |
| `DeduplicationPolicy` | Fingerprint + proximity duplicate detection |
| `MergePolicy` | Merge identities |
| `SnapshotPolicy` | Snapshot creation rules |

---

## 6. Address Confidence Score

**Separate from Location Intelligence confidence.** Computed at runtime — not stored in DB.

| Score | Meaning |
|-------|---------|
| 100 | Google verified + GPS + parsed fields |
| 90 | Google verified or GPS verified |
| 70 | Manual / user entered |
| 50 | Imported (non-legacy) |
| 25 | Legacy migrated import |
| 0 | Unknown |

Functions: `calculateAddressConfidence()`, `calculateAddressConfidenceFromPrepared()`.

---

## 7. Extension Interfaces (prepared, not implemented)

Registered on `addressExtensionRegistry`:

- `AddressFormatter`
- `AddressExporter`
- `AddressImporter`
- `AddressVerifier`
- `AddressSearchProvider` (also on `addressSearchRegistry`)
- `AddressRankingProvider`
- `AddressRecommendationProvider`
- `AddressAutocompleteProvider`

---

## 8. Versioning

```typescript
ADDRESS_DOMAIN_VERSION = "AddressDomainV1"
ADDRESS_CAPABILITY_VERSION = "AddressCapabilityV1"
```

Future `AddressDomainV2` / `AddressCapabilityV2` can coexist. V1 is never replaced — new capability classes or versioned facades wrap V1.

---

## 9. Repository Layer

Repositories remain internal. Domain mapping helpers in `domain/entities.ts`:

- `toIdentityEntity()`
- `toAddressRecordEntity()`
- `toAddressDomainEntity()`

Business logic receives `AddressDomainEntity` / `AddressContext`, not raw Drizzle rows. Full repository return-type migration is incremental; mapping utilities are frozen and ready.

---

## 10. Performance — Single-Pass Preparation

`prepareAddress()` runs **once** per operation:

1. Merge Google components
2. Normalize fields
3. Build formatted address + normalized key
4. Infer source + verification
5. Build fingerprint

Policies receive `prepared` on context — no duplicate normalization, parsing, deduplication fingerprinting, or redundant LIP calls within a single request.

---

## 11. Metrics & Structured Logging

`emitAddressMetrics()` writes structured Pino logs:

| Operation key | Metrics |
|---------------|---------|
| `create`, `update`, `delete`, `restore` | success, durationMs, confidence scores |
| `validate` | success, locationConfidenceScore, failureReason |
| `normalize` | success |
| `deduplication` | duplicateCount |
| `merge` | success, durationMs |
| `snapshot` | success |
| `search` | success, durationMs |

Payload includes full correlation IDs.

---

## 12. Correlation

`AddressTraceContext`:

- `traceId` — from `X-Trace-Id` header or generated UUID
- `requestId` — defaults to traceId
- `addressOperationId` — unique per address operation
- `identityId`, `addressId`, `customerId` — populated as known

Flows through: capability → service → policies → events → metrics → history metadata.

HTTP routes pass trace from request headers via `resolveAddressTraceId()`.

---

## 13. Test Report

```
pnpm --filter @workspace/api-server run test:address
```

| Suite | Tests | Status |
|-------|-------|--------|
| `address.test.ts` (Phase 2) | 10 | PASS |
| `address-architecture-freeze.test.ts` | 11 | PASS |
| **Total Address** | **21** | **PASS** |

Freeze test coverage:

- Address Confidence (4 cases)
- AddressContext construction
- Domain event publisher
- Policies (normalization + policy names)
- Version markers
- Domain entity mapping
- prepareAddress idempotency

Location Intelligence regression:

```
pnpm --filter @workspace/api-server run test:coverage
→ 30 tests PASS (platform unchanged)
```

Build:

```
pnpm --filter @workspace/api-server run build → PASS
```

---

## 14. Integration Guide for Future Modules

### DO

```typescript
import {
  addressCapability,
  buildAddressContext,
  type AddressContext,
  type AddressSearchCriteria,
  addressDomainEventPublisher,
  ADDRESS_DOMAIN_VERSION,
} from "../lib/address";

// Create with trace propagation
const result = await addressCapability.createAddress(input, {
  traceId: req.headers["x-trace-id"],
  requestId: req.id,
  logger: req.log,
});

// Use context in booking/CRM
const ctx: AddressContext = result.addressContext;

// Search
const hits = await addressCapability.searchAddresses({ customerId, nickname: "Home" });

// Subscribe to events (Phase 3+)
addressDomainEventPublisher.subscribe(handler);
```

### DO NOT

```typescript
// ❌ Bypass capability
import { addressService } from "../lib/address/AddressService";
import { addressRepository } from "../lib/address/repositories/AddressRepository";
```

### Booking integration (Phase 3)

Use `createBookingAddressSnapshot()` from `AddressSnapshotService` — already publishes `AddressSnapshotCreated` via capability.

---

## Files Modified (this freeze)

| File | Change |
|------|--------|
| `capability/AddressCapability.ts` | New — public facade |
| `AddressContext.ts` | New |
| `versioning.ts` | New |
| `correlation/AddressTraceContext.ts` | New |
| `confidence/AddressConfidenceScorer.ts` | New |
| `domain/AddressPreparation.ts` | New |
| `domain/entities.ts` | New |
| `domain/events/*` | New |
| `policies/*` | New |
| `search/*` | New |
| `extensions/interfaces.ts` | New |
| `metrics/AddressMetrics.ts` | New |
| `AddressService.ts` | Refactored to use policies + prepareAddress |
| `AddressSnapshotService.ts` | Publishes snapshot events |
| `migration/LegacyAddressMigrator.ts` | Legacy confidence flag |
| `routes/addresses.ts` | Delegates to addressCapability |
| `index.ts` | Public exports + deprecations |
| `address-architecture-freeze.test.ts` | New |
| `package.json` | Restored `migrate:legacy-addresses` script |

**Not modified:** DB schema, migrations, LIP, booking engine, UI.

---

## Remaining Work for Phase 3

Phase 3 builds **on** this frozen domain. No further architectural redesign of Address Domain is expected.

1. **Booking wire-up** — Attach `address_snapshot_id` / `address_identity_id` on booking create/update flows via `createBookingAddressSnapshot()`.
2. **Event consumers** — Notifications, CRM timeline, Analytics pipelines subscribe to `addressDomainEventPublisher`.
3. **UI** — Customer/admin address forms consume existing REST APIs (additive context fields optional).
4. **Extension implementations** — Autocomplete (Google), ranking, recommendations as needed per module.
5. **Search provider upgrade** — Optional external index behind `AddressSearchProvider` without changing capability API.
6. **Repository return types** — Incrementally return `AddressDomainEntity` from repository methods (helpers already exist).
7. **Staff / Franchise / Marketplace** — Import `addressCapability` only; pass `AddressContext` across service boundaries.

---

## Architecture Freeze Declaration

After this implementation:

- The Address Domain schema, APIs, and UI contracts are **frozen**.
- All new platform modules MUST use `AddressCapability` and `AddressContext`.
- Architectural changes to Address Domain require explicit platform review — equivalent to a major version bump (`AddressDomainV2`).

**Phase 3 may begin.**
