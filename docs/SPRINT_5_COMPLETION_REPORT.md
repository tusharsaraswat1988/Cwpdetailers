# Sprint 5 Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Sprint:** 5 — Customer 360 Cleanup  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 5, [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md) §4, Sprint 4C approval gate  

**Status:** Complete — awaiting Sprint 5 review gate (do not start Sprint 6)  

---

## 1. Objective

Customer module = identity + **read-only intelligence summaries**. No service selling, no billing management, no wallet adjustments from Customer 360.

---

## 2. Pre-Sprint 5 requirement (Active Services fields)

Every contract in Customer 360 Active Services displays:

| Field | Source |
|-------|--------|
| Service Name | `summaryJson` + `services.name` via `resolveContractServiceName()` |
| Status | `customer_contracts.status` |
| Start Date | `valid_from` → `startDate` |
| End Date | `valid_until` → `endDate` |
| Linked Service Location | `service_locations` join on `service_location_id` |
| Linked Asset | `assets` join on `registry_asset_id` |

Implemented in `listCustomerContracts()` (`contractRegistry.ts`) and rendered in `ActiveServicesSummary.tsx`.

---

## 3. API changes

| Endpoint | Action |
|----------|--------|
| `GET /api/customers/:id/services` | Contract rows enriched with service name, location, asset, dates |
| `GET /api/customers/:id/contracts` | Same enriched registry via `listCustomerContracts()` |
| `GET /api/customers/:id/billing-summary` | **NEW** — outstanding due, wallet ₹, last invoice, last payment |

**No schema migrations.**

---

## 4. UI changes

| Screen / Tab | Before | After |
|--------------|--------|-------|
| Services & Plans | Multi-section hub (DCMS, entitlements, etc.) | **Active Services** — registry table only |
| Billing | Full invoice/subscription panels + create actions | **Billing Summary** — read-only KPIs + Open Billing |
| Wallet | Credit form + full ledger | **Wallet Summary** — ₹ balance + last 3 tx |
| Assets | Linked assets panel | **Linked Assets** (read-only, deep links) |
| Locations | Service locations panel | **Linked Locations** (read-only, deep links) |

### New / renamed components

| Component | Role |
|-----------|------|
| `ActiveServicesSummary.tsx` | Contract registry table (6 required fields) |
| `BillingSummaryPanel.tsx` | Outstanding due, wallet, last invoice/payment, Open Billing |
| `WalletSummaryPanel.tsx` | Read-only wallet ₹ + recent transactions |
| `LinkedLocationsSummary.tsx` | Re-export of locations panel |
| `LinkedAssetsSummary.tsx` | Re-export of assets panel |

Legacy filenames (`CustomerServicesTab.tsx`, `Customer360BillingPanels.tsx`) re-export new components for backward compatibility.

---

## 5. Removed from Customer 360

| Removed | Moved to |
|---------|----------|
| Add Service wizard | Already removed Sprint 4B — verified not mounted |
| Create invoice / record payment buttons | Billing & Finance |
| Wallet credit form | Billing & Finance → Wallet Adjustments (Sprint 8 tab) |
| Full invoice/subscription tables on billing tab | Billing & Finance |
| Full wallet transaction ledger | Billing & Finance (customer filter) |
| Duplicate DCMS/entitlement sections on services tab | Operational modules / registry is canonical |

**Retained:** Book Service CTA → `/admin/book-services?customerId=`

---

## 6. Founder rules preserved

| Rule | Status |
|------|--------|
| Customer 360 read-only intelligence | ✅ No sell/billing/wallet mutations on 360 |
| Wallet = money only | ✅ Copy clarifies no wash credits |
| Active Services from registry | ✅ `customer_contracts` |
| Book Services for sales | ✅ CTA on Active Services tab |
| No Sprint 6 assignment | ✅ Not started |

---

## 7. Acceptance criteria (IMPLEMENTATION_SEQUENCE_V1)

- [x] No Add Service wizard in Customer 360
- [x] Billing Summary: Outstanding Due, Wallet ₹, Last Invoice, Last Payment, Open Billing
- [x] Wallet Summary shows ₹ only — no wash credits
- [x] Active Services reads `customer_contracts` registry with all 6 required fields
- [x] Linked Locations + Linked Assets read-only with deep links
- [x] Book Service CTA → `/admin/book-services?customerId=`

---

## 8. Backward compatibility

- Tab query `?tab=services` still works; `?tab=active-services` maps to same tab
- `CustomerServicesTab` / `Customer360BillingPanels` imports still resolve
- Franchisee Customer 360: location/asset labels shown without admin deep links when not admin path

---

## 9. Rollback strategy

Revert `CustomerDetail.tsx` tab labels and component imports to pre-Sprint-5 files from git. API enrichment is additive and safe to leave in place.

---

## 10. Architecture conflicts

| Item | Resolution |
|------|------------|
| Wallet adjustments link targets `?tab=wallet-adjustments` | Tab exists in Sprint 8; link prepares navigation — full tab may be empty until Sprint 8 |
| Legacy contracts without `service_location_id` | Location column shows — until backfilled |
| Overview still shows recent bookings/payments KPIs | Kept per “Overview KEEP” in SCREEN_MAPPING_V2 — not a redesign |

---

## 11. Next gate

**Do not start Sprint 6.** Await Sprint 5 review and approval.

Recommended manual tests:

1. Customer with Book Services contract → Active Services shows all 6 columns
2. Billing Summary → Open Billing lands on filtered billing hub
3. Wallet tab → no credit form; balance read-only
4. Book Service CTA works from Active Services tab

---

*End of Sprint 5 completion report.*
