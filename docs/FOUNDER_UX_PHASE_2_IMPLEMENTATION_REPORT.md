# Founder UX Phase 2 — Authorization, Terminology Cleanup & Franchise Readiness

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Phase:** Founder UX Phase 2 (UI/copy only)  
**Reference:** [FOUNDER_UX_AUDIT_REPORT_V1.md](./FOUNDER_UX_AUDIT_REPORT_V1.md), [FOUNDER_UX_PHASE_1B_IMPLEMENTATION_REPORT.md](./FOUNDER_UX_PHASE_1B_IMPLEMENTATION_REPORT.md), [SERVICE_CATALOG_REDESIGN_REPORT_V3.md](../SERVICE_CATALOG_REDESIGN_REPORT_V3.md), [SERVICE_CATALOG_IMPLEMENTATION_READINESS_REPORT.md](../SERVICE_CATALOG_IMPLEMENTATION_READINESS_REPORT.md)  
**Status:** Complete (presentation layer)

---

## Executive Summary

Phase 2 reframes franchise-facing admin UX around the **founder revenue model** and **customer operations**. A branch owner should operate the business through **Customer → Bookings → Services → Complaints → Billing** without encountering architect vocabulary (Asset, Location module, Category, Matrix, Slab, Entitlement, Credit, Pricing Rule, Pricing Model, DCMS).

**Constraints honored:** No schema changes, no API redesign, no billing logic changes, no assignment changes, no execution changes, no new features.

**Goal:** A non-technical franchise owner can understand and operate CWP within ~15 minutes without technical training.

---

## 1. Terminology Replacements

Complete replacement map applied across franchise-visible UI:

| Forbidden / Legacy | Allowed Replacement | Context |
|--------------------|---------------------|---------|
| Asset | Vehicle / Car / Solar site | Booking, customer profile, assignment queue |
| Service Location | Service address | Booking wizard, customer profile, invoices |
| Location (as module) | Service address | Standalone admin pages, forms |
| Category | *(removed from catalog UI)* | Service catalog — auto-resolved internally |
| Matrix / Matrix pricing | *(hidden)* | Not shown in founder catalog |
| Slab / Solar slab | *(hidden)* | Solar sold as 3 products only |
| Entitlement | Washes included / Visits included / Daily cleans included | Package & plan displays |
| Credit (wallet) | Add money / Wallet top-up | Billing wallet adjustments |
| Credit note | Refund note | Invoice list actions |
| Pricing Rule / Pricing Model | *(hidden)* | Not in founder catalog |
| DCMS | Daily cleaning / Daily cleaning plan / Daily cleaning visit | All franchise workflows |
| DCMS Operations | Legacy Daily Cleaning | Sidebar (legacy section) |
| DCMS Plans | Daily cleaning plans | Service catalog |
| Staff Category | Role type | Staff admin |

**Internal code** (types, API fields, DB columns) still uses legacy names — acceptable per phase scope; not surfaced in franchise UI.

---

## 2. Screens Changed

### Service Catalog (`/admin/services`)

| Area | Before | After |
|------|--------|-------|
| Structure | Services, Packages, DCMS Plans, Price By City, Solar Slabs, Categories, Pricing, GST tabs | **3 revenue lines:** Car Wash (Services + Packages), Daily Cleaning, Solar |
| Car Wash | Mixed vehicle/solar services | Services sub-tab (one-time washes) + Packages sub-tab (4/8/12 wash deals) |
| Daily Cleaning | “DCMS Plans” with internal field names | “Daily cleaning plans” — Price per month, Daily cleans included, Washes included, Weekly offs |
| Solar | Slab editor + category filters | **SolarCatalogPanel** — One Time Cleaning, 6 Month AMC, 12 Month AMC |
| Removed from nav | Categories, Solar Slabs, Price By City, Pricing Models/Rules | Legacy URLs redirect to wash-services |

**Files:** `ProductsAndPlans.tsx`, `ServicesTab.tsx`, `SolarCatalogPanel.tsx` (new), `PackagesTab.tsx`, `DcmsPlansPanel.tsx`

