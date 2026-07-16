# Phase C — My Vehicles & Solar Sites (+ Phase B Review)

**Status:** Complete  
**IA Freeze:** v1.0 (`docs/CUSTOMER_IA_FREEZE_v1.md`)

## Phase B review improvements (shipped first)

| Item | Implementation |
|------|----------------|
| **Current Address** | Visible **Change** button opens `AddressPickerSheet` in one tap; `useSelectedAddress` persists selection via `selected-address.ts` |
| **Current Plan** | Single summary card with visits remaining, expiry, and **View All Plans →** |
| **Operational Hero** | Right-now only: today / en route / feedback / renewal / clear — no historical stats or marketing |
| **Adaptive CTA** | One primary CTA; lower priority in action queue only |
| **Header** | Disabled 🔔 placeholder reserved (`data-testid="notifications-placeholder"`) |

## 1. Files created

| File | Purpose |
|------|---------|
| `src/lib/selected-address.ts` | Persisted current service address (localStorage per customer) |
| `src/hooks/use-selected-address.ts` | React hook for address selection |
| `src/lib/asset-dashboard.ts` | Composes asset card view models from existing APIs |
| `src/lib/asset-dashboard.test.ts` | Unit tests for asset composition |
| `src/components/assets/AssetCard.tsx` | Rich asset health card with quick actions |
| `src/components/assets/AssetEmptyState.tsx` | Empty state with Add Vehicle / Add Solar Site |
| `src/components/assets/AddAssetSheet.tsx` | Bottom sheet add flows |
| `src/components/assets/EditAssetAddressSheet.tsx` | Change address via `LocationPicker` |

## 2. Files modified

| File | Change |
|------|--------|
| `src/components/home/CurrentAddressBar.tsx` | **Change** button + address picker (not hidden link) |
| `src/components/home/CurrentPlanWidget.tsx` | Spec layout + View All Plans |
| `src/lib/home-dashboard.ts` | Hero right-now states, Purchase Plan CTA, selected address |
| `src/pages/customer/Dashboard.tsx` | Wired `useSelectedAddress` + saved locations |
| `src/components/layout/CustomerLayout.tsx` | Notifications bell placeholder |
| `src/pages/customer/MyAssets.tsx` | Full Phase C rebuild — grouped cards, health, actions |
| `src/pages/customer/BookService.tsx` | URL `vehicleId`/`solarSiteId`/`planId`, single-asset preselect |
| `src/lib/customer-plans.ts` | `vehicleId` / `solarSiteId` on `RawSubscription` |
| `src/lib/home-dashboard.test.ts` | Updated Purchase Plan expectation |

## 3. Routes updated

No new routes. Existing:

| Route | Screen |
|-------|--------|
| `/customer/assets` | My Vehicles & Solar Sites |

Schedule deep links: `/customer/schedule?vehicleId=` / `?solarSiteId=` / `?planId=`

## 4. APIs consumed (unchanged endpoints)

| Endpoint | Used for |
|----------|----------|
| `GET /api/vehicles` | Vehicle list, photos, addresses |
| `GET /api/solar-sites` | Solar sites, panel count, dates |
| `GET /api/subscriptions?customerId=` | Plan per asset (`vehicleId` / `solarSiteId`) |
| `GET /api/customers/:id/summary` | `recentBookings` for last/next service |
| `PATCH /api/vehicles/:id` | Change vehicle service address |
| `PATCH /api/solar-sites/:id` | Change solar site address |
| `POST /api/vehicles` | Add vehicle |
| `POST /api/solar-sites` | Add solar site |
| Saved locations API | Home address picker |

## 5. UX improvements

- Assets page answers **“What does CWP take care of for me?”** — health, plan, last/next service per asset
- Vehicles and Solar Sites **never mixed** in one list
- **Protected / Due Soon / No Active Plan** health badges
- Flat quick actions: Schedule · View Plan · Edit · History (no nested menus)
- Empty state: primary Add Vehicle, secondary Add Solar Site
- **One-asset rule**: localStorage hint + Schedule auto-preselect when only one asset
- Home address is first-class with visible Change (Uber-style persistent address, CWP-compatible)

## 6. Performance optimizations

- Reuses React Query caches (`vehicles`, `solar-sites`, `subscriptions`, `summary`) — same keys as Home
- `buildAssetsDashboard()` pure composition — no extra round-trips
- Asset images use `loading="lazy"`
- Add/edit flows in sheets — no full-page reload

## 7. Accessibility review

- Asset cards use `<article>` with `aria-label`
- Section headings: Vehicles / Solar Sites (`aria-labelledby`)
- Quick action buttons ≥ 40px touch targets (`h-10`)
- Change address: `aria-label` on Home bar
- Notifications placeholder: `aria-label="Notifications (coming soon)"`
- Visible focus on interactive elements (Button / Link components)

## 8. Test results

```bash
cd artifacts/cwp-platform && pnpm test src/lib/home-dashboard.test.ts src/lib/asset-dashboard.test.ts
```

Expected: all tests pass (home dashboard + asset dashboard).

## 9. Manual QA checklist

### Phase B review
- [ ] Home → Current Address shows **Change** → picker opens in one tap
- [ ] Selected address persists after reload
- [ ] Current Plan shows one card + **View All Plans →**
- [ ] Hero shows only right-now states (no visit-count stats when clear)
- [ ] Bell icon visible in header (disabled)

### Phase C — Assets
- [ ] Empty state: Add Vehicle / Add Solar Site
- [ ] Vehicles and Solar in separate sections
- [ ] Card shows health, address + Change, plan, last/next service
- [ ] Schedule from card preselects asset on Schedule page
- [ ] Single-asset customer: Schedule auto-selects that asset
- [ ] Edit / Change address saves via PATCH
- [ ] No Wallet / Book terminology

## Deferred (Phase D+)

- Asset-filtered Service History (backend unchanged; link goes to full history for now)
- Live notifications implementation
- Full Schedule asset-step skip when one eligible asset
