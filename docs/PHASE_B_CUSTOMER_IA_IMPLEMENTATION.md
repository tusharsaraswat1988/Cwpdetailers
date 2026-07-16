# Phase B — Operational Home Dashboard

**Status:** Complete  
**IA Freeze:** v1.0 (`docs/CUSTOMER_IA_FREEZE_v1.md`)

## Design rule (non-negotiable)

Primary Home content must fit **one screen height without scrolling**:

```
Current Address
      ↓
Operational Hero
      ↓
Primary CTA
      ↓
Current Plan
```

Everything else lives below the fold.

## 1. Files created

| File | Purpose |
|------|---------|
| `artifacts/cwp-platform/src/lib/home-dashboard.ts` | Composes address, hero, CTA, plan, action queue from existing APIs |
| `artifacts/cwp-platform/src/lib/home-dashboard.test.ts` | Unit tests for CTA priority and plan selection |
| `artifacts/cwp-platform/src/components/home/CurrentAddressBar.tsx` | Current address strip (links to Assets) |
| `artifacts/cwp-platform/src/components/home/OperationalHero.tsx` | Dynamic operational status hero (`aria-live="polite"`) |
| `artifacts/cwp-platform/src/components/home/AdaptivePrimaryCta.tsx` | Single adaptive primary button |
| `artifacts/cwp-platform/src/components/home/CurrentPlanWidget.tsx` | Concise Current Plan summary |
| `artifacts/cwp-platform/src/components/home/HomeBelowFold.tsx` | Action queue (max 2) + footer links |

## 2. Files modified

| File | Change |
|------|--------|
| `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` | Rebuilt as operational dashboard; removed stat chips, marketing cards, activity feed from above-fold |
| `artifacts/cwp-platform/vitest.config.ts` | Added `@/` path alias for unit tests |
| `artifacts/cwp-platform/src/lib/customer-wallet.ts` | Fixed truncated stub (unblocks typecheck) |

## 3. Above-fold layout

- Section `data-testid="home-above-fold"` capped at  
  `calc(100dvh - var(--app-bar-height) - var(--bottom-nav-height) - 2rem)`  
  accounting for app chrome and main padding.
- `overflow-hidden` prevents primary content from spilling into a scroll-first experience.
- Compact single-line address bar (address · asset on one row).

## 4. Removed from Home (marketing / clutter)

- Stat chips (bookings count, dues, etc.)
- `DcmsHomeCard` promo block
- `PlanSummaryCard` grid
- `ActivityFeed`
- Renewal banner in primary viewport

## 5. Below the fold

- `PasswordSetupNudge`
- Action queue (dues, renewal — max 2 items, only when not already the primary CTA)
- Footer links: All plans · Service history · Assets

## 6. `buildHomeDashboard()` logic

Reuses frozen platforms only — no new backend concepts.

### Current address (`resolveCurrentAddress`)

1. Upcoming scheduled service address (from `recentBookings`)
2. First vehicle `serviceAddress` / `address`
3. First solar site address
4. Fallback CTA copy → Assets

### Operational hero (`buildHero`)

Priority: feedback due → in progress → en route → pending → scheduled today → next scheduled → DCMS active plan → clear state.

### Adaptive primary CTA (`buildAdaptiveCta`)

| Priority | Condition | CTA |
|----------|-----------|-----|
| 1 | Pending feedback | Rate Your Visit |
| 2 | In progress / en route | Track Today's Service |
| 3 | Scheduled today | View Today's Service |
| 4 | Future scheduled | View Scheduled Service |
| 5 | Outstanding dues | View Your Bill |
| 6 | Renewal / expired plan | Renew Plan |
| 7 | Paused plan | Contact CWP to Resume |
| 8 | Active credit plan | Schedule Next Visit |
| 9 | Active DCMS plan | View Daily Cleaning Plan |
| 10 | Assets, no plans | Get a Plan for your vehicle/site |
| 11 | No assets | Add Your Vehicle |
| 12 | Default | Schedule a Service |

### Current Plan widget (`pickPrimaryPlan`)

1. Renewal-due or expired plan
2. Active plan with most remaining visits
3. Paused plan
4. Empty state → “No active plan” + link to My Plans

## 7. APIs consumed (unchanged)

| Endpoint | Used for |
|----------|----------|
| `GET /api/customers/:id/summary` | `recentBookings`, `pendingDues` |
| `GET /api/subscriptions?customerId=` | Plan list via `activePlans()` |
| `GET /api/vehicles` | Address fallback, asset context |
| `GET /api/solar-sites` | Address fallback |
| `GET /api/daily-cleaning/customer/pending-feedback` | Feedback hero + CTA |

## 8. Test results

```bash
cd artifacts/cwp-platform && pnpm test src/lib/home-dashboard.test.ts
```

```
✓ pickPrimaryPlan > prefers renewal-due plan
✓ buildHomeDashboard > surfaces track CTA when service is en route
✓ buildHomeDashboard > defaults to schedule CTA for new customer with assets
✓ buildHomeDashboard > uses invoice CTA when dues outstanding
```

## 9. Manual verification checklist

- [ ] Open Home on mobile — four primary blocks visible without scrolling
- [ ] En-route booking → hero pulses, CTA is “Track Today's Service”
- [ ] No plans + has vehicle → CTA “Get a Plan for your vehicle”
- [ ] Outstanding dues → CTA “View Your Bill”
- [ ] Current Plan links to plan detail; empty state links to My Plans
- [ ] No Wallet / Book / Booking / marketing banners above the fold
- [ ] Scroll reveals only password nudge, action queue, footer links

## 10. Deferred to later phases

- Plan-scoped usage history on Plan Detail (Phase E)
- DCMS tabs absorbed into unified Plan Detail (Phase E)
- Self-serve renewal flow (Phase E/G)
- `subscriptionId` on booking create (Phase D)
