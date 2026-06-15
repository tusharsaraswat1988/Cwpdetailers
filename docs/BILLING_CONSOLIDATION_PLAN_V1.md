# Billing Consolidation Plan V1 — Sprint 8

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Version:** 1.0  
**Status:** Implemented — see [`SPRINT_8_COMPLETION_REPORT.md`](./SPRINT_8_COMPLETION_REPORT.md)  
**Prerequisites:** Sprint 4C (contract billing), Sprint 5 (Customer 360 billing summary), Sprint 7 review gate  

**Governing docs:** [`FINAL_ARCHITECTURE_SIGNOFF.md`](./FINAL_ARCHITECTURE_SIGNOFF.md), [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 8, [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md) §10, [`DATA_RELATIONSHIP_V1.md`](./DATA_RELATIONSHIP_V1.md) §2 & §6, [`SPRINT_4C_COMPLETION_REPORT.md`](./SPRINT_4C_COMPLETION_REPORT.md), [`SPRINT_5_COMPLETION_REPORT.md`](./SPRINT_5_COMPLETION_REPORT.md)

---

## 1. Objective

Deliver a **single Billing & Finance hub** at `/admin/billing` that consolidates invoices, payments, quotations, expenses, dues, wallet adjustments, and credit notes — with unified GST, lifecycle visibility, and deep links from Customer 360.

Sprint 8 completes the navigation and UX consolidation started in Sprint 1 (redirects) and deferred in Sprint 5 (wallet tab placeholder links).

---

## 2. Current State Audit

### 2.1 Billing screens

| Screen / Route | File | Current behavior | Target (Sprint 8) |
|----------------|------|------------------|-------------------|
| Billing & Finance hub | `pages/admin/Invoices.tsx` | Title “Billing & Finance”; tabs: **Invoices, Payments, Quotations, Expenses** | Add **Dues**, **Wallet Adjustments**; rename file → `BillingFinancePage.tsx` |
| Legacy redirect | `/admin/invoices` → `/admin/billing` | ✅ Working | Keep |
| Quotations redirect | `/admin/quotations` → `?tab=quotations` | ✅ Working | Keep; add in-tab create/convert |
| Expenses redirect | `/admin/expenses` → `?tab=expenses` | ✅ Route redirects | Restore **create expense** in tab (lost vs standalone page) |
| Dues & Collections | `pages/admin/Dues.tsx` at `/admin/dues` | **Standalone** — health KPIs + customer dues table | **Merge** into `?tab=dues`; redirect `/admin/dues` |
| Quotation Builder | `pages/admin/QuotationBuilder.tsx` | **Orphan** — hardcoded 18% GST; **not routed** in `App.tsx` | Delete or fold into shared quotation dialog |
| Invoice & GST Settings | `pages/admin/InvoiceBillingSettings.tsx` | Standalone settings (correct) | Keep linked from hub header |
| Customer 360 Billing Summary | `BillingSummaryPanel.tsx` | Read-only KPIs + Open Billing → `?customerId=` | Wire filtered views + optional tab deep links |
| Customer 360 Wallet Summary | `WalletSummaryPanel.tsx` | Read-only; links to `?tab=wallet-adjustments` | Tab must exist (currently **404-equivalent** — falls back to invoices) |
| Sidebar nav | `adminNavConfig.ts` | **Two entries:** Billing & Finance + Dues & Collections | **Single** Billing & Finance entry |
| Founder Dashboard | `FounderDashboard.tsx` | KPI links to `/admin/dues` | Update to `/admin/billing?tab=dues` |

**Partial consolidation already done (Sprint 1):** route renames, quotation/expense redirects, hub shell with four tabs.

**Not done:** dues merge, wallet tab, lifecycle filters, quotation actions in hub, expense create in hub, customer filter banner, nav deduplication.

---

### 2.2 Invoice flows

#### Entry points

| Source | Path | GST engine | Contract linkage |
|--------|------|------------|------------------|
| Billing hub — Create Invoice dialog | `CreateInvoiceDialog.tsx` | Client preview (`/1.18` approx); server uses `invoiceGstEngine` | Optional booking/subscription; no contract ref from manual create |
| Book Services wizard | `contractBillingService.ts` → `POST /service-contracts/:id/invoice` | ✅ `computeInvoiceGst` + `getDefaultGstRate()` | ✅ Required `contract_registry_id` |
| Quotation convert | `POST /quotations/:id/convert` → `createInvoiceFromQuotation` | ✅ Unified | ✅ From quotation row |
| Booking complete (auto) | `maybeCreateInvoiceOnBookingComplete` | ✅ Server | Booking ID only |
| Wallet recharge | `createPaidInvoiceForWalletRecharge` | ✅ Server | N/A |

#### Hub invoices tab (`Invoices.tsx`)

- Lists via `useListInvoices` with optional `customerId` query param (from URL; **no visible filter chip/banner**).
- Row actions: PDF download, credit note (if balance > 0), “From quote” indicator.
- Status badges: `draft`, `sent`, `paid`, `overdue`, `cancelled`.
- Credit notes show **CN** badge when `documentType === "credit_note"`.

#### Backend (`routes/payments.ts` + `invoiceService.ts`)

- `GET /invoices` supports `customerId`, `status` filters.
- `POST /invoices` → `createInvoiceRecord` with full GST breakdown, document types (`tax_invoice`, `credit_note`).
- Credit note creation reduces reference invoice `balanceDue` atomically.
- PDF generation via `GET /invoices/:id/pdf`.

#### Gaps

- No **lifecycle** filter UI (quotation → closed chain from `DATA_RELATIONSHIP_V1.md` §6).
- Manual invoice dialog GST preview is **client-side 18% inclusive** — should call preview API or shared hook.
- Invoices from Book Services appear in list but **no contract/location/asset columns** in hub table.
- `customerFilter` applies to invoices/payments only — not quotations/expenses/dues/wallet tabs.

---

### 2.3 Quotation flows

#### Entry points

| Source | Path | GST |
|--------|------|-----|
| Book Services | `POST /service-contracts/:id/quotation` | ✅ `contractBillingService` |
| Manual (orphan builder) | `QuotationBuilder.tsx` → `POST /quotations` | ❌ **Hardcoded 18%** in UI (`subtotal - disc) * 0.18`) |
| API direct | `POST /quotations` | ✅ `computeInvoiceGst` + `getDefaultGstRate()` |

#### Hub quotations tab

- Read-only table via manual `fetchQuotations` (not in OpenAPI client).
- Shows: number, customer, subtotal, GST, total, status, valid until.
- **No actions:** create, edit status, convert to invoice, view detail.

#### Quotation lifecycle (backend)

| Status | Meaning |
|--------|---------|
| `draft` | Created, not sent |
| `sent` | Issued to customer |
| `accepted` / `rejected` | Customer decision |
| `converted` | Invoice created |
| `expired` | Past `validUntil` |

Convert: `POST /quotations/:id/convert` (draft/sent/accepted → invoice + status `converted`).

#### Gaps

- **No UI for convert** — critical path from Book Services quote flow stops at read-only list.
- Orphan `QuotationBuilder.tsx` contradicts unified GST rule; route already removed.
- Quotations tab ignores `customerId` URL filter.
- No link from quotation row to contract / Book Services context.

---

### 2.4 Payment flows

#### Entry points

| Source | UI | API |
|--------|-----|-----|
| Billing hub — Record Payment dialog | Customer search, optional invoice ID, amount, method | `POST /payments` → `recordPayment` |
| Customer 360 | Read-only last payment | `GET /customers/:id/billing-summary` |
| Wallet recharge | Auto via wallet credit | Creates completed payment on recharge invoice |

#### Backend behavior (`recordPayment`)

- Inserts `payments` row with status `completed`.
- If `invoiceId` provided: `applyPaymentToInvoice` updates `paidAmount`, `balanceDue`, status.
- If no invoice: only `syncCustomerTotalDues`.
- **Overpayment:** excess amount is **not** credited to wallet — `balanceDue` capped at 0, remainder discarded.
- **Wallet offset at payment:** not implemented (`DATA_RELATIONSHIP_V1.md` R203 — “Invoice may apply wallet balance at payment time”).
- Reversal: `POST /payments/:id/reverse` restores invoice balances.

#### Hub payments tab

- Read-only list; respects `customerId` filter when set via URL.
- No link from payment row to invoice; no reverse action in UI.

#### Gaps

- Overpayment → wallet credit flow **missing** (documented in architecture, not coded).
- Pay-with-wallet option missing from Record Payment dialog.
- Payment methods include `razorpay` in UI but wallet/debit paths unused.

---

### 2.5 Wallet adjustment flow

#### Architecture rule (`DATA_RELATIONSHIP_V1.md` §2)

Wallet = **₹ monetary ledger only** — not wash credits, not entitlements.

#### Backend (`lib/wallet/service.ts` + `routes/wallet.ts`)

| Capability | Status |
|------------|--------|
| `getLedgerBalance` | ✅ Ledger sum is source of truth |
| `creditWallet` | ✅ Used by `POST /customers/:id/wallet/credit` |
| `debitWallet` | ✅ Service exists; **no HTTP route** |
| Wallet recharge invoice | ✅ Auto tax invoice on credit |
| `paymentMode: adjustment` | ✅ Enum exists; not exposed in admin UI |

#### Admin UI

- **No wallet adjustments tab** — `WalletSummaryPanel` links to `?tab=wallet-adjustments` but `BILLING_TABS` in `Invoices.tsx` does not include it (invalid tab → defaults to invoices).
- Wallet credit form was **removed from Customer 360** in Sprint 5 (correct); replacement tab not built.

#### Gaps

- New `WalletAdjustmentsTab.tsx` required: credit form, optional manual debit/adjustment, transaction ledger with customer filter.
- `POST /customers/:id/wallet/debit` (admin-only, with reason) — or unified `POST /wallet/adjustments`.
- Copy must state **₹ only — not service credits** on every form.
- Customer-scoped deep link: `/admin/billing?customerId=X&tab=wallet-adjustments`.

---

### 2.6 Credit note flow

#### Two UI paths (redundant)

| Path | Component | API |
|------|-----------|-----|
| Row action on invoice | `CreateCreditNoteDialog.tsx` | `POST /invoices/:id/credit-note` |
| Create Invoice dialog | `CreateInvoiceDialog.tsx` (document type = credit note) | `POST /invoices` with `documentType: credit_note` |

Both ultimately use `createCreditNote` / `createInvoice` with `documentType: credit_note`.

#### Backend behavior

- Validates reference is `tax_invoice`.
- Creates CN document with GST; reduces reference `balanceDue`.
- PDF supports credit note fields (`referenceInvoiceNumber`, `creditReason`).

#### Gaps

- Duplicate UX — Sprint 8 should **keep row-action dialog** as primary; remove credit note mode from create dialog or hide behind advanced.
- No filter for “credit notes only” in invoices tab.
- CN rows cannot issue nested CN (correct) but no link back to reference invoice in UI.

---

### 2.7 Dues workflow

#### Standalone page (`Dues.tsx`)

- `GET /billing/health` — collected this month, dues outstanding, expenses this month, net.
- `GET /billing/dues` — per-customer aggregated `balanceDue > 0`.
- Customer name links to Customer 360 `?tab=billing`.

#### Integration gaps

- Still a **separate sidebar item** and route — not merged per `SCREEN_MAPPING_V2.md`.
- Dues APIs live in `routes/billing.ts` (correct); page should become a tab component.
- Health KPIs could become hub header summary cards visible across tabs.
- `customerId` URL param does not filter dues tab.
- `customers.totalDues` denormalized field synced via `syncCustomerTotalDues` — used by Customer 360 summary.

---

### 2.8 Expenses workflow

#### Standalone page (`Expenses.tsx`)

- Full create form + list (queued POST for offline).
- Route redirects to billing tab — **create UI unreachable** from nav.

#### Billing hub expenses tab

- Read-only list only (`fetchExpenses`).

#### Gap

- Port create-expense form from `Expenses.tsx` into billing tab (or shared `ExpensesTab.tsx`).

---

### 2.9 Cross-cutting: GST unification

| Layer | Current | Sprint 8 target |
|-------|---------|-----------------|
| Server quotations | ✅ `invoiceGstEngine` | Keep |
| Server invoices | ✅ `invoiceGstEngine` | Keep |
| Contract billing | ✅ `contractBillingService` | Keep |
| `CreateInvoiceDialog` preview | ❌ Hardcoded `/1.18` | Use `GET /service-contracts/:id/billing-preview` pattern or shared preview endpoint |
| `QuotationBuilder.tsx` | ❌ Hardcoded 18% | **Delete** (unrouted dead code) |
| Catalog default rate | `getDefaultGstRate()` | Surface in UI labels (“GST per catalog default”) |

---

### 2.10 Cross-cutting: Billing lifecycle

Target chain from `DATA_RELATIONSHIP_V1.md` §6.1:

```
Quotation → Approved → Work Scheduled → Work Started → Work Completed → Invoice → Payment → Closed
```

**Current reality:** statuses exist in **separate domains** (quotation.status, assignment/execution, invoice.status, payment) with **no unified lifecycle field or hub filter**.

Sprint 8 scope (per `IMPLEMENTATION_SEQUENCE_V1.md`):

- **Phase A (Sprint 8):** Hub filters mapping existing fields — e.g. “Open quotations”, “Unpaid invoices”, “Overdue”, “Converted quotes” — without mandatory schema migration.
- **Phase B (optional/follow-up):** Additive `lifecycleStatus` on invoices/quotations if cross-entity views prove insufficient.

---

## 3. Gap Summary

| # | Gap | Severity | Sprint 8 |
|---|-----|----------|----------|
| G1 | Dues still standalone route + nav | High | ✅ Merge |
| G2 | Wallet adjustments tab missing | Critical | ✅ New tab + API debit route |
| G3 | `?tab=wallet-adjustments` deep link broken | High | ✅ Fix tab registry |
| G4 | Quotation convert/create missing in hub | High | ✅ Tab actions |
| G5 | Expense create unreachable | Medium | ✅ Port form to tab |
| G6 | Overpayment → wallet not implemented | High | ✅ Payment flow |
| G7 | Pay-with-wallet not implemented | Medium | ✅ Payment dialog |
| G8 | Customer filter not visible / not cross-tab | Medium | ✅ Filter banner |
| G9 | Orphan `QuotationBuilder` hardcoded GST | Medium | ✅ Delete |
| G10 | Lifecycle filters absent | Medium | ✅ Filter chips |
| G11 | Duplicate credit note creation UX | Low | ✅ Consolidate |
| G12 | Book Services invoices lack context columns | Low | Optional column set |

---

## 4. Sprint 8 Implementation Plan

**Estimated duration:** 5–7 working days  
**Migration required:** No (optional additive `lifecycleStatus` deferred)  
**Risk level:** Medium–High (billing critical path)  
**Dependency chain:** Sprint 4C + Sprint 5  

### Phase 8A — Hub shell & navigation (Day 1)

| Task | Details |
|------|---------|
| 8A.1 | Rename `Invoices.tsx` → `BillingFinancePage.tsx`; update `App.tsx` import |
| 8A.2 | Extend `BILLING_TABS`: `invoices`, `payments`, `quotations`, `expenses`, `dues`, `wallet-adjustments` |
| 8A.3 | Fix `billingTabFromSearch` — unknown tab must not silently fall back without user feedback |
| 8A.4 | Remove `dues` from `adminNavConfig.ts`; add redirect `/admin/dues` → `/admin/billing?tab=dues` |
| 8A.5 | Update `FounderDashboard` dues link |
| 8A.6 | Add **customer filter banner** when `?customerId=` present — applies to all tabs; clear button resets URL |

**Deliverable:** Single nav entry; six tabs routable; deep links from Customer 360 resolve correctly.

---

### Phase 8B — Dues tab merge (Day 1–2)

| Task | Details |
|------|---------|
| 8B.1 | Extract `DuesTab.tsx` from `Dues.tsx` — health KPI cards + customer dues table |
| 8B.2 | Wire `customerId` filter to `GET /billing/dues?customerId=` (API enhancement if needed) |
| 8B.3 | Retire standalone `AdminDues` page component (keep thin redirect wrapper only) |
| 8B.4 | Optional: show compact health KPI strip in hub header (visible on all tabs) |

**API change (optional):**

```text
GET /billing/dues?customerId=123  — filter to single customer row
```

---

### Phase 8C — Wallet adjustments tab (Day 2–3)

| Task | Details |
|------|---------|
| 8C.1 | New `WalletAdjustmentsTab.tsx` — customer search, balance display, transaction table |
| 8C.2 | **Credit form** — amount, payment mode (cash/upi/bank_transfer), notes → existing `POST /customers/:id/wallet/credit` |
| 8C.3 | **Debit / adjustment form** — amount, reason (required), notes → new `POST /customers/:id/wallet/debit` |
| 8C.4 | Admin-only guards; validation messages use **₹** explicitly |
| 8C.5 | Copy block: “Wallet holds money adjustments only. Wash credits and visit balances are on service contracts.” |
| 8C.6 | Prefill customer from `?customerId=` (from Customer 360 wallet link) |

**New API:**

```text
POST /api/customers/:id/wallet/debit
Body: { amount, notes, reason }
→ debitWallet({ reference: "manual_adjustment", ... })
```

Restrict `paymentMode: adjustment` for manual admin credits without invoice (existing enum).

---

### Phase 8D — Quotation tab completion (Day 3)

| Task | Details |
|------|---------|
| 8D.1 | New `CreateQuotationDialog.tsx` — reuse patterns from `CreateInvoiceDialog` / contract line items; **server-side GST only** (POST body, display response totals) |
| 8D.2 | Quotation row actions: **Convert to invoice** (`POST /quotations/:id/convert`), **Mark sent/accepted/rejected** (`PATCH /quotations/:id`) |
| 8D.3 | Respect `customerId` filter on list fetch |
| 8D.4 | Delete `QuotationBuilder.tsx` (unrouted, hardcoded GST) |
| 8D.5 | “Create quotation” header button on quotations tab |

**Note:** Ad-hoc quotations without contract are allowed by API but Book Services path should remain contract-first; dialog should optionally link contract when available.

---

### Phase 8E — Expenses tab restore (Day 3)

| Task | Details |
|------|---------|
| 8E.1 | Extract `ExpensesTab.tsx` from `Expenses.tsx` — list + create form |
| 8E.2 | Preserve queued offline create (`queuedFetch`) behavior |
| 8E.3 | Delete or deprecate standalone `Expenses.tsx` page |

---

### Phase 8F — Payment & wallet settlement (Day 4)

| Task | Details |
|------|---------|
| 8F.1 | **Overpayment handling** in `recordPayment`: when `amount > balanceDue`, apply full balance to invoice, credit excess via `creditWallet` (`reference: overpayment`, `referenceId: payment.id`) |
| 8F.2 | **Pay with wallet** checkbox in Record Payment dialog — when enabled, `debitWallet` up to min(wallet balance, amount due) before recording external payment for remainder |
| 8F.3 | Transaction notes / audit trail linking payment ↔ wallet tx |
| 8F.4 | UI: show wallet balance in payment dialog when customer selected |

**Business rules to document in code comments:**

- Overpayment always credits wallet (₹), never entitlements.
- Wallet debit insufficient → block or partial pay with user confirmation.

---

### Phase 8G — Lifecycle filters & invoice polish (Day 4–5)

| Task | Details |
|------|---------|
| 8G.1 | Invoices tab filter chips: All, Unpaid, Overdue, Paid, Credit notes |
| 8G.2 | Quotations tab filter chips: Open (draft/sent/accepted), Converted, Expired |
| 8G.3 | Wire filters to existing `GET /invoices?status=` and `GET /quotations?status=` |
| 8G.4 | Consolidate credit note UX — primary: row action `CreateCreditNoteDialog`; remove document-type toggle from create dialog (or collapse to “Advanced”) |
| 8G.5 | Optional columns on invoice row: contract ID, payment terms (when `contract_registry_id` present) |
| 8G.6 | `CreateInvoiceDialog` — replace client GST math with API preview call |

---

### Phase 8H — Customer 360 deep links & QA (Day 5–6)

| Task | Details |
|------|---------|
| 8H.1 | Verify `BillingSummaryPanel` → `/admin/billing?customerId=` filters all tabs |
| 8H.2 | Verify `WalletSummaryPanel` → `?tab=wallet-adjustments&customerId=` |
| 8H.3 | Book Services success links (`ContractCreatedStep`) still resolve |
| 8H.4 | Manual regression script (see §7) |
| 8H.5 | `SPRINT_8_COMPLETION_REPORT.md` |

---

## 5. Files Affected

### Frontend (new / modified)

| File | Action |
|------|--------|
| `pages/admin/Invoices.tsx` | Rename → `BillingFinancePage.tsx`; tab orchestration |
| `pages/admin/Dues.tsx` | Gut → redirect only |
| `pages/admin/Expenses.tsx` | Gut → redirect only |
| `pages/admin/QuotationBuilder.tsx` | **Delete** |
| `features/billing/components/DuesTab.tsx` | **New** |
| `features/billing/components/WalletAdjustmentsTab.tsx` | **New** |
| `features/billing/components/ExpensesTab.tsx` | **New** |
| `features/billing/components/QuotationsTab.tsx` | **New** (or inline in page) |
| `features/billing/components/CreateQuotationDialog.tsx` | **New** |
| `features/billing/components/CreateInvoiceDialog.tsx` | GST preview fix; remove duplicate CN path |
| `features/billing/components/CreateCreditNoteDialog.tsx` | Keep |
| `components/layout/adminNavConfig.ts` | Remove dues nav item |
| `App.tsx` | Imports, `/admin/dues` redirect |
| `pages/admin/FounderDashboard.tsx` | Dues href |

### Backend (modified)

| File | Action |
|------|--------|
| `routes/wallet.ts` | Add `POST .../wallet/debit` |
| `routes/billing.ts` | Optional `customerId` on dues |
| `routes/payments.ts` | Overpayment + wallet settlement in `recordPayment` |
| `lib/billing/invoiceService.ts` | Wallet-aware payment helper |
| `lib/wallet/service.ts` | No change expected (debit exists) |

### Unchanged (verify only)

| File | Role |
|------|------|
| `lib/billing/contractBillingService.ts` | Book Services billing |
| `lib/billing/invoiceGstEngine.ts` | GST single source |
| `routes/quotations.ts` | Already unified GST |
| `lib/customers/customerBillingSummary.ts` | Customer 360 read model |

---

## 6. API Surface (Sprint 8 delta)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/customers/:id/wallet/debit` | Admin manual debit / adjustment |
| `GET` | `/api/billing/dues?customerId=` | Optional customer-scoped dues |
| — | `POST /api/payments` | Enhanced: overpayment → wallet, pay-with-wallet |
| — | `GET /api/invoices?status=&customerId=` | Wired to UI filters |
| — | `GET /api/quotations?status=&customerId=` | Wired to UI filters |

No breaking changes to existing Book Services contract billing endpoints.

---

## 7. Test Plan

### 7.1 Navigation & tabs

1. Sidebar shows **one** Billing & Finance entry (no Dues).
2. `/admin/dues` redirects to `?tab=dues`.
3. `/admin/billing?tab=wallet-adjustments` renders wallet tab (not invoices).
4. Invalid tab shows friendly fallback or 404 message.

### 7.2 Customer deep links

1. Customer 360 → Open Billing → hub filtered by customer on all tabs.
2. Customer 360 → Adjust in Billing → wallet tab with customer prefilled.

### 7.3 Quotation flow

1. Book Services → quotation → appears in quotations tab.
2. Convert quotation → invoice appears in invoices tab; quotation status = converted.
3. Manual create quotation → GST matches server (`computeInvoiceGst`), not hardcoded 18%.

### 7.4 Invoice & credit note

1. Create tax invoice from hub → PDF downloads.
2. Issue credit note from row → reference invoice balance reduced; CN badge visible.
3. Book Services invoice → visible with contract reference.

### 7.5 Payments & wallet

1. Record full payment → invoice paid.
2. Record overpayment → invoice paid; wallet credited excess ₹.
3. Pay with wallet → wallet debited; invoice balance reduced.
4. Wallet credit (recharge) → ledger + tax invoice created.
5. Manual wallet debit → balance decreases; insufficient balance blocked.

### 7.6 Dues

1. Health KPIs match API totals.
2. Customer with outstanding invoices appears in dues table.
3. Dues decrease after payment / credit note.

### 7.7 Expenses

1. Create expense from billing tab → appears in list.
2. `/admin/expenses` redirect still works.

### 7.8 Regression

1. Customer 360 remains read-only (no billing mutations).
2. Sprint 4C contract-first billing unchanged.
3. Franchisee tenant scoping on all billing APIs.

---

## 8. Acceptance Criteria

Aligned with [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) Sprint 8:

- [ ] Single billing hub with tabs: **Invoices, Payments, Quotations, Expenses, Dues, Wallet Adjustments**
- [ ] No hardcoded 18% GST in any active quotation UI
- [ ] Wallet tab credits/debits **₹ only** — clear copy on forms
- [ ] Wallet overpayment flow documented and working
- [ ] Credit notes end-to-end (row action + PDF)
- [ ] Lifecycle filters: quotation → closed (via status chip filters)
- [ ] Customer 360 Open Billing lands on filtered billing view
- [ ] Book Services invoices appear in hub
- [ ] `/admin/dues` merged; sidebar deduplicated
- [ ] Expense create restored in hub

---

## 9. Rollback Strategy

1. Revert `BillingFinancePage.tsx` → prior `Invoices.tsx` (4 tabs).
2. Restore `/admin/dues` standalone route + nav entry.
3. Revert `App.tsx` redirects if needed.
4. Wallet debit route is additive — safe to disable via feature flag.
5. Payment overpayment logic: revert `recordPayment` to prior behavior (no wallet side effects).

No schema rollback required.

---

## 10. Out of Scope (Sprint 8)

| Item | Target |
|------|--------|
| Razorpay live integration | Future |
| Additive `lifecycleStatus` DB column | Sprint 8B / optional |
| Franchisee GST profiles | Future |
| Customer portal billing mutations | Future |
| Automated dunning / collection workflows | Future |
| Debit note documents | Future |
| OpenAPI codegen for quotations/expenses | Nice-to-have |

---

## 11. Authorization Gate

| Gate | Status |
|------|--------|
| Sprint 7 review complete | ⏳ Pending |
| Sprint 8 planning (this document) | ✅ Complete |
| Sprint 8 implementation | ❌ **Not authorized** |

**Do not start Sprint 8 code changes** until Sprint 7 review approves and founder explicitly authorizes Sprint 8.

---

## 12. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 15 Jun 2026 | Initial audit + Sprint 8 implementation plan |

---

*Planning document only. No code, routes, migrations, or schema changes.*
