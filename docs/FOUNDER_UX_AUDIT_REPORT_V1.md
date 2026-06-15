# Founder UX Audit Report V1

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Version:** 1.0  
**Phase:** Founder UX Simplification — Phase 1 (Audit Only)  
**Status:** Awaiting founder approval — **no UI changes implemented**

---

## Executive Summary

This audit reviews the CWP Detailers admin platform from the perspective of franchise owners, branch managers, office executives, and call center operators — not from an architecture or database viewpoint.

**Verdict:** The system is functionally complete but **presentation still reflects internal engineering concepts**. A new franchise owner would struggle to understand navigation, card ownership, and operational dashboards within the 15-minute target. Several screens fail the **5-second comprehension test**.

**Scope of this document:** Audit and redesign proposal only. No APIs, tables, entities, or migrations. UI/UX presentation changes only, pending approval.

**Primary persona:** Admin panel (`/admin/*`) used by franchise HQ and branch operations staff.

---

## 1. Current Screens Reviewed

### 1.1 Admin Portal — Operations (Primary Focus)

| Screen | Route | Source File | 5-Second Test |
|--------|-------|-------------|---------------|
| Operations Dashboard | `/admin/dashboard` | `pages/admin/Dashboard.tsx` | **Fail** — 9 KPIs + charts; revenue-first, not ops-first |
| Leads & CRM | `/admin/leads` | `pages/admin/Leads.tsx` | Pass (with CRM familiarity) |
| Customers (list) | `/admin/customers` | `features/customers/pages/Customers.tsx` | Pass |
| Customer Detail | `/admin/customers/:id` | `features/customers/pages/CustomerDetail.tsx` | **Partial** — rich but fragmented across 9 tabs |
| Bookings | `/admin/bookings` | `pages/admin/Bookings.tsx` | Pass |
| Legacy Contacts | `/admin/customers/legacy-contacts` | `pages/admin/LegacyContacts.tsx` | Fail for new users — legacy jargon |
| Reactivated | `/admin/customers/reactivated` | `pages/admin/ReactivatedCustomers.tsx` | Fail for new users |
| Import | `/admin/customers/migration` | `pages/admin/CustomerMigration.tsx` | Fail for new users |
| Churned | `/admin/churned` | `pages/admin/ChurnedCustomers.tsx` | Pass (label understood) |
| Service Locations | `/admin/service-locations` | `pages/admin/ServiceLocationsPage.tsx` | **Fail** — no customer name on cards |
| Assets | `/admin/assets` | `pages/admin/AssetsPage.tsx` | **Fail** — no customer name on cards |
| Book Services | `/admin/book-services` | `pages/admin/BookServicesPage.tsx` | Partial — multi-step but labeled OK |
| Assign Services | `/admin/assign-services` | `pages/admin/AssignServicesPage.tsx` | Partial — "Assignment ID" is technical |
| Services (catalog) | `/admin/services` | `pages/admin/ProductsAndPlans.tsx` | Pass for setup staff |
| DCMS Operations | `/admin/daily-cleaning/*` | `features/daily-cleaning/` | **Fail** — acronym + mixed with main ops |
| Staff | `/admin/staff` | `features/staff/pages/Staff.tsx` | Pass |
| Billing & Finance | `/admin/billing` | `pages/admin/BillingFinancePage.tsx` | Pass (dense but familiar) |
| Complaints | `/admin/complaints` | `pages/admin/Complaints.tsx` | Pass |
| Service Updates | `/admin/service-updates` | `pages/admin/OperationsWall.tsx` | **Fail** — 15+ status/channel concepts |

### 1.2 Admin Portal — Other Sections

| Section | Screens | Notes |
|---------|---------|-------|
| Network | Franchisees, Staff Verification, Credentials | Appropriate for HQ; not day-to-day franchise ops |
| Config | Branches, Master Data, Analytics, Communication Center, Notifications, Push Delivery Log | Technical; should stay out of daily workflow |
| Settings | Brand Identity, Invoice & GST, Business Info, SEO, System Status | Setup-only |
| Legal & Compliance | Legal Pages CMS, Compliance Settings | Setup-only |
| Views | Founder Dashboard | Business-friendly; closer to target than main dashboard |

