# Sprint 4B Completion Report

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Sprint:** 4B — Service Contract Layer  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 4B, founder Sprint 4B authorization  

**Status:** Complete — awaiting Sprint 4B review gate (do not start Sprint 4C)  

---

## 1. Objective

Convert the Book Services Wizard from draft-only UI into a **Service Contract creation system** that persists business records across three frozen fulfillment modes — without billing, assignments, or wallet involvement.

---

## 2. Fulfillment modes (frozen mappings)

Documented in `artifacts/api-server/src/lib/contracts/fulfillmentMode.ts`:

| Product | Mode | Runtime storage |
|---------|------|-----------------|
| Doorstep one-time wash / one-time solar | `one_time` | `bookings` + registry (`source_system: booking`) |
| Daily car cleaning (plan) | `contract_recurring` | `dcms_subscriptions` + registry |
| Solar AMC (package) | `contract_recurring` | `subscriptions` (`type: solar_amc`) + registry |
| Doorstep wash package | `contract_credits` | `customer_entitlements` + registry |

**Wallet is not used** for any fulfillment path. Invoice creation is skipped (`skipBilling: true`) on all Book Services contract paths.

---

## 3. Database changes

**Migration:** `lib/db/migrations/031_service_contracts_sprint4b.sql`

| Table | Additive columns |
|-------|------------------|
| `bookings` | `service_location_id`, `asset_id` |
| `dcms_subscriptions` | `service_location_id`, `asset_id` |
| `customer_entitlements` | `service_location_id`, `asset_id` |
| `subscriptions` | `service_location_id`, `asset_id` |
| `customer_contracts` | `service_location_id`, `registry_asset_id`, `service_id`, `contract_type`, `catalog_ref_kind`, `catalog_ref_id` |

**New enum values:**

- `contract_source_system`: `booking`
- `contract_product_line`: `one_time_service`
- `contract_fulfillment_type`: `one_time`, `contract_recurring`, `contract_credits`

**Drizzle schema updated:** `customer-contracts.ts`, `bookings.ts`, `dcms.ts`, `service-catalog.ts`, `subscriptions.ts`

---

## 4. API changes

**New router:** `artifacts/api-server/src/routes/service-contracts.ts`

| Endpoint | Purpose |
|----------|---------|
| `POST /api/service-contracts` | Create contract from Book Services payload |
| `GET /api/service-contracts/:id` | Registry row detail |
| `PATCH /api/service-contracts/:id/status` | Update registry (+ propagate to DCMS/subscription source) |
| `GET /api/customers/:customerId/service-contracts` | List customer contracts |

**Core service:** `lib/contracts/serviceContractService.ts` — branches on `resolveFulfillmentMode()`.

**Registry updates:** `contractRegistry.ts`

- `syncContractFromBooking()` — **new** for one-time jobs
- Extended sync helpers with `contract_type`, location, asset, catalog refs
- `syncCustomerContracts()` now includes bookings

**Modified helpers (no billing on Book Services path):**

- `createSubscription({ skipBilling: true, serviceLocationId, assetId })`
- `grantPackageEntitlements({ skipBilling: true, serviceLocationId, assetId })`

**Feature flag:** `ENABLE_BOOK_SERVICES_CONTRACTS` (default on; set `false` to disable POST)

---

## 5. Contract lifecycle implementation

### ONE_TIME

```
Book Services → POST /service-contracts
  → bookings row (scheduled job, location + asset FKs)
  → customer_contracts (source_system: booking, contract_type: one_time)
```

### CONTRACT_RECURRING — Daily Cleaning

```
Book Services (plan) → dcms_subscriptions
  → customer_contracts (source_system: dcms)
  → No invoice (Sprint 4B)
  → No staff assignment (Sprint 6)
```

### CONTRACT_RECURRING — Solar AMC

```
Book Services (solar package) → subscriptions (solar_amc)
  → customer_contracts (source_system: subscription)
  → Visit schedule automation deferred (manual jobs interim per SERVICE_CONTRACT_REVIEW_V2)
```

### CONTRACT_CREDITS — Wash Package

```
Book Services (wash package) → customer_entitlements
  → customer_contracts (source_system: entitlement, contract_type: contract_credits)
  → No wallet credits
```

---

## 6. UI changes

| Screen | Change |
|--------|--------|
| `/admin/book-services` | Review step → **Create Service Contract**; success screen **Active plan created** |
| Customer 360 Services tab | Removed `AddCustomerServiceWizard`; **Book Service** CTA → `/admin/book-services?customerId=` |
| Customer 360 Overview | **Add service** → **Book Service** deep link |
| DCMS Subscriptions page | Removed inline sell UI; **Sell via Book Services** link |

**New components:**

- `ContractCreatedStep.tsx`
- `features/book-services/api.ts` — `createServiceContract()`

---

## 7. Customer 360 impact