### Book Service (`/admin/book-services`)

| Step | Before | After |
|------|--------|-------|
| Step labels | Location, Asset | **Service address**, **Vehicle / Solar site** |
| Empty states | Links to `/admin/assets`, `/admin/service-locations` | Inline guidance; book from customer profile |
| Package picker | All packages mixed | Wash packages vs solar AMC filtered by service type |
| Review / confirmation | Asset, Location | Vehicle/Solar site, Service address |

**Files:** `types.ts`, `LocationSelect.tsx`, `AssetSelect.tsx`, `ServiceSelect.tsx`, `ReviewSummaryStep.tsx`, `ContractCreatedStep.tsx`, `api.ts`

### Customer Profile (`/admin/customers/:id`)

| Area | Before | After |
|------|--------|-------|
| Tabs | 9 tabs including Assets, Locations, Wallet | **Overview, Profile, Bills, Communications** |
| Overview | Billing panel + booking-setup module links | Command center: active plans, recent jobs, outstanding amount, wallet balance, open complaints |
| CTAs | Book Service + Add address + Add vehicle + deep links to asset/location modules | **Book Service** only; vehicles/addresses in Profile tab |
| Legacy URLs | `?tab=assets`, `?tab=locations`, etc. | Redirect to Overview or Bills |

**Files:** `CustomerDetail.tsx`, `Customer360Overview.tsx`, `CustomerLinkedAssetsPanel.tsx`, `CustomerServiceLocationsPanel.tsx`, `ActiveServicesSummary.tsx`, `BillingSummaryPanel.tsx`, `WalletSummaryPanel.tsx`, `AddCustomerServiceWizard.tsx`

### Navigation & Legacy Routes

| Area | Change |
|------|--------|
| Sidebar | No Assets or Service Locations modules; “DCMS Operations” → **Legacy Daily Cleaning** |
| `/admin/daily-cleaning/plans` | Redirects to `?tab=daily-cleaning` |
| `/admin/assets`, `/admin/service-locations` | Routes preserved as **secondary admin views** with customer-context banners; **no deep links** from primary workflows |
| Create flows | After add vehicle/site or address → return to **Customer Profile (Profile tab)** |

**Files:** `adminNavConfig.ts`, `CustomerBookingDataContext.tsx`, `DcmsAdminNav.tsx`, `App.tsx`, `AssetsPage.tsx`, `AssetDetail.tsx`, `ServiceLocationsPage.tsx`, `ServiceLocationDetail.tsx`

### Billing & Operations

| Screen | Change |
|--------|--------|
| Invoices list | Columns: Service address, Vehicle; no links to asset/location modules |
| Wallet adjustments | “Credit (recharge)” → **Add money**; “Credit wallet” → **Add to wallet** |
| Assign Services queue | Column “Asset” → **Vehicle** |
| Staff | “Staff Category” → **Role type** |
| Subscriptions page | “DCMS Operations” link → **Legacy Daily Cleaning** |
| Invoice billing settings | “DCMS” in description → **daily cleaning** |

**Files:** `InvoicesTab.tsx`, `WalletAdjustmentsTab.tsx`, `AssignServicesPage.tsx`, `Staff.tsx`, `StaffDetail.tsx`, `Subscriptions.tsx`, `InvoiceBillingSettings.tsx`, `CreateInvoiceDialog.tsx`

### Shared Components

| Component | Change |
|-----------|--------|
| `LocationPicker` | “Service Location” → **Service address** |
| `AssetForms` | “Service location” → **Service address** |
| `lib/customer-model/products.ts` | Hub labels: wash packages (not credits) |

---

## 3. Service Catalog Cleanup

### Final founder-facing model (Rule 4)

```
SERVICE CATALOG
├── CAR WASH
│   ├── Services — Foam Wash, Interior, Exterior, Detailing (one-time)
│   └── Packages — 4 / 8 / 12 Wash Package
├── DAILY CLEANING
│   └── Plans — Basic, Premium, Premium Plus
│       (price/month, daily cleans, washes included, weekly offs)
└── SOLAR CLEANING
    ├── One Time Cleaning
    ├── 6 Month AMC
    └── 12 Month AMC
```