### 1.3 Secondary Portals (Brief)

| Portal | Key Screens | UX Notes |
|--------|-------------|----------|
| Franchisee | Dashboard, Customers, Leads, Bookings, Staff, Churned | Simpler nav; good reference for admin simplification |
| Customer (mobile) | Home, Services, Book, Wallet, Account | Consumer-friendly; not in scope |
| Staff (mobile) | Today, Jobs, Route, Earnings, Profile | Field-friendly; not in scope |

---

## 2. Confusing Elements Found

### 2.1 Navigation & Information Architecture

| Element | Location | Why It Confuses |
|---------|----------|-----------------|
| Single flat "Operations" section with 15+ items | Sidebar | Feels like a database table list, not a workflow |
| "Customer 360" vs "Customers" | Sidebar vs page title | Same screen, two names; "360" is vendor jargon |
| Service Locations & Assets between Customers and Book Services | Sidebar order | Setup entities mixed with daily operations |
| DCMS Operations inline with core ops | Sidebar | Legacy subsystem visible at same priority as Book Service |
| Customer hub children (Legacy Contacts, Import, Reactivated) | Customers submenu | Migration tooling exposed to daily users |
| "Views → Founder Dashboard" | Sidebar | Hidden duplicate of business dashboard |
| `/admin/subscriptions` | Orphan route (not in sidebar) | Reachable via dashboard links only — inconsistent |

### 2.2 Cards & List Views

| Element | Current Display | User Question |
|---------|-----------------|---------------|
| Service location card title | `Primary` or `Lanka Office` | "Whose location is this?" |
| Service location footer | `3 linked customers` | "Which customer do I care about?" |
| Asset card title | `UP65BG5150` (registration) | "Whose vehicle is this?" |
| Asset card subtitle | `Vehicle` + `@ Primary` | Customer missing; location label alone is ambiguous |
| Asset create dialog | `Customer ID` text field | Operators know names, not database IDs |
| Service location filter subtitle | `Locations linked to customer #42` | Numeric ID instead of customer name |

### 2.3 Dashboard & Operations

| Element | Issue |
|---------|-------|
| Page title "Operations Dashboard" | Revenue/analytics heavy; not "what do I do today?" |
| 9 equal-weight KPI cards | No visual priority; ops metrics buried (Active Jobs is card 7 of 9) |
| Subscription Health strip | 6 subscription states — DCMS-specific concepts on main dashboard |
| Lead Source Analytics + Follow-ups | CRM depth appropriate for sales role, not franchise owner morning check |
| Service Updates subtitle | "aggregates assignments & executions" — internal language |
| 7 secondary stat tiles | Executions, DCMS visits, DCMS due, Due wash — parallel concepts |
| 8 primary pipeline tiles | Pending, Assigned, Scheduled, Started, Completed, Missed, Cancelled — too many for first glance |
| Channel badges on timeline | Booking, DCMS visit, DCMS due, Due wash, **Execution** — users think "service" not "channel" |
| Assign Services panel | "Assignment ID: #1234" — internal entity reference |

### 2.4 Customer Detail Hub

| Element | Issue |
|---------|-------|
| Subtitle "Customer 360 hub" | Technical branding |
| 9 horizontal tabs | Cognitive load; user must hunt for Locations, Assets, Bills |
| "Linked Assets" / "Linked Locations" | "Linked" implies database relationship |
| Read-only footers | "Read-only in Customer 360. Manage assets in the Assets module." — exposes module architecture |
| Active Services copy | "from the service registry" + "Contract #123" — registry/contract are internal |
| Wallet note | Explains wash credits vs wallet — correct but dense for first visit |
| Profile tab separate from Overview | Name/phone duplicated across tabs |

### 2.5 Forms & Dialogs

| Element | Issue |
|---------|-------|
| "Customer ID" inputs | Assets create, Communications journey panel |
| "Site masters where work is performed" | Service Locations subtitle — architect language |
| "Vehicles, solar sites, and future asset types — placed at service locations" | Assets subtitle — over-explains data model |

---

## 3. Labels To Rename

### 3.1 Required Renames (Founder Rules 7)

