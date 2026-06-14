# Sprint 4C Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Sprint:** 4C — Quotation, Invoice & Billing Integration  
**Governing doc:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md)  
**Basis:** Sprint 4C authorization, [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md), [`SPRINT_4B_COMPLETION_REPORT.md`](./SPRINT_4B_COMPLETION_REPORT.md)  

**Status:** Complete — awaiting Sprint 4C review gate (do not start Sprint 5 automatically)  

---

## 1. Objective

Convert Service Contracts into a proper commercial workflow: quotations, invoices, GST calculations, billing records, payment terms, and billing visibility — without staff assignment, routing, or wallet fulfillment logic.

---

## 2. Founder rules compliance

| Rule | Implementation |
|------|----------------|
| Contract before billing | `contractBillingService` rejects billing without registry row; Book Services creates contract first, then calls billing API |
| Quotation ≠ Invoice | Separate tables, endpoints, and UI choices; quotation status `sent` → convert via existing `/quotations/:id/convert` |
| Payment terms mandatory | Server validates `paymentTerms` on `POST /service-contracts`; stored in contract `summaryJson` and on billing rows |
| No assignment in 4C | `pending_service_assignments` placeholder only; no staff/route/auto-assign APIs added |
| GST engine single source | All billing uses `computeInvoiceGst` + `getDefaultGstRate()`; legacy `computeGst(18%)` removed from quotations route |
| Corporate vs retail | B2B when customer has GSTIN; snapshot + `isCorporate` flag on billing result |
| Wallet separate | No wallet reads/writes in billing path |
| Book Services = sales only | Wizard creates contract + quote/invoice; no dues/payments/credit notes in wizard |

---

## 3. Database changes

**Migration:** `lib/db/migrations/032_sprint4c_billing_integration.sql`

| Table | Change |
|-------|--------|
| `quotations` | `contract_registry_id`, `service_location_id`, `asset_id`, `service_id`, `payment_terms`, `cgst_amount`, `sgst_amount`, `igst_amount` |
| `invoices` | `contract_registry_id`, `service_location_id`, `asset_id`, `service_id`, `payment_terms` |
| `pending_service_assignments` | **NEW** — placeholder queue for Sprint 6 |

**Drizzle schema:**

- `lib/db/src/schema/quotations.ts` — contract linkage + GST breakdown columns
- `lib/db/src/schema/invoices.ts` — contract linkage + payment terms
- `lib/db/src/schema/pending-assignments.ts` — **NEW**

**Migration runner:** `032_sprint4c_billing_integration.sql` added to `scripts/src/run-pending-migrations.ts`

---

## 4. Billing backend changes

### New services

| File | Purpose |
|------|---------|
| `lib/billing/contractBillingService.ts` | Contract-first quote/invoice creation, GST computation, pending assignment |
| `lib/billing/featureFlag.ts` | `ENABLE_BOOK_SERVICES_BILLING` (default on) |

### Modified services

| File | Change |
|------|--------|
| `lib/billing/invoiceService.ts` | Contract linkage fields on create; `normalizeItems` uses `getDefaultGstRate()` not hardcoded 18% |
| `routes/quotations.ts` | Unified GST via `computeInvoiceGst`; contract fields on create/convert |
| `routes/service-contracts.ts` | `POST /:id/quotation`, `POST /:id/invoice`, `GET /:id/billing-preview` |
| `lib/contracts/serviceContractService.ts` | `paymentTerms` required; stored on DCMS/credits registry summaries |

---

## 5. API surface (Sprint 4C scope only)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/service-contracts/:id/quotation` | Create quotation linked to contract |
| `POST /api/service-contracts/:id/invoice` | Create tax invoice linked to contract |
| `GET /api/service-contracts/:id/billing-preview` | GST preview for existing contract |
| `POST /api/quotations/:id/convert` | Quote → invoice (enhanced with contract refs) |

**Not implemented (Sprint 6):** staff assignment, route assignment, auto-assign, dispatch APIs.

---

## 6. Quotation flow (Option A)

```text
Customer → Book Services wizard
  → POST /service-contracts (contract registry)
  → POST /service-contracts/:id/quotation
  → Quotation status: sent (awaiting approval)
  → Billing & Finance → Quotations tab
  → POST /quotations/:id/convert → Invoice
  → Payment (existing Billing module)
```

Every quotation references: customer, service location, asset, contract (`contract_registry_id`), service.

---

## 7. Invoice flow (Option B)

```text
Customer → Book Services wizard
  → POST /service-contracts
  → POST /service-contracts/:id/invoice
  → Tax invoice in Billing & Finance → Invoices tab
  → Payment (existing module)
```

Every invoice references: customer, service location, asset, contract, service.

---

## 8. GST implementation

| Layer | Source |
|-------|--------|
| Organization profile | `getInvoiceBillingSettings()` — default SAC, supplier state |
| Customer profile | `buildCustomerSnapshot()` — GSTIN → corporate B2B; place of supply |
| Service configuration | `services.gst_rate`, `catalog_packages.gst_rate`, catalog `default_gst_rate` setting |
| Computation | `computeInvoiceGst()` in `invoiceGstEngine.ts` |

