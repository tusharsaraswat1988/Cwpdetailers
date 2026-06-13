# Legacy Customer Migration Toolkit — Implementation Plan

**Status:** Plan — implementation not started  
**Prerequisites:** Service Catalog Engine **complete and verified** (`SERVICE_CATALOG_FIX_VERIFICATION.md`, `verify:catalog` 25/25)  
**Prerequisite:** Staff Ecosystem Phase A **complete**  
**Type:** Migration tooling only — **no catalog architecture or pricing redesign**  
**Estimated effort:** 8–12 dev days (1 developer, including QA on pilot sample)

---

## Goal

Migrate existing CWP legacy customers into the new platform with **minimal manual work**, using a repeatable Excel-based import pipeline that:

1. Creates customers who can **log in immediately** after import  
2. Imports vehicles, solar sites, and active contracts  
3. Creates **proper `customer_entitlements`** via the verified entitlement engine (not ad-hoc credit fields)  
4. Supports **validation preview**, **dry-run**, and **actual import** with full error reporting  

---

## Success Definition

1. Admin downloads a multi-sheet Excel template with field instructions and catalog lookup values.  
2. Admin uploads a filled workbook → sees row-level validation preview (errors + warnings) before any DB write.  
3. **Dry-run** simulates the full import in a transaction and rolls back — returns counts and per-row outcomes.  
4. **Import** commits customers, login accounts, assets, subscriptions, and entitlements in dependency order.  
5. Imported customer with active **4 Wash Package** (2 of 4 used) has `remainingCredits: 2` and passes self-booking check.  
6. Imported daily-cleaning customer has active `daily_wash` subscription + wallet balance; scheduler can generate bookings.  
7. Imported solar AMC customer has `solar_amc` subscription + `solar_visit` entitlements with correct remaining visits.  
8. Re-uploading the same `legacy_customer_id` is **idempotent** (update or skip, never duplicate phone).  
9. `pnpm --filter @workspace/scripts run verify:migration` passes on a golden sample file.

---

## What Already Exists (Do Not Rebuild)

| Layer | Verified assets to reuse |
|-------|--------------------------|
| **Customers** | `customers` + `users` (phone login, `customerId` link) — same pattern as `scripts/src/seed.ts` |
| **Vehicles** | `vehicles` with `locationComplete`, `vehicleModelId`, `registrationNumber` unique per customer scope |
| **Solar** | `solar_sites` with `panelCount`, geo fields |
| **Daily cleaning** | `subscriptions` type `daily_wash` + wallet debit via `artifacts/api-server/src/subscriptions/dailyScheduler.ts` |
| **Solar AMC (legacy sub)** | `subscriptions` type `solar_amc` with `totalServices` / `servicesRemaining` |
| **Packages (catalog)** | `catalog_packages` + `catalog_package_entitlements` seeded in Varanasi (`seed:catalog`) |
| **Runtime credits** | `customer_entitlements` via `grantPackageEntitlements()` / `grantEntitlement()` in `entitlementEngine.ts` |
| **Booking consumption** | `consumeEntitlementOnCompletion()` on booking complete — already wired |
| **Catalog slugs** | `4-wash-package`, `12-month-solar-amc-package`, `6-month-solar-amc-package`, `daily-cleaning-2-washes`, etc. |

**Frozen:** No changes to pricing engine, catalog schema, package definitions, or entitlement consumption rules beyond **additive** migration helpers (see LM-4).

---

## Import Entities → Platform Mapping

### 1. Customers (+ login)

| Legacy source | Target tables | Notes |
|---------------|---------------|-------|
| Name, phone, email, address, city, branch | `customers` | Phone normalized 10-digit Indian mobile |
| Initial password (or generated) | `users` | `role: customer`, `passwordHash`, `customerId` bidirectional link |
| Wallet balance, dues | `customers.walletBalance`, `customers.totalDues` | Optional; default 0 |
| `legacy_customer_id` | `migration_entity_map` | Idempotency key |