| Current Label | Proposed Label | Where Used |
|---------------|----------------|------------|
| Customer 360 | **Customers** | Sidebar child, detail subtitle, read-only footers |
| Customer 360 hub | **Customer profile** or remove subtitle | Customer detail header |
| Contract Registry / service registry | **Active Services** (already tab name; fix body copy) | ActiveServicesSummary.tsx |
| Contract #123 | **Service #123** or **Plan #123** | Active services table rows |
| Execution | **Service Visit** | OperationsWall channel badge, stat card |
| Executions | **Service Visits** | Service Updates stat row |
| Assign Services | **Staff Assignment** (sidebar) / keep "Assign Service" as action verb | Sidebar, page title |
| Assignment ID | **Job #** or **Task #** | AssignServicesPage panel |
| Linked Assets | **Vehicles & Assets** | Customer detail tab |
| Linked Locations | **Locations** | Customer detail tab |
| Linked customers | **Customer** (singular on card) or **Customers** | Service location card footer |
| Service Locations (module subtitle) | **Where we serve customers** | Page description |
| Assets (module subtitle) | **Customer vehicles & equipment** | Page description |
| Operations Dashboard | **Dashboard** or **Today's Overview** | Dashboard page title |
| DCMS Operations | **Daily Cleaning (Legacy)** | Sidebar — move to Legacy section |
| DCMS visit / DCMS due | **Daily wash visit** / **Wash due** | Service Updates timeline |
| Pending Queue / Assigned Queue | **Needs staff** / **Staff assigned** | Assign Services tabs |
| Wallet Summary | **Wallet** | Customer tab (optional shorten) |
| Billing Summary | **Bills** | Customer tab |
| Support | **Complaints** | Customer tab (align with sidebar) |
| Master Data | **Reference Data** or keep under Config only | Config section |
| Staff Verification | **Verify Staff** | Network section |

### 3.2 Labels To Keep

| Label | Reason |
|-------|--------|
| Book Services | Clear action |
| Billing & Finance | Standard business term |
| Complaints | Clear |
| Staff | Clear |
| Services (catalog) | Clear in Master Setup context |
| Leads & CRM | Acceptable for sales workflow |

### 3.3 Copy Replacements (Not Nav Labels)

| Current Copy | Proposed Copy |
|--------------|---------------|
| "Read-only in Customer 360. Manage assets in the Assets module." | "View only. To add or edit, go to **Assets** in Master Setup." |
| "Read-only in Customer 360. Manage locations in the Service Locations module." | "View only. To add or edit, go to **Locations** in Master Setup." |
| "from the service registry" | "currently active for this customer" |
| "aggregates assignments & executions" | "Live view of today's services" |
| "Site masters where work is performed — linked to customers" | "All customer addresses where services are delivered" |
| "execution starts in a later sprint" | Remove entirely (internal dev note visible to users) |

---

## 4. Sidebar Restructure Proposal

### 4.1 Current Structure (Problem)

```
Operations (everything in one bucket — 15+ items)
├── Dashboard
├── Leads & CRM
├── Customers ▼
│   ├── Customer 360
│   ├── Bookings
│   ├── Legacy Contacts
│   ├── Reactivated
│   ├── Import
│   └── Churned
├── Service Locations      ← setup mixed with ops
├── Assets                 ← setup mixed with ops
├── Book Services
├── Assign Services
├── Services
├── DCMS Operations        ← legacy mixed with ops
├── Staff
├── Billing & Finance
├── Complaints
└── Service Updates

Network | Config | Settings | Legal | Views
```

**Problems:** Database-entity ordering, legacy exposed, customer migration tools in daily nav, no visual workflow grouping.

### 4.2 Proposed Structure (Founder Rule 3)

