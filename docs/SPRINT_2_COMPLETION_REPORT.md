# Sprint 2 Completion Report

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Sprint:** 2 — Service Locations  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Sequence:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 2  

**Status:** Complete — ready for Sprint 3 review gate  

---

## 1. Objective (as scoped)

Introduce **Service Locations** as a core entity with customer links and **auto-created default location** on customer create — without Assets, Book Services, or Customer 360 redesign.

---

## 2. Deliverables

### 2.1 Database

| Artifact | Action |
|----------|--------|
| `lib/db/src/schema/service-locations.ts` | **NEW** — Drizzle schema |
| `lib/db/migrations/029_service_locations.sql` | **NEW** — tables + backfill |
| `service_locations` | Location master: label, address, geo, type, status, `is_auto_created`, tenant cols |
| `customer_location_links` | Customer ↔ location with `is_default`, `effective_from`, `effective_until` |

**Backfill:** Migration `029` creates a **Primary** default location (from customer profile address) for every existing customer missing a default link.

### 2.2 API (`artifacts/api-server`)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/service-locations` | List (optional `customerId`, `search`, `status`) |
| `POST /api/service-locations` | Create location (+ optional initial customer link) |
| `GET /api/service-locations/:id` | Detail with customer links |
| `PATCH /api/service-locations/:id` | Update location fields |
| `GET /api/service-locations/:id/customer-links` | List links |
| `POST /api/service-locations/:id/customer-links` | Link customer (effective dates, default flag) |
| `DELETE /api/service-locations/:id/customer-links?customerId=` | Unlink |

**Side effects:**

| Path | Change |
|------|--------|
| `POST /api/customers` | Calls `ensureDefaultServiceLocation()` after insert |
| `POST /api/migration/customers/import` | Backfills default location per imported/updated customer |

**Libraries:**

- `lib/serviceLocations/defaultLocationService.ts` — idempotent Primary location creation
- `lib/serviceLocations/featureFlag.ts` — `ENABLE_SERVICE_LOCATIONS` (default **on**)

**Routing:** `service-locations.ts` registered under `guardResource("customers")` in `routes/index.ts`.

### 2.3 Admin UI (`artifacts/cwp-platform`)

| Screen | Route | File |
|--------|-------|------|
| Locations directory | `/admin/service-locations` | `ServiceLocationsPage.tsx` |
| Location detail + links | `/admin/service-locations/:id` | `ServiceLocationDetail.tsx` |
| Shared form | — | `ServiceLocationForm.tsx` |
| API client | — | `features/service-locations/api.ts` |

**Navigation:** **Service Locations** added to Operations sidebar (`adminNavConfig.ts`).

**Customer 360:** Read-only **Locations** tab via `CustomerServiceLocationsPanel.tsx` — no CRUD in Customer module.

**Migration UI:** Import result shows `locationsCreated` count.

### 2.4 Intentionally not implemented (per instruction)

| Item | Sprint |
|------|--------|
| Assets module | Sprint 3 |
| Book Services wizard / contract persistence | Sprint 4A–4C |
| Customer 360 billing/services redesign | Sprint 5 |
| `bookings.serviceLocationId` column | Sprint 4B |
| `location_asset_links` | Sprint 3 |

---

## 3. Acceptance criteria

| Criterion | Status |
|-----------|--------|
| CRUD service locations in admin | ✅ |
| Link/unlink location to customer with effective dates | ✅ |
| New customer auto-gets `Primary` default (`isDefault: true`) | ✅ |
| Migrated/imported customers backfilled | ✅ (SQL migration + import engine) |
| `isAutoCreated` flag distinguishable | ✅ (DB + UI badge) |
| Book Services can list locations by `customerId` (API ready) | ✅ `GET /api/service-locations?customerId=` |

---

## 4. Backward compatibility

- Existing `customers.address` / `city` unchanged — still source for auto-created Primary location.
- Existing `saved_locations` table untouched (separate doorstep/customer-app concern).
- No changes to bookings, vehicles, solar sites, or DCMS contracts.
- Feature flag `ENABLE_SERVICE_LOCATIONS=false` disables API module (503) and skips default-location side effects.
- Legacy customer create flows (`QuickCreateCustomerForm`, admin customer forms) benefit from server-side default location — no client change required.

---

## 5. Rollback

1. Set `ENABLE_SERVICE_LOCATIONS=false` on API server.
2. Hide Service Locations nav (revert `adminNavConfig.ts` + routes) if needed.
3. Tables can remain in place pre-production; drop only if zero dependent links (Sprint 4+ may add FKs later).

---

## 6. Deploy notes

1. Apply migration **`029_service_locations.sql`** before deploying API.
2. Optional env: `ENABLE_SERVICE_LOCATIONS=true` (default when unset).
3. No OpenAPI codegen update in this sprint — frontend uses dedicated fetch client in `features/service-locations/api.ts`.

---

## 7. Architecture conflicts

**None identified.** Implementation matches `FINAL_ARCHITECTURE_SIGNOFF.md` and `DATA_RELATIONSHIP_V1.md` §4.2.

---

## 8. Files changed (summary)

**New**

- `lib/db/src/schema/service-locations.ts`
- `lib/db/migrations/029_service_locations.sql`
- `artifacts/api-server/src/lib/serviceLocations/*`
- `artifacts/api-server/src/routes/service-locations.ts`
- `artifacts/cwp-platform/src/features/service-locations/*`
- `artifacts/cwp-platform/src/pages/admin/ServiceLocationsPage.tsx`
- `artifacts/cwp-platform/src/pages/admin/ServiceLocationDetail.tsx`
- `artifacts/cwp-platform/src/features/customers/components/CustomerServiceLocationsPanel.tsx`
- `docs/SPRINT_2_COMPLETION_REPORT.md`

**Modified**

- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/customers.ts`
- `artifacts/api-server/src/lib/migration/legacyImportEngine.ts`
- `artifacts/api-server/src/lib/migration/types.ts`
- `artifacts/cwp-platform/src/App.tsx`
- `artifacts/cwp-platform/src/components/layout/adminNavConfig.ts`
- `artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx`
- `artifacts/cwp-platform/src/pages/admin/CustomerMigration.tsx`
- `docs/IMPLEMENTATION_SEQUENCE_V1.md`

---

## 9. Recommended test plan (manual)

1. Apply migration 029 on staging DB.
2. Admin → **Service Locations** — create site, edit, link/unlink customer with dates.
3. Create new customer — verify Primary location appears in Customer 360 **Locations** tab.
4. Customer import — verify `locationsCreated` in result.
5. `GET /api/service-locations?customerId={id}` returns linked rows with `isDefault`.
6. Set `ENABLE_SERVICE_LOCATIONS=false` — API returns 503; new customers still create without error (warn log only).

---

## 10. Next sprint

**Sprint 3 — Assets** per `IMPLEMENTATION_SEQUENCE_V1.md`. Do not start until this report is reviewed.

---

*Generated at Sprint 2 completion. No architecture changes beyond approved Service Locations scope.*
