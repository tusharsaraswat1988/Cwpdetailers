# Sprint 4A Completion Report

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Sprint:** 4A — Book Services Wizard Shell  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 4A, founder Sprint 4A authorization  

**Status:** Complete — awaiting Sprint 4A review gate (do not start Sprint 4B)  

---

## 1. Objective

Deliver the **Book Services Wizard Shell** — a read-only, in-memory draft workflow that makes the full business chain visible to users without persisting bookings, contracts, invoices, entitlements, subscriptions, quotations, or assignments.

Approved step sequence:

```
Customer → Service Location → Asset → Service → Add-ons → Discount → Payment Terms → Review Summary
```

---

## 2. UI changes

| Screen | Route | File |
|--------|-------|------|
| Book Services wizard | `/admin/book-services` | `pages/admin/BookServicesPage.tsx` |
| Wizard shell | — | `features/book-services/components/BookServicesWizard.tsx` |

**Navigation:** **Book Services** added to Operations sidebar (after Assets), permission `bookings:view`.

**Deep link:** `?customerId=` pre-fills step 1 via read-only `GET /api/customers/:id`.

---

## 3. Components added

| Component | Step | Purpose |
|-----------|------|---------|
| `CustomerSelect` | 1 | Wraps `CustomerSearchSelect` |
| `LocationSelect` | 2 | Lists customer locations; auto-selects Primary (`isDefault`) |
| `AssetSelect` | 3 | Lists assets filtered by `serviceLocationId` |
| `ServiceSelect` | 4 | Catalog services, packages, plans (by asset type) |
| `AddOnSelect` | 5 | Optional add-ons for catalog services |
| `DiscountStep` | 6 | Optional percent or flat discount (draft only) |
| `PaymentTermsStep` | 7 | Advance / partial / after-service choice |
| `ReviewSummaryStep` | 8 | Display-only summary + estimated total |

**Shared types / logic:** `features/book-services/types.ts` — draft state, `validateStep`, `canProceedToStep`, `computeDraftTotals`, `WIZARD_STEPS`.

---

## 4. APIs consumed (read-only)

| Data | Hook / function | Endpoint |
|------|-----------------|----------|
| Customer search | `searchCustomers` | `GET /api/customers?search=` |
| Customer prefill | `useGetCustomer` | `GET /api/customers/:id` |
| Service locations | `listServiceLocations` | `GET /api/service-locations` |
| Assets (location-scoped) | `listAssets` | `GET /api/assets` |
| Catalog services | `useAdminServices` | `GET /api/services` |
| Packages | `useCatalogPackages` | `GET /api/catalog/packages` |
| Plans | `useDcmsPlans` | `GET /api/daily-cleaning/plans` |
| Add-ons | `useCatalogAddons` | `GET /api/catalog/addons` |

**Not called:** booking create, contract create, invoice create, assignment create, subscription create, quotation create, or any `POST` / `PATCH` / `DELETE` from the wizard module.

---

## 5. Validation rules

| Step | Required to proceed |
|------|---------------------|
| Customer | Customer selected |
| Service Location | Location selected |
| Asset | Asset at selected location selected |
| Service | Service, package, or plan selected |
| Add-ons | Always optional (can skip) |
| Discount | If percent: 0–100; if flat: non-negative |
| Payment Terms | If partial advance: 1–99% |
| Review | No submit — informational only |

**Navigation guards:**

- **Next** blocked until current step validates.
- **Step tabs** disabled until all prior steps validate (`canProceedToStep`).
- Changing customer resets location, asset, service, add-ons.
- Changing location resets asset, service, add-ons.
- Changing asset resets service, add-ons.

---

## 6. UX decisions

