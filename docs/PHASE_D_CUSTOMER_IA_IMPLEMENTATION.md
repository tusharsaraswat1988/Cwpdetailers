# Phase D — Schedule Journey

**Status:** Complete  
**IA Freeze:** v1.0

## Design principle

Never ask for information CWP already knows. Steps auto-skip when only one valid option exists.

**Flow:** Asset → Plan → Service → Date → Time → Review → Request Received

### Entry-point consistency (success criterion)

The Schedule journey is **identical** whether the customer starts from **Home**, **My Plans**, or **My Vehicles & Solar Sites** (or the Schedule FAB). Regardless of entry point, the system skips already-known choices (asset, plan, address) and lands on the next meaningful decision.

| Entry | URL params | Skips |
|-------|------------|-------|
| Home — Schedule Next Visit | `?planId=&from=home` | Asset + Plan → Service |
| Home — Schedule a Service | `?from=home` | Asset if single / hinted |
| My Plans — Schedule Next Visit | `?planId=&from=plans` | Asset + Plan → Service |
| My Plans — empty state | `?from=plans` | Per customer context |
| Assets — Schedule | `?vehicleId=` or `?solarSiteId=` + optional `planId`, `from=assets` | Asset (+ Plan if plan linked) |
| Schedule FAB | `?from=fab` | Per customer context |

Unified resolver: `src/lib/schedule-entry.ts` — `resolveScheduleEntryContext()` used by `BookService.tsx`. Canonical URL builder: `CUSTOMER_ROUTES.scheduleEntry()`.

## 1. Files created

| File | Purpose |
|------|---------|
| `src/lib/schedule-journey.ts` | Step machine, auto-skip, plan/service filtering |
| `src/lib/schedule-entry.ts` | Unified entry context — URL params, asset/plan/address resolution |
| `src/lib/schedule-entry.test.ts` | Entry-point consistency tests |
| `src/lib/schedule-journey.test.ts` | Unit tests |
| `src/lib/schedule-slots.ts` | Available dates (Sundays disabled) + time slots |
| `src/lib/coverage-client.ts` | `POST /api/coverage/check` wrapper |
| `src/components/schedule/ScheduleStepProgress.tsx` | Progress indicator |
| `src/components/schedule/ScheduleAssetStep.tsx` | Asset picker (grouped) |
| `src/components/schedule/SchedulePlanStep.tsx` | Use This Plan / One-Time Visit |
| `src/components/schedule/ScheduleServiceStep.tsx` | Coverage-filtered services |
| `src/components/schedule/ScheduleDateStep.tsx` | Available dates only |
| `src/components/schedule/ScheduleTimeStep.tsx` | Available slots only |
| `src/components/schedule/ScheduleReviewStep.tsx` | Review + Request Service |
| `src/components/schedule/ScheduleSuccessScreen.tsx` | Request Received success |

## 2. Files modified

| File | Change |
|------|--------|
| `src/pages/customer/BookService.tsx` | Full rewrite — asset-first journey; uses `resolveScheduleEntryContext()` |
| `src/pages/customer/MyPlans.tsx` | Schedule CTAs via `scheduleEntry()`; fixed Card imports |
| `src/pages/customer/PlanDetail.tsx` | Schedule Next Visit CTA with `planId` |
| `src/components/plans/PlanSummaryCard.tsx` | Schedule Next Visit per eligible plan |
| `src/components/layout/CustomerLayout.tsx` | FAB uses `scheduleEntry({ from: 'fab' })` |
| `src/lib/home-dashboard.ts` | Home schedule CTAs use `scheduleEntry()` |
| `src/lib/asset-dashboard.ts` | Asset schedule links include `planId` + `from=assets` |
| `src/lib/customer-routes.ts` | `scheduleEntry()` helper |
| `src/pages/customer/BookingDetail.tsx` | Status section, asset row, Support link, terminology |
| `src/lib/asset-dashboard.ts` | Health labels per Phase D spec |

## 3. Routes updated

No new routes. Canonical: `/customer/schedule`, `/customer/schedule/:id`

