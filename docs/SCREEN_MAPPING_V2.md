# Screen Mapping V2 — Admin Panel Restructure

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Version:** 2.0  
**Status:** Architecture Freeze — Documentation Only  
**Basis:** Founder-approved decisions (June 2026) + [`DATA_RELATIONSHIP_V1.md`](./DATA_RELATIONSHIP_V1.md)  
**Supersedes:** [`SCREEN_MAPPING_V1.md`](./SCREEN_MAPPING_V1.md)

---

## Purpose

Re-audited classification of **every existing admin screen** after v2 architecture refinements:

- **Service Locations** entity and module impacts  
- **Assets** as core (vehicles, solar sites, future types)  
- **Customer 360 Billing Summary** (retained — not removed)  
- **Book Services** 9-step flow: Customer → Service Location → Asset → …  

| Action | Meaning |
|--------|---------|
| **KEEP** | Screen stays; same module and purpose; minor copy/permission tweaks only |
| **MOVE** | Screen relocates to a different module, route, or nav section |
| **MERGE** | Screen is absorbed into another screen (tab, section, or wizard step) |
| **DELETE** | Screen or route is retired (redirect or removal after migration) |
| **RENAME** | Same screen function; new label and/or canonical route |

### Metadata Legend (per recommendation)

| Field | Values |
|-------|--------|
| **Priority** | Critical · High · Medium · Low |
| **Risk** | Low · Medium · High |
| **Dependency** | None · Phase 1 · Phase 1b · Phase 2 · Phase 3 · Future |

---

## Target Module Structure (V2)

```
Operations
├── Dashboard
├── Leads & CRM
├── Customers              (identity + summaries — no service/asset/location CRUD)
├── Service Locations      (NEW — site masters + customer links)
├── Assets                 (NEW — vehicle/solar masters + location placement)
├── Book Services          (NEW — 9-step operational flow)
├── Assign Services        (NEW — unified assignment)
├── Service Updates        (live ops dashboard)
├── Billing & Finance      (separate module; full billing management)
├── Complaints
└── Staff

Config / Network / Settings / Legal   (unchanged scope)
```

### Approved Book Services Flow (V2)

```
Customer → Service Location → Asset → Service → Add-ons → Discount → Payment Terms → Quote/Invoice → Assignment
```

### Wallet Rule

Wallet = **₹ monetary adjustment ledger only**. Not loyalty, not wash credits, not service credits. See `DATA_RELATIONSHIP_V1.md` §2.

### Customer 360 Billing Rule

Customer 360 **retains Billing Summary** (read-only):

- Outstanding Due  
- Wallet Balance (₹)  
- Last Invoice  
- Last Payment  
- **Open Billing** button → Billing & Finance  

Full invoice/payment/wallet CRUD remains in **Billing & Finance**.

---

## 1. Top-Level Sidebar Screens