```
DASHBOARD
└── Dashboard                    /admin/dashboard

CUSTOMERS
└── Customers                    /admin/customers
    (detail hub — not separate nav items for Bookings/Legacy/Import)

OPERATIONS
├── Book Service                 /admin/book-services
├── Assign Service               /admin/assign-services
└── Service Updates              /admin/service-updates

MASTER SETUP
├── Services                     /admin/services
├── Locations                    /admin/service-locations
├── Assets                       /admin/assets
└── Staff                        /admin/staff

FINANCE
└── Billing & Finance            /admin/billing

SUPPORT
└── Complaints                   /admin/complaints

SALES (optional — keep if used daily)
└── Leads & CRM                  /admin/leads

LEGACY ▼ (collapsed by default)
├── ⚠ LEGACY MODULE
├── DCMS Operations              /admin/daily-cleaning
├── Legacy Contacts              /admin/customers/legacy-contacts
├── Customer Import              /admin/customers/migration
├── Reactivated Customers        /admin/customers/reactivated
└── Churned Customers            /admin/churned

ADMIN (collapsed by default — HQ only)
├── Network (Franchisees, Verify Staff, Credentials)
├── Config (Branches, Analytics, Communications…)
├── Settings
└── Legal & Compliance
```

### 4.3 Implementation Notes (Post-Approval)

| Change | Type | Risk |
|--------|------|------|
| Reorder `ADMIN_NAV_SECTIONS` | Config-only | Low |
| Collapse Legacy + Admin sections by default | UI state | Low |
| Add "LEGACY MODULE" badge/header | UI copy | Low |
| Move Bookings under customer detail or Book Service | Nav removal | Medium — confirm bookings workflow |
| Rename nav labels per Section 3 | Copy | Low |
| Hide Founder Dashboard duplicate | Merge into main dashboard KPIs | Low |

**No route changes required** for Phase 1 — presentation and nav grouping only.

---

## 5. Dashboard Simplification Proposal

### 5.1 Current KPI Grid (9 cards — equal weight)

1. Today's Revenue  
2. Month Revenue  
3. Active Subscriptions  
4. Total Customers  
5. Staff Profiles (% completion)  
6. Pending Dues  
7. Active Jobs  
8. Open Complaints  
9. Repeat Customer %  

Plus: Subscription Health strip, Lead Analytics, Follow-ups, 3 charts, Expiring Soon list.

### 5.2 Proposed Primary Row (Founder Rule 8 — priority order)

| Priority | KPI | Source | Action Link |
|----------|-----|--------|-------------|
| 1 | **Today's Jobs** | `activeJobs` + today's scheduled count | → Service Updates |
| 2 | **Pending Assignments** | assignment pending count | → Assign Service |
| 3 | **Collections Due** | `pendingDuesTotal` | → Billing (Dues tab) |
| 4 | **Open Complaints** | `openComplaints` | → Complaints |
| 5 | **Revenue This Month** | `monthRevenue` | → Billing |
| 6 | **Active Customers** | `totalCustomers` or active-only | → Customers |

**Visual treatment:** Large cards for items 1–4 (ops-critical). Smaller row for 5–6 (business health).

### 5.3 Move to Secondary / Collapsible Sections

| Current Element | Proposal |
|-----------------|----------|
| Today's Revenue (separate from month) | Merge into "Revenue This Month" with today as subtitle |
| Active Subscriptions | Move to collapsible "Subscription Health" (DCMS-heavy) |
| Staff Profiles % | Move to Staff module or Admin section |
| Repeat Customer % | Move to Analytics |
| Lead Source Analytics | Move under Leads & CRM or collapsible "Sales" |
| Follow-ups | Link to Leads only |
| Revenue by Category / Subscription Mix / City charts | Collapsible "Analytics" panel on dashboard |
| Expiring Soon | Link from Subscription Health, not primary row |

### 5.4 Page Title

| Current | Proposed |
|---------|----------|
| Operations Dashboard | **Dashboard** |
| Real-time business overview | **What needs your attention today** |

### 5.5 Reference: Founder Dashboard

The existing `/admin/founder` (Founder Dashboard) is **closer to the target** than the main dashboard. Consider merging its KPI philosophy into `/admin/dashboard` and retiring the separate "Views" entry.

---

## 6. Customer-Centric Improvements

### 6.1 Current Customer Detail Structure

```
Customer Detail (9 tabs)
├── Overview        — KPIs, recent bookings/payments
├── Active Services — contract table
├── Profile         — edit form, referrals
├── Wallet Summary
├── Billing Summary
├── Linked Assets   — read-only, link out
├── Linked Locations— read-only, link out
├── Communications
└── Support         — complaints
```

