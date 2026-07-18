# Phase 2.5 — Billing & Finance → Commercial Operations Center

**Status:** READY FOR REVIEW
**Scope:** UX only. No backend, database, routes, invoices/payments/GST/contract/pricing business logic, or permissions were changed.
**Frozen inputs (unchanged):** Bookings, Staff Assignment, Operations Control Center, Job Orchestration — all consumed read-only via existing APIs.
**Wait for approval before Phase 3 — Executive Dashboard.**

---

## 1. Existing Screen Audit

`BillingFinancePage.tsx` was `AdminLayout` + `PageActionHeader` + seven shadcn `Tabs`, none of which used the shared Phase-6 kit (`PageTemplate` / `DataTable` / `FilterBar` / `KpiRow` / `EntityDrawer`).

| Tab | Pattern found | Verdict |
|---|---|---|
| Commercial Closure | Nested `Tabs` + card-grid queues (Ready/Draft/Issued/Outstanding/Paid), local `StatusBadge`, `Dialog`s for preview/issue/mark-paid/void | **Redesigned** — merged into Commercial Operations Center |
| Invoices | Bespoke `<table>`, button filters, no pagination UI despite the backend supporting `limit`/`offset`/`total` | **Redesigned** — merged into Commercial Operations Center |
| Payments | Bespoke `<table>`, read-only | **Kept** (no local status-color map to fix) |
| Quotations | Bespoke `<table>` + local `qStatusColors` map | **Polished** — swapped to shared `StatusBadge` |
| Expenses | Inline form + bespoke `<table>` | **Kept** (category `Badge` is not a status map) |
| Dues | KPI `Card`s + bespoke `<table>` | **Kept** |
| Wallet Adjustments | Search + forms + ledger list | **Kept** |

**Backend audit (reused as-is, unmodified):** `routes/commercial-billing.ts` and `lib/billing/commercialClosureService.ts` fully support preview, generate-draft, issue, mark-paid, void, credit-note, and merged timeline/history. `listCommercialInvoices` selects **all** `tax_invoice` rows (job-linked *and* manual), which made a single Invoice & Collections queue possible without any backend change. `commercial_status`: `draft | issued | payment_pending | paid | commercially_closed | voided`. `billing_mode`: `subscription_visit | one_time | prepaid_fulfillment | manual`.

**Gaps confirmed (not backend-supported, handled honestly rather than invented):**
- No "Send Reminder" / notification endpoint anywhere in billing.
- No server-side export.
- No date-range ("overdue"/"today") aggregation endpoint — the commercial list only filters by `status`/`outstanding`.
- The commercial endpoint returns raw invoice rows with **no customer-name join** (unlike the legacy `/api/invoices` list), so customer names are resolved client-side via the existing per-id `useGetCustomer` hook (same pattern already used by `CustomerFilterBanner`).

---

## 2. UX Improvements

- Commercial Closure + Invoices (two separate tabs, two status vocabularies) → **one page, two visible queues** (Ready for Billing, Invoice & Collections) — no tabs, per the Page Contract.
- Ready for Billing is now visually the highest-priority section (bordered "handoff" panel) instead of one queue among five inside a nested tab set.
- Collection Insights KPI row (Ready for Billing, Draft, Outstanding, Overdue, Paid/Closed, Collected Today) — every tile is clickable and filters/scrolls the queues below (recognition over recall, fewer clicks).
- Payment status is now a **visual stepper** (Draft → Issued → Outstanding → Paid → Closed) next to the text badge, not text alone.
- Bulk actions (Issue, Mark Paid, Export Selected) via `BulkActionBar` — previously no bulk actions existed anywhere in billing.
- All destructive/state-changing actions (`Void`, `Mark Paid`) now go through the shared `ConfirmDialog` instead of ad-hoc dialogs with no confirm step for void reasons.
- Sorting/pagination/column-visibility/sticky actions column now available on the invoice queue (previously: fixed `limit=50`, no pager).
- Quotations' local status→color map replaced with the shared `StatusBadge`.

