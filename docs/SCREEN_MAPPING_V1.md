# Screen Mapping V1 — Admin Panel Restructure

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Status:** Superseded by [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md) — do not use for new work  
**Basis:** `PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT.md` v2.0 + Founder decisions (June 2026)

---

## Purpose

This document classifies **every existing admin screen** (route, sidebar item, in-page tab, or dead file) into one of five actions and specifies its **future destination** in the target module structure.

| Action | Meaning |
|--------|---------|
| **KEEP** | Screen stays; same module and purpose; minor copy/permission tweaks only |
| **MOVE** | Screen relocates to a different module, route, or nav section |
| **MERGE** | Screen is absorbed into another screen (tab, section, or wizard step) |
| **DELETE** | Screen or route is retired (redirect or removal after migration) |
| **RENAME** | Same screen function; new label and/or canonical route |

---

## Target Module Structure (V1)

Founder-approved core modules:

```
Operations
├── Dashboard
├── Leads & CRM
├── Customers          (identity + linking only — no service creation)
├── Assets             (NEW — independent master records, linked to customers)
├── Book Services      (NEW — operational booking flow)
├── Assign Services    (NEW — unified assignment)
├── Service Updates    (live ops dashboard)
├── Billing & Finance  (separate module; Book Services may emit quotes/invoices)
├── Complaints
└── Staff

Config / Network / Settings / Legal   (unchanged scope)
```

### Approved Book Services Flow

```
Customer → Asset → Service → Add-ons → Discount → Payment Terms → Quote/Invoice → Assignment
```

### Wallet Rule (Founder Decision)

**Wallet = monetary adjustment ledger only.** It is not a wash-credit, service-credit, or entitlement store. Prepaid package credits (`customer_entitlements`) remain a separate runtime concept managed through Book Services and Billing — not through Wallet.

### Assets Rule (Founder Decision)

**Assets = core module.** Vehicles and solar sites are independent master records first, then **linked** to customers. Customer 360 shows linked assets read-only; create/edit lives in Assets.

---

## 1. Top-Level Sidebar Screens