### Removed from founder view (Rule 5)

| Removed surface | Disposition |
|-----------------|-------------|
| Categories tab | Removed from nav; category ID auto-resolved in `ServicesTab` |
| Solar Slabs tab | Removed; `SolarSlabsTab.tsx` remains in codebase, unreachable from catalog |
| Price By City | Removed from nav |
| Pricing Models / Matrix / Rules | Removed from nav; `PricingTab.tsx` unreachable |
| Category dropdown on service form | Removed |
| Pricing model badges on service cards | Removed |
| Entitlement type names on packages | Replaced with “4 washes included”, etc. |

### HQ Pricing Model (Rule 6 — Option A)

Catalog header states: *“Prices are set by HQ; branches choose what to offer when booking.”*  
Franchise users configure **product availability** via booking flows, not pricing engines. Full HQ/franchise RBAC for price editing is **not implemented** in this phase (documented in readiness report).

---

## 4. Customer Profile Cleanup (Rule 7)

### Tab structure

| Tab | Contents |
|-----|----------|
| **Overview** | Customer info, KPI row (outstanding, wallet, active plans, jobs this month), active plans table, recent jobs, open complaints |
| **Profile** | Edit customer, vehicles & solar sites, service addresses |
| **Bills** | Invoice list, wallet summary, payment history (moved out of Overview clutter) |
| **Communications** | Message history |

### Overview command center fields

- Active plans  
- Recent jobs  
- Outstanding amount  
- Wallet balance  
- Open complaints  

Removed from Overview: duplicate billing panel, collapsible “booking setup” module with asset/location admin links.

---

## 5. DCMS Terminology Removal (Rule 3)

| Legacy | Replacement | Where applied |
|--------|-------------|---------------|
| DCMS | Daily cleaning | Plans panel, book service, billing dialogs |
| DCMS Plans | Daily cleaning plans | Catalog tab |
| DCMS plan | Daily cleaning plan | Add customer service wizard, create invoice |
| DCMS Subscription | Daily cleaning plan | Book service fulfillment labels |
| DCMS Visit | Daily cleaning visit | Operations copy (where visible) |
| DCMS Operations | Legacy Daily Cleaning | Sidebar, subscriptions cross-link |

**Remaining (acceptable):** One code comment in `pages/customer/Dashboard.tsx` (`/* Daily Cleaning (DCMS) */`) — customer portal, not franchise admin. Legacy daily-cleaning route namespace (`/admin/daily-cleaning/*`) unchanged (no route redesign).

---

## 6. Franchise Readiness Improvements

1. **Customer-first navigation** — Sidebar centers Customers, Book Service, Service Catalog, Billing; no Asset/Location modules.
2. **Booking-context vehicles & addresses** — Selected during Book Service and managed on Customer Profile → Profile tab.
3. **Three revenue lines** — Catalog matches how CWP earns: Car Wash, Daily Cleaning, Solar.
4. **Plain-language operations** — Assignment queue, invoices, and staff screens use Vehicle / Service address / Plan / Package.
5. **Legacy containment** — Old catalog tabs and DCMS ops hidden under Legacy Daily Cleaning; direct URLs to pricing/slab editors no longer linked.
6. **Post-create return paths** — Adding vehicle, solar site, or service address returns to customer profile instead of orphan admin detail pages.

---

## 7. Forbidden Word Audit Results

Scan target: franchise-visible `.tsx` under `artifacts/cwp-platform/src` (admin, book-services, customers, billing, staff, service-catalog nav).

| Term | Franchise admin UI | Notes |
|------|-------------------|-------|
| Asset | **Clear** | Replaced with Vehicle / Solar site; no `/admin/assets` links in workflows |
| Location (module) | **Clear** | Replaced with Service address |
| Category | **Clear** | Removed from catalog; Staff uses “Role type” |
| Matrix | **Clear** | Only in unreachable `PricingTab.tsx` |
| Slab | **Clear** | Only in unreachable `SolarSlabsTab.tsx` |
| Entitlement | **Clear** | Internal filtering only; UI shows “washes included” |
| Credit | **Clear** | Wallet: “Add money”; invoices: “Refund note” |
| Pricing Rule / Model | **Clear** | Not in founder catalog nav |
| DCMS | **Clear** | One customer-portal code comment only |

