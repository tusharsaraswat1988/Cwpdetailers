# Structured Address Management System — Phase 2

**Status:** Complete  
**Builds on:** [Location Intelligence Platform](./LOCATION_INTELLIGENCE_PLATFORM.md) (frozen — not modified)

---

## Overview

Phase 2 introduces a unified **Address Domain** with:

- **Address Identity** — stable physical-location identifier (survives renames/edits)
- **Address** — current editable record (versioned)
- **Address History** — previous versions preserved
- **Address Snapshots** — immutable copies for bookings/contracts
- **Legacy Links** — maps old tables without data loss

All validation flows through the **Location Intelligence Platform** via `locationIntelligencePlatform.validateCoverage()` — the Address domain never reimplements coverage logic.

---

## ER Diagram

```mermaid
erDiagram
  CUSTOMERS ||--o{ ADDRESS_IDENTITIES : owns
  ADDRESS_IDENTITIES ||--o{ ADDRESSES : "current + historical rows"
  ADDRESS_IDENTITIES ||--o{ ADDRESS_HISTORY : versions
  ADDRESS_IDENTITIES ||--o{ ADDRESS_SNAPSHOTS : frozen
  ADDRESSES ||--o{ ADDRESS_LEGACY_LINKS : maps
  BOOKINGS }o--o| ADDRESS_SNAPSHOTS : "optional anchor"
  BOOKINGS }o--o| ADDRESS_IDENTITIES : "optional anchor"
  CITIES ||--o{ ADDRESSES : city_id
  STATES ||--o{ ADDRESSES : state_id

  ADDRESS_IDENTITIES {
    int id PK
    int customer_id FK
    text canonical_place_id
    float canonical_latitude
    float canonical_longitude
    text fingerprint
    enum status
  }

  ADDRESSES {
    int id PK
    int identity_id FK
    int customer_id FK
    int version
    text nickname
    enum address_type
    text formatted_address
    jsonb address_components
    text postal_code
    float latitude
    float longitude
    text place_id
    boolean is_default
    enum verification_status
    enum source
    int confidence_score
    jsonb location_context_snapshot
    boolean is_current
    timestamp deleted_at
  }

  ADDRESS_HISTORY {
    int id PK
    int identity_id FK
    int address_id
    int version
    jsonb snapshot
    timestamp superseded_at
  }

  ADDRESS_SNAPSHOTS {
    int id PK
    int identity_id FK
    int address_id
    jsonb snapshot
    jsonb location_context
    enum snapshot_reason
  }
```

---

## Address Identity vs Address

| Concept | Purpose |
|---------|---------|
| **Address Identity** | Permanent ID for a physical location. Used by deduplication, analytics, booking anchors. |
| **Address** | User-facing editable record (nickname, instructions, etc.). Version increments on edit. |
| **Address History** | Full JSON snapshot of each superseded version. |
| **Address Snapshot** | Immutable point-in-time copy + `LocationContext` for bookings. |

When a customer renames "Home" → "New Home" or fixes a landmark, **identityId stays the same**; version increments; history preserves the old state.

---

## Address Types

`HOME`, `WORK`, `OTHER`, `FAMILY`, `OFFICE`, `SITE`, `WAREHOUSE`, `FACTORY`

## Verification Status

`UNKNOWN`, `GOOGLE_VERIFIED`, `GPS_VERIFIED`, `USER_ENTERED`, `ADMIN_VERIFIED`

## Source

`GOOGLE`, `GPS`, `MANUAL`, `IMPORTED`, `ADMIN`, `API`

---

## Lifecycle

```
Create → [Validate via Location Intelligence] → Store Identity + Address v1
Update → History append → Mark old not current → Address v(n+1)
Soft Delete → deleted_at set
Restore → deleted_at cleared
Archive → archived_at set
Set Default → clears other defaults for customer
Merge Duplicates → identities marked MERGED into keeper
Snapshot → immutable copy + LocationContext
```

---

## Normalization

`AddressNormalizer` applies:

- Unicode NFKC normalization
- Whitespace collapse
- Duplicate comma removal
- Title-case for long uppercase tokens
- PIN whitespace strip

Produces `normalizedAddress` key used for deduplication fingerprints.

---

## Deduplication

Three signals (in priority order):

1. **placeId** match
2. **fingerprint** match (SHA-256 of placeId OR normalized address + rounded coordinates)
3. **proximity** — same normalized key within **50m** (configurable)

Create returns **409** with `duplicates[]` unless `allowDuplicate: true`.

---

## Google Component Persistence

`GoogleComponentMapper` extracts and persists:

- houseNumber, buildingName, street, landmark
- area, locality, subLocality, district
- state, country, postalCode, plusCode
- Full `addressComponents` JSON array

Nothing from Google is discarded.

---

## Module Layout

```
artifacts/api-server/src/lib/address/
├── AddressService.ts              Domain service + lifecycle
├── AddressSnapshotService.ts      Booking-ready snapshots
├── types.ts
├── normalization/
├── parsing/
├── deduplication/
├── repositories/
├── migration/
└── index.ts

artifacts/api-server/src/routes/addresses.ts   REST API

lib/db/src/schema/addresses.ts                 Drizzle schema
lib/db/migrations/047_addresses.sql            SQL migration
```