| # | Current Label | Current Route | Action | Future Module | Future Route / Label | Notes |
|---|---------------|---------------|--------|---------------|----------------------|-------|
| 1 | Dashboard | `/admin/dashboard` | **KEEP** | Operations | `/admin/dashboard` | Unchanged |
| 2 | Leads & CRM | `/admin/leads` | **KEEP** | Operations | `/admin/leads` | Unchanged |
| 3 | Customers (group) | — | **RENAME** | Operations | **Customers** (hub) | Hub scope narrows to identity + lists; Bookings child removed |
| 4 | Products & Plans | `/admin/products` | **RENAME** | Operations | `/admin/services` — **Services** | Catalog setup only; 8 tabs reorganized under 3 service lines |
| 5 | DCMS Operations | `/admin/daily-cleaning` | **MOVE** | Operations | **Assign Services** + **Service Updates** | Nav item removed; sub-routes embedded or redirected |
| 6 | Staff | `/admin/staff` | **KEEP** | Operations | `/admin/staff` | Unchanged |
| 7 | Invoices & Payments | `/admin/invoices` | **RENAME** | Operations | `/admin/billing` — **Billing & Finance** | Canonical finance hub |
| 8 | Quotations | `/admin/quotations` | **MERGE** | Operations | `/admin/billing?tab=quotations` | Remove standalone sidebar entry |
| 9 | Expenses | `/admin/expenses` | **MERGE** | Operations | `/admin/billing?tab=expenses` | Remove standalone sidebar entry |
| 10 | Dues & Collections | `/admin/dues` | **MERGE** | Operations | `/admin/billing?tab=dues` | Becomes tab inside Billing & Finance |
| 11 | Complaints | `/admin/complaints` | **KEEP** | Operations | `/admin/complaints` | Unchanged |
| 12 | Franchisees | `/admin/franchisees` | **KEEP** | Network | `/admin/franchisees` | Unchanged |
| 13 | Staff Verification | `/admin/staff-approval` | **KEEP** | Network | `/admin/staff-approval` | Unchanged |
| 14 | Credentials | `/admin/credentials` | **KEEP** | Network | `/admin/credentials` | Unchanged |
| 15 | Branches | `/admin/branches` | **KEEP** | Config | `/admin/branches` | Unchanged |
| 16 | Master Data | `/admin/masters` | **KEEP** | Config | `/admin/masters` | Unchanged |
| 17 | Analytics | `/admin/analytics` | **KEEP** | Config | `/admin/analytics` | Unchanged |
| 18 | Communication Center | `/admin/communications` | **KEEP** | Config | `/admin/communications` | Unchanged |
| 19 | Notifications | `/admin/notifications` | **KEEP** | Config | `/admin/notifications` | Unchanged |
| 20 | Push Delivery Log | `/admin/push-logs` | **KEEP** | Config | `/admin/push-logs` | Unchanged |
| 21 | Brand Identity | `/admin/settings/brand` | **KEEP** | Settings | `/admin/settings/brand` | Unchanged |
| 22 | Invoice & GST | `/admin/settings/invoice-billing` | **KEEP** | Settings | `/admin/settings/invoice-billing` — **GST Settings (Level 1)** | Supplier/franchisee GST profile |
| 23 | Business Info | `/admin/settings/business` | **KEEP** | Settings | `/admin/settings/business` | Unchanged |
| 24 | SEO Management | `/admin/settings/seo` | **KEEP** | Settings | `/admin/settings/seo` | Unchanged |
| 25 | System Status | `/admin/settings/system` | **KEEP** | Settings | `/admin/settings/system` | Unchanged |
| 26 | Legal Pages CMS | `/admin/legal` | **KEEP** | Legal & Compliance | `/admin/legal` | Unchanged |
| 27 | Compliance Settings | `/admin/compliance` | **KEEP** | Legal & Compliance | `/admin/compliance` | Unchanged |
| 28 | Operations Wall | `/admin/operations-wall` | **RENAME** | Operations | `/admin/service-updates` — **Service Updates** | Promoted from Views to Operations |
| 29 | Founder Dashboard | `/admin/founder` | **KEEP** | Views | `/admin/founder` | Unchanged |
| 30 | — (missing today) | — | **NEW** | Operations | `/admin/assets` — **Assets** | New core module |
| 31 | — (missing today) | — | **NEW** | Operations | `/admin/book-services` — **Book Services** | New core module |
| 32 | — (missing today) | — | **NEW** | Operations | `/admin/assign-services` — **Assign Services** | New core module |

---

## 2. Customers Hub Sub-Nav Screens

| # | Current Label | Current Route | Action | Future Module | Future Destination | Notes |
|---|---------------|---------------|--------|---------------|-------------------|-------|
| 1 | Customer 360 | `/admin/customers`, `/admin/customers/:id` | **KEEP** | Customers | Same routes | Detail tabs restructured (see §4) |
| 2 | Bookings | `/admin/bookings` | **MOVE** | Assign Services | `/admin/assign-services?section=jobs` | Removed from Customers hub |
| 3 | Legacy Contacts | `/admin/customers/legacy-contacts` | **KEEP** | Customers | Same route | Unchanged |
| 4 | Reactivated | `/admin/customers/reactivated` | **KEEP** | Customers | Same route | Unchanged |
| 5 | Import | `/admin/customers/migration` | **KEEP** | Customers | Same route | Unchanged |
| 6 | Churned | `/admin/churned` | **KEEP** | Customers | Same route | Unchanged |

---

## 3. Services (Products & Plans) In-Page Tabs

Current parent: `/admin/products` (`ProductsAndPlans.tsx`)

