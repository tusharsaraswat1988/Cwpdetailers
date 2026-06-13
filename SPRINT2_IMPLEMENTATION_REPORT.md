# Sprint 2 Implementation Report

**CWP World-Class Product Experience — Customer Portal Expansion**  
**Date:** 13 June 2026  
**Status:** ✅ COMPLETE — TypeScript: 0 errors  
**Scope:** Customer portal only — Staff portal unchanged (Sprint 3)

---

## Pre-Sprint: Roadmap Update

Added **Sprint M — Legacy Migration Tools** to `CWP_UI_IMPLEMENTATION_ROADMAP.md`.

| Field | Value |
|-------|-------|
| Schedule | After Sprint 4 (Daily Ops stabilization), before full customer rollout |
| Required before Sprint 2? | No |
| Purpose | Migrate legacy customers: contracts, wallet balance, credits, visits, staff, audit trail |

Sprint order unchanged. Sprint 3 remains Staff App Shell → Jobs → Earnings → Profile.

---

## Summary

Sprint 2 delivers two new customer screens (Wallet, Services), updates bottom navigation per roadmap, and adds an Account hub stub. History improvements from Sprint 1 (month grouping, 80px photos, lightbox) remain in place.

| Deliverable | Status | File |
|-------------|--------|------|
| `/customer/wallet` page | ✅ | `pages/customer/Wallet.tsx` |
| `/customer/services` page | ✅ | `pages/customer/Services.tsx` |
| Bottom nav update | ✅ | `components/layout/CustomerLayout.tsx` |
| Account stub (Sprint 9 placeholder) | ✅ | `pages/customer/Account.tsx` |
| Shared wallet fetchers | ✅ | `lib/customer-wallet.ts` |
| Routes registered | ✅ | `App.tsx` |
| History timeline (Sprint 1 carry-over) | ✅ | `pages/customer/History.tsx` |
| Staff portal | ⏭ Unchanged | — |

---

## 1. Customer Wallet (`/customer/wallet`)

**File:** `artifacts/cwp-platform/src/pages/customer/Wallet.tsx`

### Features
- **Hero balance card** — large ₹ display with `IndianRupee` icon
- **Low balance banner** — reuses `walletSummary.isLowBalance` logic from Dashboard
- **Outstanding dues section** — shows `summary.pendingDues` with link to `/customer/invoices`
- **Recharge info card** — Call CWP + WhatsApp contact buttons
- **Full transaction list** — up to 50 transactions from `/api/customers/:id/wallet/transactions`
- **EmptyState** when no transactions
- **ErrorState** with retry on API failure

### Data sources (existing APIs only)
```
GET /api/customers/:id/wallet
GET /api/customers/:id/wallet/transactions?limit=50
GET /api/customers/:id/summary  (pending dues)
```

---

## 2. Customer Services (`/customer/services`)

**File:** `artifacts/cwp-platform/src/pages/customer/Services.tsx`

### Features
- **Active subscriptions** — `CompletionRing` when `totalServices` is set
- **Paused section** — amber-accented cards + "Recharge wallet" CTA → `/customer/wallet`
- **Solar AMC card** — when `type === solar_amc`: next visit, visits done, remaining
- **Book service** button in header → `/customer/bookings`
- **Manage assets** link → `/customer/assets` (legacy route preserved)
- **EmptyState** with Book CTA when no plans

### Data source
```
useListSubscriptions({ customerId })
```

---

## 3. CustomerLayout Bottom Nav

**File:** `artifacts/cwp-platform/src/components/layout/CustomerLayout.tsx`

### Before (Sprint 1)
```
Home | Services (/assets) | Book | History | Support
```

### After (Sprint 2 — per roadmap)
```
Home | Services (/services) | Book | Wallet | Account
```

### Page title map
Direct navigation to legacy routes still shows correct titles:
- `/customer/history` → History
- `/customer/invoices` → Invoices
- `/customer/assets` → My Assets
- `/customer/complaints` → Support

---

## 4. Account Hub Stub

**File:** `artifacts/cwp-platform/src/pages/customer/Account.tsx`  
**Route:** `/customer/account`

Placeholder for Sprint 9 full Account hub. Provides:
- Profile card (name, phone, email)
- Links to History, Invoices, Assets, Support

Legacy routes remain fully functional — not removed from `App.tsx`.

---

## 5. Shared Wallet Utilities

**File:** `artifacts/cwp-platform/src/lib/customer-wallet.ts`

Extracted `fetchWalletSummary` and `fetchWalletTransactions` for reuse across Wallet page and future Dashboard refactor.

---

## 6. Routes Added

**File:** `artifacts/cwp-platform/src/App.tsx`

```tsx
/customer/wallet    → CustomerWallet
/customer/services  → CustomerServices
/customer/account   → CustomerAccount
```

**Preserved (unchanged):**
```
/customer/assets, /customer/history, /customer/invoices, /customer/complaints
```

---

## 7. History (Sprint 2.4 — completed in Sprint 1)

No additional History changes required. Existing implementation satisfies Sprint 2 definition of done:

- ✅ Month grouping (`June 2026` headers)
- ✅ 80px photos (`w-20 h-20`)
- ✅ Tap-to-expand lightbox (`Dialog`)
- ✅ EmptyState with Book CTA

---

## Definition of Done Checklist

- [x] `/customer/wallet` accessible and shows balance + transactions
- [x] `/customer/services` accessible and shows active plans with completion rings
- [x] Bottom nav has Wallet tab (pointing to `/customer/wallet`)
- [x] Bottom nav Services tab points to `/customer/services`
- [x] Account tab stub at `/customer/account`
- [x] History has month grouping
- [x] History photos are 80px min + tap-to-expand
- [x] Old routes still work (`/customer/assets`, `/customer/history`, etc.)
- [x] No Staff portal changes
- [x] No business logic changes
- [x] No schema changes
- [x] TypeScript: 0 errors

---

## Files Changed

| File | Change |
|------|--------|
| `CWP_UI_IMPLEMENTATION_ROADMAP.md` | Added Sprint M |
| `src/lib/customer-wallet.ts` | **New** — shared wallet API helpers |
| `src/pages/customer/Wallet.tsx` | **New** — wallet page |
| `src/pages/customer/Services.tsx` | **New** — services page |
| `src/pages/customer/Account.tsx` | **New** — account stub |
| `src/components/layout/CustomerLayout.tsx` | Updated bottom nav + page titles |
| `src/App.tsx` | Added 3 customer routes |

**Total:** 7 files (3 new pages, 1 new lib, 3 modified)

---

## What Was NOT Changed

- Staff portal (Dashboard, Schedule, Layout) — Sprint 3
- Admin portal
- API routes / database schema
- Business logic
- Customer Dashboard (wallet section kept; dedicated Wallet page is additive)

---

## Sprint 3 Preview (Next — Approved Order)

Per roadmap, do not start until Sprint 2 is verified:

1. Replace `StaffLayout` with `AppShell` + bottom nav
2. Staff Dashboard — active job focus mode
3. Create `/staff/jobs` (replaces schedule UX)
4. Create `/staff/earnings`
5. Create `/staff/profile`

**Sprint M (Legacy Migration)** remains scheduled after Sprint 4.