**Login rule:** Every imported row with `create_login = Y` gets a `users` row. Default password = `temporaryPassword` column or auto-generated 8-char; force reset flag optional (future).

### 2. Vehicles

| Column | Target | Validation |
|--------|--------|------------|
| `legacy_customer_id` | FK via map | Must exist in Customers sheet or same batch |
| `registration_number` | `vehicles.registrationNumber` | Unique per customer |
| `make`, `model`, `year`, `color`, `vehicle_type` | Direct | `vehicle_type` ∈ enum |
| `vehicle_model_slug` (optional) | `vehicles.vehicleModelId` | Resolve via `vehicle_models.slug` |
| Service address + lat/lng | `serviceAddress`, `serviceLat`, `serviceLng`, `locationComplete` | Required for booking eligibility |
| `assigned_staff_phone` (optional) | `assignedStaffId` | Resolve staff by phone |

### 3. Solar sites

| Column | Target | Validation |
|--------|--------|------------|
| `legacy_customer_id` | FK via map | Required |
| `address`, `city`, `panel_count` | Direct | `panel_count` > 0 |
| Lat/lng, place_id | Geo fields | Recommended |
| `last_cleaned_date`, `next_service_date` | Direct | ISO date |

### 4. Active car wash packages (credit packs)

**Not** legacy `subscriptions` alone — must create **catalog entitlements**.

| Legacy field | Platform action |
|--------------|-----------------|
| `package_slug` (e.g. `4-wash-package`) | Resolve `catalog_packages.id` by slug + city |
| `valid_from`, `valid_until` | Pass to entitlement grant |
| `total_credits`, `used_credits` | Grant with remaining = total − used |
| `legacy_contract_id` | Stored in `migration_entity_map` + entitlement `notes` |

**Engine call (after LM-4 extension):**

```ts
await grantPackageEntitlementsWithBalance(customerId, packageId, {
  cityId,
  validFrom,
  validUntil,
  usedCredits,  // optional override per entitlement line
});
```

Fallback: map known legacy product names → catalog `package_slug` via `MIGRATION_PACKAGE_MAP` constant (no new catalog packages).

### 5. Active solar AMC

Dual write (subscription + entitlements):

| Step | Target |
|------|--------|
| A | `subscriptions` row: `type: solar_amc`, `solarSiteId`, `serviceId` (one-time-solar-cleaning), dates, `totalServices`, `servicesUsed`, `servicesRemaining` |
| B | Entitlements via `package_slug` `12-month-solar-amc-package` or `6-month-solar-amc-package` **OR** direct `grantEntitlement({ entitlementType: solar_visit, ... })` with partial credits |

Prefer **package grant + balance override** so self-booking and catalog stay aligned.

### 6. Daily cleaning contracts

| Legacy pattern | Platform mapping |
|----------------|------------------|
| Recurring daily exterior clean | `subscriptions.type = daily_wash` |
| Vehicle link | `subscriptions.vehicleId` |
| `start_date`, `end_date`, `daily_rate`, `off_days` | Direct columns |
| Prepaid wallet balance | `customers.walletBalance` (or wallet ledger credit in same transaction) |
| Package includes wash credits | Separate row in **CarWashPackages** sheet → entitlement grant |

**Do not** encode daily cleaning as wash_credit unless legacy sold a credit pack; recurring daily = subscription + wallet.

---

## Catalog Package Reference (Varanasi — use slugs in template)

| Slug | Use for |
|------|---------|
| `4-wash-package` | Flex wash credit packs |
| `daily-cleaning-2-washes` | Daily + 2 washes combo |
| `12-month-solar-amc-package` | 12-visit solar AMC |
| `6-month-solar-amc-package` | 6-visit solar AMC |
| `daily-exterior-clean`, `daily-clean-1-full-wash`, etc. | Legacy plan name mapping |

