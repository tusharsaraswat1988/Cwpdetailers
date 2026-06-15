# Founder UX Simplification — Phase 1B Implementation Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Phase:** Founder UX Simplification Phase 1B + Service Catalog Simplification  
**Basis:** [FOUNDER_UX_AUDIT_REPORT_V1.md](./FOUNDER_UX_AUDIT_REPORT_V1.md), [FOUNDER_UX_SIMPLIFICATION_IMPLEMENTATION_REPORT.md](./FOUNDER_UX_SIMPLIFICATION_IMPLEMENTATION_REPORT.md)  
**Status:** Complete (UI/UX only)

---

## Executive Summary

Phase 1B removes architect-style complexity from daily admin surfaces. Changes are **presentation-only** with two minimal **read projections** (assignment location type/city) so operators see meaningful location context instead of bare labels like “Primary”.

**Constraints honored:** No schema changes, no API redesign, no new business logic, no billing/assignment/execution changes.

---

## 1. Homepage CMS Decision

**Decision:** Move Homepage CMS **out of Service Catalog** into a collapsed **Marketing** sidebar section.

| Aspect | Before | After |
|--------|--------|-------|
| Location | Tab inside Service Catalog (`/admin/services?tab=homepage`) beside core setup | Same URL, but **not in catalog tab bar** |
| Sidebar | Not listed separately | **Marketing → Homepage CMS** (collapsed by default) |
| Default visibility | Visible to anyone opening Services | Default users never see it unless they expand Marketing |
| Page treatment | Mixed with catalog tabs | Dedicated view with amber banner: “marketing tool, not daily operations” |

**Rationale:** Branch owners rarely edit hero text, testimonials, or CTA buttons. Website CMS should not occupy prime catalog space.

**Files:** `adminNavConfig.ts`, `ProductsAndPlans.tsx`

---

## 2. Sidebar Simplification

**Decision:** **Option C** — hide Locations and Assets from sidebar; access through Customer Profile.

**Design principle (founder clarification):** Assets and Locations are **not business modules**. They are **customer-owned booking-support entities** whose purpose is:

```
Service → Asset → Location → Booking
```

Standalone admin pages (`/admin/assets`, `/admin/service-locations`) remain for edit/create flows but are **secondary admin views**, not operational modules. They show context banners and link back to Customer Profile.

| Section | Before (Phase 1) | After (Phase 1B) |
|---------|------------------|------------------|
| **Customers** | Customer Profile, Locations, Assets | **Customer Profile only** |
| **Master Setup** | Services | **Service Catalog** (renamed) |
| **Marketing** *(new, collapsed)* | — | Homepage CMS |

**Customer Profile access:**
- Header CTAs: **Book Service**, **Add address**, **Add vehicle**
- Overview section: **Booking setup — service address & vehicle** (auto-expands when customer has no vehicles yet)
- Panels use booking language: “Service addresses”, “Vehicles & sites” — not “Manage Assets module”

**Routes preserved:** `/admin/service-locations` and `/admin/assets` still work with `?customerId=` — with banners directing users to Customer Profile first.

**Files:** `adminNavConfig.ts`, `AdminNavMenu.tsx`

---

## 3. Customer Profile Simplification

**Tabs reduced from 9 → 3:**

| Before | After |
|--------|-------|
| Overview, Active Services, Profile, Wallet, Bills, Vehicles & Assets, Locations, Communications, Complaints | **Overview**, **Profile**, **Communications** |

**Legacy tab URLs** (`?tab=services`, `wallet`, `billing`, `assets`, `locations`, `support`, `active-services`) redirect to **Overview**.

### Overview = Customer Command Center

Sections in order:

1. **Customer info** — name, phone, city, status
2. **KPI row** — Outstanding dues, Wallet, Active services, Services this month
3. **Active services** — embedded panel (was separate tab)
4. **Billing summary** — outstanding dues detail (was Bills tab)
5. **Recent jobs** + **Recent payments**
6. **Complaints** — embedded panel (was Support tab)
7. **Operational details (Phase 1B)** — Renamed **Booking setup — service address & vehicle** with flow hint `Service → Asset → Location → Booking`. Auto-expands when customer has no vehicles yet.