---

## API Reference

Base path: `/api/addresses` (customer resource guard)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/addresses` | Create address (validates via Location Intelligence by default) |
| GET | `/addresses?customerId=` | List addresses |
| GET | `/addresses/:id` | Get address |
| PATCH | `/addresses/:id` | Update (creates new version + history) |
| DELETE | `/addresses/:id` | Soft delete |
| POST | `/addresses/:id/restore` | Restore soft-deleted |
| POST | `/addresses/:id/default` | Set as default |
| POST | `/addresses/:id/snapshot` | Create immutable snapshot |
| GET | `/addresses/:id/history` | Version history by identity |
| POST | `/addresses/validate` | Coverage validation only |
| POST | `/addresses/normalize` | Normalize without save |
| POST | `/addresses/preview-parse` | Parse Google components preview |
| POST | `/addresses/check-duplicates` | Duplicate detection |
| POST | `/addresses/merge-duplicates` | Merge identity IDs |
| POST | `/addresses/migrate-legacy` | Admin: migrate legacy data |

### Create Example

```json
POST /api/addresses
{
  "customerId": 1,
  "nickname": "Home",
  "addressType": "HOME",
  "formattedAddress": "12 MG Road, Varanasi 221005",
  "latitude": 25.3176,
  "longitude": 82.9739,
  "placeId": "ChIJ...",
  "addressComponents": [...],
  "isDefault": true
}
```

Response includes `identityId`, `confidenceScore`, `locationContext`.

---

## Migration

### 1. Apply schema

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cwp
pnpm --filter @workspace/scripts run migrate:pending
```

### 2. Migrate legacy data

```bash
pnpm --filter @workspace/scripts run migrate:legacy-addresses
# or admin API: POST /api/addresses/migrate-legacy
```

### Sources migrated

| Legacy Table | Link Table | Notes |
|--------------|------------|-------|
| `customers.address` | `address_legacy_links` | Primary nickname |
| `saved_locations` | `address_legacy_links` | Preserves label, coords, placeId |
| `service_locations` | via `customer_location_links` | Maps location type |
| `vehicles.service_address` | `address_legacy_links` | Per-vehicle |
| `solar_sites.address` | `address_legacy_links` | Per-site |

Legacy tables **remain untouched**. Existing APIs continue working.

### Migration report shape

```json
{
  "customers": { "migrated": 120, "skipped": 5, "errors": 0 },
  "savedLocations": { "migrated": 45, "skipped": 2, "errors": 0 },
  ...
}
```

---

## Backward Compatibility

| Component | Status |
|-----------|--------|
| `saved_locations` API | Unchanged |
| `customers.address` field | Unchanged |
| `service_locations` API | Unchanged |
| Booking address columns | Unchanged (optional `address_snapshot_id` added) |
| Location Intelligence Platform | **Not modified** |

Bookings can optionally use `createBookingAddressSnapshot(addressId)` to populate new anchor columns without changing existing snapshot fields.

---

## Database Indexes

- `address_identities`: customer_id, fingerprint, canonical_place_id
- `addresses`: customer_id, identity_id, postal_code, place_id, city_id, is_default, verification_status, normalized_address, (latitude, longitude)
- `address_history`: identity_id, customer_id, address_id
- `address_snapshots`: identity_id, customer_id, address_id
- `bookings`: address_snapshot_id, address_identity_id (additive)
- Partial unique: one current address per identity (`WHERE is_current AND deleted_at IS NULL`)

---

## Testing

```bash
pnpm --filter @workspace/api-server run test:address
pnpm --filter @workspace/api-server run test:coverage   # Location Intelligence unchanged
pnpm --filter @workspace/api-server run build
```

Tests cover: normalization, Google parsing, deduplication, fingerprinting, distance calculation.

---

## Performance Considerations

- Deduplication index loaded per customer (not global scan)
- Normalization is in-memory (no external calls)
- Coverage validation delegated to cached Location Intelligence pipeline
- Snapshots store precomputed `LocationContext` to avoid re-validation on repeat reads
- Partial unique index keeps current-address lookups O(1) per identity
- Legacy migration is idempotent (skips already-linked rows)

---

## Remaining Work for Phase 3

| Item | Phase |
|------|-------|
| Wire booking creation to auto-create snapshots from `addressId` | Phase 3 |
| UI address picker → new Address API | Phase 3 |
| Deprecate `saved_locations` reads (dual-read period) | Phase 3 |
| Branch / Franchise resolution | Phase 3 |
| Dynamic pricing by location | Phase 3 |
| Redis-backed address cache | Phase 3+ |

---

## Related Docs

- [Location Intelligence Platform](./LOCATION_INTELLIGENCE_PLATFORM.md)
- [Address Audit (Phase 0)](./ADDRESS_GOOGLE_MAPS_BOOKING_AUDIT_REPORT.md)