| # | Current Tab | `?tab=` | Action | Future Module | Future Destination | Notes |
|---|-------------|---------|--------|---------------|-------------------|-------|
| 1 | Services | `services` | **RENAME** | Services | `/admin/services` → **Doorstep Vehicle Wash → One-time Services** | Under service-line grouping |
| 2 | Packages | `packages` | **RENAME** | Services | `/admin/services` → **Doorstep Vehicle Wash → Packages** | Prepaid wash bundles — not wallet credits |
| 3 | DCMS Plans | `dcms-plans` | **RENAME** | Services | `/admin/services` → **Daily Car Cleaning → Plans** | Drop "DCMS" from UI label |
| 4 | City Pricing | `pricing` | **KEEP** | Services | `/admin/services` → **Shared → City Pricing** | Unchanged function |
| 5 | Solar Slabs | `solar` | **RENAME** | Services | `/admin/services` → **Solar Panel Cleaning → Panel Pricing** | Unchanged function |
| 6 | Categories | `categories` | **KEEP** | Services | `/admin/services` → **Shared → Categories** | Low-exposure taxonomy |
| 7 | Homepage CMS | `homepage` | **KEEP** | Services | `/admin/services` → **Shared → Homepage CMS** | Marketing visibility |
| 8 | GST | `settings` | **KEEP** | Services | `/admin/services` → **Shared → Catalog GST Defaults** | Level 3 GST; distinct from Settings → Invoice & GST |
| 9 | Legacy contracts link | `/admin/subscriptions` | **DELETE** | — | Retire after Phase 8 migration | Hidden link on Products page today |

---

## 4. Customer 360 Detail Tabs

Current parent: `/admin/customers/:id` (`CustomerDetail.tsx`)

| # | Current Tab | `?tab=` | Action | Future Module | Future Destination | Notes |
|---|-------------|---------|--------|---------------|-------------------|-------|
| 1 | Overview | `overview` | **KEEP** | Customers | Customer Detail → **Overview** | Add links to Assets, Book Services, Billing |
| 2 | Services & Plans | `services` | **DELETE** | — | Replaced by read-only summary | **Add Service wizard removed** — founder rule |
| 3 | Profile | `profile` | **KEEP** | Customers | Customer Detail → **Profile** | Customer type: Retail / Corporate |
| 4 | Wallet | `wallet` | **KEEP** | Customers | Customer Detail → **Wallet** (read-mostly) | **Monetary adjustments only**; full ledger in Billing |
| 5 | Billing | `billing` | **MOVE** | Billing & Finance | Customer-scoped view via `/admin/billing?customerId=` | Read-only in Customer 360; deep-link to Billing hub |
| 6 | Vehicles | `vehicles` | **MOVE** | Assets | `/admin/assets?customerId=` (linked view) | Master CRUD in Assets module |
| 7 | Communications | `communications` | **KEEP** | Customers | Customer Detail → **Communications** | Unchanged |
| 8 | Support | `support` | **KEEP** | Customers | Customer Detail → **Support** | Complaints scoped to customer |
| 9 | — (missing) | — | **NEW** | Customers | Customer Detail → **Linked Assets** | Read-only list of asset links |
| 10 | — (missing) | — | **NEW** | Customers | Customer Detail → **Active Services** | Read-only; link to Book Services |

### Customer 360 Components to Retire or Refactor

| Component | Action | Future Destination |
|-----------|--------|-------------------|
| `AddCustomerServiceWizard.tsx` | **MOVE** | Book Services wizard (refactored with Asset step) |
| `CustomerServicesTab.tsx` | **MERGE** | Customer Detail → Active Services (read-only) |
| `Customer360BillingPanels.tsx` | **MERGE** | Billing & Finance (customer filter) + Customer Detail read-only |

---

## 5. Assets Module Screens (New)

No dedicated Assets admin screens exist today. Vehicle and solar site management is embedded in Customer 360.

| # | Screen (New) | Action | Future Module | Future Route | Source Material |
|---|--------------|--------|---------------|--------------|-----------------|
| 1 | Assets Directory | **NEW** | Assets | `/admin/assets` | New list: all asset master records |
| 2 | Asset Detail | **NEW** | Assets | `/admin/assets/:id` | Vehicle or solar site record |
| 3 | Create / Edit Asset | **NEW** | Assets | `/admin/assets/new`, `/admin/assets/:id/edit` | Extracted from Customer 360 vehicles + solar flows |
| 4 | Link Asset to Customer | **NEW** | Assets | Asset Detail → **Customer Links** tab | Independent link table; not owned by customer |
| 5 | Assets by Customer (filtered) | **NEW** | Assets | `/admin/assets?customerId=` | Replaces Customer 360 Vehicles tab for admin CRUD |