| # | Current | Current Route | Action | Future Module | Future Route | Priority | Risk | Dep |
|---|---------|---------------|--------|---------------|--------------|----------|------|-----|
| 1 | Dashboard | `/admin/dashboard` | **KEEP** | Operations | `/admin/dashboard` | Low | Low | None |
| 2 | Leads & CRM | `/admin/leads` | **KEEP** | Operations | `/admin/leads` | Low | Low | None |
| 3 | Customers (group) | — | **RENAME** | Operations | **Customers** hub | High | Low | Phase 1 |
| 4 | Products & Plans | `/admin/products` | **RENAME** | Operations | `/admin/services` | High | Low | Phase 1 |
| 5 | DCMS Operations | `/admin/daily-cleaning` | **MOVE** | Assign + Service Updates | See §8, §9 | High | Medium | Phase 3 |
| 6 | Staff | `/admin/staff` | **KEEP** | Operations | `/admin/staff` | Low | Low | None |
| 7 | Invoices & Payments | `/admin/invoices` | **RENAME** | Billing & Finance | `/admin/billing` | Critical | Medium | Phase 1 |
| 8 | Quotations | `/admin/quotations` | **MERGE** | Billing & Finance | `/admin/billing?tab=quotations` | High | Medium | Phase 1 |
| 9 | Expenses | `/admin/expenses` | **MERGE** | Billing & Finance | `/admin/billing?tab=expenses` | Medium | Low | Phase 1 |
| 10 | Dues & Collections | `/admin/dues` | **MERGE** | Billing & Finance | `/admin/billing?tab=dues` | High | Low | Phase 1 |
| 11 | Complaints | `/admin/complaints` | **KEEP** | Operations | `/admin/complaints` | Low | Low | None |
| 12–27 | Network / Config / Settings / Legal | (unchanged) | **KEEP** | Same | Same | Low | Low | None |
| 28 | Operations Wall | `/admin/operations-wall` | **RENAME** | Service Updates | `/admin/service-updates` | Medium | Low | Phase 4 |
| 29 | Founder Dashboard | `/admin/founder` | **KEEP** | Views | `/admin/founder` | Low | Low | None |
| 30 | — | — | **NEW** | Service Locations | `/admin/service-locations` | Critical | Medium | Phase 1b |
| 31 | — | — | **NEW** | Assets | `/admin/assets` | Critical | Medium | Phase 1b |
| 32 | — | — | **NEW** | Book Services | `/admin/book-services` | Critical | High | Phase 2 |
| 33 | — | — | **NEW** | Assign Services | `/admin/assign-services` | High | Medium | Phase 3 |

---

## 2. Customers Hub Sub-Nav

| # | Current | Route | Action | Future | Notes | Priority | Risk | Dep |
|---|---------|-------|--------|--------|-------|----------|------|-----|
| 1 | Customer 360 | `/admin/customers`, `/:id` | **KEEP** | Customers | Tabs restructured §4 | Critical | Medium | Phase 2 |
| 2 | Bookings | `/admin/bookings` | **MOVE** | Assign Services | Not in Customers hub | High | Low | Phase 3 |
| 3 | Legacy Contacts | `/admin/customers/legacy-contacts` | **KEEP** | Customers | Unchanged | Low | Low | None |
| 4 | Reactivated | `/admin/customers/reactivated` | **KEEP** | Customers | Unchanged | Low | Low | None |
| 5 | Import | `/admin/customers/migration` | **KEEP** | Customers | Unchanged | Medium | Medium | None |
| 6 | Churned | `/admin/churned` | **KEEP** | Customers | Unchanged | Low | Low | None |

---

## 3. Service Locations Module (New)

No dedicated screens exist today. Customer address fields and per-asset addresses are fragmented.

| # | Screen (New) | Action | Route | Source / Notes | Priority | Risk | Dep |
|---|--------------|--------|-------|----------------|----------|------|-----|
| 1 | Locations Directory | **NEW** | `/admin/service-locations` | New list all sites | Critical | Medium | Phase 1b |
| 2 | Location Detail | **NEW** | `/admin/service-locations/:id` | Label, address, geo, type | Critical | Medium | Phase 1b |
| 3 | Create / Edit Location | **NEW** | `/admin/service-locations/new`, `/:id/edit` | Not in Customer 360 | Critical | Medium | Phase 1b |
| 4 | Link Location to Customer | **NEW** | Location Detail → Customer Links | `customer_location_links` | Critical | Medium | Phase 1b |
| 5 | Locations by Customer | **NEW** | `/admin/service-locations?customerId=` | Customer 360 deep link | High | Low | Phase 2 |

---

## 4. Customer 360 Detail Tabs (Re-Audited)

Current: `CustomerDetail.tsx`

