# Founder UX Phase 2 — Completion Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Phase:** Founder UX Phase 2 — Terminology Cleanup & Franchise Readiness  
**Authorization:** [`SERVICE_CATALOG_IMPLEMENTATION_READINESS_REPORT.md`](../SERVICE_CATALOG_IMPLEMENTATION_READINESS_REPORT.md) — **approved, implementation authorized**  
**Prior work:** [`FOUNDER_UX_PHASE_2_IMPLEMENTATION_REPORT.md`](./FOUNDER_UX_PHASE_2_IMPLEMENTATION_REPORT.md)  
**Status:** **Complete** (founder UX / presentation layer only)

---

## Executive Summary

Phase 2 implements the **frozen founder rulings** across franchise-facing admin UX. A branch owner operates through **Customer → Bookings → Services → Complaints → Billing**. Vehicles, solar sites, and service addresses are **supporting booking data**, not primary business modules. The Service Catalog reflects **three revenue lines** only. Forbidden architect vocabulary is removed from primary workflows. **Pricing Governance Option A** is enforced in UI: HQ (`superadmin`) owns prices and product definitions; branch roles control **availability only**.

**Constraints honored:** No schema redesign, no billing redesign, no assignment redesign, no execution redesign.

---

## 1. Terminology Replacements

| Forbidden | Replacement | Applied in |
|-----------|-------------|------------|
| Asset | Vehicle / Car / Solar site | Book Service, customer profile, assignment queue, invoices, contract summary |
| Location (module) | Service address | Booking wizard, customer profile, location picker, asset forms |
| Service Location | Service address | All franchise admin copy |
| Category | *(removed from catalog UI)* | Service catalog; staff uses **Role type** |
| Matrix / Vehicle matrix | *(hidden)* | Unreachable from founder catalog |
| Slab / Solar slab | *(hidden)* | Unreachable from founder catalog |
| Entitlement | Washes included / Visits included / Daily cleans included | Package & plan cards |
| Credit (wallet) | Add money / Wallet top-up | Wallet adjustments |
| Credit note | Refund note | Invoice list |
| Pricing Rule / Pricing Model | *(hidden)* | Not in founder catalog |
| City pricing | *(hidden)* | Not in founder catalog |
| DCMS | Daily cleaning / Daily cleaning plan | Catalog, billing, wizards, legacy nav |
| DCMS Operations | Legacy Daily Cleaning | Sidebar (collapsed Legacy section) |
| Staff Category | Role type | Staff admin |

Internal API/types (`assetId`, `entitlementType`, `dcms_plans`) unchanged — not shown in franchise UI.

---

## 2. Screens Changed

### Service Catalog — `/admin/services`

| Screen / tab | Change |
|--------------|--------|
| Catalog shell | Three revenue-line selector: **Car Wash**, **Daily Cleaning**, **Solar Cleaning** |
| Car Wash → Services | One-time wash/detailing SKUs; no category or pricing-model fields |
| Car Wash → Packages | 4 / 8 / 12 wash packages; inclusion badges in plain language |
| Daily Cleaning | Plan cards: price/month, daily cleans, washes, weekly offs |
| Solar | One Time, 6 Month Plan, 12 Month Plan sections |
| Removed from nav | Categories, Solar Slabs, Price By City, Pricing Models/Rules |
| Settings / Homepage | GST settings + Homepage CMS (marketing, collapsed sidebar) |
| Option A | Branch roles: read-only prices; service **availability** toggle only; daily cleaning plan **active** toggle |

**Files:** `ProductsAndPlans.tsx`, `ServicesTab.tsx`, `PackagesTab.tsx`, `DcmsPlansPanel.tsx`, `SolarCatalogPanel.tsx`, `lib/catalogGovernance.ts`

### Customer Profile — `/admin/customers/:id`

| Tab | Change |
|-----|--------|
| Overview | Command center: outstanding amount, wallet balance, active plans, jobs this month, recent jobs, open complaints |
| Profile | Customer edit + vehicles/solar sites + service addresses (inline, no module links) |
| Bills | Invoices, wallet, payments (restored as dedicated tab) |
| Communications | Unchanged |
| Removed | Assets tab, Locations tab, module deep links |

**Files:** `CustomerDetail.tsx`, `Customer360Overview.tsx`, `CustomerLinkedAssetsPanel.tsx`, `CustomerServiceLocationsPanel.tsx`, `ActiveServicesSummary.tsx`, `AddCustomerServiceWizard.tsx`, `CustomerOnboardingWizard.tsx`

### Book Service — `/admin/book-services`

| Step | Before → After |
|------|----------------|
| 1 | Service address (not “Location”) |
| 2 | Vehicle / Solar site (not “Asset”) |
| 3+ | Service selection filtered by revenue line |
| Confirmation | Service address + Vehicle/Solar site labels |