---

## 6. Book Services Screens (New)

| # | Screen (New) | Action | Future Module | Future Route | Source Material |
|---|--------------|--------|---------------|--------------|-----------------|
| 1 | Book Services Hub | **NEW** | Book Services | `/admin/book-services` | New primary operational entry |
| 2 | Step: Select Customer | **NEW** | Book Services | Wizard step 1 | `CustomerSearchSelect`, quick-create |
| 3 | Step: Select Asset | **NEW** | Book Services | Wizard step 2 | Asset picker / inline create via Assets API |
| 4 | Step: Select Service | **NEW** | Book Services | Wizard step 3 | Catalog fetch from Services module |
| 5 | Step: Add-ons | **NEW** | Book Services | Wizard step 4 | From `AddCustomerServiceWizard` configure logic |
| 6 | Step: Discount | **NEW** | Book Services | Wizard step 5 | Line + invoice-level discount |
| 7 | Step: Payment Terms | **NEW** | Book Services | Wizard step 6 | Full / partial / post-service |
| 8 | Step: Quote / Invoice | **NEW** | Book Services | Wizard step 7 | `CreateInvoiceDialog` + `QuotationBuilder` logic; **records also appear in Billing & Finance** |
| 9 | Step: Assignment | **NEW** | Book Services | Wizard step 8 | Auto / manual / queue → Assign Services |
| 10 | Book Services (deep link) | **NEW** | Book Services | `/admin/book-services?customerId=&assetId=` | From Customer 360 "Book Service" button |

---

## 7. Assign Services Screens

| # | Current Screen | Current Route | Action | Future Module | Future Destination | Notes |
|---|----------------|---------------|--------|---------------|-------------------|-------|
| 1 | Bookings List & Detail | `/admin/bookings` | **MOVE** | Assign Services | `/admin/assign-services?section=doorstep-solar` | Doorstep wash + solar one-time jobs |
| 2 | DCMS Assignments | `/admin/daily-cleaning/assignments` | **MOVE** | Assign Services | `/admin/assign-services?section=daily-routes` | Daily car cleaning routes |
| 3 | DCMS Subscriptions (sell) | `/admin/daily-cleaning/subscriptions` | **MOVE** | Book Services + Assign Services | Subscriptions created via Book Services; assignment queue here | No direct sell from DCMS nav |
| 4 | Pending Queue (new) | — | **NEW** | Assign Services | `/admin/assign-services?section=queue` | Unified unassigned work |
| 5 | Bulk Auto-Assign (new) | — | **NEW** | Assign Services | `/admin/assign-services` action panel | New UI on top of existing APIs |

---

## 8. Service Updates Screens

| # | Current Screen | Current Route | Action | Future Module | Future Destination | Notes |
|---|----------------|---------------|--------|---------------|-------------------|-------|
| 1 | Operations Wall | `/admin/operations-wall` | **RENAME** | Service Updates | `/admin/service-updates` | Enhanced timeline across all service lines |
| 2 | DCMS Dashboard | `/admin/daily-cleaning` | **MERGE** | Service Updates | `/admin/service-updates?section=daily-cleaning` | KPIs folded into unified dashboard |
| 3 | DCMS Visits | `/admin/daily-cleaning/visits` | **MOVE** | Service Updates | `/admin/service-updates?section=visits` | Visit monitoring |
| 4 | DCMS Wash History | `/admin/daily-cleaning/washes` | **MOVE** | Service Updates | `/admin/service-updates?section=wash-history` | Completion history |
| 5 | DCMS Staff Performance | `/admin/daily-cleaning/staff-performance` | **MOVE** | Service Updates | `/admin/service-updates?section=staff-performance` | Reporting subsection |

---

## 9. Billing & Finance Screens

