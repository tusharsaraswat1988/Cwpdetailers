# Founder UX Simplification — Implementation Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Phase:** Founder UX Simplification Phase 1  
**Basis:** [FOUNDER_UX_AUDIT_REPORT_V1.md](./FOUNDER_UX_AUDIT_REPORT_V1.md) — approved with founder modifications  
**Status:** Complete (UI/UX only)

---

## Executive Summary

Phase 1 UX simplification is implemented across the admin platform. Changes are **presentation-only**: no new features, no schema migrations, and no business-rule changes. Two minimal **read projections** were added so list cards can show customer names (existing joins only).

**Founder modifications applied:**

1. **Customer 360 → Customer Profile / Customer Overview** (not renamed to “Customers” in nav)
2. **Locations & Assets** under **Customers** (customer-owned operational entities, not Master Setup)
3. **Primary CTA** on every major operations screen
4. **Dashboard KPI order** per founder priority
5. **Service Updates** defaults to five statuses: Pending, Assigned, In Progress, Completed, Missed

---

## 1. Sidebar Restructure

**File:** `artifacts/cwp-platform/src/components/layout/adminNavConfig.ts`  
**Renderer:** `AdminNavMenu.tsx`

### New structure

| Section | Items | Notes |
|---------|-------|-------|
| **Dashboard** | Dashboard | |
| **Customers** | Customer Profile, Locations, Assets | Customer-owned entities grouped here |
| **Operations** | Book Service, Assign Service, Service Updates, Leads & CRM | Daily workflow |
| **Master Setup** | Services, Staff | True catalog/setup only |
| **Finance** | Billing & Finance | |
| **Support** | Complaints | |
| **Legacy** *(collapsed)* | Legacy Module ▼ → DCMS, Legacy Contacts, Import, Reactivated, Churned | Amber styling + warning copy |
| **Admin** *(collapsed)* | Franchisees, Verify Staff, Config, Settings, Legal, Founder Dashboard | HQ-only |

### Removed from daily nav

- Customer hub sub-items (Bookings, Legacy Contacts, Import, etc.) moved to Legacy or in-page hub only
- Flat 15-item “Operations” bucket eliminated
- DCMS Operations demoted to Legacy

---

## 2. Label & Copy Changes

| Before | After | Where |
|--------|-------|-------|
| Customer 360 | **Customer Profile** | Sidebar, list title |
| Customers (hub header) | **Customer Overview** | `CustomerHubAdminNav` |
| Customer 360 hub | *(removed)* | Customer detail header |
| Linked Assets | **Vehicles & Assets** | Customer tabs/panels |
| Linked Locations | **Locations** | Customer tabs/panels |
| Wallet Summary | **Wallet** | Customer tab |
| Billing Summary | **Bills** | Customer tab |
| Support | **Complaints** | Customer tab |
| Service Locations | **Locations** | Page title |
| Book Services | **Book Service** | Sidebar + page |
| Assign Services | **Assign Service** | Sidebar + page |
| Operations Dashboard | **Dashboard** | Page title |
| Assignment ID | **Job #** | Assign Service panel |
| Execution | **Service Visit** | Service Updates timeline |
| DCMS visit / DCMS due | **Daily wash visit / Wash due** | Service Updates |
| Contract # / service registry | **Service # / active services for this customer** | Active Services panel |
| Pending Queue / Assigned Queue | **Needs staff / Staff assigned** | Assign Service tabs |
| Daily Cleaning | **Daily Cleaning (Legacy)** | DCMS sub-nav |

---

## 3. Dashboard Simplification

**File:** `pages/admin/Dashboard.tsx`

### Primary KPI row (founder order)

1. **Today's Jobs** → `/admin/service-updates`
2. **Pending Assignments** → `/admin/assign-services` (from ops timeline summary)
3. **Collections Due** → `/admin/billing?tab=dues`
4. **Open Complaints** → `/admin/complaints`
5. **Revenue This Month** → `/admin/billing`

Secondary: **Active Customers** → `/admin/customers`

### Collapsed section

Subscription health, lead analytics, charts, expiring subscriptions moved under **“More insights”** collapsible.

### Primary CTA

**View today's jobs** → Service Updates

---

## 4. Service Updates Simplification

**File:** `pages/admin/OperationsWall.tsx`

### Default status row (5 tiles)

| Status | Source |
|--------|--------|
| Pending | `summary.pending` |
| Assigned | `summary.assigned` |
| In Progress | `summary.scheduled + summary.started` |
| Completed | `summary.completed` |
| Missed | `summary.missed` |

Scheduled, Started, Cancelled + DCMS/execution stats moved to **Advanced operational metrics** (collapsed).

### Primary CTA

**Assign staff to pending jobs** → Assign Service

---

## 5. Customer-Centric Improvements

**Files:**

- `features/customers/pages/CustomerDetail.tsx`
- `features/customers/components/Customer360Overview.tsx`
- `features/customers/pages/Customers.tsx`

### Customer Profile detail

- **Book Service** primary CTA in header
- Subtitle “Customer 360 hub” removed
- Overview tab now embeds: **Locations**, **Vehicles & Assets**, **Active Services**, **Bills**, **Complaints** (read-only sections remain; edit via sidebar modules)
- Tab labels simplified (see §2)

### Customer Profile list

- Title **Customer Profile** with description focused on opening a full profile
- Primary CTA: **Add customer**
- In-page hub: **Customer Overview** + Bookings tab only

---

## 6. Asset & Location Card Visibility

### Assets

**Files:** `pages/admin/AssetsPage.tsx`, `lib/assets/assetService.ts`, `features/assets/api.ts`