Removed duplicate “quick link” cards at bottom of overview.

**Files:** `CustomerDetail.tsx`, `Customer360Overview.tsx`, `CustomerServiceLocationsPanel.tsx`, `CustomerLinkedAssetsPanel.tsx`

---

## 4. Service Catalog Simplification

### Phase A — Tab audit

| Old tab | Why it exists | Who uses it | Frequency | Advanced? | Renamed? |
|---------|---------------|-------------|-----------|-----------|----------|
| Services | One-time vehicle wash/detailing SKUs | Branch owner / ops lead | Occasional setup | No | **Vehicle Services** |
| Packages | Prepaid wash credits | Branch owner | Occasional | No | **Wash Packages** |
| DCMS Plans | Daily cleaning subscription templates | Legacy + setup | Rare | Partially legacy | **Daily Cleaning Plans** |
| City Pricing | City-wise service rates | Branch owner | When expanding cities | No | **Price By City** |
| Solar Slabs | Solar cleaning slabs | Solar ops | When selling solar | No | **Solar Pricing** |
| Categories | Grouping for filters/reports | Setup | Rare | **Yes** | Categories |
| Homepage CMS | Public website content | Marketing | Very rare | **Yes → Marketing** | Moved out |
| GST | Default tax settings | Finance/setup | Once | **Yes** | GST |

### Phase B — Restructured layout

```
SERVICE CATALOG
  Vehicle Services | Wash Packages | Daily Cleaning Plans
─────────────────────────────────
PRICING
  Price By City | Solar Pricing
─────────────────────────────────
ADVANCED SETUP
  GST | Categories
```

Homepage CMS accessible only via **Marketing → Homepage CMS** (`?tab=homepage`), not beside core catalog tabs.

**Files:** `ProductsAndPlans.tsx`

---

## 5. Assign Service Improvements

**Problem:** Location column showed bare “Primary” — meaningless to operators.

**Solution:** `formatAssignmentLocation()` builds human-readable context:

- `Primary Residence · Lanka`
- `Primary Residence · Sigra`
- `Solar Site · Jaitpura`

Uses location label + type (when not already in label) + city.

**Read projection added** (join only, no schema change): `serviceLocationType`, `serviceLocationCity` on pending/assigned assignment lists.

**Files:** `formatLocation.ts`, `AssignServicesPage.tsx`, `features/assign-services/api.ts`, `api-server/.../assignmentService.ts`

---

## 6. Staff Module Improvements

**Problem:** Profile Completion % dominated staff cards — owners do not care day-to-day.

**Solution:** Card hierarchy reordered:

| Priority | Metric |
|----------|--------|
| Primary | **Jobs this month**, **Rating** (prominent grid) |
| Secondary | Status badge (Active/Inactive), Skills/operational roles |
| Tertiary | Phone, branch |
| Demoted | Profile completion — small text line, no progress bar |

**Note:** “Today’s Jobs” is not available on the staff list API without a new aggregation endpoint. Jobs this month is the closest existing operational metric. Detail view may show more.

**Files:** `Staff.tsx`

---

## 7. Founder Journey Audit

End-to-end flow for a new franchise owner:

```
Customer → Location → Asset → Book Service → Assign Service → Service Updates → Billing → Payment
```

| Step | Can complete without training? | Confusion points |
|------|-------------------------------|------------------|
| **Add customer** | ✅ Yes | Customer Profile list + Add CTA is clear |
| **Add location** | ⚠️ Partial | No sidebar link — must open customer → Overview → Operational details (collapsed). First-time users may not discover collapse |
| **Add vehicle/asset** | ⚠️ Partial | Same as locations — nested under collapsed section |
| **Book service** | ✅ Yes | Book Service in Operations with primary CTA |
| **Assign service** | ✅ Improved | Location now readable; “Needs staff / Staff assigned” tabs from Phase 1 |
| **Service Updates** | ✅ Yes | Five default statuses; advanced metrics collapsed |
| **Billing** | ⚠️ Partial | Bills/wallet now on customer Overview — good. Standalone Billing & Finance module still dense for non-finance owners |
| **Payment** | ⚠️ Partial | Recording payment may require knowing Billing module vs customer Overview wallet |