| # | Current Screen | Current Route | Action | Future Module | Future Destination | Notes |
|---|----------------|---------------|--------|---------------|-------------------|-------|
| 1 | Invoices & Payments (parent) | `/admin/invoices` | **RENAME** | Billing & Finance | `/admin/billing` | Canonical hub |
| 2 | Invoices tab | `/admin/invoices` (tab) | **KEEP** | Billing & Finance | `/admin/billing?tab=invoices` | Unchanged |
| 3 | Payments tab | `/admin/invoices` (tab) | **KEEP** | Billing & Finance | `/admin/billing?tab=payments` | Unchanged |
| 4 | Quotations tab (in Invoices) | `/admin/invoices` (tab) | **KEEP** | Billing & Finance | `/admin/billing?tab=quotations` | Unchanged |
| 5 | Expenses tab (in Invoices) | `/admin/invoices` (tab) | **KEEP** | Billing & Finance | `/admin/billing?tab=expenses` | Unchanged |
| 6 | Standalone Quotation Builder | `/admin/quotations` | **MERGE** | Billing & Finance | `/admin/billing?tab=quotations&action=new` | GST engine unified with `invoiceGstEngine` |
| 7 | Standalone Expenses | `/admin/expenses` | **MERGE** | Billing & Finance | `/admin/billing?tab=expenses` | Remove duplicate nav |
| 8 | Dues & Collections | `/admin/dues` | **MERGE** | Billing & Finance | `/admin/billing?tab=dues` | New tab in billing hub |
| 9 | Credit Notes (dialog) | `CreateCreditNoteDialog` | **KEEP** | Billing & Finance | Billing hub action | Not a standalone route today |
| 10 | Invoice PDF | API-driven | **KEEP** | Billing & Finance | Same API | Unchanged |
| 11 | Wallet transactions (full) | Customer 360 Wallet tab | **MOVE** | Billing & Finance | `/admin/billing?tab=wallet-adjustments&customerId=` | Wallet **credits/debits** are monetary adjustments, not service credits |

---

## 10. DCMS Sub-Nav Screens (DcmsAdminNav)

Current parent hub: `/admin/daily-cleaning`

| # | Current Label | Current Route | Action | Future Module | Future Destination |
|---|---------------|---------------|--------|---------------|-------------------|
| 1 | Dashboard | `/admin/daily-cleaning` | **MERGE** | Service Updates | `/admin/service-updates` |
| 2 | Plans | `/admin/products?tab=dcms-plans` | **KEEP** | Services | `/admin/services` → Daily Car Cleaning → Plans |
| 3 | Subscriptions | `/admin/daily-cleaning/subscriptions` | **MOVE** | Book Services + Service Updates | Created via Book Services; monitored in Service Updates |
| 4 | Visits | `/admin/daily-cleaning/visits` | **MOVE** | Service Updates | `/admin/service-updates?section=visits` |
| 5 | Wash History | `/admin/daily-cleaning/washes` | **MOVE** | Service Updates | `/admin/service-updates?section=wash-history` |
| 6 | Assignments | `/admin/daily-cleaning/assignments` | **MOVE** | Assign Services | `/admin/assign-services?section=daily-routes` |
| 7 | Staff Performance | `/admin/daily-cleaning/staff-performance` | **MOVE** | Service Updates | `/admin/service-updates?section=staff-performance` |

---

## 11. Staff Screens

| # | Current Screen | Current Route | Action | Future Module | Future Destination |
|---|----------------|---------------|--------|---------------|-------------------|
| 1 | Staff List | `/admin/staff` | **KEEP** | Operations | `/admin/staff` |
| 2 | Staff Detail | `/admin/staff/:id` | **KEEP** | Operations | `/admin/staff/:id` |

---

## 12. Redirect & Dead Routes