Template **Lookups** sheet lists slugs from `GET /api/catalog/packages?citySlug=varanasi` (read-only export at template generation time).

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ Excel workbook  │────▶│ Parse + validate │────▶│ Preview API (no writes) │
│ 6 sheets        │     │ row-level rules  │     │ errors + warnings JSON  │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │  Dry-run     │        │  Import      │
            │  TX rollback│        │  TX commit   │
            └──────────────┘        └──────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    migration_batches + migration_entity_map
                    customers / users / vehicles / solar_sites
                    subscriptions / customer_entitlements
```

### Delivery surfaces

| Surface | Purpose |
|---------|---------|
| **Admin UI** | `/admin/migration` — upload, preview, dry-run, import, download error report |
| **API** | `POST /api/migration/preview`, `/dry-run`, `/import`, `GET /api/migration/template` |
| **CLI** | `pnpm --filter @workspace/scripts run migration:preview -- file.xlsx` (same engine as API) |

Single shared module: `artifacts/api-server/src/lib/migration/legacyImportEngine.ts`.

---

## Excel Template Specification

**File:** `CWP_Legacy_Migration_Template_v1.xlsx`  
**Generated by:** `GET /api/migration/template?citySlug=varanasi` (uses `exceljs` — new dependency in `@workspace/scripts` + api-server)

### Sheets (import order)

| # | Sheet name | Required | Key columns |
|---|------------|----------|-------------|
| 0 | **Instructions** | — | Read-only guidance, version, city |
| 1 | **Customers** | Yes | `legacy_customer_id*`, `name*`, `phone*`, `email`, `address`, `city`, `branch_code`, `wallet_balance`, `total_dues`, `temporary_password`, `create_login*` |
| 2 | **Vehicles** | No | `legacy_vehicle_id*`, `legacy_customer_id*`, `registration_number*`, `make*`, `model*`, `vehicle_type`, `vehicle_model_slug`, `service_address*`, `service_lat*`, `service_lng*`, `assigned_staff_phone` |
| 3 | **SolarSites** | No | `legacy_site_id*`, `legacy_customer_id*`, `address*`, `panel_count*`, `panel_capacity_kw`, `service_lat`, `service_lng`, `last_cleaned_date`, `next_service_date` |
| 4 | **CarWashPackages** | No | `legacy_contract_id*`, `legacy_customer_id*`, `package_slug*`, `valid_from*`, `valid_until*`, `total_credits*`, `used_credits`, `legacy_vehicle_id` |
| 5 | **SolarAMC** | No | `legacy_contract_id*`, `legacy_customer_id*`, `legacy_site_id*`, `package_slug*`, `start_date*`, `end_date*`, `total_visits*`, `used_visits`, `price_paid` |
| 6 | **DailyCleaning** | No | `legacy_contract_id*`, `legacy_customer_id*`, `legacy_vehicle_id*`, `start_date*`, `end_date*`, `daily_rate*`, `off_days`, `wallet_balance`, `service_id_slug` (default basic/premium wash service) |
| 7 | **Lookups** | — | Auto-filled: branches, package slugs, service slugs, vehicle model slugs, staff phones (optional) |

`*` = required when row present.

### Template generation rules

- Prefill **Lookups** from live DB for selected city (default `varanasi`).  
- Include data-validation dropdowns for `package_slug`, `vehicle_type`, `branch_code`.  
- Freeze header row; column comments with validation hints.

---

## Validation Preview

**Endpoint:** `POST /api/migration/preview`  
**Body:** multipart `.xlsx` or base64  
**Response:**

```json
{
  "batchId": null,
  "summary": { "customers": 120, "errors": 3, "warnings": 7 },
  "sheets": {
    "Customers": { "rows": [...], "errors": [...], "warnings": [...] }
  },
  "canImport": false
}
```

### Validation rules (representative)

| Rule | Severity |
|------|----------|
| Duplicate `legacy_customer_id` in file | Error |
| Duplicate `phone` in file or DB | Error |
| Invalid phone format | Error |
| Unknown `package_slug` | Error |
| `used_credits` > `total_credits` | Error |
| `valid_until` < today | Warning |
| Vehicle without geo | Warning (blocks booking until fixed) |
| `legacy_customer_id` referenced but missing in Customers | Error |
| Solar AMC without matching SolarSites row | Error |
| Daily cleaning without vehicle | Error |

No DB writes in preview mode.

---

## Dry-Run vs Import

| Mode | DB | Response |
|------|-----|----------|
| **Dry-run** | Full pipeline in one transaction → **ROLLBACK** | Same as import + `wouldCreate` / `wouldUpdate` counts |
| **Import** | **COMMIT** | `batchId`, entity maps, row outcomes |

Both modes write to `migration_batches` only on **import** (dry-run uses in-memory batch id for logging).

**Permission:** new resource `migration` — admin/manager `create` for import, `view` for preview/template.

---

## New Schema (Migration audit only — not catalog)

**Migration:** `009_legacy_migration.sql`

```sql
-- migration_batches: one per upload/import
-- migration_entity_map: legacy_id → platform id (customer, vehicle, site, subscription, entitlement)
-- migration_row_log: sheet, row_number, status, message, batch_id
```

No changes to `catalog_*` or `customer_entitlements` structure.

---

## Entitlement Engine Extension (additive — LM-4)

Add to `entitlementEngine.ts` (does not alter existing grant paths):

```ts
export async function grantEntitlementWithBalance(input: EntitlementGrantInput & {
  usedCredits?: number;
  validUntil?: string;  // override computed expiry
}, tx?: Transaction);