**Gap vs Founder Rule 4:** Information exists but is **tab-siloed**. User must know which tab to open. "Linked" language signals database, not business.

### 6.2 Proposed Customer Detail Layout

Single scrollable **Customer Home Base** with anchored sections (tabs optional as secondary nav):

```
┌─────────────────────────────────────────────────────┐
│  ← Back          Rahul Sharma                       │
│                  98765 43210 · Varanasi             │
│  [Edit profile]  [Book Service]                     │
├─────────────────────────────────────────────────────┤
│  Wallet ₹500  │  Due ₹1,200  │  Active Plans 2     │
├─────────────────────────────────────────────────────┤
│  LOCATIONS                          [View all →]    │
│  • Primary Residence — Lanka, Varanasi              │
│  • Office — Sigra                                   │
├─────────────────────────────────────────────────────┤
│  VEHICLES & ASSETS                  [View all →]    │
│  • UP65BG5150 — Swift · Primary Residence           │
├─────────────────────────────────────────────────────┤
│  ACTIVE SERVICES                    [Book Service]  │
│  • Daily Car Clean · Active · ends Aug 2026         │
├─────────────────────────────────────────────────────┤
│  BILLS                              [Open Billing]  │
│  • Last invoice ₹2,400 · Due ₹1,200                 │
├─────────────────────────────────────────────────────┤
│  COMPLAINTS                         [View all →]    │
│  • Open: Delay on 12 Jun                            │
└─────────────────────────────────────────────────────┘
```

### 6.3 Specific Changes

| Area | Current | Proposed |
|------|---------|----------|
| Page subtitle | "Customer 360 hub" | Remove or use city + status |
| Tab count | 9 tabs | 3 max visible: **Overview**, **Profile**, **Communications** — rest as sections on Overview |
| Assets/Locations | Separate tabs, read-only, "open module" | Inline sections on Overview; deep-link to Master Setup for edits |
| Active Services | Tab with "service registry" copy | Section on Overview; rename rows to Service not Contract |
| Support tab | Separate | Merge into Overview as Complaints section |
| Wallet/Billing | Separate tabs | Summary cards at top + expandable sections |
| Customer list nav | "Customer 360" in sidebar | **Customers** only |

### 6.4 Customer List Improvements

| Change | Benefit |
|--------|---------|
| Rename sidebar entry to **Customers** | Consistent with page title |
| Move Bookings, Legacy, Import, Reactivated, Churned out of daily Customers submenu | Reduces noise |
| Add quick action column: **Book Service** | Reinforces customer as action center |
| Keep churned/import under Legacy | Migration-only tools hidden |

---

## 7. Asset Visibility Improvements

### 7.1 Current Asset Card

```
┌──────────────────────────┐
│ 🚗                  active│
│ UP65BG5150               │
│ Vehicle                  │
│ @ Primary                │
└──────────────────────────┘
```

**Missing:** Customer name. Location label "Primary" is meaningless without customer context.

### 7.2 Proposed Asset Card (Founder Rule 6)

```
┌──────────────────────────┐
│ UP65BG5150          active│
│ Rahul Sharma             │
│ Lanka Residence          │
│ Vehicle                  │
└──────────────────────────┘
```

**Field order:** Vehicle Number → Customer Name → Location Name → Asset Type

### 7.3 Data Availability

| Field | List API (`AssetListRow`) | Detail API |
|-------|---------------------------|------------|
| `label` (registration) | ✅ | ✅ |
| `serviceLocationLabel` | ✅ | ✅ |
| `customerId` | ✅ | ✅ |
| `customerName` | ❌ not in list | ✅ in `customerLinks[]` |

**Implementation note (post-approval):** Display change may require **enriching list API response** with `customerName` — this is a read projection change, not a new entity. Flag for technical review to confirm it stays within Phase 1 UI-only boundary, or use client-side join if customer name is already available elsewhere.

### 7.4 Additional Asset UX Fixes

| Item | Fix |
|------|-----|
| Create dialog "Customer ID" | Replace with **customer search by name/phone** |
| Page subtitle | "Customer vehicles & equipment" |
| Search placeholder | "Search by vehicle number or customer name…" |
| Solar assets | Same card pattern: site name → customer → location → Solar Site |

