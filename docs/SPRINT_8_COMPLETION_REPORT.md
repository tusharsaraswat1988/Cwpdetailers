# Sprint 8 Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Sprint:** 8 — Billing Consolidation  
**Governing doc:** [`BILLING_CONSOLIDATION_PLAN_V1.md`](./BILLING_CONSOLIDATION_PLAN_V1.md)  
**Basis:** [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) § Sprint 8, [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md) §10  

**Status:** Complete — awaiting Sprint 8 review gate  

---

## 1. Objective

Single **Billing & Finance** hub at `/admin/billing` with six tabs, unified GST preview, wallet adjustments, dues merge, payment settlement enhancements, and Customer 360 deep links.

---

## 2. Founder requirements (additional)

| Requirement | Implementation |
|-------------|----------------|
| Wallet debit requires mandatory `reason` | `POST /api/customers/:id/wallet/debit` returns 400 if `reason` missing/blank; UI marks field required |
| Customer filter banner on all billing tabs | `CustomerFilterBanner` rendered above tabs when `?customerId=` set; all list tabs receive filter |
| Invoice list shows Contract, Location, Asset | `GET /invoices` joins `service_locations` + `assets`; `InvoicesTab` columns with deep links |
| Extra `recordPayment()` regression testing | `scripts/src/sprint8-recordPayment-verify.ts` — settlement, overpayment, wallet offset |

---

## 3. Backend changes

| File | Change |
|------|--------|
| `lib/billing/invoiceService.ts` | `recordPayment` — wallet offset (`useWallet`), overpayment → `creditWallet`, split wallet/external payment rows |
| `routes/wallet.ts` | **NEW** `POST /customers/:id/wallet/debit` (admin, mandatory reason) |
| `routes/payments.ts` | `GET /invoices` — `documentType`, `hasBalance`, contract/location/asset joins; **NEW** `POST /invoices/gst-preview`; `POST /payments` accepts `useWallet` |
| `routes/billing.ts` | `GET /billing/dues?customerId=` filter |

**No schema migrations.**

---

## 4. Frontend changes

### Hub shell

| File | Action |
|------|--------|
| `pages/admin/BillingFinancePage.tsx` | **NEW** — canonical hub (6 tabs, header actions, customer banner) |
| `pages/admin/Invoices.tsx` | Re-exports `BillingFinancePage` |
| `pages/admin/Dues.tsx` | Redirect → `?tab=dues` |
| `pages/admin/Expenses.tsx` | Redirect → `?tab=expenses` |
| `pages/admin/QuotationBuilder.tsx` | **Deleted** (hardcoded 18% GST orphan) |
| `components/layout/adminNavConfig.ts` | Removed duplicate Dues nav entry |
| `App.tsx` | Billing route → `BillingFinancePage` |
| `FounderDashboard.tsx` | Collections Due → `/admin/billing?tab=dues` |

### Tab components (new)

| Component | Role |
|-----------|------|
| `CustomerFilterBanner.tsx` | Visible customer filter + clear |
| `InvoicesTab.tsx` | Lifecycle chips, contract/location/asset columns, credit note row action |
| `PaymentsTab.tsx` | Filtered payment list |
| `QuotationsTab.tsx` | Create, convert, status filters |
| `ExpensesTab.tsx` | Create + list (from legacy page) |
| `DuesTab.tsx` | Health KPIs + dues table |
| `WalletAdjustmentsTab.tsx` | Credit/debit forms, ₹ copy, ledger |
| `RecordPaymentDialog.tsx` | Wallet balance display, `useWallet` checkbox |
| `CreateQuotationDialog.tsx` | Server GST preview only |
| `CreateInvoiceDialog.tsx` | Credit note mode removed; GST via `/invoices/gst-preview` |

---

## 5. Payment & wallet behavior

### `recordPayment()` (transactional)

1. **useWallet + invoice** — debits wallet up to `min(balance, balanceDue)`; records `method: wallet` payment row.
2. **External amount** — records cash/upi/etc. payment row.
3. **Invoice settlement** — applies `min(total, balanceDue)` to invoice via `applyPaymentToInvoice`.
4. **Overpayment** — excess credited to wallet (`reference: overpayment`, `paymentMode: adjustment`).

### Wallet debit (admin)

- Route: `POST /api/customers/:id/wallet/debit`
- Body: `{ amount, reason, notes? }` — **`reason` required**
- Uses `debitWallet` with `reference: manual_adjustment`

---

## 6. Acceptance criteria ([`BILLING_CONSOLIDATION_PLAN_V1.md`](./BILLING_CONSOLIDATION_PLAN_V1.md) §8)

- [x] Single billing hub: Invoices, Payments, Quotations, Expenses, Dues, Wallet Adjustments
- [x] No hardcoded 18% GST in active quotation UI (server preview + API GST engine)
- [x] Wallet tab credits/debits ₹ only — clear copy on forms
- [x] Wallet overpayment flow implemented in `recordPayment`
- [x] Credit notes end-to-end (row action + PDF unchanged)
- [x] Lifecycle filters: invoice chips + quotation chips
- [x] Customer 360 Open Billing → filtered hub (`?customerId=`)
- [x] Customer 360 wallet link → `?tab=wallet-adjustments&customerId=`
- [x] Book Services invoices appear in hub (contract columns when linked)
- [x] `/admin/dues` merged; sidebar deduplicated
- [x] Expense create restored in hub tab

---

## 7. Regression testing

### Automated script

```bash
npx tsx scripts/src/sprint8-recordPayment-verify.ts
```

Covers:

| Case | Assertion |
|------|-----------|
| Full invoice pay | `balanceDue = 0`, `status = paid` |
| Overpayment | Invoice paid; wallet credited excess ₹ |
| Pay with wallet | Wallet debited; invoice balance reduced |
| Wallet payment row | `payments.method = wallet` recorded |
| Debit audit | Wallet debit tx has notes |

**Note:** Script requires DB connectivity and `tsx` in environment. Run against staging/dev before sign-off.

### Manual QA checklist

1. `/admin/billing?tab=wallet-adjustments` — tab renders (not invoices fallback)
2. `/admin/dues` redirects to dues tab
3. Customer filter banner visible on every tab when `?customerId=` set
4. Invoice rows show Contract #, Location, Asset when Book Services billing linked
5. Record Payment with overpayment → check wallet balance increased
6. Record Payment with “Apply wallet” → invoice paid from wallet
7. Wallet debit without reason → API 400
8. Quotation convert → invoice in Invoices tab
9. Customer 360 remains read-only (no billing mutations)

---

## 8. Rollback strategy

1. Revert `BillingFinancePage.tsx` → prior `Invoices.tsx` (4-tab version from git).
2. Restore `adminNavConfig` Dues sidebar entry.
3. Wallet debit route is additive — disable by reverting `routes/wallet.ts`.
4. `recordPayment` wallet/overpayment logic — revert `invoiceService.ts` to pre-Sprint-8.

No schema rollback required.

---

## 9. Out of scope (unchanged)

- Razorpay live integration
- Additive `lifecycleStatus` DB column
- Customer portal billing mutations
- Automated dunning workflows

---

## 10. Next gate

**Do not start post-Sprint-8 enhancements.** Await Sprint 8 review and approval.

---

*End of Sprint 8 completion report.*