export async function grantPackageEntitlementsWithBalance(
  customerId: number,
  packageId: number,
  opts?: { cityId?; validFrom?; validUntil?; usedCreditsByServiceId?: Record<number, number> },
  tx?: Transaction,
);
```

Import engine **must** use these helpers — never raw INSERT into `customer_entitlements` except inside the helper.

---

## Phase Overview

| Phase | Focus | Est. |
|-------|-------|------|
| **P1** | Schema + entitlement balance helpers + package slug map | 1.5 d |
| **P2** | Import engine (parse, validate, dry-run, commit) | 3 d |
| **P3** | API routes + permissions | 1 d |
| **P4** | Excel template generator + CLI | 1.5 d |
| **P5** | Admin Migration UI | 2 d |
| **P6** | Golden sample + `verify:migration` + docs | 1 d |

---

## Task Index

| ID | Task | Phase | Priority |
|----|------|-------|----------|
| LM-1 | Migration `009_legacy_migration.sql` + Drizzle schema | P1 | P0 |
| LM-2 | `MIGRATION_PACKAGE_MAP` legacy name → catalog slug | P1 | P0 |
| LM-3 | `legacyImportEngine.ts` — parse workbook (exceljs) | P2 | P0 |
| LM-4 | `grantEntitlementWithBalance` / `grantPackageEntitlementsWithBalance` | P1 | P0 |
| LM-5 | Row validators per sheet | P2 | P0 |
| LM-6 | Import pipeline: customers + users (login) | P2 | P0 |
| LM-7 | Import pipeline: vehicles + solar sites | P2 | P0 |
| LM-8 | Import pipeline: car wash packages → entitlements | P2 | P0 |
| LM-9 | Import pipeline: solar AMC → subscription + entitlements | P2 | P0 |
| LM-10 | Import pipeline: daily cleaning → subscription + wallet | P2 | P0 |
| LM-11 | Dry-run transaction wrapper + rollback | P2 | P0 |
| LM-12 | `migration_batches` / row log on commit | P2 | P0 |
| LM-13 | API: template download, preview, dry-run, import | P3 | P0 |
| LM-14 | Permission resource `migration` + seed | P3 | P0 |
| LM-15 | CLI scripts: `migration:template`, `migration:preview`, `migration:import` | P4 | P0 |
| LM-16 | Admin UI `/admin/migration` — upload, preview table, error export CSV | P5 | P0 |
| LM-17 | Golden workbook `fixtures/legacy-migration-sample.xlsx` | P6 | P0 |
| LM-18 | `verify:migration` script (dry-run + entitlement + login smoke) | P6 | P0 |
| LM-19 | Post-import smoke: login + self-booking check sample customer | P6 | P0 |

---

## API Sketch

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/migration/template?citySlug=varanasi` | Download Excel template |
| POST | `/api/migration/preview` | Validate only |
| POST | `/api/migration/dry-run` | Simulate import, rollback |
| POST | `/api/migration/import` | Commit import |
| GET | `/api/migration/batches` | List past imports |
| GET | `/api/migration/batches/:id` | Batch detail + row log |