### Residual exposure (low risk)

| Item | Risk | Mitigation |
|------|------|------------|
| Direct URL `/admin/assets` or `/admin/service-locations` | Low | Secondary views with customer back-links; not in nav or CTAs |
| Master Data → Service Categories | Medium | HQ/setup screen; not daily franchise workflow |
| Dashboard “Revenue by Service Category” chart | Low | Internal reporting label; not catalog configuration |
| Brand Identity “Logos & Assets” | Low | Marketing/setup; different meaning of “assets” |
| Seed data names (e.g. “Wash Card”, `cleaning_credit`) | Medium | Backend/catalog data — UI labels mask entitlement types |
| Legacy Daily Cleaning section | Low | Intentionally labeled “Legacy”; isolated from main catalog |

---

## 8. Before vs After Screenshot Mapping

No screenshots captured in this pass. Textual mapping for future visual QA:

| # | Route | Before (conceptual) | After (conceptual) |
|---|-------|---------------------|-------------------|
| 1 | `/admin/services` | 8+ tabs including Categories, Solar Slabs, Price By City, DCMS Plans | 3 revenue line cards → Car Wash / Daily Cleaning / Solar sub-views |
| 2 | `/admin/services?tab=wash-services` | Service form with Category + Pricing Model | Service form — name, price, description only |
| 3 | `/admin/services?tab=wash-packages` | Package list with entitlement type codes | Package list with “4 washes included” labels |
| 4 | `/admin/services?tab=daily-cleaning` | DCMS Plans, internal field names | Daily cleaning plans with founder-friendly inclusions |
| 5 | `/admin/services?tab=solar` | Slab matrix editor | Three solar product sections |
| 6 | `/admin/customers/:id` | 9 tabs, asset/location module links | 4 tabs; Overview command center |
| 7 | `/admin/customers/:id?tab=profile` | Scattered vehicle/location admin CTAs | Vehicles, solar sites, service addresses inline |
| 8 | `/admin/book-services` | Steps: Location → Asset → Service | Service address → Vehicle/Solar site → Service |
| 9 | `/admin/billing` (invoices) | Location/Asset columns with module links | Service address / Vehicle plain text |
| 10 | Sidebar | DCMS Operations, possible asset/location entries | Legacy Daily Cleaning; customer-centric sections |

---

## 9. Remaining UX Confusion Points

1. **HQ vs franchise price editing** — UI copy says HQ sets prices, but catalog forms may still allow price edits unless RBAC is added (readiness report item).
2. **Legacy Daily Cleaning routes** — Still exist under `/admin/daily-cleaning/*` for operations continuity; new franchise owners should use Book Service + catalog plans instead.
3. **Master Data screens** — Service Categories, vehicle models, etc. remain in Master Setup for HQ; franchise owners may stumble in if given superadmin access.
4. **Seed/catalog data mismatch** — DB may still contain legacy package names and entitlement types; UI labels help but invoice line items may show internal names until data cleanup.
5. **Customer portal** — Customer-facing app not fully aligned with Phase 2 terminology (lower priority for franchise owner test).
6. **Assignment / execution** — “Pending assignment” messaging still references sprint/internal language in Book Service confirmation.
7. **No guided onboarding** — Terminology is fixed but there is no first-run tour for the 15-minute franchise owner goal.

---

## 10. Franchise Owner Test Results

Validation method: **code-path & copy audit** against the 8 scenarios (no live browser session in this pass). Each scenario assessed for forbidden terminology exposure on the primary happy path.

