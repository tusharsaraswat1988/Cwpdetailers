# Phase 3.5 — Wallet → My Plans Transformation

**Status:** Implemented (customer portal)  
**Scope:** Business terminology & UX only — backend platforms frozen.

## Objective

Replace the customer-facing concept of "Wallet" with "My Plans". Customers own **service entitlements** (plans), not wallet money.

## Terminology Mapping

| Old (Wallet) | New (My Plans) |
|--------------|----------------|
| Wallet | My Plans |
| Wallet Balance | Remaining Services |
| Recharge | Renew Plan |
| Transactions | Usage History |
| Credits | Included Services |
| Wallet History | Plan History |
| Recharge Wallet | Purchase Plan |
| Wallet Expiry | Plan Expiry |
| Balance | Remaining Visits |
| Available Balance | Remaining Entitlements |

## API Mapping (unchanged endpoints)

| Customer UI | Backend API | Notes |
|-------------|-------------|-------|
| My Plans list | `GET /api/subscriptions?customerId=` | Unified DCMS + legacy subscriptions |
| Plan detail | Same subscription id | DCMS plans redirect to `/customer/daily-cleaning` |
| Usage History | `GET /api/bookings?customerId=` | Bookings as service usage |
| Renew Plan | Contact support → admin `POST /wallet/credit` | Customer does not call wallet APIs |
| Remaining visits | `servicesRemaining` on subscription | Not `walletBalance` |

**Wallet APIs (`/api/customers/:id/wallet*`) are not used in customer UI.** Admin billing retains wallet for ₹ adjustments.

## Plan Status

| Backend `status` | Customer `PlanStatus` |
|------------------|----------------------|
| `active` | ACTIVE |
| `paused` | PAUSED |
| `expired` | EXPIRED |
| `expiring` | RENEWAL_DUE |
| `cancelled` / `completed` | COMPLETED |
| `pending` | PENDING_ACTIVATION |

## Files Modified

### New
- `artifacts/cwp-platform/src/lib/customer-plans.ts` — plan view models & API terminology map
- `artifacts/cwp-platform/src/components/plans/PlanProgressBar.tsx`
- `artifacts/cwp-platform/src/components/plans/PlanSummaryCard.tsx` — reusable across Home, My Plans, Booking, Dashboard, Account
- `artifacts/cwp-platform/src/pages/customer/MyPlans.tsx`
- `artifacts/cwp-platform/src/pages/customer/PlanDetail.tsx`

### Updated (customer portal)
- `pages/customer/Dashboard.tsx` — My Active Plans replaces Wallet card
- `pages/customer/Wallet.tsx` — redirects to `/customer/plans`
- `pages/customer/Services.tsx` — Renew Plan CTA
- `pages/customer/BookService.tsx` — Use Existing Plan / Book One-Time flow
- `pages/customer/Account.tsx` — My Plans link
- `pages/customer/History.tsx` — Usage History title
- `components/layout/CustomerLayout.tsx` — bottom nav My Plans
- `components/shared/WalletChip.tsx` — PlanChip (remaining visits)
- `App.tsx` — routes `/customer/plans`, `/customer/plans/:id`

### Unchanged (admin)
- Wallet admin tabs, billing, Customer 360 wallet panel — admin ₹ ledger unchanged

## Screens Updated

1. **Home** — stat chips: Remaining Visits, Active Plans, Due; My Active Plans section; renewal reminder
2. **My Plans** (`/customer/plans`) — plan cards, renew CTA, plan history, usage history link
3. **Plan Detail** (`/customer/plans/:id`) — summary, progress, usage history, renew/support/invoices
4. **Book** — mode picker: Use Existing Plan vs Book One-Time
5. **Account** — My Plans first in quick links
6. **Services** — paused → Renew Plan
7. **History** — Usage History labeling

## Booking Flow

```
Book → How would you like to book?
  ├─ Use Existing Plan → Eligible plans (remaining services) → Continue booking
  └─ Book One-Time Service → Standard catalog flow
```

## Remaining Work (Phase 4)

- [ ] Per-plan usage history filtered by subscription (currently shows all customer bookings)
- [ ] DCMS included services breakdown on unified plan cards (cleanings vs washes from DCMS API)
- [ ] In-app plan purchase / renewal (today: contact supervisor)
- [ ] Plan search (admin has subscription search; customer plan search not built)
- [ ] Photos in usage history rows
- [ ] Terms & invoices section on plan detail (invoices link exists; terms TBD)
- [ ] OpenAPI docs for subscription unified fields (`vehicleName`, `source`, `daily_cleaning` type)
- [ ] E2E tests for My Plans navigation and booking mode picker
- [ ] Remove `/customer/wallet` redirect after migration period (optional)

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Wallet disappears from customer UI | ✅ |
| Customer understands they own Plans | ✅ |
| Usage replaces Transactions | ✅ |
| Remaining Services replaces Balance | ✅ |
| My Plans first-class module | ✅ |
| Booking: Use Plan / One-Time | ✅ |
| Backend compatible | ✅ |
| Architecture frozen | ✅ |