Card layout (top → bottom):

1. Vehicle/asset number (label)
2. **Customer name** (`customerName` from list join)
3. Location name
4. Asset type

Primary CTA: **Add asset**

### Locations

**Files:** `pages/admin/ServiceLocationsPage.tsx`, `routes/service-locations.ts`, `features/service-locations/api.ts`

Card layout:

1. **Customer name** (`primaryCustomerName` — default/first linked customer)
2. Location label
3. Type · city
4. Address

Primary CTA: **Add location**

### Read projection note

| Change | Type | Schema? |
|--------|------|---------|
| `customerName` on asset list | SQL join to `customers` | No |
| `primaryCustomerName` on location list | SQL join to `customers` | No |

No new tables, enums, or business rules. Display fields only.

---

## 7. Primary CTAs by Screen

| Screen | Primary CTA | Action |
|--------|-------------|--------|
| Dashboard | View today's jobs | → Service Updates |
| Customer Profile (list) | Add customer | Opens create dialog |
| Customer Profile (detail) | Book Service | → Book Service with `customerId` |
| Locations | Add location | Opens create dialog |
| Assets | Add asset | Opens create dialog |
| Book Service | Start booking / Continue for {name} | Wizard entry |
| Assign Service | Assign selected job | Focuses pending queue |
| Service Updates | Assign staff to pending jobs | → Assign Service |
| Billing & Finance | Record payment | Opens payment dialog |
| Complaints | Review open complaints | Scroll / dashboard |
| Staff | Add staff member | Opens create dialog |

Shared component: `components/layout/PageActionHeader.tsx`

---

## 8. Legacy Module Treatment

- **Legacy** sidebar section collapsed by default
- **Admin** section collapsed by default
- Legacy group shows amber header + warning: *“Old Daily Cleaning system and migration tools…”*
- DCMS sub-nav titled **Daily Cleaning (Legacy)**

Routes unchanged — hide/demote only.

---

## 9. Files Changed

### Frontend (cwp-platform)

| File | Change |
|------|--------|
| `components/layout/adminNavConfig.ts` | Full nav restructure |
| `components/layout/AdminNavMenu.tsx` | Collapsible Legacy/Admin sections |
| `components/layout/PageActionHeader.tsx` | **New** — primary CTA header |
| `pages/admin/Dashboard.tsx` | KPI reorder + collapsible insights |
| `pages/admin/OperationsWall.tsx` | 5-status default + advanced collapse |
| `pages/admin/AssetsPage.tsx` | Cards + CTA + copy |
| `pages/admin/ServiceLocationsPage.tsx` | Cards + CTA + copy |
| `pages/admin/AssignServicesPage.tsx` | Labels + CTA |
| `pages/admin/BookServicesPage.tsx` | Title + CTA |
| `pages/admin/BillingFinancePage.tsx` | CTA layout |
| `pages/admin/Complaints.tsx` | CTA + copy |
| `features/customers/pages/CustomerDetail.tsx` | Profile UX + tabs |
| `features/customers/pages/Customers.tsx` | Profile list + CTA |
| `features/customers/components/Customer360Overview.tsx` | Embedded home-base sections |
| `features/customers/components/CustomerHubAdminNav.tsx` | Customer Overview label |
| `features/customers/components/ActiveServicesSummary.tsx` | Business copy |
| `features/customers/components/CustomerServiceLocationsPanel.tsx` | Labels + copy |
| `features/customers/components/CustomerLinkedAssetsPanel.tsx` | Labels + copy |
| `features/staff/pages/Staff.tsx` | CTA test id + description |
| `features/daily-cleaning/components/DcmsAdminNav.tsx` | Legacy label |
| `features/assets/api.ts` | `customerName` type |
| `features/service-locations/api.ts` | `primaryCustomerName` type |

### Backend (read projections only)

| File | Change |
|------|--------|
| `api-server/src/lib/assets/assetService.ts` | Join `customerName` on all asset lists |
| `api-server/src/routes/service-locations.ts` | `primaryCustomerName` on list responses |

### Scripts

| File | Change |
|------|--------|
| `scripts/src/verify-tier3-customers.ts` | `customer-profile-tabs` test id |

---

## 10. Out of Scope (Confirmed Not Done)

- New features or modules
- Database migrations / schema changes
- Assignment, billing, or execution business logic
- Customer / Staff / Franchisee mobile app redesign
- Screenshot capture (deferred to manual QA pass)

---

## 11. Verification Checklist

Manual QA recommended:

- [ ] Sidebar: Legacy collapsed on first load; expands with warning
- [ ] Dashboard: 5 primary KPIs in founder order; insights collapsed
- [ ] Service Updates: 5 status tiles; advanced section hidden by default
- [ ] Customer Profile: Overview shows locations, assets, services, bills, complaints inline
- [ ] Asset cards: customer name visible without opening detail
- [ ] Location cards: customer name as first line
- [ ] Every major screen has one obvious primary button
- [ ] No “Customer 360” visible in UI
- [ ] Book Service / Assign Service / Service Updates flow unchanged functionally

---

## 12. Follow-Up (Optional Phase 1b)

| Item | Reason |
|------|--------|
| Capture before/after screenshots | Audit §10 checklist |
| Customer search in asset create dialog | Replace numeric ID entry |
| Merge Founder Dashboard into main Dashboard | Reduce duplicate “Views” entry |
| Franchisee portal parity | Same UX language for franchise owners |

---

*Implementation complete. Await founder walkthrough feedback before Phase 1b or further copy tweaks.*
