# Phase 5.6 — Billing & Commercial Closure

**Status:** READY FOR REVIEW  
**Business question:** *How is completed work converted into a commercial transaction?*  
**Starts when:** Job reaches `ready_for_billing` (Phase 5.5 — frozen)  
**Ends when:** Billing is commercially complete  
**Do not start Phase 5.7 until approved.**

---

## 1. Architecture Summary

```
Job ready_for_billing (Phase 5.5 — frozen, read-only handoff)
        ↓
Commercial Calculation (catalog / contract pricing)
        ↓
Invoice Draft
        ↓
Invoice Issued → Payment Pending
        ↓
Paid
        ↓
Commercial Closed   ← Phase 5.6 ends
```

**Billing owns:** invoice generation, commercial calculation, tax, discounts, subscription entitlement consumption, one-time billing, invoice lifecycle, payment status, credit notes (future-ready), commercial audit history, Billing* domain events (publish-only).

**Does not own:** Customer, Booking, Assignment, Field Execution, Job Orchestration, Inventory, Accounting Ledger, GST Returns, Route Planning, Payment Gateway, CRM, notification delivery.

**Frozen — not modified:** Service Request, Booking, Staff Assignment, Field Execution, Job Orchestration, CRM, Inventory, Route Planning.

---

## 2. Audit Findings

| Area | Finding |
|------|---------|
| `invoices` / `payments` | Mature GST invoice engine, credit notes, PDF, wallet settlement — **reused** |
| `invoiceGstEngine` / `pricingEngine` | Canonical tax + catalog pricing — **reused** (no duplicate pricing) |
| `contractBillingService` | Contract purchase quotations/invoices (pre-fulfillment) — **reused for pricing patterns** |
| `customer_contracts` | Commercial registry linked from Jobs — **pricing / mode source** |
| Subscriptions / entitlements / DCMS | Multiple product authorities; visit consumption counters exist |
| `ready_for_billing` | Ops marker only; **no billing subscriber** before 5.6 |
| Invoice ↔ Job link | **Missing** `execution_id` before 5.6 |
| Billing domain events | **Missing** before 5.6 |
| Commercial timeline | **Missing** before 5.6 |
| Duplicate risk | Manual / contract / booking invoice paths lacked a single job idempotency key |

---

## 3. Existing Components Reused

- `invoices`, `payments`, `quotations`, `customer_contracts`
- `invoiceService.createInvoice` / `recordPayment` / `createCreditNote`
- `invoiceGstEngine`, `invoicePdfGenerator`, `invoiceBillingSettings`
- Catalog pricing (`services`, `catalog_packages`, contract `summaryJson` amount)
- Entitlement consumption (`consumeEntitlementOnCompletion`) + subscription `decrementOnCompletion`
- Admin Billing & Finance page + design system
- Auth resource `invoices` + tenant scope helpers

---

## 4. New Components

| Component | Purpose |
|-----------|---------|
| `055_billing_commercial_closure_phase56.sql` | Job link + commercial status + timeline |
| `billing-commercial-timeline.ts` | Commercial audit schema |
| `lib/billing/commercialClosureService.ts` | Job → invoice lifecycle |
| `lib/billing/commercialValidation.ts` | Commercial rules |
| `lib/billing/commercialDomainEvents.ts` | Publish-only Billing events |
| `lib/billing/commercialTimeline.ts` | Audit history |
| `routes/commercial-billing.ts` | Phase 5.6 APIs |
| `features/commercial-billing/*` | Admin Commercial Closure UI |
| `commercialValidation.test.ts` | Unit tests |

---

## 5. Database Changes

Migration `055_billing_commercial_closure_phase56.sql`:

**On `invoices` (extend — no duplicate invoice entity):**

- `execution_id` — Job id (= `service_executions.id`); unique active tax invoice per job
- `commercial_status` — `draft` \| `issued` \| `payment_pending` \| `paid` \| `commercially_closed` \| `voided`
- `billing_mode` — `subscription_visit` \| `one_time` \| `prepaid_fulfillment` \| `manual`
- `commercially_closed_at`, `voided_at`, `void_reason`, `entitlement_consumed`