---

## Admin UI Sketch (`/admin/migration`)

1. **Download template** button (city selector).  
2. **Upload** `.xlsx` → auto-run preview.  
3. **Preview panel:** tabs per sheet; red errors / amber warnings; summary counts.  
4. **Dry-run** button → modal with would-create/update totals.  
5. **Import** button (disabled if errors) → confirmation → progress → batch report.  
6. **Download error report** (CSV of failed rows).

Sidebar entry under **Operations** or **Config** (admin only).

---

## Error Reporting

| Output | Format |
|--------|--------|
| Preview API | JSON array `{ sheet, row, column, severity, code, message }` |
| Post-import | `migration_row_log` queryable by batch |
| User export | CSV columns: `sheet,row,column,severity,code,message,legacy_id` |

Error codes (stable): `DUPLICATE_PHONE`, `UNKNOWN_PACKAGE`, `MISSING_CUSTOMER_REF`, `INVALID_DATE`, `CREDIT_OVERFLOW`, `GEO_INCOMPLETE`, etc.

---

## Idempotency

- **`migration_entity_map`:** `(batch_id, entity_type, legacy_id) → platform_id`  
- Re-import same `legacy_customer_id`: **update** customer fields if `import_mode=upsert` (default); skip if unchanged.  
- Never create second `users` row for same phone — update password only if `reset_password=Y` on row.  
- Entitlements: match by `(customer_id, package_id, legacy_contract_id in notes)` — update balances, don't duplicate.

---

## Verification (`verify:migration`)

1. Load `fixtures/legacy-migration-sample.xlsx`.  
2. Run dry-run → expect 0 errors.  
3. Run import into test DB (or dedicated schema prefix / transaction rollback wrapper).  
4. Assert:  
   - Customer count +1, user login works (`/auth/login`)  
   - Vehicle `locationComplete = true`  
   - 4-wash entitlement `remainingCredits` matches sheet  
   - Solar AMC `servicesRemaining` matches sheet  
   - Daily cleaning subscription `status = active`  
5. `GET /api/catalog/self-booking/check` eligible where credits remain.

---

## Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `exceljs` | api-server + scripts | Read/write `.xlsx` |

No new database beyond `009_legacy_migration.sql`. No catalog migrations.

---

## Out of Scope

- Legacy billing / invoice history import (separate toolkit if needed)  
- Staff assignment migration (Staff Ecosystem handles staff separately)  
- Multi-city bulk (v1 = single city per batch; `citySlug` on batch)  
- Automatic legacy DB connector — file-based only for v1  
- Catalog package creation or pricing changes  
- Customer-facing migration UI  

---

## Suggested Implementation Order

1. LM-1, LM-4 (schema + entitlement helpers)  
2. LM-3, LM-5, LM-6–LM-12 (engine core)  
3. LM-13, LM-14 (API)  
4. LM-15 (CLI for pilot scripting)  
5. LM-16 (admin UI)  
6. LM-17–LM-19 (verification before pilot data load)  

---

## References

| Document | Relevance |
|----------|-----------|
| `SERVICE_CATALOG_VERIFICATION_REPORT.md` | Entitlement E2E baseline |
| `SERVICE_CATALOG_FIX_VERIFICATION.md` | Admin permissions + pricing quote |
| `scripts/src/seed-catalog-migration.ts` | Package slugs and entitlement types |
| `artifacts/api-server/src/lib/catalog/entitlementEngine.ts` | Grant/consume API |
| `scripts/src/seed.ts` | Customer + user + subscription patterns |

---

*Build migration tooling on top of the verified Service Catalog Engine. No architecture redesign.*