| # | Current Tab | Action | Future Destination | Priority | Risk | Dep |
|---|-------------|--------|------------------|----------|------|-----|
| 1 | Overview | **KEEP** | Overview + summary cards | High | Low | Phase 2 |
| 2 | Services & Plans | **DELETE** | → **Active Services** (read-only) | Critical | Medium | Phase 2 |
| 3 | Profile | **KEEP** | Profile (Retail/Corporate, GST) | High | Low | Phase 2 |
| 4 | Wallet | **RENAME** | **Wallet Summary** (₹ balance + last 3 tx read-only) | Critical | Low | Phase 2 |
| 5 | Billing | **RENAME** | **Billing Summary** — see below | Critical | Low | Phase 2 |
| 6 | Vehicles | **MOVE** | Assets module (§5) | Critical | Medium | Phase 1b |
| 7 | Communications | **KEEP** | Communications | Low | Low | None |
| 8 | Support | **KEEP** | Support | Low | Low | None |
| 9 | — | **NEW** | **Linked Service Locations** (read-only) | Critical | Low | Phase 2 |
| 10 | — | **NEW** | **Linked Assets** (read-only) | Critical | Low | Phase 2 |

### Customer 360 → Billing Summary (V2 Rule)

| Element | Action | Future behavior |
|---------|--------|-----------------|
| Outstanding Due | **KEEP** | Read-only; from dues API |
| Wallet Balance (₹) | **KEEP** | Read-only summary — not entitlement counts |
| Last Invoice | **KEEP** | Read-only row + link |
| Last Payment | **KEEP** | Read-only row + link |
| Open Billing button | **NEW** | → `/admin/billing?customerId=` |
| Create Invoice dialog | **MOVE** | Billing & Finance only |
| Full invoice table | **MOVE** | Billing & Finance |
| Wallet credit/debit form | **MOVE** | Billing & Finance → Wallet Adjustments |
| Full transaction history | **MOVE** | Billing & Finance (customer filter) |

**Change from V1:** Billing tab is **not** removed — it becomes a **summary panel**, not a management surface.

---

## 5. Assets Module (Re-Audited)

| # | Screen (New) | Action | Route | Notes | Priority | Risk | Dep |
|---|--------------|--------|-------|-------|----------|------|-----|
| 1 | Assets Directory | **NEW** | `/admin/assets` | Filter by type, location, customer | Critical | Medium | Phase 1b |
| 2 | Asset Detail | **NEW** | `/admin/assets/:id` | Vehicle or Solar Site | Critical | Medium | Phase 1b |
| 3 | Create / Edit Asset | **NEW** | `/admin/assets/new`, `/:id/edit` | **Not** in Customer module | Critical | Medium | Phase 1b |
| 4 | Place Asset at Location | **NEW** | Asset Detail → Location placement | `location_asset_links` | Critical | Medium | Phase 1b |
| 5 | Link Asset to Customer | **NEW** | Asset Detail → Customer Links | Commercial link | High | Medium | Phase 1b |
| 6 | Assets by Customer | **NEW** | `/admin/assets?customerId=` | Replaces Vehicles tab CRUD | High | Low | Phase 2 |
| 7 | Future Asset Types | **NEW** | Extensible type selector | Equipment etc. | Low | Low | Future |

### Asset Type Screens (within Assets module)

| Type | Current location | Action | Future |
|------|------------------|--------|--------|
| Vehicles | Customer 360 Vehicles tab | **MOVE** | Assets → Vehicles |
| Solar Sites | Wizard inline create | **MOVE** | Assets → Solar Sites |
| Future types | — | **NEW** | Assets → type registry | Future |

---

## 6. Book Services Screens (9-Step Flow)

| # | Step | Action | Route / UI | Priority | Risk | Dep |
|---|------|--------|------------|----------|------|-----|
| 1 | Select Customer | **NEW** | Wizard step 1 | Critical | Medium | Phase 2 |
| 2 | Select Service Location | **NEW** | Wizard step 2 | Critical | High | Phase 2 |
| 3 | Select Asset | **NEW** | Wizard step 3 (filtered by location) | Critical | High | Phase 2 |
| 4 | Select Service | **NEW** | Wizard step 4 | Critical | High | Phase 2 |
| 5 | Add-ons | **MOVE** | Wizard step 5 — from `AddCustomerServiceWizard` | High | Medium | Phase 2 |
| 6 | Discount | **NEW** | Wizard step 6 | High | Medium | Phase 2 |
| 7 | Payment Terms | **NEW** | Wizard step 7 (full/partial/post) | Critical | Medium | Phase 2 |
| 8 | Quote / Invoice | **MOVE** | Wizard step 8 → emits to Billing & Finance | Critical | High | Phase 2 |
| 9 | Assignment | **MOVE** | Wizard step 9 → Assign Services queue | High | Medium | Phase 2 |
| 10 | Deep link entry | **NEW** | `/admin/book-services?customerId=&locationId=` | High | Low | Phase 2 |