| Allowed | Implemented |
|---------|-------------|
| Active Services summary | ✅ Existing hub + registry (read-only) |
| Contract summary | ✅ Registry cards unchanged |
| Book Service button | ✅ Links to Book Services wizard |

| Not allowed | Status |
|-------------|--------|
| Add / Create / Sell service in Customer 360 | ✅ Wizard removed |
| Inline DCMS sell | ✅ Redirected to Book Services |

---

## 8. Proof of scope boundaries

| Excluded (Sprint 4B) | Verified |
|----------------------|----------|
| Invoices | `skipBilling: true` on subscription + package grant |
| Quotations | No new quote endpoints |
| Assignments | No staff/route APIs called from contract service |
| Wallet entries | No wallet imports in contract service |
| Payment records | No payment APIs called |

---

## 9. Backward compatibility

| Concern | Strategy |
|---------|----------|
| Legacy DCMS POST `/daily-cleaning/subscriptions` | Still creates invoices (unchanged) — Book Services uses `skipBilling` |
| Legacy `grant-package` route | Still creates invoices — Book Services uses internal grant with `skipBilling` |
| Existing registry rows | Backfill via `syncCustomerContracts`; new columns nullable |
| `AddCustomerServiceWizard.tsx` | File retained but **no longer mounted** in Customer 360 |

---

## 10. Rollback strategy

1. Set `ENABLE_BOOK_SERVICES_CONTRACTS=false` — blocks new contract POST.
2. Revert nav/CTA changes if needed; legacy sell paths still exist on old API routes.
3. Migration 031 is additive — safe to leave columns in place.

---

## 11. Acceptance criteria

| Criterion | Status |
|-----------|--------|
| ONE_TIME works | ✅ |
| CONTRACT_RECURRING works | ✅ |
| CONTRACT_CREDITS works | ✅ |
| Daily Cleaning uses CONTRACT_RECURRING | ✅ (`dcms_subscriptions`) |
| Solar AMC uses CONTRACT_RECURRING | ✅ (`subscriptions` solar_amc — not entitlements) |
| Wash Packages use CONTRACT_CREDITS | ✅ |
| Every sale creates `customer_contracts` record | ✅ |
| Wallet not involved | ✅ |
| No billing records created (Book Services path) | ✅ |
| No assignments created | ✅ |
| Customer 360 cannot create services directly | ✅ |

---

## 12. Architecture conflicts

**None blocking.** Solar AMC auto-scheduler remains a post-4B delivery item (manual jobs interim). Solar AMC routing changed from legacy `grant-package` entitlements to `subscriptions` per SERVICE_CONTRACT_REVIEW_V2 V2 ruling — documented in `fulfillmentMode.ts`.

---

## 13. Files summary

**New**

- `lib/db/migrations/031_service_contracts_sprint4b.sql`
- `artifacts/api-server/src/lib/contracts/fulfillmentMode.ts`
- `artifacts/api-server/src/lib/contracts/serviceContractService.ts`
- `artifacts/api-server/src/lib/contracts/featureFlag.ts`
- `artifacts/api-server/src/routes/service-contracts.ts`
- `artifacts/cwp-platform/src/features/book-services/api.ts`
- `artifacts/cwp-platform/src/features/book-services/components/ContractCreatedStep.tsx`
- `docs/SPRINT_4B_COMPLETION_REPORT.md`

**Modified**

- Schema: `customer-contracts.ts`, `bookings.ts`, `dcms.ts`, `service-catalog.ts`, `subscriptions.ts`
- `contractRegistry.ts`, `subscriptionService.ts`, `entitlementEngine.ts`
- `routes/index.ts`, `run-pending-migrations.ts`
- `BookServicesWizard.tsx`, `ReviewSummaryStep.tsx`, `BookServicesPage.tsx`
- `CustomerServicesTab.tsx`, `Customer360Overview.tsx`
- `DcmsSubscriptionsPage.tsx`
- `docs/IMPLEMENTATION_SEQUENCE_V1.md`

---

## 14. Recommended test plan

1. **One-time wash:** Book Services → vehicle → catalog service → Create → verify `bookings` + registry `booking` source.
2. **Daily plan:** Select plan → Create → verify `dcms_subscriptions` + registry; **no** invoice in billing.
3. **Wash package:** Select package on vehicle → Create → verify `customer_entitlements`; **not** wallet.
4. **Solar AMC:** Select solar package on solar asset → Create → verify `subscriptions` type `solar_amc`; **not** entitlement grant.
5. Customer 360 → Services → **Book Service** opens wizard with customer pre-filled.
6. DCMS Subscriptions → no create dialog; link goes to Book Services.
7. `GET /api/customers/:id/contracts` shows new registry row.

---

**Sprint 4C not started.** Await Sprint 4B review and approval gate.

---

*Generated at Sprint 4B completion per founder authorization.*