---

## 8. Service Location Improvements

### 8.1 Current Location Card

```
┌──────────────────────────┐
│ 📍            Auto active │
│ Primary                  │
│ Residence · Varanasi     │
│ 123 Lane, Lanka...       │
│ ─────────────────────    │
│ 👥 1 linked customers    │
└──────────────────────────┘
```

**Missing:** Customer name as primary identifier.

### 8.2 Proposed Location Card (Founder Rule 5)

```
┌──────────────────────────┐
│ Rahul Sharma        active│
│ Primary Residence        │
│ Lanka, Varanasi          │
│ 123 Lane, Lanka...       │
└──────────────────────────┘
```

**Field order:** Customer Name → Location Label → City/Area

When multiple customers share a location (rare), show:

```
┌──────────────────────────┐
│ 3 customers         active│
│ Shared Parking — Sigra   │
│ Varanasi                 │
└──────────────────────────┘
```

### 8.3 Data Availability

| Field | List API | Detail API |
|-------|----------|------------|
| `label` | ✅ | ✅ |
| `locationType`, `city`, `address` | ✅ | ✅ |
| `linkedCustomerCount` | ✅ | ✅ |
| `customerName` | ❌ not in list | ✅ in `customerLinks[]` |

Same enrichment consideration as assets — display-only join for primary/default customer name.

### 8.4 Additional Location UX Fixes

| Item | Fix |
|------|-----|
| Filter banner `customer #42` | Show **customer name** |
| Footer "linked customers" | Replace with customer name when count = 1 |
| Page subtitle | "All customer addresses where services are delivered" |
| "Auto" badge | Add tooltip: "Created automatically during booking" |
| Nav label | **Locations** under Master Setup (shorter) |

---

## 9. Legacy Modules To Hide

### 9.1 Modules To Collapse Under LEGACY (Default Collapsed)

| Module | Route | Rationale |
|--------|-------|-----------|
| **DCMS Operations** | `/admin/daily-cleaning/*` | Parallel system to new Book/Assign/Service Updates flow |
| Legacy Contacts | `/admin/customers/legacy-contacts` | Pre-migration data |
| Customer Import | `/admin/customers/migration` | One-time migration tool |
| Reactivated Customers | `/admin/customers/reactivated` | Migration outcome view |
| Churned Customers | `/admin/churned` | Historical; not daily ops |

### 9.2 DCMS Sub-Modules (Inside Legacy)

| Tab | Status | Proposal |
|-----|--------|----------|
| Dashboard | Active | Keep inside Legacy with warning banner |
| Plans | Redirects to Services catalog | Remove duplicate entry |
| Subscriptions | Active | Keep in Legacy |
| Visits | Active | Keep in Legacy |
| Wash History | Active | Keep in Legacy |
| Assignments (Legacy) | Deprecated | Hide or show strikethrough only |
| Staff Performance | Active | Keep in Legacy |

### 9.3 Legacy Visual Treatment

```
┌─ LEGACY MODULE ─────────────────────────────────────┐
│  ⚠ These screens support the old Daily Cleaning      │
│  system. New services use Book Service → Assign      │
│  Service → Service Updates.                          │
└──────────────────────────────────────────────────────┘
```

- Section collapsed by default in sidebar  
- Amber/warning styling on Legacy section header  
- "LEGACY MODULE" label visible when expanded  
- Do **not** delete routes — redirect and hide only  

### 9.4 Admin-Only Sections (Collapse by Default)

Not legacy, but not for franchise daily use:

- Network (Franchisees, Credentials)  
- Config (Master Data, Analytics, Communication Center, Push Logs)  
- Settings (Brand, SEO, System Status)  
- Legal & Compliance  

### 9.5 Orphan / Hidden Routes

| Route | Current State | Proposal |
|-------|---------------|----------|
| `/admin/subscriptions` | Not in sidebar; linked from dashboard | Add under Legacy or Finance, or redirect to DCMS Subscriptions |
| `/admin/dues` | Redirects to billing | OK |
| `/admin/operations-wall` | Redirects to service-updates | OK |

---