**Overall:** Core daily loop (Customer → Book → Assign → Updates) is understandable within ~10 seconds per screen. **Setup loop** (locations/assets before first booking) needs one guided moment because sidebar links were intentionally removed.

---

## 8. Screens Changed

| Screen / area | Change |
|---------------|--------|
| Admin sidebar | Removed Locations/Assets; added Marketing; renamed Services → Service Catalog |
| Service Catalog (`ProductsAndPlans.tsx`) | Grouped tabs, business labels, Homepage CMS removed from bar |
| Homepage CMS | Standalone marketing view + warning banner |
| Customer Profile (`CustomerDetail.tsx`) | 3 tabs only |
| Customer Overview (`Customer360Overview.tsx`) | Command center layout + collapsed operational details |
| Customer location/asset panels | Updated helper copy for new access path |
| Assign Service | Meaningful location display |
| Staff list cards | Operational metrics first |

---

## 9. Before vs After Summary

| Area | Before | After |
|------|--------|-------|
| Homepage CMS | Inside Service Catalog tabs | Marketing section, collapsed; not in catalog bar |
| Sidebar Customers | Profile + Locations + Assets | Profile only |
| Customer tabs | 9 tabs | 3 tabs; rest embedded in Overview |
| Service Catalog | Flat 8-tab architect list | 3 business groups + plain-language names |
| Assign location | “Primary” | “Primary Residence · City” |
| Staff cards | Profile % progress bar | Jobs/month + Rating prominent |
| Founder mental model | “Many equal modules” | “Customer command center + daily ops + setup when needed” |

---

## 10. Remaining Confusion Points

1. **Booking setup discovery** — Auto-expands when no vehicles exist; header CTAs added for Add address / Add vehicle. First-time users may still need a one-time hint on the flow order (address before vehicle before book).
2. **Today’s Jobs on staff cards** — Would require API read enrichment; not done in this phase.
3. **Daily Cleaning Plans in catalog** — Still visible in Service Catalog (legacy product line). Consider moving fully to Legacy in a future phase if DCMS is sunset.
4. **Billing vs customer Overview** — Two paths to money (Finance module vs customer Overview KPIs). Could unify messaging in a future copy pass.
5. **Direct URLs to `/admin/assets` and `/admin/service-locations`** — Still work but are unlinked from sidebar; intentional for power users only.
6. **Homepage CMS permissions** — Uses same `services.view` permission as catalog; marketing role separation is a future RBAC topic, not this phase.

---

## Technical Notes

- **Read projections only:** Assignment location type/city joined from existing `serviceLocations` table fields.
- **No migrations, no billing/assignment/execution logic changes.**
- **Verification:** Linter clean on touched files. Full Vite build requires `PORT` env in this workspace (pre-existing config constraint).

---

## File Index

| File | Purpose |
|------|---------|
| `artifacts/cwp-platform/src/components/layout/adminNavConfig.ts` | Sidebar structure |
| `artifacts/cwp-platform/src/pages/admin/ProductsAndPlans.tsx` | Service Catalog rework |
| `artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx` | 3-tab profile |
| `artifacts/cwp-platform/src/features/customers/components/Customer360Overview.tsx` | Command center |
| `artifacts/cwp-platform/src/features/assign-services/formatLocation.ts` | Location formatter |
| `artifacts/cwp-platform/src/pages/admin/AssignServicesPage.tsx` | Uses formatter |
| `artifacts/cwp-platform/src/components/layout/CustomerBookingDataContext.tsx` | Booking-data banners + profile back links |
| `artifacts/cwp-platform/src/features/customers/components/CustomerServiceLocationsPanel.tsx` | Service addresses panel |
| `artifacts/cwp-platform/src/features/customers/components/CustomerLinkedAssetsPanel.tsx` | Vehicles & sites panel |
| `artifacts/cwp-platform/src/pages/admin/AssetsPage.tsx` | Secondary admin view framing |
| `artifacts/cwp-platform/src/pages/admin/ServiceLocationsPage.tsx` | Secondary admin view framing |
| `artifacts/cwp-platform/src/features/staff/pages/Staff.tsx` | Staff card metrics |
| `artifacts/api-server/src/lib/assignments/assignmentService.ts` | Location read projection |