**New table:** `billing_commercial_timeline` (Billing-owned commercial history).

**Not added (intentionally):** `invoice_lines`, `payment_allocations`, ledger / GST return tables, payment gateway tables.

---

## 6. APIs

| Method | Path | Action |
|--------|------|--------|
| GET | `/billing/ready-for-billing` | Ready-for-billing queue |
| GET | `/billing/jobs/:jobId/preview` | Commercial calculation preview |
| POST | `/billing/jobs/:jobId/generate` | Generate draft invoice |
| GET | `/billing/commercial?status=` | Draft / issued / paid / outstanding |
| GET | `/billing/invoices/:id` | Invoice detail + timeline |
| GET | `/billing/invoices/:id/timeline` | Commercial timeline |
| GET | `/billing/invoices/:id/history` | Alias for history |
| POST | `/billing/invoices/:id/issue` | Issue draft |
| POST | `/billing/invoices/:id/mark-paid` | Record payment + commercial close |
| POST | `/billing/invoices/:id/void` | Void invoice |
| POST | `/billing/invoices/:id/credit-note` | Credit note (future-ready wrapper) |
| GET | `/invoices/:id/pdf` | Existing PDF endpoint (reused) |

All routes: tenant isolation via `tenantFilters` / `rowInScope`, authorization via `invoices` resource + admin role check, commercial timeline audit.

---

## 7. UI

Admin **Billing & Finance** → **Commercial Closure** tab:

- Ready for Billing queue
- Draft / Issued / Outstanding / Paid queues
- Invoice detail with commercial timeline
- Preview, Generate draft, Issue, Mark paid, Void, PDF

---

## 8. Technical Debt

1. Invoice numbering remains max+1 (pre-existing concurrency risk) — not redesigned in 5.6.
2. Multiple subscription authorities (DCMS / subscriptions / entitlements) still coexist; billing classifies by contract `sourceSystem`.
3. DCMS visit counters remain DCMS-owned; billing documents complimentary visits and consumes package/subscription entitlements.
4. OpenAPI still lags runtime commercial endpoints (same debt as prior billing extensions).
5. In-memory Billing domain events — publish only, no durable outbox (same pattern as Phase 5.5).

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Double invoice for same job | Unique index on `execution_id` for active tax invoices + validation |
| Double charge after prepaid contract invoice | `prepaid_fulfillment` mode links existing invoice |
| Negative / invalid totals | `assertNonNegativeTotals` + GST engine |
| Expired contract billed | `assertContractBillable` |
| Entitlement over-consumption | Validate remaining credits; skip if consumption log exists |

---

## 10. QA Checklist

- [ ] Subscription visit (DCMS / package / subscription) → complimentary draft → issue → commercially closed
- [ ] One-time after-service job → priced from contract/catalog → issue → mark paid → closed
- [ ] Prepaid one-time → links existing invoice → commercial closed without second charge
- [ ] Duplicate generate for same job → 409
- [ ] Job not `ready_for_billing` → rejected
- [ ] Expired/cancelled contract → rejected
- [ ] Invoice numbering still produces unique `CWP/{FY}/{n}`
- [ ] Taxes / discounts from GST engine visible on preview
- [ ] Commercial timeline records draft / issued / paid / void / closed
- [ ] Tenant isolation: franchisee cannot see other tenant jobs/invoices
- [ ] Permissions: invoices view/create/edit enforced
- [ ] Regression: Phase 5.5 Job Orchestration untouched; existing Invoices/Payments tabs still work
- [ ] PDF still downloads via `/api/invoices/:id/pdf`

---

## Domain Events (publish only)

`InvoiceCreated`, `InvoiceIssued`, `InvoicePaid`, `InvoiceVoided`, `InvoiceCancelled`, `InvoiceReady`, `CreditNoteCreated`, `CommercialClosed`

---

**Phase 5.6 is READY FOR REVIEW. Wait for approval before Phase 5.7.**