**Removed:** `computeGst(subtotal - disc)` with implicit 18% in quotations route.

**Note:** `invoiceGstEngine.DEFAULT_GST_RATE` remains as engine fallback only when no catalog rate is resolvable; runtime paths resolve rates from DB/settings first.

---

## 9. Payment terms implementation

| Value | Label |
|-------|-------|
| `full_advance` | Full payment in advance |
| `partial_advance` | Partial advance (+ `partialAdvancePercent` in summary) |
| `after_service` | Payment after service completion |

Stored at contract creation in `customer_contracts.summary_json.paymentTerms` and copied to `quotations.payment_terms` / `invoices.payment_terms`.

---

## 10. Pending assignment implementation

**Table:** `pending_service_assignments`

Created automatically when quotation or invoice is generated from Book Services:

- Status: `pending` only
- Links: contract registry, customer, location, asset, service, source system/id
- Notes: "Created from Book Services — awaiting Sprint 6 assignment"
- Unique partial index prevents duplicate pending rows per contract

**No staff assignment, route planning, or dispatch occurs.**

---

## 11. UI changes

| Screen | Change |
|--------|--------|
| `/admin/book-services` | Review step: choose Quotation vs Invoice; creates contract + billing |
| `ReviewSummaryStep.tsx` | Billing document selector; updated copy |
| `ContractCreatedStep.tsx` | Shows contract ID, quote/invoice ID, payment terms, GST summary, pending assignment badge |
| `PaymentTermsStep.tsx` | Payment terms required messaging |
| Billing hub (`/admin/billing`) | Existing tabs display generated records (no structural change) |

---

## 12. Billing visibility

Book Services creates records; Billing & Finance remains source of truth for management:

- Invoices list: `/admin/billing?tab=invoices`
- Quotations list: `/admin/billing?tab=quotations`
- Success screen links directly to filtered billing tabs
- Customer 360 billing panels continue to read from existing invoice/quotation APIs

---

## 13. Backward compatibility

| Area | Behavior |
|------|----------|
| Sprint 4B contracts without billing | Unaffected; billing columns nullable |
| Manual quotation builder | `POST /quotations` still works; optional contract fields |
| DCMS inline sell | Still redirected to Book Services (4B) |
| Feature flag | `ENABLE_BOOK_SERVICES_BILLING=false` disables quote/invoice endpoints; contracts still created |
| Legacy invoices | No `contract_registry_id` required on existing rows |

---

## 14. Rollback strategy

1. Set `ENABLE_BOOK_SERVICES_BILLING=false` — disables new billing endpoints; contracts continue via 4B flag
2. Revert Book Services UI to contract-only success screen (4B behavior)
3. Migration 032 is additive — rollback safe if no production dependency on new columns
4. Drop `pending_service_assignments` only if empty (pre-release)

---

## 15. Acceptance criteria checklist

- [x] Contract created before billing
- [x] Quotation creation works (`POST /service-contracts/:id/quotation`)
- [x] Direct invoice creation works (`POST /service-contracts/:id/invoice`)
- [x] Quote → invoice conversion works (`POST /quotations/:id/convert`)
- [x] Payment terms stored on contract and billing rows
- [x] GST engine centralized (`computeInvoiceGst`)
- [x] No hardcoded 18% in quotation creation path
- [x] Billing & Finance shows generated records
- [x] Pending assignment placeholder created
- [x] No staff assignment occurs
- [x] No route assignment occurs
- [x] Wallet not used for fulfillment

---

## 16. Architecture conflicts discovered

| Item | Detail | Resolution |
|------|--------|------------|
| IMPLEMENTATION_SEQUENCE 4C title | Doc says "Billing Assign"; authorization says billing only, assignment in Sprint 6 | Implemented per Sprint 4C authorization (billing + pending placeholder only) |
| DCMS plans lack `gst_rate` column | Plans use catalog `default_gst_rate` fallback | Documented; future: add plan-level GST if needed |
| Wash package discount | Discount stored in summary but package price may be pre-discount for credits path | Credits use `discountFromSummary`; subscription/booking use final stored price |
| Quotation item type | Legacy `QuotationItem` vs `InvoiceItem` | Quotations now store `InvoiceItem[]` for GST parity |

---

## 17. Deliverables

- [x] Migration 032 + Drizzle schema
- [x] `contractBillingService.ts`
- [x] Service contract billing APIs
- [x] Book Services UI integration
- [x] Quotations GST unification
- [x] This completion report

---

## 18. Next gate

**Do not start Sprint 5 automatically.** Await Sprint 4C review and approval.

Recommended manual test plan:

1. Book one-time wash → Create Quotation → verify in Billing → Convert to invoice
2. Book wash package → Create Invoice directly → verify GST breakdown + B2C
3. Book with corporate customer (GSTIN) → verify B2B / IGST if inter-state
4. Confirm `pending_service_assignments` row exists, no staff assigned
5. Set `ENABLE_BOOK_SERVICES_BILLING=false` → confirm billing endpoints 503, contract still creates

---

*End of Sprint 4C completion report.*
