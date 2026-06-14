# Sprint 3 Completion Report

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Sprint:** 3 — Assets Foundation  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 3, founder Sprint 3 authorization  

**Status:** Complete — awaiting Sprint 3 review gate (do not start Sprint 4A)  

---

## 1. Objective

Establish a **future-proof Assets foundation** (not a vehicle-only module):

```
Assets
├ Vehicles
├ Solar Sites
└ Future asset types (registry extensible via asset_type enum)
```

With mandatory **Customer → Service Location → Asset** chain, ownership history, and backward-compatible dual-read.

---

## 2. Database changes

| Artifact | Action |
|----------|--------|
| `lib/db/src/schema/assets.ts` | **NEW** |
| `lib/db/migrations/030_assets.sql` | **NEW** — tables + backfill |
| `assets` | Unified registry: `asset_type`, `vehicle_id`, `solar_site_id`, `label`, `status`, `notes` |
| `location_asset_links` | Placement at service location with `effective_from` / `effective_until` |
| `customer_asset_links` | Ownership history: `link_type` (operational, commercial, historical), effective dates |
| `solar_sites` | Added `site_name`, `notes` (additive) |
| `vehicles` | **Unchanged columns** — `customer_id` retained for dual-read |

**Backfill (030):** Existing vehicles and solar sites registered in `assets` with default customer location placement and commercial ownership links.

---

## 3. API changes

| Endpoint | Purpose |
|----------|---------|
| `GET /api/assets` | Unified list (`customerId`, `assetType`, `serviceLocationId` filters) |
| `POST /api/assets` | Create vehicle or solar_site asset (requires `serviceLocationId`) |
| `GET /api/assets/:id` | Detail + typed payload + link histories |
| `PATCH /api/assets/:id` | Update registry + typed fields (vehicle/solar) |
| `GET/POST /api/assets/:id/location-links` | Placement history + transfer (closes prior link) |
| `GET/POST /api/assets/:id/customer-links` | Ownership history + transfer (closes prior link, dual-read FK sync) |

**Legacy routes (dual-read):**

| Route | Change |
|-------|--------|
| `POST /api/vehicles` | After insert → `registerVehicleAsset()` (uses default or explicit `serviceLocationId`) |
| `POST /api/solar-sites` | After insert → `registerSolarAsset()`; relaxed `siteName`/`panelCapacityKw` defaults for compat |
| `GET /api/vehicles`, `GET /api/solar-sites` | **Unchanged** — still filter by `customerId` on legacy FK |

**Libraries:**

- `lib/assets/assetService.ts` — create, register, transfer, list, detail
- `lib/assets/featureFlag.ts` — `ENABLE_ASSETS_MODULE` (default **on**)

---

## 4. UI changes

| Screen | Route | File |
|--------|-------|------|
| Assets directory | `/admin/assets` | `AssetsPage.tsx` |
| Asset detail | `/admin/assets/:id` | `AssetDetail.tsx` |
| Vehicle / Solar forms | — | `features/assets/components/AssetForms.tsx` |
| API client | — | `features/assets/api.ts` |

**Navigation:** **Assets** added to Operations sidebar (after Service Locations).

**Customer 360:**

- **Vehicles tab removed** → **Assets tab** (read-only `CustomerLinkedAssetsPanel`)
- No create/edit/delete in Customer module
- Deep links to `/admin/assets/:id`

**AddCustomerServiceWizard:**

- Inline solar site creation **removed** — select existing site only; link to Assets module for new sites

**Not changed (per scope):**

- Book Services wizard shell (Sprint 4A)
- Billing / Customer 360 billing redesign (Sprint 5)
- Services tab in Customer 360 (unchanged)

---

## 5. Migration details

1. Apply **`030_assets.sql`** after `029_service_locations.sql`.
2. Backfill creates `assets` row per vehicle/solar site.
3. Placement uses customer **default service location** (creates Primary if missing).
4. Commercial ownership link seeded from legacy `customer_id`.
5. No hard-delete of ownership rows — history append-only via `effective_until`.