Query params: `?vehicleId=`, `?solarSiteId=`, `?planId=`, `?mode=one_time`, `?from=home|plans|assets|fab`

## 4. APIs consumed (unchanged)

| Endpoint | Used for |
|----------|----------|
| `GET /api/vehicles` | Asset list + address |
| `GET /api/solar-sites` | Asset list + address |
| `GET /api/subscriptions?customerId=` | Eligible plans per asset |
| `GET /catalog/services` | Service catalog |
| `POST /api/coverage/check` | Location Intelligence — filter available services |
| `GET /catalog/self-booking/check` | Plan credit eligibility |
| `GET /catalog/pricing/quote` | One-time price estimate |
| `POST /api/bookings` | Submit service request |
| `GET /api/bookings/:id` | Scheduled service detail |
| `GET /api/bookings/:id/timeline` | Status timeline |

## 5. UX improvements

| Rule | Implementation |
|------|----------------|
| One asset | Auto-select, skip asset step |
| One eligible plan | Auto **Use This Plan** |
| No plans | Auto **One-Time Visit** |
| One service at address | Auto-select |
| One address | From asset or `selected-address` store |
| Coverage | Only show services returned by Coverage Engine |
| Dates | Sundays disabled with explanation |
| Times | Past slots hidden for today |
| Success | **Request Received** — not "Booking Confirmed" |
| CTA | **Request Service** — not "Confirm Booking" |
| Terminology | Use This Plan / One-Time Visit throughout |

## 6. Performance review

- Reuses React Query caches (`vehicles`, `solar-sites`, `subscriptions`, `catalog/services`)
- Coverage check cached 30s per address (`staleTime`)
- No duplicate catalog fetches
- Step components are lightweight; no marketing blocks

## 7. Accessibility review

- Progress bar with `aria-label`
- Step buttons ≥ 44px touch targets (`h-11`, `py-2.5`)
- Disabled dates expose `title` reason
- Success screen semantic heading
- Review notes use labelled `textarea`
- Support button with visible label

## 8. Test report

```bash
cd artifacts/cwp-platform && npx vitest run src/lib/schedule-entry.test.ts src/lib/schedule-journey.test.ts src/lib/asset-dashboard.test.ts src/lib/home-dashboard.test.ts
```

**27 passed** (schedule-entry, schedule-journey, slots, asset-dashboard, home-dashboard)

## 9. Manual QA checklist

### Entry-point consistency
- [ ] Home **Schedule Next Visit** → skips asset + plan, lands on service
- [ ] My Plans **Schedule Next Visit** on a plan card → same skip behavior as Home
- [ ] Assets **Schedule** on a vehicle/solar card → skips asset (+ plan if linked)
- [ ] Schedule FAB with multiple assets → shows asset picker
- [ ] All entry points produce same review screen for same customer state

### Auto-skip
- [ ] Single asset customer opens Schedule — lands on plan or service, not asset picker
- [ ] Single eligible plan — auto-selected, plan step skipped
- [ ] No plans — One-Time Visit auto-selected
- [ ] Single available service — auto-selected

### Flow
- [ ] Asset → Plan shows **Use This Plan** + **One-Time Visit**
- [ ] Services list excludes unavailable (coverage)
- [ ] Sundays disabled on date picker
- [ ] Past time slots hidden for today
- [ ] Review shows asset, address, plan, service, date, time
- [ ] **Request Service** submits successfully

### Success
- [ ] Screen says **Request Received** with request number
- [ ] **View Scheduled Service** + **Back Home** work

### Scheduled Service Detail
- [ ] Shows current status, timeline, asset, address
- [ ] Reschedule / Cancel visible when allowed
- [ ] Support link works

### Error states
- [ ] No assets → link to Assets page
- [ ] No coverage → error with retry / change address
- [ ] Offline → services retry

### Terminology
- [ ] No "Book", "Booking", "Order", "Cart" in customer UI
- [ ] Asset health: **Protected by Active Plan**, **Service Due Soon**

## Deferred (Phase E+)

- Asset-filtered service history deep link
- `subscriptionId` on booking create body
- Holiday calendar from backend (Sunday rule is client-side placeholder)
- Full self-serve reschedule policy engine
