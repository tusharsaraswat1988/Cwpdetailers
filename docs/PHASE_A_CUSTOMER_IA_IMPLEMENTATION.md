# Phase A — Customer IA Implementation Report

**Status:** Complete  
**IA Freeze:** v1.0 (`docs/CUSTOMER_IA_FREEZE_v1.md`)

## 1. Files Modified

| File | Change |
|------|--------|
| `artifacts/cwp-platform/src/lib/customer-routes.ts` | **Created** — canonical route constants |
| `artifacts/cwp-platform/src/pages/customer/CustomerRouteRedirects.tsx` | **Created** — legacy redirect components |
| `artifacts/cwp-platform/src/components/layout/CustomerLayout.tsx` | Frozen 5-tab nav, page titles, logo → Home |
| `artifacts/cwp-platform/src/App.tsx` | Canonical routes + legacy aliases |
| `docs/CUSTOMER_IA_FREEZE_v1.md` | **Created** — IA freeze reference |
| `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` | Links + Schedule terminology |
| `artifacts/cwp-platform/src/pages/customer/BookService.tsx` | Customer-facing Schedule copy |
| `artifacts/cwp-platform/src/pages/customer/BookingDetail.tsx` | Scheduled Service copy + routes |
| `artifacts/cwp-platform/src/pages/customer/History.tsx` | Service History title + routes |
| `artifacts/cwp-platform/src/pages/customer/Account.tsx` | Links + Service History label |
| `artifacts/cwp-platform/src/pages/customer/MyAssets.tsx` | Page title per freeze |
| `artifacts/cwp-platform/src/pages/customer/MyPlans.tsx` | Routes + Service History link |
| `artifacts/cwp-platform/src/pages/customer/PlanDetail.tsx` | Routes + Service History section |
| `artifacts/cwp-platform/src/pages/customer/Invoices.tsx` | Schedule link |
| `artifacts/cwp-platform/src/pages/customer/Wallet.tsx` | Redirect via `CUSTOMER_ROUTES` |
| `artifacts/cwp-platform/src/components/plans/PlanSummaryCard.tsx` | Support route for Renew |
| `artifacts/cwp-platform/src/components/shared/WalletChip.tsx` | Default href via `CUSTOMER_ROUTES` |

## 2. Components Created

- `customer-routes.ts` — route map + helpers
- `CustomerRouteRedirects.tsx` — `RedirectToPlans`, `RedirectToSchedule`, `RedirectBookingsIdToSchedule`

## 3. Routes Updated

| Canonical | Component |
|-----------|-----------|
| `/customer/schedule` | `BookService` |
| `/customer/schedule/:id` | `BookingDetail` |
| `/customer/support` | `CustomerComplaints` |

| Legacy alias | Redirects to |
|--------------|--------------|
| `/customer/bookings` | `/customer/schedule` |
| `/customer/bookings/:id` | `/customer/schedule/:id` |
| `/customer/book` | `/customer/schedule` |
| `/customer/services` | `/customer/plans` |
| `/customer/wallet` | `/customer/plans` |
| `/customer/complaints` | `/customer/support` |

## 4. APIs Consumed

Phase A is routing/navigation only — **no new API calls**. Existing pages continue using the same backend endpoints.

## 5. UX Improvements

- Bottom nav matches frozen IA: **Home · My Plans · Schedule · Assets · Account**
- Logo returns to Home (not public marketing site)
- All internal links use canonical `/customer/schedule` paths
- Banned terms removed from customer-visible strings (Book, Booking, Usage History, etc.)
- Legacy bookmarks and deep links continue to work

## 6. Performance Considerations

- Redirect components are zero-fetch (`<Redirect>` only)
- `CUSTOMER_ROUTES` constants avoid string duplication
- No additional API calls per navigation change

## 7. Accessibility Review

- Bottom nav retains `aria-label="Main navigation"` (BottomNav)
- Sign out keeps `aria-label="Sign out"`
- FAB Schedule button uses visible label + icon
- Page titles set in app bar for screen reader context
- **Follow-up (Phase B+):** adaptive CTA should use `aria-live` for state changes

## 8. Test Results

Run locally:

```bash
cd artifacts/cwp-platform && pnpm exec tsc --noEmit
```

Manual verification checklist:

- [ ] Bottom nav shows Home, My Plans, Schedule (FAB), Assets, Account
- [ ] `/customer/bookings` → `/customer/schedule`
- [ ] `/customer/bookings/1` → `/customer/schedule/1`
- [ ] `/customer/services` → `/customer/plans`
- [ ] `/customer/wallet` → `/customer/plans`
- [ ] `/customer/complaints` → `/customer/support`
- [ ] Assets page title: "My Vehicles & Solar Sites"
- [ ] No customer-visible "Book", "Booking", "Wallet", "Transaction History"