| # | Current Route | File | Action | Future Destination | Notes |
|---|---------------|------|--------|-------------------|-------|
| 1 | `/admin/catalog` | `App.tsx` redirect | **DELETE** | Redirect → `/admin/services` | Update redirect target on rename |
| 2 | `/admin/services` | `App.tsx` redirect | **RENAME** | Becomes canonical `/admin/services` (Services module) | Today redirects to products tab |
| 3 | `/admin/daily-cleaning/plans` | `App.tsx` redirect | **DELETE** | Redirect → `/admin/services` (Daily Car Cleaning → Plans) | Unchanged target, new parent |
| 4 | `/admin/subscriptions` | `Subscriptions.tsx` | **DELETE** | Retire after legacy data migration | Legacy `subscriptions` table |
| 5 | `/admin` | `AdminRoot` | **KEEP** | `/admin/dashboard` or `/admin/login` | Unchanged |
| 6 | `/admin/login` | `AdminLogin.tsx` | **KEEP** | `/admin/login` | Unchanged |
| 7 | `ServiceCatalog.tsx` | No route | **DELETE** | — | Dead file; superseded by `ProductsAndPlans.tsx` |
| 8 | `pages/admin/Services.tsx` | Re-export shim | **DELETE** | — | Verify and remove if unused |

---

## 13. Communication Center In-Page Tabs

Parent: `/admin/communications` — all **KEEP** in Config.

| Tab | Action | Future Destination |
|-----|--------|-------------------|
| Dashboard | **KEEP** | Same |
| Inbox | **KEEP** | Same |
| Campaigns | **KEEP** | Same |
| Audience | **KEEP** | Same |
| Templates | **KEEP** | Same |
| History | **KEEP** | Same |
| DLT | **KEEP** | Same |
| Providers | **KEEP** | Same |
| Automations | **KEEP** | Same |
| Brands | **KEEP** | Same |
| Workflows | **KEEP** | Same |
| Email & WA | **KEEP** | Same |
| CRM (Insights / Journey / KB) | **KEEP** | Same |

---

## 14. Settings, Config & Views (Unchanged Screens)

All **KEEP** at current routes unless noted:

| Screen | Route |
|--------|-------|
| Admin Dashboard widgets | `/admin/dashboard` |
| Master Data | `/admin/masters` |
| Branches | `/admin/branches` |
| Analytics | `/admin/analytics` |
| Notifications | `/admin/notifications` |
| Push Delivery Log | `/admin/push-logs` |
| Brand Identity | `/admin/settings/brand` |
| Invoice & GST Settings | `/admin/settings/invoice-billing` |
| Business Info | `/admin/settings/business` |
| SEO Management | `/admin/settings/seo` |
| System Status | `/admin/settings/system` |
| Legal Pages CMS | `/admin/legal` |
| Compliance Settings | `/admin/compliance` |
| Founder Dashboard | `/admin/founder` |
| Franchisees | `/admin/franchisees` |
| Staff Verification | `/admin/staff-approval` |
| Credentials | `/admin/credentials` |
| Complaints (global) | `/admin/complaints` |

---

## 15. Summary Counts

| Action | Count (approx.) |
|--------|-----------------|
| **KEEP** | 42 |
| **MOVE** | 18 |
| **MERGE** | 14 |
| **DELETE** | 8 |
| **RENAME** | 7 |
| **NEW** | 15 |

---

## 16. Route Redirect Plan (Post-Implementation)

| Old Route | New Route |
|-----------|-----------|
| `/admin/products` | `/admin/services` |
| `/admin/products?tab=*` | `/admin/services?tab=*` (tab keys may remap) |
| `/admin/invoices` | `/admin/billing` |
| `/admin/quotations` | `/admin/billing?tab=quotations` |
| `/admin/expenses` | `/admin/billing?tab=expenses` |
| `/admin/dues` | `/admin/billing?tab=dues` |
| `/admin/bookings` | `/admin/assign-services?section=doorstep-solar` |
| `/admin/daily-cleaning` | `/admin/service-updates` |
| `/admin/daily-cleaning/*` | `/admin/service-updates?section=*` or `/admin/assign-services?section=*` |
| `/admin/operations-wall` | `/admin/service-updates` |
| Customer 360 `?tab=vehicles` | `/admin/assets?customerId=` |
| Customer 360 `?tab=services` | Customer 360 `?tab=active-services` (read-only) |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 14 Jun 2026 | Initial screen mapping from founder-approved restructure decisions |

---

*No code changes in this document. Implementation follows approved phases in `PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT.md` v2.0.*