**Files:** `types.ts`, `LocationSelect.tsx`, `AssetSelect.tsx`, `ServiceSelect.tsx`, `ReviewSummaryStep.tsx`, `ContractCreatedStep.tsx`, `api.ts`

### Billing & Operations

| Screen | Change |
|--------|--------|
| Invoices | Columns: Service address, Vehicle; no module deep links; Refund note (not Credit note) |
| Wallet adjustments | Add money / Deduct (not Credit/Debit) |
| Assign Service queue | Vehicle column |
| Staff | Role type (not Staff Category) |

**Files:** `InvoicesTab.tsx`, `WalletAdjustmentsTab.tsx`, `AssignServicesPage.tsx`, `Staff.tsx`, `StaffDetail.tsx`

### Secondary admin views (operational only)

Routes `/admin/assets` and `/admin/service-locations` remain for edge edit flows with customer-context banners. **No sidebar entries, no workflow deep links, no list-card navigation to detail pages.** Create flows return to Customer Profile.

**Files:** `AssetsPage.tsx`, `AssetDetail.tsx`, `ServiceLocationsPage.tsx`, `ServiceLocationDetail.tsx`, `AssetForms.tsx`, `LocationPicker.tsx`

---

## 3. Service Catalog Changes

### Final founder model (mandatory decision #4)

```
CAR WASH
  Services   — Foam Wash, Interior, Exterior, Detailing
  Packages   — 4 / 8 / 12 Wash Package

DAILY CLEANING
  Plans      — Basic, Premium, Premium Plus
               (price/month, daily cleans, washes included, weekly offs)

SOLAR CLEANING
  One Time Cleaning
  6 Month Plan
  12 Month Plan
```

### Removed founder-facing exposure (mandatory decision #5)

| Surface | Status |
|---------|--------|
| Categories tab | Removed from catalog nav; category resolved internally |
| Solar Slabs | Removed; component exists but unreachable |
| Pricing Models / Rules | Removed from nav |
| City Pricing | Removed from nav |
| Vehicle Matrix | Hidden; matrix runs internally at booking |

### Pricing Governance Option A (mandatory decision #6)

| Role | Catalog UI capability |
|------|----------------------|
| **HQ (`superadmin`)** | Create/edit services, packages, plans; set prices and inclusions |
| **Branch (`admin`, `manager`)** | View catalog at HQ prices; toggle service **Active** and plan **Active** only |
| **Engineering** | Matrices/slabs remain internal — never in daily UI |

Enforced via `lib/catalogGovernance.ts` → `isHqCatalogEditor(role)`.

---

## 4. Navigation Changes

### Sidebar (primary business navigation)

| Section | Items |
|---------|-------|
| Dashboard | Dashboard |
| Customers | Customer Profile |
| Operations | Book Service, Assign Service, Service Updates, Leads & CRM |
| Master Setup | Service Catalog, Staff |
| Marketing *(collapsed)* | Homepage CMS |
| Finance | Billing & Finance |
| Support | Complaints |
| Legacy *(collapsed)* | Legacy Daily Cleaning, Legacy Contacts, Import |

**Removed from primary nav:** Assets, Service Locations, DCMS Operations (renamed and moved to Legacy).

### Customer hub (in-page)

Customer Profile and Bookings only — no Locations or Assets hub tabs.

### Redirects

- `/admin/daily-cleaning/plans` → `/admin/services?tab=daily-cleaning`
- Legacy catalog tab URLs (`categories`, `pricing`, `dcms-plans`, etc.) → mapped revenue-line tabs

---

## 5. Customer Workflow Changes

### Founder mental model enforced

```
Customer
  ↓
Bookings
  ↓
Services
  ↓
Complaints
  ↓
Billing
```

### Supporting data in booking context

| Data | Where managed | Never forced to |
|------|---------------|-----------------|
| Vehicle / solar site | Book Service step 2; Customer Profile → Profile | `/admin/assets` module |
| Service address | Book Service step 1; Customer Profile → Profile | `/admin/service-locations` module |

### Customer Profile CTAs

- Primary: **Book Service**
- Vehicles and addresses: Profile tab panels (no “Manage Assets” / “Manage Locations”)

### Overview command center (Rule 7)

Displays: Active plans · Recent jobs · Outstanding amount · Wallet balance · Open complaints

---

## 6. Before / After Screenshots

No screenshot files were captured in this implementation pass. Use the mapping below for visual QA.