**V2 change from V1:** Service Location step inserted between Customer and Asset.

---

## 7. Services (Products & Plans) Tabs

| Tab | Action | Future | Priority | Risk | Dep |
|-----|--------|--------|----------|------|-----|
| Services | **RENAME** | Doorstep Wash → One-time Services | High | Low | Phase 1 |
| Packages | **RENAME** | Doorstep Wash → Packages (entitlements) | High | Low | Phase 1 |
| DCMS Plans | **RENAME** | Daily Car Cleaning → Plans | High | Low | Phase 1 |
| City Pricing | **KEEP** | Shared → City Pricing | Medium | Low | Phase 1 |
| Solar Slabs | **RENAME** | Solar → Panel Pricing | Medium | Low | Phase 1 |
| Categories | **KEEP** | Shared → Categories | Low | Low | Phase 1 |
| Homepage CMS | **KEEP** | Shared → Homepage CMS | Low | Low | None |
| GST | **KEEP** | Shared → Catalog GST Defaults | High | Low | Phase 1 |

---

## 8. Assign Services Screens

| Current | Route | Action | Future | Priority | Risk | Dep |
|---------|-------|--------|--------|----------|------|-----|
| Bookings | `/admin/bookings` | **MOVE** | `/admin/assign-services?section=doorstep-solar` | High | Medium | Phase 3 |
| DCMS Assignments | `/admin/daily-cleaning/assignments` | **MOVE** | `/admin/assign-services?section=daily-routes` | High | Medium | Phase 3 |
| DCMS Subscriptions sell | `/admin/daily-cleaning/subscriptions` | **MOVE** | Create via Book Services only | Critical | Medium | Phase 2 |
| Pending Queue | — | **NEW** | `/admin/assign-services?section=queue` | High | Medium | Phase 3 |

---

## 9. Service Updates Screens

| Current | Route | Action | Future | Priority | Risk | Dep |
|---------|-------|--------|--------|----------|------|-----|
| Operations Wall | `/admin/operations-wall` | **RENAME** | `/admin/service-updates` | Medium | Low | Phase 4 |
| DCMS Dashboard | `/admin/daily-cleaning` | **MERGE** | Service Updates KPIs | Medium | Low | Phase 4 |
| DCMS Visits | `…/visits` | **MOVE** | `?section=visits` | Medium | Low | Phase 4 |
| DCMS Wash History | `…/washes` | **MOVE** | `?section=wash-history` | Medium | Low | Phase 4 |
| DCMS Staff Performance | `…/staff-performance` | **MOVE** | `?section=staff-performance` | Low | Low | Phase 4 |

---

## 10. Billing & Finance Screens

| Current | Route | Action | Future | Priority | Risk | Dep |
|---------|-------|--------|--------|----------|------|-----|
| Invoices & Payments | `/admin/invoices` | **RENAME** | `/admin/billing` | Critical | Medium | Phase 1 |
| Invoices tab | tab | **KEEP** | `?tab=invoices` | Critical | Medium | Phase 1 |
| Payments tab | tab | **KEEP** | `?tab=payments` | Critical | Medium | Phase 1 |
| Quotations tab | tab | **KEEP** | `?tab=quotations` | High | Medium | Phase 1 |
| Expenses tab | tab | **KEEP** | `?tab=expenses` | Medium | Low | Phase 1 |
| Standalone Quotations | `/admin/quotations` | **MERGE** | Billing hub | High | Medium | Phase 1 |
| Standalone Expenses | `/admin/expenses` | **MERGE** | Billing hub | Medium | Low | Phase 1 |
| Dues | `/admin/dues` | **MERGE** | `?tab=dues` | High | Low | Phase 1 |
| Wallet Adjustments | (in Customer 360 today) | **NEW** tab | `?tab=wallet-adjustments` | Critical | Medium | Phase 2 |
| Credit Notes dialog | component | **KEEP** | Billing hub action | High | Medium | Phase 2 |
| Lifecycle status views | — | **NEW** | Filter by lifecycle §Billing | High | Medium | Phase 2 |