## 3. Intelligent UX Recommendations (implemented)

| Recommendation | UX principle | Operational benefit |
|---|---|---|
| Commercial Handoff pipeline card between the two queues | System status / continuity | Operations→Billing→Collections reads as one pipeline, not two disconnected lists |
| Clickable KPI row that filters/scrolls the queues | Recognition over recall, Fitts's Law | One click from a count to the exact work queue |
| Payment-progress stepper per row and in the drawer | Progressive disclosure, status ≠ color-only | Instant read of "how far along" without opening the row |
| Overdue-days chip on the Due Date column | Error prevention / prioritization | Collections staff see risk without computing it mentally |
| Split Commercial Timeline (workflow) vs Activity (audit: void/credit-note/entitlement) | Separation of concerns (UI Constitution §10) | Founders read the story; auditors read the log — without mixing them |
| `ConfirmDialog` for Void with a required reason field | Error prevention | No accidental voids; audit trail always has a reason |

## 4. Enterprise UX Opportunities

| Priority | Opportunity |
|---|---|
| High | Add `customerName`/service join to `GET /billing/commercial` so the invoice queue doesn't need N per-row `useGetCustomer` calls (backend change, out of scope this phase) |
| High | Add a dedicated `overdue` status filter + a lightweight `/billing/commercial/summary` aggregate endpoint so KPI counts aren't capped at the 100-row page limit |
| Medium | Surface credit notes (`documentType=credit_note`) as a visible row/marker in the unified queue instead of only reachable via the parent invoice's Actions tab |
| Medium | Deep-link "Related Job" in the invoice drawer to a specific Job Orchestration row (today it's a general reference, since Job Orchestration has no per-job URL) |
| Low | Saved filter presets (FilterBar already has a UI-only `savedFilters` slot) for recurring collections views (e.g. "This week's overdue") |

## 5. Future UX Opportunities (tracked, not implemented)

Payment gateway integration · Auto reminders / dunning · Collection-risk prediction · AI collection assistant · Revenue forecasting · Payment heatmap · Invoice approval automation.

## 6. Components Reused

`PageTemplate`, `DataTable`, `FilterBar`, `KpiRow` / `StatCard`, `EntityDrawer`, `Timeline`, `ActivityFeed`, `BulkActionBar`, `ActionBar`, `ConfirmDialog`, `StatusBadge`; existing `CreateCreditNoteDialog`, `InvoicePdfButton`, `CustomerFilterBanner`, `CreateInvoiceDialog`, `RecordPaymentDialog`; existing commercial-billing API functions (`fetchReadyForBilling`, `previewJobInvoice`, `generateJobInvoice`, `fetchCommercialInvoices`, `fetchCommercialInvoiceDetail`, `issueCommercialInvoice`, `markCommercialInvoicePaid`, `voidCommercialInvoice`) — all unchanged.

## 7. Shared Components Extended

- **`StatusBadge`** (`components/shared/StatusBadge.tsx`): additive tone-map entries for `payment_pending`, `commercially_closed`, `issued`, `voided`, `sent`, `accepted`, `converted`, `expired`. No existing keys changed or removed.
- **`commercial-billing/api.ts`**: additive `dueDate` field on `CommercialInvoice` (already returned by the backend, previously untyped) and new `PAYMENT_STAGES` / `paymentStageIndex()` helpers for the stepper. No request/response contracts changed.

No new shared component was introduced — the payment-progress stepper and customer-name cell are local render helpers inside `CommercialOperationsCenter.tsx`, consistent with "extend, don't fork."

## 8. Files Modified

**New:**
- `artifacts/cwp-platform/src/features/commercial-billing/CommercialOperationsCenter.tsx`
- `docs/PHASE_2_5_BILLING_COMMERCIAL_OPERATIONS.md`

**Modified:**
- `artifacts/cwp-platform/src/pages/admin/BillingFinancePage.tsx` — `PageTemplate` shell, removed Invoices tab.
- `artifacts/cwp-platform/src/features/billing/billingTabs.ts` — removed `"invoices"`, relabelled `"commercial"` → "Commercial Operations".
- `artifacts/cwp-platform/src/features/billing/components/QuotationsTab.tsx` — `StatusBadge` instead of local color map.
- `artifacts/cwp-platform/src/features/commercial-billing/api.ts` — additive `dueDate` field + stepper helpers.
- `artifacts/cwp-platform/src/components/shared/StatusBadge.tsx` — additive tone-map entries.
- `artifacts/cwp-platform/src/features/book-services/components/ContractCreatedStep.tsx` — updated post-checkout invoice link from `?tab=invoices` to `?tab=commercial`.

**Removed (superseded, no remaining imports verified before deletion):**
- `artifacts/cwp-platform/src/features/commercial-billing/CommercialClosurePanel.tsx`
- `artifacts/cwp-platform/src/features/billing/components/InvoicesTab.tsx`

## 9. Breaking Changes

- `/admin/billing?tab=invoices` deep links now fall back to the default `commercial` tab (which contains the same invoices, unified). No 404 — `billingTabFromSearch()` already falls back safely for unrecognized tab values.
- The `BillingTab` union lost the `"invoices"` member; any other code referencing it at compile time would fail to build (none found in the codebase after a full-project search).

## 10. Before vs After

**Before:** 7 tabs; Commercial Closure and Invoices were two separate card/table UIs with two disconnected status vocabularies; no shared DataTable/FilterBar/KpiRow anywhere in billing; no bulk actions; fixed 50-row invoice list with no pager; status shown as plain text/local color badges.

**After:** 6 tabs; a single no-tabs Commercial Operations Center (Collection Insights KPIs → FilterBar → Ready for Billing queue → Commercial Handoff pipeline → Invoice & Collections queue with sort/pagination/bulk actions) unifies the full invoice lifecycle for both job-driven and manual invoices; visual payment-progress stepper; `ConfirmDialog`-gated Void/Mark Paid; client-side CSV export; Quotations tab now uses the shared status system. Payments/Expenses/Dues/Wallet Adjustments tabs are functionally unchanged.

## 11. Build Status

`pnpm --filter @workspace/cwp-platform build` — **green**. 4546 modules transformed, Vite + PWA/service-worker build completed with no TypeScript or bundler errors (only the pre-existing "chunk > 500kB" advisory warning, unrelated to this change).

## 12. Remaining Technical Debt

1. KPI/handoff counts for Draft, Outstanding, Overdue and Collected-Today are computed client-side from up to 100 rows per status (the backend's `limit` cap) — exact for typical SMB volumes today, but will under-count once any status queue exceeds 100 rows. Fixing this cleanly needs a backend aggregate endpoint (tracked as a High enterprise opportunity above).
2. Customer names in the Invoice & Collections queue are resolved via one `useGetCustomer(id)` call per unique customer on the visible page (react-query dedupes repeats) because `GET /billing/commercial` doesn't join customer data. A backend join would remove this N+1 pattern.
3. Credit notes are not shown as their own row/marker in the unified queue — only reachable from the parent invoice's Actions tab, same as before this phase.
4. "Collected Today" / "Overdue" are best-effort labels reflecting currently loaded data, not a guaranteed real-time ledger total — documented in-code and here rather than presented as precise accounting figures (this page remains explicitly "not an accounting system").
5. Pre-existing debt carried over unchanged from Phase 5.6: invoice numbering is max+1 (concurrency risk), multiple subscription authorities coexist, OpenAPI lags runtime commercial endpoints, in-process-only domain events (no durable outbox).

---

**Phase 2.5 is READY FOR REVIEW. Wait for approval before Phase 3 — Executive Dashboard.**