| # | Scenario | Path | Result | Notes |
|---|----------|------|--------|-------|
| 1 | Create Customer | Customers → Add customer / onboarding wizard | **PASS** | No forbidden terms on create flow |
| 2 | Book Foam Wash | Customer → Book Service → wash service | **PASS** | Service address + Vehicle steps; no Asset/Location modules |
| 3 | Sell 4 Wash Package | Book Service → package selection | **PASS** | “4 washes included”; no entitlement/credit labels |
| 4 | Sell Daily Cleaning Plan | Book Service or Add Service wizard | **PASS** | “Daily cleaning plan”; no DCMS |
| 5 | Sell Solar AMC | Book Service → solar → 6/12 month package | **PASS** | Product names only; no slab UI |
| 6 | Assign Staff | Staff page or vehicle detail (secondary) | **PASS** | “Role type” not Staff Category |
| 7 | Track Job | Customer Overview → recent jobs / assignments | **PASS** | Vehicle column; no asset module links |
| 8 | Collect Payment | Customer Bills tab / billing invoices | **PASS** | Refund note (not credit note); wallet “Add money” |

**Overall:** **8/8 PASS** on primary franchise workflows for forbidden terminology.

**Caveat:** Pass assumes franchise role uses customer-centric navigation and does not bookmark legacy URLs (`/admin/services?tab=categories`, `/admin/assets`, Master Data).

---

## Files Modified (Phase 2)

```
artifacts/cwp-platform/src/
├── App.tsx
├── components/layout/adminNavConfig.ts
├── components/layout/CustomerBookingDataContext.tsx
├── components/shared/LocationPicker.tsx
├── features/assets/components/AssetForms.tsx
├── features/billing/components/CreateInvoiceDialog.tsx
├── features/billing/components/InvoicesTab.tsx
├── features/billing/components/WalletAdjustmentsTab.tsx
├── features/book-services/api.ts
├── features/book-services/types.ts
├── features/book-services/components/AssetSelect.tsx
├── features/book-services/components/ContractCreatedStep.tsx
├── features/book-services/components/LocationSelect.tsx
├── features/book-services/components/ReviewSummaryStep.tsx
├── features/book-services/components/ServiceSelect.tsx
├── features/customers/components/ActiveServicesSummary.tsx
├── features/customers/components/AddCustomerServiceWizard.tsx
├── features/customers/components/BillingSummaryPanel.tsx
├── features/customers/components/Customer360Overview.tsx
├── features/customers/components/CustomerLinkedAssetsPanel.tsx
├── features/customers/components/CustomerServiceLocationsPanel.tsx
├── features/customers/components/WalletSummaryPanel.tsx
├── features/customers/pages/CustomerDetail.tsx
├── features/daily-cleaning/components/DcmsAdminNav.tsx
├── features/daily-cleaning/pages/DcmsAssignmentsPage.tsx
├── features/products/components/DcmsPlansPanel.tsx
├── features/products/components/PackagesTab.tsx
├── features/service-catalog/components/ServicesTab.tsx
├── features/service-catalog/components/SolarCatalogPanel.tsx (new)
├── features/staff/pages/Staff.tsx
├── features/staff/pages/StaffDetail.tsx
├── lib/customer-model/src/products.ts
├── pages/admin/AssetDetail.tsx
├── pages/admin/AssetsPage.tsx
├── pages/admin/AssignServicesPage.tsx
├── pages/admin/InvoiceBillingSettings.tsx
├── pages/admin/ProductsAndPlans.tsx
├── pages/admin/ServiceLocationDetail.tsx
├── pages/admin/ServiceLocationsPage.tsx
└── pages/admin/Subscriptions.tsx
```

---

## Conclusion

Phase 2 delivers **franchise-ready founder UX** within frozen architecture constraints. The service catalog reflects **three revenue lines**, customer profile is a **four-tab command center**, and forbidden architect vocabulary is **removed from primary workflows**. Legacy routes and HQ setup screens remain for continuity but are **de-emphasized and unlinked** from daily franchise operations.

**Recommended next steps (out of scope for Phase 2):**

1. HQ/franchise RBAC for price editing (Option A enforcement)  
2. Seed data cleanup for package/plan display names  
3. Visual QA screenshots from mapping table §8  
4. Customer portal terminology alignment  
5. Optional: redirect `/admin/assets` and `/admin/service-locations` without `?customerId=` to Customer list

---

*End of report.*