## 10. Screenshots Before/After Mapping

> **Note:** This audit was conducted via codebase review. Actual PNG screenshots should be captured during implementation for founder sign-off. Below: wireframe mappings with route references for the implementation sprint.

### 10.1 Sidebar

| Before | After |
|--------|-------|
| ![Before: Flat Operations list with 15 items, Customer 360, DCMS inline](wireframe) | ![After: Grouped sections — CUSTOMERS, OPERATIONS, MASTER SETUP, FINANCE, SUPPORT, LEGACY collapsed](wireframe) |

**Before (current):**
```
OPERATIONS
  Dashboard
  Leads & CRM
  Customers ▼
    Customer 360
    Bookings
    Legacy Contacts
    ...
  Service Locations
  Assets
  Book Services
  ...
  DCMS Operations
```

**After (proposed):**
```
DASHBOARD
  Dashboard

CUSTOMERS
  Customers

OPERATIONS
  Book Service
  Assign Service
  Service Updates

MASTER SETUP
  Services | Locations | Assets | Staff

FINANCE
  Billing & Finance

SUPPORT
  Complaints

▶ LEGACY MODULE
```

**Capture instructions:** Screenshot `adminNavConfig` rendered sidebar at 1440px width before/after.

---

### 10.2 Dashboard

| KPI Area | Before | After |
|----------|--------|-------|
| Row 1 | Today's Revenue, Month Revenue, Active Subscriptions, Total Customers | **Today's Jobs**, **Pending Assignments**, **Collections Due**, **Open Complaints** |
| Row 2 | Staff %, Pending Dues, Active Jobs, Open Complaints, Repeat % | **Revenue This Month**, **Active Customers** |
| Below fold | Subscription Health, Leads, 3 charts | Collapsible: Subscription Health, Sales, Charts |

**Routes:** `/admin/dashboard`  
**Reference file:** `pages/admin/Dashboard.tsx`

---

### 10.3 Service Location Card

| Before | After |
|--------|-------|
| Title: **Primary** | Title: **Rahul Sharma** |
| Sub: Residence · Varanasi | Sub: **Primary Residence** |
| Footer: 1 linked customers | Sub: **Lanka, Varanasi** |

**Routes:** `/admin/service-locations`  
**Reference file:** `pages/admin/ServiceLocationsPage.tsx` lines 142–151

---

### 10.4 Asset Card

| Before | After |
|--------|-------|
| Title: **UP65BG5150** | Line 1: **UP65BG5150** |
| Sub: Vehicle | Line 2: **Rahul Sharma** |
| Sub: @ Primary | Line 3: **Lanka Residence** |
| | Line 4: **Vehicle** |

**Routes:** `/admin/assets`  
**Reference file:** `pages/admin/AssetsPage.tsx` lines 222–231

---

### 10.5 Customer Detail

| Before | After |
|--------|-------|
| Subtitle: "Customer 360 hub" | Subtitle: removed or city only |
| 9 tabs across top | Single Overview with sections |
| Linked Assets tab → module link | Vehicles section inline |
| Linked Locations tab → module link | Locations section inline |
| Support tab | Complaints section inline |

**Routes:** `/admin/customers/:id`  
**Reference file:** `features/customers/pages/CustomerDetail.tsx`

---

### 10.6 Service Updates

| Before | After |
|--------|-------|
| 8 pipeline tiles including Scheduled, Started, Cancelled | **5 primary:** Pending, Assigned, In Progress, Completed, Missed |
| 7 stat tiles: Executions, DCMS visits, DCMS due… | Collapsed "Advanced metrics" accordion |
| Channel badge: "Execution" | **Service Visit** |
| Subtitle: "aggregates assignments & executions" | "Live view of today's services" |

**Routes:** `/admin/service-updates`  
**Reference file:** `pages/admin/OperationsWall.tsx`

**Status mapping proposal:**

| Primary Status | Includes (current) |
|----------------|-------------------|
| Pending | pending |
| Assigned | assigned |
| In Progress | scheduled, started, confirmed, en_route, in_progress |
| Completed | completed |
| Missed | missed |
| *(Advanced)* Cancelled | cancelled |
| *(Advanced)* Rescheduled | rescheduled |