---

## 6. Backward compatibility

| Concern | Strategy |
|---------|----------|
| Existing reports using `vehicles.customer_id` | FK **still written** on create + updated on ownership transfer |
| `GET /api/vehicles?customerId=` | Unchanged |
| Legacy solar create API | Still works; auto-registers asset when module enabled |
| Orphan assets | Prevented on `/api/assets` POST (requires `serviceLocationId`) |
| Feature flag off | `ENABLE_ASSETS_MODULE=false` → assets API 503; legacy vehicle/solar routes unchanged |

---

## 7. Rollback plan

1. Set `ENABLE_ASSETS_MODULE=false`.
2. Revert admin nav + routes + Customer 360 Assets tab if needed.
3. Legacy `vehicles` / `solar_sites` tables and APIs continue to function.
4. Link tables can remain pre-production; drop only if no downstream Sprint 4 FKs.

---

## 8. Acceptance criteria

| Criterion | Status |
|-----------|--------|
| `/admin/assets` exists | ✅ |
| Vehicle CRUD inside Assets | ✅ |
| Solar Site CRUD inside Assets | ✅ |
| Asset always linked to Service Location (new creates) | ✅ |
| Ownership history preserved (`effectiveFrom` / `effectiveUntil`) | ✅ |
| Customer 360 linked assets read-only | ✅ |
| Legacy vehicle relationships continue working | ✅ |
| No Book Services functionality | ✅ |
| No Billing functionality | ✅ |
| No Customer 360 redesign beyond linked assets | ✅ |

---

## 9. Architecture conflicts

**None identified.** Implementation follows approved link-history model in `DATA_RELATIONSHIP_V1.md` and founder rules (Customer → Service Location → Asset, no direct Customer → Asset CRUD).

---

## 10. Files summary

**New**

- `lib/db/src/schema/assets.ts`
- `lib/db/migrations/030_assets.sql`
- `artifacts/api-server/src/lib/assets/*`
- `artifacts/api-server/src/routes/assets.ts`
- `artifacts/cwp-platform/src/features/assets/*`
- `artifacts/cwp-platform/src/pages/admin/AssetsPage.tsx`
- `artifacts/cwp-platform/src/pages/admin/AssetDetail.tsx`
- `artifacts/cwp-platform/src/features/customers/components/CustomerLinkedAssetsPanel.tsx`
- `docs/SPRINT_3_COMPLETION_REPORT.md`

**Modified**

- `lib/db/src/schema/solar-sites.ts`, `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/routes/index.ts`, `vehicles.ts`, `solar-sites.ts`
- `artifacts/cwp-platform/src/App.tsx`, `adminNavConfig.ts`
- `artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx`
- `artifacts/cwp-platform/src/features/customers/components/AddCustomerServiceWizard.tsx`
- `docs/IMPLEMENTATION_SEQUENCE_V1.md`

---

## 11. Deploy notes

1. Run migration **030** on staging/production DB.
2. Optional: `ENABLE_ASSETS_MODULE=true` (default when unset).
3. Verify backfill: each legacy vehicle has `assets` row + location + customer links.

---

## 12. Recommended test plan

1. Admin → **Assets** → create vehicle (customer ID + service location + reg no).
2. Create solar site (site name + capacity + service location).
3. Asset detail → transfer customer → verify old link has `effectiveUntil`, new link open.
4. Asset detail → move location → verify placement history.
5. Customer 360 → **Assets** tab read-only; no add button.
6. `GET /api/vehicles?customerId=` still returns legacy rows.
7. Add Customer Service wizard → solar path only allows existing sites.

---

**Sprint 4A not started.** Await Sprint 3 review and approval gate.

---

*Generated at Sprint 3 completion per founder authorization.*