---

## 11. DCMS Sub-Nav (DcmsAdminNav)

| Label | Route | Action | Future | Priority | Risk | Dep |
|-------|-------|--------|--------|----------|------|-----|
| Dashboard | `/admin/daily-cleaning` | **MERGE** | Service Updates | Medium | Low | Phase 4 |
| Plans | `?tab=dcms-plans` | **KEEP** | Services module | High | Low | Phase 1 |
| Subscriptions | `…/subscriptions` | **MOVE** | Book Services + Service Updates | Critical | Medium | Phase 2 |
| Visits | `…/visits` | **MOVE** | Service Updates | Medium | Low | Phase 4 |
| Wash History | `…/washes` | **MOVE** | Service Updates | Medium | Low | Phase 4 |
| Assignments | `…/assignments` | **MOVE** | Assign Services | High | Medium | Phase 3 |
| Staff Performance | `…/staff-performance` | **MOVE** | Service Updates | Low | Low | Phase 4 |

---

## 12. Redirect & Dead Routes

| Route | Action | Future redirect | Priority | Risk | Dep |
|-------|--------|-----------------|----------|------|-----|
| `/admin/catalog` | **DELETE** | → `/admin/services` | Low | Low | Phase 1 |
| `/admin/services` (today) | **RENAME** | Becomes canonical Services route | High | Low | Phase 1 |
| `/admin/products` | **RENAME** | → `/admin/services` | High | Low | Phase 1 |
| `/admin/subscriptions` | **DELETE** | Retire post-migration | Medium | High | Future |
| `ServiceCatalog.tsx` | **DELETE** | Dead file | Low | Low | Phase 1 |

---

## 13. Communication Center & Unchanged Screens

All Communication Center tabs: **KEEP** (Priority: Low, Risk: Low, Dep: None).

All Network / Config / Settings / Legal screens from V1: **KEEP** unchanged.

---

## 14. Summary Counts (V2)

| Action | Count |
|--------|-------|
| **KEEP** | 44 |
| **MOVE** | 22 |
| **MERGE** | 15 |
| **DELETE** | 7 |
| **RENAME** | 9 |
| **NEW** | 22 |

---

## 15. Route Redirect Plan

| Old Route | New Route |
|-----------|-----------|
| `/admin/products` | `/admin/services` |
| `/admin/invoices` | `/admin/billing` |
| `/admin/quotations` | `/admin/billing?tab=quotations` |
| `/admin/expenses` | `/admin/billing?tab=expenses` |
| `/admin/dues` | `/admin/billing?tab=dues` |
| `/admin/bookings` | `/admin/assign-services?section=doorstep-solar` |
| `/admin/daily-cleaning` | `/admin/service-updates` |
| `/admin/operations-wall` | `/admin/service-updates` |
| Customer 360 `?tab=vehicles` | `/admin/assets?customerId=` |
| Customer 360 `?tab=billing` | Billing Summary (stay on Customer 360) + Open Billing → `/admin/billing?customerId=` |
| Customer 360 `?tab=services` | `?tab=active-services` (read-only) |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 14 Jun 2026 | Initial mapping |
| 2.0 | 14 Jun 2026 | Service Locations, Billing Summary rule, 9-step Book Services, Assets re-audit, priority/risk/dependency metadata |

---

*Documentation only. No code, routes, migrations, or schema changes.*