---

### 10.7 Screenshot Capture Checklist (Implementation Phase)

When founder approves, capture these pairs:

| # | Screen | URL | Viewport |
|---|--------|-----|----------|
| 1 | Sidebar | any admin page | 1440×900 |
| 2 | Dashboard | `/admin/dashboard` | 1440×900 |
| 3 | Customer list | `/admin/customers` | 1440×900 |
| 4 | Customer detail | `/admin/customers/{id}` | 1440×900 |
| 5 | Service Locations | `/admin/service-locations` | 1440×900 |
| 6 | Assets | `/admin/assets` | 1440×900 |
| 7 | Service Updates | `/admin/service-updates` | 1440×900 |
| 8 | Assign Services | `/admin/assign-services` | 1440×900 |
| 9 | Legacy section expanded | sidebar | 1440×900 |

Store under: `docs/screenshots/founder-ux-phase1/{before|after}/`

---

## Appendix A — Service Updates Simplification Detail (Rule 9)

### Current Primary Row (8 tiles)
Pending · Assigned · Scheduled · Started · Completed · Missed · Cancelled

### Proposed Primary Row (5 tiles)
Pending · Assigned · In Progress · Completed · Missed

### Advanced Section (collapsed)
Scheduled · Started · Cancelled · Rescheduled · DCMS visits · DCMS due · Executions · Delayed

---

## Appendix B — Visibility Audit Scorecard (Rule 10)

| Screen | 30-Second Explain Test | Verdict |
|--------|--------------------------|---------|
| Dashboard | "Lots of numbers — not sure what to do first" | Redesign |
| Customers list | "List of customers with wallet and dues" | Pass |
| Customer detail | "Everything about one customer but too many tabs" | Redesign layout |
| Service Locations | "Addresses but I can't tell who they belong to" | Redesign cards |
| Assets | "Vehicle numbers — whose are these?" | Redesign cards |
| Book Services | "Wizard to sell a service" | Pass |
| Assign Services | "Give pending jobs to staff" | Pass with label fixes |
| Service Updates | "Too many statuses and DCMS words" | Redesign |
| Billing | "Invoices and payments" | Pass |
| Complaints | "Customer problems to resolve" | Pass |
| Staff | "Team members" | Pass |
| DCMS Operations | "Old daily cleaning system?" | Hide in Legacy |

---

## Appendix C — Out of Scope (Confirmed)

Per Founder Rules, **not included** in Phase 1:

- New APIs, tables, entities, migrations  
- Architecture changes  
- New features  
- Customer/Staff/Franchisee mobile app redesign (admin panel only)  
- Backend business logic changes  

**Possible borderline item:** Adding `customerName` to asset/location list API responses is a read projection enrichment — requires founder decision on whether this crosses the "UI only" line.

---

## Appendix D — Recommended Implementation Order (Post-Approval)

| Order | Work Package | Effort | Impact |
|-------|--------------|--------|--------|
| 1 | Sidebar restructure + label renames | 1–2 days | High |
| 2 | Legacy section collapse + warning banner | 0.5 day | High |
| 3 | Dashboard KPI reorder + collapse secondary | 1–2 days | High |
| 4 | Asset + Location card enrichment | 1–2 days | High |
| 5 | Customer detail → home base layout | 2–3 days | High |
| 6 | Service Updates simplification | 1–2 days | Medium |
| 7 | Copy sweep (registry, 360, execution) | 1 day | Medium |
| 8 | Screenshot before/after capture | 0.5 day | Documentation |

**Total estimate:** 8–12 days UI-only work after approval.

---

## Approval Block

| Item | Approved (Y/N) | Notes |
|------|----------------|-------|
| Sidebar restructure (Section 4) | | |
| Label renames (Section 3) | | |
| Dashboard simplification (Section 5) | | |
| Customer home base layout (Section 6) | | |
| Asset card changes (Section 7) | | |
| Location card changes (Section 8) | | |
| Legacy collapse (Section 9) | | |
| List API enrichment for customer names | | |
| Service Updates 5-status model (Section 10.6) | | |

**Founder signature / date:** ___________________________

---

*End of report. No code changes have been made. Await founder approval before implementation.*