| # | Route | Before (conceptual) | After (conceptual) |
|---|-------|-------------------|-------------------|
| 1 | Sidebar | Assets, Locations, DCMS Operations visible | Customer-centric sections; Legacy collapsed |
| 2 | `/admin/services` | 8+ tabs incl. Categories, Slabs, Pricing | 3 revenue lines: Car Wash / Daily Cleaning / Solar |
| 3 | `/admin/services?tab=wash-services` | Category + pricing model form | Name, price, description; HQ-only edit for branch |
| 4 | `/admin/services?tab=wash-packages` | Entitlement type codes | “4 washes included” badges |
| 5 | `/admin/services?tab=daily-cleaning` | DCMS Plans | Daily cleaning plans; branch toggles active only |
| 6 | `/admin/services?tab=solar` | Slab matrix | Three solar products |
| 7 | `/admin/customers/:id` | 9 tabs, asset/location links | Overview / Profile / Bills / Communications |
| 8 | `/admin/book-services` | Location → Asset steps | Service address → Vehicle / Solar site |
| 9 | `/admin/billing` | Location/Asset columns + module links | Service address / Vehicle plain text |
| 10 | Branch catalog edit | Full price edit | “Prices set by HQ” + availability toggle |

**Recommended capture paths for QA:** sidebar, catalog (each revenue line), customer overview, book service wizard (all steps), invoice list, staff page.

---

## 7. Acceptance Test Results

**Method:** Code-path and copy audit of franchise primary workflows (`admin` / `manager` roles).  
**Criterion:** Complete each flow without encountering forbidden terminology.

| # | Scenario | Path | Result |
|---|----------|------|--------|
| 1 | Customer creation | Customers → Add / onboarding wizard | **PASS** |
| 2 | Car Wash booking | Customer → Book Service → wash service | **PASS** |
| 3 | Wash Package sale | Book Service → package (4/8/12) | **PASS** |
| 4 | Daily Cleaning plan sale | Book Service or Add Service wizard | **PASS** |
| 5 | Solar plan sale | Book Service → solar AMC | **PASS** |
| 6 | Staff assignment | Staff page / vehicle staff assign | **PASS** |
| 7 | Job tracking | Customer Overview → recent jobs | **PASS** |
| 8 | Payment collection | Customer Bills / Billing invoices / wallet | **PASS** |

**Overall: 8 / 8 PASS** on primary happy paths.

**Caveats (documented, not blockers):**

- Direct URL to legacy routes (`/admin/assets`, old catalog tabs, Master Data) may still expose HQ-only setup screens.
- Seed data internal names may appear on invoice line items until data cleanup (out of scope).
- Customer portal (`/customer/*`) not fully aligned — franchise admin scope only.

---

## 8. Forbidden Word Audit — Final

| Term | Franchise admin primary workflows | Residual (low risk) |
|------|-------------------------------------|---------------------|
| Asset | ✅ Clear | Brand Identity “Logos & Assets”; customer portal My Assets |
| Location | ✅ Clear | Expense “Category” column; Master Data |
| Category | ✅ Clear | Master Data service categories; comms KB fields |
| Matrix | ✅ Clear | Unreachable PricingTab.tsx |
| Slab | ✅ Clear | Unreachable SolarSlabsTab.tsx |
| Entitlement | ✅ Clear | Internal API only |
| Credit | ✅ Clear | GST “input tax credit” on landing (public) |
| Pricing Rule/Model | ✅ Clear | Unreachable |
| DCMS | ✅ Clear | One code comment in customer Dashboard |

---

## 9. Files Modified

```
artifacts/cwp-platform/src/
├── lib/catalogGovernance.ts                          (new — Option A)
├── lib/customer-model/src/products.ts
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
├── features/book-services/components/*.tsx           (5 files)
├── features/customers/components/*.tsx             (8 files)
├── features/customers/pages/CustomerDetail.tsx
├── features/daily-cleaning/components/DcmsAdminNav.tsx
├── features/daily-cleaning/pages/DcmsAssignmentsPage.tsx
├── features/products/components/DcmsPlansPanel.tsx
├── features/products/components/PackagesTab.tsx
├── features/service-catalog/components/ServicesTab.tsx
├── features/service-catalog/components/SolarCatalogPanel.tsx
├── features/service-locations/components/ServiceLocationForm.tsx
├── features/staff/pages/Staff.tsx
├── features/staff/pages/StaffDetail.tsx
└── pages/admin/*.tsx                                 (10 files)
```

---

## 10. Conclusion

Founder UX Phase 2 is **complete and authorized scope delivered**:

1. ✅ Customer is the primary business entity  
2. ✅ Assets/Locations removed from primary navigation  
3. ✅ DCMS → Daily Cleaning terminology  
4. ✅ Service Catalog = 3 revenue lines only  
5. ✅ Pricing engines hidden from founders  
6. ✅ Option A pricing governance in catalog UI  
7. ✅ Terminology leak cleanup on franchise workflows  
8. ✅ Branch owner acceptance test — 8/8 pass  

This was a **founder UX implementation**, not an architecture project. Recommended follow-ups (out of scope): seed data display-name cleanup, customer portal alignment, visual QA screenshots from §6, optional hard redirect for orphan asset/location URLs without `?customerId=`.

---

*End of completion report.*