| Decision | Rationale |
|----------|-----------|
| Business labels only (Service, Plan, Package, Visit) | Founder Rule #7 — no DCMS / entitlement / fulfillment jargon |
| Primary location auto-selected | Founder Rule #5 — fewer clicks; user can override |
| Assets filtered by location | Founder Rule #4 — no cross-location asset leakage |
| Services from catalog APIs | Founder Rule #6 — no hardcoded product names |
| Solar vs vehicle catalog split by category slug | Future service types follow API metadata |
| Packages/plans only for non-solar assets | Matches current catalog shape |
| Review shows estimated total, no buttons | Sprint 4A is draft-only; creation deferred to 4B/4C |
| Horizontal step strip | Franchise-owner clarity in ~30 seconds |

---

## 7. Proof of no database writes

| Check | Result |
|-------|--------|
| New API routes in `api-server` | **None** |
| DB migrations | **None** |
| `useMutation` in `features/book-services/**` | **None** (grep verified) |
| `POST` / `PATCH` / `DELETE` in wizard module | **None** (grep verified) |
| Review step actions | **No** Save / Submit / Create |
| Wizard state | React `useState` only — lost on refresh |

All network calls from the wizard are **GET** (or read-only React Query hooks wrapping GET).

---

## 8. Acceptance criteria

| Criterion | Status |
|-----------|--------|
| `/admin/book-services` exists | ✅ |
| Wizard follows approved sequence (8 steps) | ✅ |
| Step validation works | ✅ |
| Default location auto-select works | ✅ |
| Asset filtering by location works | ✅ |
| Services loaded dynamically from Services module | ✅ |
| No database writes occur | ✅ |
| No contracts created | ✅ |
| No bookings created | ✅ |
| No invoices created | ✅ |
| No assignments created | ✅ |
| Review screen available | ✅ |
| Business-friendly terminology used | ✅ |

---

## 9. Architecture conflicts

**None identified.** Wizard consumes Sprints 2–3 location/asset APIs and existing catalog endpoints per `FINAL_ARCHITECTURE_SIGNOFF.md`. Persistence paths remain untouched for Sprint 4B.

**Note:** `useDcmsPlans` reads plan data from `/api/daily-cleaning/plans` but UI labels them **Plan** only — no DCMS terminology exposed.

---

## 10. Files summary

**New**

- `artifacts/cwp-platform/src/features/book-services/types.ts`
- `artifacts/cwp-platform/src/features/book-services/components/CustomerSelect.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/LocationSelect.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/AssetSelect.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/ServiceSelect.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/AddOnSelect.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/DiscountStep.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/PaymentTermsStep.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/ReviewSummaryStep.tsx`
- `artifacts/cwp-platform/src/features/book-services/components/BookServicesWizard.tsx`
- `artifacts/cwp-platform/src/pages/admin/BookServicesPage.tsx`
- `docs/SPRINT_4A_COMPLETION_REPORT.md`

**Modified**

- `artifacts/cwp-platform/src/App.tsx` — route `/admin/book-services`
- `artifacts/cwp-platform/src/components/layout/adminNavConfig.ts` — nav + active state
- `docs/IMPLEMENTATION_SEQUENCE_V1.md` — Sprint 4A checkboxes

---

## 11. Recommended test plan

1. Admin → **Book Services** — wizard loads with 8 steps.
2. Try **Next** without customer — error shown.
3. Select customer — Primary location auto-selected when present.
4. Change location — only that location’s assets appear.
5. Select vehicle asset — services, packages, plans from catalog (no hardcoded names).
6. Select solar asset — solar-category services only.
7. Add optional add-ons, discount, payment terms — reach Review.
8. Review shows summary + estimated total; **no** create/submit button.
9. Open `/admin/book-services?customerId=<id>` — customer pre-filled.
10. Network tab during wizard — **no** write requests from book-services flow.

---

## 12. Out of scope (deferred)

- Sprint 4B — contract / booking persistence
- Sprint 4C — quotation, invoice, assignment
- Customer 360 “Book Service” CTA deep link (Sprint 4B prep)
- `AddCustomerServiceWizard` refactor / removal

---

**Sprint 4B not started.** Await Sprint 4A review and approval gate.

---

*Generated at Sprint 4A completion per founder authorization.*
