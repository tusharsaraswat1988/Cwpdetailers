# CWP COMPLETE ENGINEERING AUDIT — PHASE 2
## Application Inventory, Route Discovery & User Journey Mapping

**Audit Phase:** Phase 2 of Complete Engineering Audit  
**Target Repository:** `tusharsaraswat1988/Cwpdetailers`  
**Monorepo Workspace:** `d:/cwpdetailersapp`  
**Git Commit Baseline:** `6377bbe16568aac15495bbbad205bb55db66878c` (with preserved Hotfix A+B local working tree changes)  
**Audit Mode:** STRICT READ-ONLY FORENSIC AUDIT  
**Auditor:** Principal Software Architect, Staff Engineer & Security Auditor  
**Date:** 2026-11-25  

---

## 1. Executive Summary

This Phase 2 forensic audit establishes a code-backed, evidence-based master inventory of the entire CWP Detailers software ecosystem. Every application, package, route, component, dialog, role permission, and API integration point was directly verified against the repository source code at the current commit baseline.

### 1.1 Key Architectural Findings

1. **Unified Multi-Portal Client Architecture:**  
   The platform uses a unified React 19 + Vite web client (`@workspace/cwp-platform`) that contains all user portals—Customer, Staff (Cleaners/Supervisors), Admin (Central & Superadmin), Branch Manager, Franchisee, and Public/SEO. Application boundaries are established via client-side routing (`wouter`), contextual layout shells, and role-based authentication wrappers (`ProtectedRoute`, `AdminRoot`, `StaffPortalRouter`).

2. **Native Mobile Shells via Capacitor:**  
   Rather than maintaining separate native Android codebases, the ecosystem deploys two dedicated Android Capacitor shells:
   - `@workspace/cwp-customer-app` (`in.cwpdetailers.customer`): Consumes compiled platform assets with Geolocation, Status Bar, Splash Screen, and App plugins.
   - `@workspace/cwp-staff-app` (`in.cwpdetailers.staff`): Field operations shell with native Camera hardware access, fine-grained Geolocation, Background Geolocation, App state lifecycle listeners, and hardware back-button management (`AppNativeGuard`).

3. **Routing Scale & Topology:**  
   - **App.tsx Route Elements:** 159 route definitions registering **158 unique URL paths** plus 1 fallback 404 handler.
   - **Staff Sub-Router:** 17 path entries in `StaffPortalRouter.tsx` (8 active page components, 6 legacy/internal redirects, 1 catch-all 404 within `StaffLayout`, plus 2 legacy aliases).
   - **Total Individual Route Paths Catalogued:** **172 unique route paths** across the ecosystem.
   - **Interactive Modal / Drawer Instances:** **124 Dialog, Sheet, and Drawer instances** across 81 component files.

4. **Backend API Scale:**  
   - **API Server Route Modules:** 67 route files registered in `artifacts/api-server/src/routes/index.ts`.
   - **Total HTTP Endpoint Handlers:** **778 endpoints** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
   - **Multi-Tenant Security Enforcement:** Guarded by `guardResource()`, `guardMasterDataRoutes()`, `guardCatalogRoutes()`, and granular row-level tenancy (`TenantScope`).

---

## 2. Monorepo Ecosystem & Application Architecture

```
                                  +----------------------------------------------------+
                                  |                 CWP MONOREPO ROOT                  |
                                  |             (pnpm workspace + Vite 6)              |
                                  +----------------------------------------------------+
                                           |                                  |
               +---------------------------+-----------+                      |
               |                                       |                      |
               v                                       v                      v
    +----------------------+               +----------------------+  +---------------------+
    | @workspace/api-server|               |@workspace/cwp-platform|  |@workspace/mockup-   |
    | (Express + Postgres) |               |  (Unified React 19)  |  | sandbox (Preview)   |
    +----------------------+               +----------------------+  +---------------------+
               ^                                       |
               |                     +-----------------+-----------------+
               |                     |                                   |
               |                     v                                   v
    +---------------------+ +----------------------+            +----------------------+
    |    lib/ packages:   | |@workspace/cwp-       |            |@workspace/cwp-       |
    | - db (Drizzle ORM)  | | customer-app         |            | staff-app            |
    | - api-client-react  | | (Capacitor Android   |            | (Capacitor Android   |
    | - api-spec/api-zod  | | in.cwpdetailers.     |            | in.cwpdetailers.     |
    | - address-model     | | customer)            |            | staff)               |
    | - customer-model    | +----------------------+            +----------------------+
    | - validation / env  |
    +---------------------+
```

### 2.1 Package Registry

| Package Name | Physical Path | Role & Technology | Distribution / Target |
| :--- | :--- | :--- | :--- |
| `@workspace/cwp-platform` | [artifacts/cwp-platform](file:///d:/cwpdetailersapp/artifacts/cwp-platform) | Unified React 19 + Vite frontend. Wouter routing, TanStack Query v5, Tailwind CSS, Radix UI. | Web Browser & Capacitor `dist/public` asset source. |
| `@workspace/api-server` | [artifacts/api-server](file:///d:/cwpdetailersapp/artifacts/api-server) | Node.js + Express REST API. Drizzle ORM, PostgreSQL 16, Redis/In-memory queue fallback. | Standalone API daemon (`PORT=8080`). |
| `@workspace/cwp-customer-app` | [artifacts/cwp-customer-app](file:///d:/cwpdetailersapp/artifacts/cwp-customer-app) | Android Capacitor native wrapper (`appId: in.cwpdetailers.customer`). | Google Play Store / Android APK. |
| `@workspace/cwp-staff-app` | [artifacts/cwp-staff-app](file:///d:/cwpdetailersapp/artifacts/cwp-staff-app) | Android Capacitor native wrapper (`appId: in.cwpdetailers.staff`). Bundled & Wi-Fi Live-Reload modes. | Internal Field APK distribution. |
| `@workspace/mockup-sandbox` | [artifacts/mockup-sandbox](file:///d:/cwpdetailersapp/artifacts/mockup-sandbox) | Standalone UI sandbox for component prototyping and design review. | Local development environment. |

### 2.2 Shared Libraries (`lib/*`)

1. **`@workspace/db` (`lib/db`):** Core Drizzle ORM schema, migrations, connection pool, and 45+ database table schemas.
2. **`@workspace/api-client-react` (`lib/api-client-react`):** Auto-generated React Query hooks and OpenAPI client SDK bindings.
3. **`@workspace/api-spec` (`lib/api-spec`):** OpenAPI 3.1 specification for all endpoints and schemas.
4. **`@workspace/api-zod` (`lib/api-zod`):** Zod schema validation types matching API requests and responses.
5. **`@workspace/address-model` (`lib/address-model`):** Address parsing, coordinate normalization, and Indian city heuristics.
6. **`@workspace/customer-model` (`lib/customer-model`):** Customer entity schemas and relationship types.
7. **`@workspace/validation` (`lib/validation`):** Reusable validation functions across client and server.
8. **`@workspace/env` (`lib/env`):** Environment variable parsers and runtime asserts.

---

## 3. Routing Architecture, Guards & Navigation Framework

The frontend uses `wouter` (v3.3.5) with custom portal shells and access control middleware.

```
                                  [ Incoming Request / Path ]
                                               |
                                     (AppNativeGuard Check)
                                  Native App Portal Restrictor
                                               |
                                    +----------+----------+
                                    |                     |
                                [Public Route]     [Protected Route]
                                    |                     |
                             (Direct Render)      (Auth & Scope Guard)
                                                   useAuth() & hasPermission()
                                                          |
                                   +----------------------+----------------------+
                                   |                      |                      |
                            [Role Verified]       [Role Unmatched]     [Permission Denied]
                                   |                      |                      |
                            (Render Shell)        Redirect to Login      "Access Restricted"
```

### 3.1 Portal Routing Shells & Layout Hierarchy

1. **Admin Portal (`/admin/*`):**  
   - Handled by `AdminLayout` ([AdminLayout.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/AdminLayout.tsx)).
   - Wrapped in `AdminThemeRoot`, `PanelShell`, `AdminSidebar` ([AdminSidebar.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/AdminSidebar.tsx)), `AdminScopeHeader` ([AdminScopeHeader.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/AdminScopeHeader.tsx)), and `AdminErrorBoundary`.
   - Global active branch/city switcher backed by `useAppStore`.
   - Configured in [adminNavConfig.ts](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/adminNavConfig.ts) with 6 functional groups: *Overview*, *Daily Operations*, *Customers & CRM*, *Commercial & Billing*, *Staff & Team*, and *Network & Coverage*.

2. **Branch Manager Portal (`/manager/*`):**  
   - Handled by `BranchManagerLayout` ([BranchManagerLayout.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/BranchManagerLayout.tsx)).
   - Automatically scopes all queries to the manager's assigned branch via `/api/branch-assignments/my-branches`.
   - Configured in [managerNavConfig.ts](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/managerNavConfig.ts) with 4 sections: *Overview*, *Daily Operations*, *Field Team & Customers*, and *Finance & Profile*.

3. **Customer Portal (`/customer/*`):**  
   - Handled by `CustomerLayout` ([CustomerLayout.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/CustomerLayout.tsx)).
   - Wrapped in `CustomerThemeRoot`, `CustomerAddressProvider` ([CustomerAddressContext.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/context/CustomerAddressContext.tsx)), `AddressPickerSheet`, and `CustomerExtraServiceApprovalHost`.
   - Frozen Information Architecture (v1.0): 5 primary bottom navigation tabs:
     1. **Home** (`/customer/dashboard`)
     2. **My Plans** (`/customer/plans`)
     3. **Schedule [FAB]** (`/customer/schedule?from=fab`)
     4. **Assets** (`/customer/assets`)
     5. **Account** (`/customer/account`)

4. **Staff Field Portal (`/staff/*`):**  
   - Handled by `StaffPortalRouter` ([StaffPortalRouter.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/StaffPortalRouter.tsx)) and `StaffLayout` ([StaffLayout.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/StaffLayout.tsx)).
   - Maintains continuous mounted GPS context via `LocationProvider` ([LocationProvider.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/lib/location/LocationProvider.tsx)) across tab transitions.
   - Core 4-tab bottom navigation in [StaffAppShell.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx):
     1. **Dashboard** (`/staff/dashboard`)
     2. **DCMS** (`/staff/daily-clean`)
     3. **Other Jobs** (`/staff/bookings`)
     4. **Account** (`/staff/profile`)
   - Includes 1-tap bilingual language switcher (English / Hindi), native resume sync listeners, offline sync banner, and job dispatch alerts.

5. **Franchisee Portal (`/franchisee/*`):**  
   - Handled by `FranchiseeLayout` ([FranchiseeLayout.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/layout/FranchiseeLayout.tsx)).
   - Sidebar navigation for franchise operations: Dashboard, Customers, Leads, Bookings, Staff, and Notifications.

6. **Native App Gateway (`AppNativeGuard`):**  
   - Implemented in [AppNativeGuard.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/lib/native/AppNativeGuard.tsx).
   - In native APK environments, detects package ID (`in.cwpdetailers.staff` vs `in.cwpdetailers.customer`) and forcibly redirects any unauthorized cross-portal navigation back to the designated portal root.
   - Intercepts hardware back button: minimizes APK at root tabs; pops history on inner screens.

---

## 4. Master Route Inventory

### 4.1 Public, Auth, Landing & Legal Routes (17 Routes)

| Route ID | URL / Path | Page Component | Layout Shell | Access / Roles | Main Operational Purpose | Primary Actions & APIs | Evidence / Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PUB-01` | `/` | `LandingDivisionRedirect` | None | Public | Root redirector based on native portal or `?division=solar/vehicle`. | Redirects to `/vehicle`, `/solar`, or native home. | [App.tsx#L180](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/App.tsx#L180) |
| `PUB-02` | `/vehicle` | `Landing` | Public Header/Footer | Public | Vehicle detailing public landing page with catalog, city selector, reviews. | View services, check coverage, switch city. | [Landing.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/Landing.tsx) |
| `PUB-03` | `/solar` | `Landing` | Public Header/Footer | Public | Solar panel cleaning public landing page. | Solar slabs, calculator, lead capture. | [Landing.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/Landing.tsx) |
| `PUB-04` | `/login` | `Login` | Auth Shell | Public | Customer phone/password login or OTP entry. | `POST /api/auth/login` (portal="customer"). | [Login.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/Login.tsx) |
| `PUB-05` | `/register` | `Register` | Auth Shell | Public | Customer account sign-up. | `POST /api/auth/register`. | [Register.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/Register.tsx) |
| `PUB-06` | `/verify-otp` | `VerifyOtp` | Auth Shell | Public | 6-digit SMS OTP verification for passwordless login. | `POST /api/auth/verify-otp`. | [VerifyOtp.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/VerifyOtp.tsx) |
| `PUB-07` | `/staff/login` | `StaffLogin` | Staff Auth Shell | Public | Field staff and cleaner credential login. | `POST /api/auth/login` (portal="staff"). | [StaffLogin.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/StaffLogin.tsx) |
| `PUB-08` | `/forgot-password` | `ForgotPassword` | Auth Shell | Public | Customer password reset with OTP verification. | `POST /api/auth/forgot-password`. | [ForgotPassword.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/ForgotPassword.tsx) |
| `PUB-09` | `/staff/forgot-password` | `ForgotPassword` | Staff Auth Shell | Public | Staff password recovery. | `POST /api/auth/forgot-password`. | [ForgotPassword.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/ForgotPassword.tsx) |
| `PUB-10` | `/admin/forgot-password` | `ForgotPassword` | Admin Auth Shell | Public | Admin/manager password recovery. | `POST /api/auth/forgot-password`. | [ForgotPassword.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/ForgotPassword.tsx) |
| `PUB-11` | `/admin/login` | `AdminLogin` | Admin Auth Shell | Public | Operations, Manager & Admin login. | `POST /api/auth/login` (portal="admin"). | [AdminLogin.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/AdminLogin.tsx) |
| `PUB-12` | `/privacy-policy` | `PrivacyPolicy` | Legal Shell | Public | Compliance & privacy terms. | Static / Legal CMS content. | [PrivacyPolicy.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/PrivacyPolicy.tsx) |
| `PUB-13` | `/terms-and-conditions` | `TermsAndConditions` | Legal Shell | Public | Service terms, cancellation rules, liability. | Static / Legal CMS content. | [TermsAndConditions.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/TermsAndConditions.tsx) |
| `PUB-14` | `/refund-policy` | `RefundPolicy` | Legal Shell | Public | Refund and makeup wash policies. | Static / Legal CMS content. | [RefundPolicy.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/RefundPolicy.tsx) |
| `PUB-15` | `/data-deletion` | `DataDeletion` | Legal Shell | Public | Account and data purge request instructions. | Static / Legal CMS content. | [DataDeletion.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/DataDeletion.tsx) |
| `PUB-16` | `/about-us` | `AboutUs` | Legal Shell | Public | Company background, brand story, coverage info. | Static / Legal CMS content. | [AboutUs.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/AboutUs.tsx) |
| `PUB-17` | `/contact-us` | `ContactUs` | Legal Shell | Public | Support numbers, address, grievance officer. | `POST /api/contact/inquire`. | [ContactUs.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/legal/ContactUs.tsx) |

---

### 4.2 Customer Portal Routes (23 Routes in `App.tsx`)

| Route ID | URL / Path | Component | Protected Roles | Main Operational Purpose | Primary Actions & APIs | States Handled |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CUST-01` | `/customer/dashboard` | `CustomerDashboard` | `customer` | Customer Home Hub: active plans, today's visit status, services grid, greeting. | Address switch, quick schedule, pending visit feedback card. `GET /api/customers/:id/summary`, `GET /api/subscriptions`. | Skeleton, Empty, Error, Active cards. |
| `CUST-02` | `/customer/plans` | `CustomerMyPlans` | `customer` | Customer active subscriptions & service packages. | Renew plan, view quota, pause subscription. `GET /api/subscriptions`. | Loading, Empty plans, Error, Card list. |
| `CUST-03` | `/customer/plans/:id` | `PlanDetail` | `customer` | Detailed plan entitlements, wash schedule, vehicle linked. | Renew, cancel, pause/resume subscription. `GET /api/subscriptions/:id`. | Loading, Not found, Detail view. |
| `CUST-04` | `/customer/schedule` | `BookService` | `customer` | 6-step service booking wizard (Asset -> Plan -> Service -> Date -> Time -> Review). | Location selection, date slot picker, coupon apply, booking create. `POST /api/bookings`. | Multi-step wizard, review dialog, success screen. |
| `CUST-05` | `/customer/schedule/:id` | `BookingDetail` | `customer` | Scheduled booking status, assigned cleaner, timeline, tracking. | Cancel booking, reschedule, view invoice. `GET /api/bookings/:id`. | Loading, Cancelled banner, Live tracker. |
| `CUST-06` | `/customer/assets` | `MyAssets` | `customer` | Customer vehicles & solar sites manager. | Add vehicle/solar site, set service address, upload photo. `GET/POST /api/vehicles`, `GET/POST /api/solar-sites`. | Empty state, Add sheet, Edit sheet. |
| `CUST-07` | `/customer/account` | `CustomerAccount` | `customer` | Customer profile, notification prefs, addresses, sign out. | Edit profile, manage saved locations. `GET /api/customers/me`, `PATCH /api/customers/:id`. | Two-column responsive desktop hub. |
| `CUST-08` | `/customer/history` | `CustomerHistory` | `customer` | Historical completed services, wash records, receipts. | Filter by date/vehicle, download invoice. `GET /api/bookings`. | Loading, Empty history, Card list. |
| `CUST-09` | `/customer/invoices` | `CustomerInvoices` | `customer` | Billing history, tax invoices, payment receipts. | Download PDF invoice, pay outstanding dues. `GET /api/invoices`. | Loading, Empty list, PDF preview. |
| `CUST-10` | `/customer/payment/return` | `CustomerPaymentReturn` | `customer` | Payment gateway return handler (Cashfree/Razorpay). | Verify payment status, redirect to booking. `POST /api/payment-gateway/verify`. | Verifying loader, Success, Failure state. |
| `CUST-11` | `/customer/support` | `CustomerComplaints` | `customer` | Customer helpdesk, complaints submission, ticket tracking. | Raise complaint, attach photo, check status. `GET/POST /api/complaints`. | Ticket list, New ticket dialog. |
| `CUST-12` | `/customer/wallet` | `CustomerWallet` | `customer` | Customer wallet balance, top-up, transaction ledger. | Add money, view credits. `GET /api/wallet`. | Balance card, Transactions list. |
| `CUST-13` | `/customer/loyalty` | `LoyaltyRewardsPage` | `customer` | Loyalty points, reward tiers, referral code sharing. | Share referral code, redeem points. `GET /api/loyalty`. | Points balance, Tier badge, History. |
| `CUST-14` | `/customer/rewards` | `LoyaltyRewardsPage` | `customer` | Alias for loyalty rewards hub. | Same as `/customer/loyalty`. | Same. |
| `CUST-15` | `/customer/services` | `CustomerServices` | `customer` | Full service catalog discovery categorized by vehicle/solar. | Select service, check price. `GET /api/service-catalog/services`. | Category tabs, Service cards. |
| `CUST-16` | `/customer/services/:slug` | `CustomerProductDetailPage` | `customer` | Deep-dive product page with inclusions, pricing slabs, FAQ. | Direct schedule CTA (`/customer/schedule?service=...`). `GET /api/service-catalog/:slug`. | Hero image, Pricing table, FAQ accordions. |
| `CUST-17` | `/customer/daily-cleaning` | `CustomerDailyCleaningPage` | `customer` | DCMS Customer overview: current monthly cycle, washes left. | View photos, request makeup clean. `GET /api/dcms/customer/overview`. | Cycle progress, Calendar view. |
| `CUST-18` | `/customer/daily-cleaning/history` | `CustomerDcmsHistoryPage` | `customer` | Historical daily wash records with before/after photos. | View photo proofs, rate wash quality. `GET /api/dcms/customer/history`. | Wash timeline, Image modal. |
| `CUST-19` | `/customer/daily-cleaning/gallery` | `CustomerDcmsGalleryPage` | `customer` | Visual photo gallery of daily washes. | Filter by date/vehicle. `GET /api/dcms/customer/photos`. | Photo grid, Zoom modal. |
| `CUST-20` | `/customer/bookings/:id` | `RedirectBookingsIdToSchedule` | `customer` | Legacy redirect to `/customer/schedule/:id`. | Automatic client redirect. | Immediate Redirect. |
| `CUST-21` | `/customer/bookings` | `RedirectToSchedule` | `customer` | Legacy redirect to `/customer/schedule`. | Automatic client redirect. | Immediate Redirect. |
| `CUST-22` | `/customer/book` | `RedirectToSchedule` | `customer` | Legacy redirect to `/customer/schedule`. | Automatic client redirect. | Immediate Redirect. |
| `CUST-23` | `/customer/complaints` | Redirect to `/customer/support` | `customer` | Legacy redirect to canonical support hub. | Automatic client redirect. | Immediate Redirect. |

---

### 4.3 Staff Field Portal Routes (17 Routes in `StaffPortalRouter.tsx` / `App.tsx`)

| Route ID | URL / Path | Component | Layout Shell | Access / Roles | Operational Purpose & Primary Actions | Primary APIs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `STAFF-01` | `/staff/dashboard` | `StaffDashboard` | `StaffLayout` | `staff` | Staff command center: attendance selfie check-in with GPS, Next Task card, quick actions. | `GET /api/staff/:id/attendance`, `POST /api/staff/:id/attendance`, `GET /api/staff-ecosystem/me`. |
| `STAFF-02` | `/staff/daily-clean` | `StaffDailyClean` | `StaffLayout` | `staff` | DCMS morning route execution: plate scan, watermarked camera capture, car not available, offline sync. | `GET /api/dcms/staff/route`, `POST /api/dcms/visits/complete`, `POST /api/dcms/visits/exception`. |
| `STAFF-03` | `/staff/bookings` | `StaffBookings` | `StaffLayout` | `staff` | Assigned detailing jobs ("Other Jobs"): navigation to customer, step-by-step checklist, photo upload. | `GET /api/bookings/today`, `POST /api/service-executions/:id/transition`. |
| `STAFF-04` | `/staff/jobs` | `StaffJobs` | `StaffLayout` | `staff` | Assigned job board with tabs: Today, Upcoming, Done. Tap job to open action drawer. | `GET /api/jobs`, `GET /api/bookings`. |
| `STAFF-05` | `/staff/earnings` | `StaffEarnings` | `StaffLayout` | `staff` | Monthly payout summary, per-car incentive breakdown, attendance bonus. | `GET /api/staff/:id/earnings`. |
| `STAFF-06` | `/staff/profile` | `StaffProfile` | `StaffLayout` | `staff` | Staff personal profile, KYC verification badge, supervisor contact, language switch. | `GET /api/staff/:id`, `PATCH /api/staff/me/ecosystem`. |
| `STAFF-07` | `/staff/work` | `StaffWork` | `StaffLayout` | `staff` | Legacy route redirecting dynamically to `/staff/daily-clean` or `/staff/bookings`. | Dynamic redirect. |
| `STAFF-08` | `/staff/team` | `StaffTeam` | `StaffLayout` | `staff` | Legacy route redirecting to `/staff/profile`. | Redirect to `/staff/profile`. |
| `STAFF-09` | `/staff/daily-route` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/daily-clean`. | Redirect. |
| `STAFF-10` | `/staff/daily-cleaning` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/daily-clean`. | Redirect. |
| `STAFF-11` | `/staff/other-jobs` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/bookings`. | Redirect. |
| `STAFF-12` | `/staff/schedule` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/jobs`. | Redirect. |
| `STAFF-13` | `/staff/attendance` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/profile`. | Redirect. |
| `STAFF-14` | `/staff/performance` | Redirect | `StaffLayout` | `staff` | Alias redirecting to `/staff/profile`. | Redirect. |
| `STAFF-15` | `/staff/login` | `StaffLogin` | None | Public | Staff mobile phone & password login. | `POST /api/auth/login`. |
| `STAFF-16` | `/staff/forgot-password` | `ForgotPassword` | None | Public | Staff password recovery. | `POST /api/auth/forgot-password`. |
| `STAFF-17` | `/staff/:_*` | `StaffPortalRouter` | `StaffLayout` | `staff` | Top-level wildcard mounting the single staff shell with persistent `LocationProvider`. | Router multiplexer. |

---

### 4.4 Admin Operations Portal Routes (79 Routes in `App.tsx`)

| Route ID | URL / Path | Component | Protected Roles | Permission Gate | Purpose & Operational Actions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ADM-01` | `/admin/dashboard` | `AdminDashboard` | `admin`, `superadmin`, `manager` | None | Operations Command Center: real-time multi-city metrics, immediate attention cards, SLA tracker. |
| `ADM-02` | `/admin/playbook` | `OperationsPlaybookPage` | `admin`, `superadmin`, `manager` | None | Standard Operating Procedures (SOP) interactive guidance hub. |
| `ADM-03` | `/admin/operations/playbook` | Redirect | `admin`, `superadmin`, `manager` | None | Redirects to `/admin/playbook`. |
| `ADM-04` | `/admin/customers/migration` | `AdminCustomerMigration` | `admin`, `superadmin`, `manager` | `customers:create` | Excel/CSV customer & vehicle batch import wizard with preview. |
| `ADM-05` | `/admin/customers/legacy-contacts` | `AdminLegacyContacts` | `admin`, `superadmin`, `manager` | `customers:view` | Unmatched contacts from legacy spreadsheets. |
| `ADM-06` | `/admin/customers/reactivated` | `AdminReactivatedCustomers` | `admin`, `superadmin`, `manager` | `customers:view` | Reactivated customer audit log and churn recovery tracking. |
| `ADM-07` | `/admin/customers/:id` | `AdminCustomerDetail` | `admin`, `superadmin`, `manager` | `customers:view` | Customer 360 view: vehicles, active subscriptions, booking history, wallet, notes. |
| `ADM-08` | `/admin/customers` | `AdminCustomers` | `admin`, `superadmin`, `manager` | `customers:view` | Customer master directory: search, city filter, create customer modal, export. |
| `ADM-09` | `/admin/staff` | `AdminStaff` | `admin`, `superadmin`, `manager` | `staff:view` | Staff directory: cleaner/supervisor roster, live attendance, rating, assignment count. |
| `ADM-10` | `/admin/staff-approval` | `AdminStaffApproval` | `admin`, `superadmin` | `staff:approve` | Field staff KYC verification queue: Aadhaar, Driving License, Police verification review. |
| `ADM-11` | `/admin/staff/:id` | `AdminStaffDetail` | `admin`, `superadmin`, `manager` | `staff:view` | Staff profile 360: assigned societies, daily attendance history, salary/payout, documents. |
| `ADM-12` | `/admin/bookings` | `AdminBookings` | `admin`, `superadmin`, `manager` | `bookings:view` | Service bookings master table: status filtering, assign staff, cancel, view proof. |
| `ADM-13` | `/admin/approvals` | `ApprovalsPage` | `admin`, `superadmin`, `manager` | `bookings:edit` | Makeup cleanings & exception approval queue: review customer requests, approve/reject credit. |
| `ADM-14` | `/admin/daily-cleaning` | `DcmsDashboardPage` | `admin`, `superadmin`, `manager` | `daily_cleaning:view_reports` | DCMS Command Center: society-wise wash completion rate, cleaner attendance, morning progress. |
| `ADM-15` | `/admin/daily-cleaning/subscriptions`| `DcmsSubscriptionsPage` | `admin`, `superadmin`, `manager` | `daily_cleaning:manage_subscriptions` | Active daily car cleaning subscriptions, car renewal dates, society grouping. |
| `ADM-16` | `/admin/daily-cleaning/assignments` | `DcmsAssignmentsPage` | `admin`, `superadmin`, `manager` | `daily_cleaning:manage_subscriptions` | Route builder: assign cleaners to societies, towers, and parking bays. |
| `ADM-17` | `/admin/daily-cleaning/history` | `DcmsServiceHistoryPage` | `admin`, `superadmin`, `manager` | `daily_cleaning:view` | Historical wash records, plate OCR logs, GPS coordinate validation, photos. |
| `ADM-18` | `/admin/daily-cleaning/staff-performance` | `DcmsStaffPerformancePage` | `admin`, `superadmin`, `manager` | `daily_cleaning:view_reports` | Daily cleaner speed, cars cleaned per hour, missed wash rate, customer ratings. |
| `ADM-19` | `/admin/daily-cleaning/plans` | Redirect | None | None | Redirects to `/admin/services?tab=daily-cleaning`. |
| `ADM-20` | `/admin/daily-cleaning/visits`| Redirect | None | None | Redirects to `/admin/daily-cleaning/history`. |
| `ADM-21` | `/admin/daily-cleaning/washes`| Redirect | None | None | Redirects to `/admin/daily-cleaning/history`. |
| `ADM-22` | `/admin/subscriptions` | `AdminSubscriptions` | `admin`, `superadmin`, `manager` | `subscriptions:view` | General subscriptions hub (car cleaning + solar AMC). |
| `ADM-23` | `/admin/billing` | `BillingFinancePage` | `admin`, `superadmin`, `manager` | `invoices:view` | Commercial Operations Center: invoices, payments, quotations, expenses, dues, wallet tabs. |
| `ADM-24` | `/admin/payments/ledger` | `PaymentLedgerPage` | `admin`, `superadmin`, `manager` | `invoices:view` | Audit-grade transaction ledger: gateway reconciliation, refunds, manual payment recording. |
| `ADM-25` | `/admin/payments` | Redirect | None | None | Redirects to `/admin/payments/ledger`. |
| `ADM-26` | `/admin/invoices` | RedirectPreserveSearch | None | None | Redirects to `/admin/billing`. |
| `ADM-27` | `/admin/quotations` | Redirect | None | None | Redirects to `/admin/billing?tab=quotations`. |
| `ADM-28` | `/admin/expenses` | Redirect | None | None | Redirects to `/admin/billing?tab=expenses`. |
| `ADM-29` | `/admin/settings/invoice-billing` | `InvoiceBillingSettingsPage` | `admin`, `superadmin`, `manager` | `invoices:view` | Invoice prefix, GSTIN, legal entity details, billing terms configuration. |
| `ADM-30` | `/admin/exceptions` | `ExceptionsHub` | `admin`, `superadmin`, `manager` | `bookings:view` | Operations exceptions: car not available, gate access denied, bad weather, customer disputes. |
| `ADM-31` | `/admin/operations/calendar` | `OperationsCalendarPage` | `admin`, `superadmin`, `manager` | `bookings:view` | Branch operational hours, blackouts, capacity slots, holiday schedule. |
| `ADM-32` | `/admin/calendar` | Redirect | None | None | Redirects to `/admin/operations/calendar`. |
| `ADM-33` | `/admin/complaints` | `AdminComplaints` | `admin`, `superadmin`, `manager` | `complaints:view` | Customer complaint ticket management, SLA timer, resolution notes, staff assignment. |
| `ADM-34` | `/admin/quality` | `QualityHub` | `admin`, `superadmin`, `manager` | `analytics:view` | Service Quality & SLA audit: cleaner ratings, photo verification audit, rework tracking. |
| `ADM-35` | `/admin/book-services` | `BookServicesPage` | `admin`, `superadmin`, `manager` | `bookings:view` | Admin-assisted customer booking creation. |
| `ADM-36` | `/admin/assign-services` | `AssignServicesPage` | `admin`, `superadmin`, `manager` | `bookings:edit` | Batch dispatch & cleaner assignment console. |
| `ADM-37` | `/admin/assignments` | Redirect | None | None | Redirects to `/admin/assign-services`. |
| `ADM-38` | `/admin/jobs` | `JobOrchestrationPage` | `admin`, `superadmin`, `manager` | `bookings:edit` | Field job orchestration board: drag-and-drop status stages, priority flags, blockers. |
| `ADM-39` | `/admin/assets` | `AssetsPage` | `admin`, `superadmin`, `manager` | `customers:view` | Fleet & property asset directory: all vehicles and solar installations across customers. |
| `ADM-40` | `/admin/assets/:id` | `AssetDetail` | `admin`, `superadmin`, `manager` | `customers:view` | Asset detail: service history, linked society/parking bay, customer link. |
| `ADM-41` | `/admin/service-locations` | `ServiceLocationsPage` | `admin`, `superadmin`, `manager` | `customers:view` | Geocoded customer service locations directory. |
| `ADM-42` | `/admin/service-locations/:id` | `ServiceLocationDetail` | `admin`, `superadmin`, `manager` | `customers:view` | Location detail: boundary polygon, linked society, verified coordinates. |
| `ADM-43` | `/admin/cities` | `AdminCities` | `admin`, `superadmin`, `manager` | `branches:view` | Multi-city expansion manager: add cities (Varanasi, Noida, etc.), active/inactive status. |
| `ADM-44` | `/admin/branches` | `AdminBranches` | `admin`, `superadmin`, `manager` | `branches:view` | Physical branch management: branch code, city binding, manager assignment. |
| `ADM-45` | `/admin/operations/zones` | `OperationalZonesPage` | `admin`, `superadmin`, `manager` | `branches:view` | Geographic operational zones: radius geofencing, leaflet zone map picker, coverage rules. |
| `ADM-46` | `/admin/zones` | Redirect | None | None | Redirects to `/admin/operations/zones`. |
| `ADM-47` | `/admin/societies` | `SocietiesPage` | `admin`, `superadmin`, `manager` | `branches:view` | Residential societies & towers manager: gate security rules, towers, parking levels, purge policy. |
| `ADM-48` | `/admin/pricing/location-rules` | `LocationPricingPage` | `admin`, `superadmin`, `manager` | `services:view` | Micro-market pricing: society/locality-specific discounts, surcharges, GST overrides. |
| `ADM-49` | `/admin/location-pricing` | Redirect | None | None | Redirects to `/admin/pricing/location-rules`. |
| `ADM-50` | `/admin/masters` | `AdminMasterData` | `admin`, `superadmin`, `manager` | `masters:view` | Vehicle models, makes, seat categories, checklist templates master data. |
| `ADM-51` | `/admin/services` | `ProductsAndPlans` | `admin`, `superadmin`, `manager` | `services:view` | Service catalog & packages manager: create services, add-ons, pricing slabs. |
| `ADM-52` | `/admin/products` | RedirectPreserveSearch | None | None | Redirects to `/admin/services`. |
| `ADM-53` | `/admin/catalog` | RedirectPreserveSearch | None | None | Redirects to `/admin/services`. |
| `ADM-54` | `/admin/analytics` | `AdminAnalytics` | `admin`, `superadmin`, `manager` | `analytics:view` | Business intelligence: revenue trends, retention curves, customer acquisition cost. |
| `ADM-55` | `/admin/notifications` | `AdminNotifications` | `admin`, `superadmin`, `manager` | `notifications:view` | Push notification broadcaster, SMS templates, automated reminder rules. |
| `ADM-56` | `/admin/push-logs` | `AdminPushLogs` | `admin`, `superadmin`, `manager` | `notifications:view` | Delivery audit log for push notifications and SMS dispatches. |
| `ADM-57` | `/admin/communications` | `CommunicationCenter` | `admin`, `superadmin`, `manager` | `communications:view` | Omni-channel CRM: WhatsApp campaigns, smart segments, customer conversations inbox. |
| `ADM-58` | `/admin/marketing` | `MarketingCMSPage` | `admin`, `superadmin`, `manager` | `settings:view` | Landing page CMS: hero banners, seasonal promos, customer testimonial cards. |
| `ADM-59` | `/admin/loyalty` | `LoyaltyAdminPage` | `admin`, `superadmin`, `manager` | `customers:view` | Loyalty points rules, referral reward amounts, redemption thresholds. |
| `ADM-60` | `/admin/referrals` | Redirect | None | None | Redirects to `/admin/loyalty`. |
| `ADM-61` | `/admin/automation` | `AutomationOpsCenter` | `admin`, `superadmin`, `manager` | `settings:view` | Automated cron jobs: morning route generation, subscription expiry warnings, purge runs. |
| `ADM-62` | `/admin/scheduler` | Redirect | None | None | Redirects to `/admin/automation`. |
| `ADM-63` | `/admin/franchisees` | `AdminFranchisees` | `admin`, `superadmin` | `franchisees:view` | Franchise partner governance, revenue-share terms, branch entitlement. |
| `ADM-64` | `/admin/credentials` | `AdminCredentials` | `admin`, `superadmin` | `staff:approve` | Staff credential and app login reset console. |
| `ADM-65` | `/admin/churned` | `AdminChurnedCustomers` | `admin`, `superadmin`, `manager` | `churned:view` | Churned subscriber recovery hub: win-back campaigns, exit surveys. |
| `ADM-66` | `/admin/leads` | `AdminLeads` | `admin`, `superadmin`, `manager` | `leads:view` | Inbound CRM leads: pipeline stages, lead assignment, conversion to customer. |
| `ADM-67` | `/admin/service-updates` | `OperationsWall` | `admin`, `superadmin`, `manager` | None | Live operations wall: real-time feed of completed washes, photos, cleaner check-ins. |
| `ADM-68` | `/admin/operations-wall` | Redirect | None | None | Redirects to `/admin/service-updates`. |
| `ADM-69` | `/admin/dues` | `AdminDues` | `admin`, `superadmin`, `manager` | `invoices:view` | Outstanding customer payments collection dashboard. |
| `ADM-70` | `/admin/founder` | `FounderDashboard` | `superadmin` | None | Executive KPI cockpit: net revenue, gross margins, active subscriber growth, burn rate. |
| `ADM-71` | `/admin/settings/brand` | `BrandIdentity` | `admin`, `superadmin`, `manager` | `settings:view` | Dynamic white-label branding: logos, primary colors, typography tokens. |
| `ADM-72` | `/admin/settings/system` | `SystemStatus` | `admin`, `superadmin`, `manager` | `settings:view` | Health status: PostgreSQL connectivity, Redis queue, Cloudinary, system uptime. |
| `ADM-73` | `/admin/settings/business` | `BusinessInfoPage` | `admin`, `superadmin` | `settings:view` | Company registration, legal name, tax identifiers, registered office. |
| `ADM-74` | `/admin/settings/seo` | `SeoSettingsPage` | `admin`, `superadmin` | `settings:view` | City-level SEO meta tags, OpenGraph images, schema.org JSON-LD definitions. |
| `ADM-75` | `/admin/compliance` | `ComplianceSettings` | `admin`, `superadmin` | `settings:view` | Data retention policies, privacy regulations, audit log expiry settings. |
| `ADM-76` | `/admin/legal` | `LegalCMS` | `admin`, `superadmin`, `manager` | `settings:view` | Markdown editor for Privacy Policy, Terms, Refund Policy, and About Us pages. |
| `ADM-77` | `/admin` | `AdminRoot` | None | None | Entry redirector: redirects to `/admin/dashboard`, `/manager/dashboard`, or `/admin/login`. |
| `ADM-78` | `/admin/daily-cleaning/washes` | Redirect | None | None | Redirects to `/admin/daily-cleaning/history`. |
| `ADM-79` | `/admin/calendar` | Redirect | None | None | Redirects to `/admin/operations/calendar`. |

---

### 4.5 Branch Manager Portal Routes (21 Routes in `App.tsx`)

| Route ID | URL / Path | Component | Protected Roles | Scope & Main Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `MGR-01` | `/manager/dashboard` | `AdminDashboard` | `MANAGER_ROLES` | Scoped operations dashboard for the manager's assigned branch. |
| `MGR-02` | `/manager/playbook` | `OperationsPlaybookPage` | `MANAGER_ROLES` | Operations SOP guide for branch managers. |
| `MGR-03` | `/manager/customers` | `AdminCustomers` | `MANAGER_ROLES` | Customer directory filtered to manager's branch. |
| `MGR-04` | `/manager/customers/:id` | `AdminCustomerDetail` | `MANAGER_ROLES` | Customer detail view within branch scope. |
| `MGR-05` | `/manager/bookings` | `AdminBookings` | `MANAGER_ROLES` | Branch detailing bookings table. |
| `MGR-06` | `/manager/book-services` | `BookServicesPage` | `MANAGER_ROLES` | Branch-assisted customer service booking. |
| `MGR-07` | `/manager/assign-services`| `AssignServicesPage` | `MANAGER_ROLES` | Branch cleaner dispatch console. |
| `MGR-08` | `/manager/assignments` | Redirect | `MANAGER_ROLES` | Redirects to `/manager/assign-services`. |
| `MGR-09` | `/manager/daily-cleaning` | `DcmsDashboardPage` | `MANAGER_ROLES` | DCMS morning route progress for branch societies. |
| `MGR-10` | `/manager/daily-cleaning/subscriptions` | `DcmsSubscriptionsPage` | `MANAGER_ROLES` | Active DCMS car subscriptions in branch societies. |
| `MGR-11` | `/manager/daily-cleaning/assignments` | `DcmsAssignmentsPage` | `MANAGER_ROLES` | Assign cleaners to branch societies. |
| `MGR-12` | `/manager/daily-cleaning/history` | `DcmsServiceHistoryPage` | `MANAGER_ROLES` | Wash completion log & photo proofs for branch. |
| `MGR-13` | `/manager/staff` | `AdminStaff` | `MANAGER_ROLES` | Field staff roster & attendance within branch. |
| `MGR-14` | `/manager/staff/:id` | `AdminStaffDetail` | `MANAGER_ROLES` | Staff profile & performance within branch. |
| `MGR-15` | `/manager/quality` | `QualityHub` | `MANAGER_ROLES` | Branch quality scorecard & cleaner ratings. |
| `MGR-16` | `/manager/exceptions` | `ExceptionsHub` | `MANAGER_ROLES` | Operational exceptions reported in branch societies. |
| `MGR-17` | `/manager/complaints` | `AdminComplaints` | `MANAGER_ROLES` | Customer complaint tickets for branch. |
| `MGR-18` | `/manager/collections` | `AdminDues` | `MANAGER_ROLES` | Permitted cash & UPI payment collections for branch. |
| `MGR-19` | `/manager/reports` | `OperationsWall` | `MANAGER_ROLES` | Real-time branch activity stream. |
| `MGR-20` | `/manager/profile` | `CustomerAccount` | `MANAGER_ROLES` | Manager personal profile & credentials. |
| `MGR-21` | `/manager` | Redirect | `MANAGER_ROLES` | Redirects to `/manager/dashboard`. |

---

### 4.6 Franchisee Portal Routes (8 Routes in `App.tsx`)

| Route ID | URL / Path | Component | Protected Roles | Main Operational Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `FRAN-01` | `/franchisee/dashboard` | `FranchiseeDashboard` | `franchisee` | Franchise territory dashboard: revenue share, active subscribers, bookings. |
| `FRAN-02` | `/franchisee/customers` | `FranchiseeCustomers` | `franchisee` | Customer directory within franchise territory. |
| `FRAN-03` | `/franchisee/customers/:id` | `FranchiseeCustomerDetail` | `franchisee` | Customer profile & service history within franchise territory. |
| `FRAN-04` | `/franchisee/bookings` | `FranchiseeBookings` | `franchisee` | Service booking requests and status within territory. |
| `FRAN-05` | `/franchisee/staff` | `FranchiseeStaff` | `franchisee` | Franchise field staff & cleaner roster. |
| `FRAN-06` | `/franchisee/churned` | `FranchiseeChurned` | `franchisee` | Churned subscribers in territory for win-back outreach. |
| `FRAN-07` | `/franchisee/leads` | `FranchiseeLeads` | `franchisee` | Territory inbound leads & CRM pipeline. |
| `FRAN-08` | `/franchisee/notifications`| Inline EmptyState | `franchisee` | Franchisee notifications placeholder view. |

---

### 4.7 Top-Level SEO & Friendly Aliases (11 Routes in `App.tsx`)

| Route ID | URL / Path | Target / Component | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `SEO-01` | `/:citySlug/:serviceSlug` | `CityServicePage` | Dynamic Route | City + Service programmatic landing page (e.g. `/varanasi/daily-car-cleaning`). |
| `SEO-02` | `/:citySlug` | `CityLandingPage` | Dynamic Route | City-specific landing page (e.g. `/noida`, `/varanasi`). |
| `ALIAS-01`| `/services` | Redirect to `/customer/services` | Alias | Top-level shortcut to customer catalog. |
| `ALIAS-02`| `/catalog` | Redirect to `/customer/services` | Alias | Top-level shortcut to customer catalog. |
| `ALIAS-03`| `/book` | Redirect to `/customer/schedule` | Alias | Top-level shortcut to booking wizard. |
| `ALIAS-04`| `/schedule` | Redirect to `/customer/schedule` | Alias | Top-level shortcut to booking wizard. |
| `ALIAS-05`| `/bookings` | Redirect to `/customer/history` | Alias | Top-level shortcut to customer service history. |
| `ALIAS-06`| `/plans` | Redirect to `/customer/plans` | Alias | Top-level shortcut to customer plans. |
| `ALIAS-07`| `/history` | Redirect to `/customer/history` | Alias | Top-level shortcut to customer history. |
| `ALIAS-08`| `/account` | Redirect to `/customer/account` | Alias | Top-level shortcut to customer profile. |
| `ALIAS-09`| `/rewards` | Redirect to `/customer/rewards` | Alias | Top-level shortcut to loyalty rewards. |

---

## 5. Interactive Screens, Modals, Drawers & Subviews

The frontend incorporates **124 modal, drawer, and sheet instances** across 81 files. The table below documents the core operational dialogs and drawers that drive key business workflows.

| Domain / Portal | Component Name | Physical File | Trigger / Parent Screen | Operational Function |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `AddressPickerSheet` | [AddressPickerSheet.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/shared/AddressPickerSheet.tsx) | Header Capsule, Booking Wizard | Manage, geocode, and switch service locations. |
| **Customer** | `AddAssetSheet` | [AddAssetSheet.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/assets/AddAssetSheet.tsx) | My Assets (`/customer/assets`) | Register a new vehicle or solar site with address binding. |
| **Customer** | `EditAssetSheet` | [EditAssetSheet.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/assets/EditAssetSheet.tsx) | My Assets (`/customer/assets`) | Update registration number, model, color, or location. |
| **Customer** | `QuickAddAssetSheet` | [QuickAddAssetSheet.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/shared/QuickAddAssetSheet.tsx) | Booking Wizard (`/customer/schedule`) | Inline asset addition without leaving the booking wizard. |
| **Customer** | `CustomerSubscribeModal`| [CustomerSubscribeModal.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/components/CustomerSubscribeModal.tsx) | Plan Detail, DCMS Overview | Subscribe vehicle to a daily cleaning plan. |
| **Customer** | `CustomerCancelModal` | [CustomerCancelModal.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/components/CustomerCancelModal.tsx) | Plan Detail (`/customer/plans/:id`) | Cancel subscription with reason capture. |
| **Customer** | `CustomerPaymentReviewDialog` | [CustomerPaymentReviewDialog.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/payment/CustomerPaymentReviewDialog.tsx) | Dashboard, Booking Review | Payment checkout sheet (UPI, Card, NetBanking). |
| **Customer** | `ProfileEditor` | [ProfileEditor.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/customer/account/ProfileEditor.tsx) | Account Hub (`/customer/account`) | Edit name, email, alternate contact number. |
| **Staff** | `StaffVehicleCleanDialog` | [StaffVehicleCleanDialog.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx) | Daily Clean (`/staff/daily-clean`) | Complete wash with camera photo, OCR verify, shutter GPS. |
| **Staff** | `StaffCarNotAvailableDialog` | [StaffCarNotAvailableDialog.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/components/StaffCarNotAvailableDialog.tsx) | Daily Clean (`/staff/daily-clean`) | Report car missing from parking bay with photo proof. |
| **Staff** | `StaffExecutionActionsSheet` | [StaffExecutionActionsSheet.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/components/StaffExecutionActionsSheet.tsx) | Daily Clean route stop menu | View car details, navigate in Google Maps, report issue. |
| **Admin** | `TransactionDetailsDrawer` | [TransactionDetailsDrawer.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/admin/TransactionDetailsDrawer.tsx) | Payment Ledger (`/admin/payments/ledger`) | Full payment audit: gateway payload, customer details, refund. |
| **Admin** | `CreateInvoiceDialog` | [CreateInvoiceDialog.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/billing/components/CreateInvoiceDialog.tsx) | Billing (`/admin/billing`) | Generate manual tax invoice with itemized line items. |
| **Admin** | `RecordPaymentDialog` | [RecordPaymentDialog.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/billing/components/RecordPaymentDialog.tsx) | Billing (`/admin/billing`) | Record offline cash, cheque, or external UPI collection. |
| **Admin** | `CommandPalette` | [CommandPalette.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/shared/CommandPalette.tsx) | Admin Layout (`Ctrl+K` / `Cmd+K`) | Universal operational search across customers, staff, routes. |
| **Admin** | `ZoneMapPicker` | [ZoneMapPicker.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/components/admin/ZoneMapPicker.tsx) | Operational Zones (`/admin/operations/zones`) | Interactive map to place zone center pin and radius circle. |

---

## 6. Role-Wise Access Matrix & Permission Enforcement

The platform enforces authorization at two levels:
1. **Frontend Route & Layout Gating:** Enforced by `<ProtectedRoute roles={[...]} permission={{ resource, action }}>` in `App.tsx` and filtered navigation in `adminNavConfig.ts`.
2. **Backend Express Middleware:** Enforced by `guardResource(resource, overrides)` in `artifacts/api-server/src/routes/index.ts` and `requirePermission(resource, action)` in `artifacts/api-server/src/middlewares/auth.ts`.

### 6.1 Role Matrix Overview

| Role Slug | Portal Entry | System Scope | Primary Capabilities | Restricted Actions |
| :--- | :--- | :--- | :--- | :--- |
| `superadmin` | `/admin/login` | Global (All Companies & Branches) | Unrestricted system configuration, executive founder metrics, destructive DB maintenance. | None. |
| `central_admin`| `/admin/login` | Company-wide | Master catalog, billing, franchisee governance, employee approval. | Cannot bypass audit logging. |
| `admin` | `/admin/login` | Company / Multi-Branch | Branch management, customer directory, dispatch orchestration, ledger. | Limited system settings. |
| `city_admin` | `/admin/login` | Single City Scope | All branch operations, pricing overrides, societies within assigned city. | Cannot modify other cities or platform settings. |
| `branch_manager`| `/admin/login` | Single Branch Scope | Branch customer service, cleaner attendance, dispatch, dues collection. | No central financial settings or system configuration. |
| `manager` | `/admin/login` | Legacy Branch/Ops Scope | Retains existing operational CRUD permissions across customers, bookings, catalog. | Legacy compatibility. |
| `supervisor` | `/staff/login` | Branch / Society Cluster | Cleaner attendance review, DCMS quality audit, reassigning daily stops. | No access to financial invoices or cleaner salaries. |
| `franchisee` | `/admin/login` | Franchise Territory | Territory bookings, customers, local staff dispatch, settlement review. | Cannot access other franchise territories or central admin. |
| `staff` | `/staff/login` | Assigned Jobs / Route | Check-in attendance, execute DCMS route stops, upload photos, mark job status. | Zero access to other cleaners' data or customer billing. |
| `customer` | `/login` | Own Account & Assets | View active plans, schedule visits, manage vehicles/addresses, pay invoices. | Strictly scoped to `user.customerId`. |

---

## 7. End-to-End User Journey Mapping

```
                                [ END-TO-END USER JOURNEYS ]

    [ CUSTOMER JOURNEY: CJ-2 ]
    Browse Catalog --------> Select Service --------> Pick Asset / Loc --------> Choose Slot --------> Review & Pay
    (/customer/services)     (/customer/services/:s)  (AddressPickerSheet)     (Date/Time Steps)    (Cashfree Gateway)
                                                                                                            |
                                                                                                            v
    [ STAFF JOURNEY: SJ-2 ]                                                                           [Booking Created]
    Selfie Check-in -------> View Route Stops ------> Scan License Plate -----> Capture Watermark ----> Mark Complete
    (GPS + Shutter Stamp)    (/staff/daily-clean)     (PlateScanFlow / OCR)     (Shutter GPS Stamp)   (Optimistic Sync)
                                                                                                            |
                                                                                                            v
    [ ADMIN JOURNEY: AJ-1 ]                                                                           [Exception Alert]
    Command Center --------> Monitor Route ---------> Exception Hub ----------> Resolve Dispute -----> Reassign Cleaner
    (/admin/dashboard)       (30s Live Polling)       (/admin/exceptions)       (Grant Makeup Clean)  (/admin/assign)
```

### 7.1 Customer Journeys

#### Journey CJ-1: Onboarding, Authentication, Address & Asset Registration
1. **Entry:** Customer navigates to `/register` or `/login`. Enters mobile number and receives 6-digit SMS OTP (`VerifyOtp.tsx`).
2. **Profile Creation:** System establishes customer record in `customers` table; links session cookie (`POST /api/auth/login`).
3. **Location Setup:** Header displays address capsule. User opens `AddressPickerSheet`, searches locality/society, or drops map pin. Saved to `service_locations` table via `POST /api/service-locations`.
4. **Asset Addition:** User navigates to `/customer/assets`, clicks "Add Vehicle" (`AddAssetSheet.tsx`), enters registration number (e.g. `UP65AB1234`), selects make/model and binds it to the service location.
5. **Outcome:** Customer is fully registered with a verified service address and vehicle ready for scheduling.

#### Journey CJ-2: Service Discovery, Pricing Quote & 6-Step Booking Wizard
1. **Discovery:** Customer browses `/customer/services` or dedicated landing page `/:citySlug/:serviceSlug`.
2. **Wizard Initialization:** Customer clicks "Book Now", navigating to `/customer/schedule` ([BookService.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/customer/BookService.tsx)).
3. **Step 1 (Asset):** Selects registered vehicle or solar site (`ScheduleAssetStep.tsx`).
4. **Step 2 (Plan):** Selects plan mode: "Use Active Subscription" or "One-Time Service" (`SchedulePlanStep.tsx`).
5. **Step 3 (Service):** Selects package and add-ons (`ScheduleServiceStep.tsx`). Dynamic pricing quote fetched via `POST /api/service-catalog/pricing-quote`.
6. **Step 4 (Date):** Selects service date from real-time calendar availability (`ScheduleDateStep.tsx`).
7. **Step 5 (Time):** Selects morning/afternoon time slot (`ScheduleTimeStep.tsx`).
8. **Step 6 (Review & Pay):** Applies promo code, reviews GST breakdown (`ScheduleReviewStep.tsx`), and initiates payment gateway checkout (`CustomerPaymentReviewDialog.tsx`).
9. **Outcome:** Booking record created (`POST /api/bookings`) with status `confirmed`; redirects to live tracking (`/customer/schedule/:id`).

#### Journey CJ-3: Daily Car Cleaning (DCMS) Subscription & Visit Gallery Review
1. **Subscription:** Customer selects monthly daily cleaning plan from `/customer/plans` and completes recurring payment.
2. **Morning Wash Delivery:** Staff cleaner completes daily wash at customer's society parking bay.
3. **Customer Notification:** Customer receives push notification upon wash completion.
4. **Photo Verification:** Customer opens `/customer/daily-cleaning/gallery` or `/customer/daily-cleaning/history`, reviews watermarked before/after wash photos, and rates cleaner service quality.

---

### 7.2 Staff Field Journeys

#### Journey SJ-1: Authentication & Geofenced Selfie Attendance Check-in
1. **Login:** Cleaner opens CWP Staff APK, enters credentials at `/staff/login`.
2. **Dashboard Gate:** App navigates to `/staff/dashboard`. Attendance widget shows "Check-In Required".
3. **Camera & GPS Capture:** Cleaner taps "Punch In". Native camera opens (`@capacitor/camera`), capturing selfie with high-accuracy GPS coordinates (`markAttendanceWithLocation`).
4. **Verification:** System validates staff location against branch/society geofence; records attendance row in `staff_attendance` with timestamp in IST.
5. **Unlock:** Route stops for the day unlock on `/staff/daily-clean`.

#### Journey SJ-2: DCMS Morning Route Execution
1. **Route View:** Cleaner opens `/staff/daily-clean` ([StaffDailyRouteSimplified.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx)). Displays prioritized list of society stops with tower, flat, and parking bay numbers.
2. **Arrival & Plate Scan:** Cleaner locates vehicle, taps camera icon. `PlateScanFlow.tsx` opens camera to read number plate via client-side OCR (`plateOcr.ts`).
3. **Verification:** If detected registration matches assigned stop, dialog displays green confirmation (`StaffVehicleCleanDialog.tsx`). If unreadable, cleaner enters plate manually with assigned match verification.
4. **Watermarked Proof:** Cleaner captures clean vehicle photo. App stamps timestamp, society name, and GPS coordinates onto the photo.
5. **Completion & Offline Sync:** Cleaner taps "Complete Wash". If online, uploads via `POST /api/dcms/visits/complete`. If connectivity drops, queues payload in local storage (`dcmsLocalStorage.ts`) and marks stop optimistically as `completed (pending sync)`.
6. **Exception Flow:** If car is absent, cleaner selects "Car Not Available" (`StaffCarNotAvailableDialog.tsx`), uploads photo of empty bay, and system logs an exception.

---

### 7.3 Admin & Operations Journeys

#### Journey AJ-1: Real-Time Operations Command Center & Exception Intervention
1. **Monitoring:** Admin opens `/admin/dashboard` ([AdminDashboard.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/admin/Dashboard.tsx)). Real-time 30-second polling updates morning wash metrics, cleaner attendance, and active detailing bookings.
2. **Exception Detection:** Immediate Attention card highlights an unresolved exception: "Car Not Available" in Tower B.
3. **Investigation:** Admin clicks into `/admin/exceptions` ([ExceptionsHub.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/admin/ExceptionsHub.tsx)), reviews cleaner's photo of the empty bay, and checks customer parking notes.
4. **Resolution:** Admin contacts customer via Communication Center, discovers car was parked in visitor parking, grants customer a makeup credit, or dispatches a re-clean.

#### Journey AJ-2: Multi-City, Branch, Zone & Society Provisioning
1. **City Expansion:** Central admin navigates to `/admin/cities`, creates new city "Noida".
2. **Branch Provisioning:** Navigates to `/admin/branches`, provisions "Noida Sector 62 Branch".
3. **Zone Mapping:** Navigates to `/admin/operations/zones`, opens interactive `ZoneMapPicker`, drops pin at Sector 62, and draws a 5 km service radius circle.
4. **Society Setup:** Navigates to `/admin/societies`, creates "Grand Omaxe", adds towers, sets gate entry rules, and configures media retention policy.
5. **Pricing Rules:** Navigates to `/admin/pricing/location-rules`, defines introductory 15% discount for Grand Omaxe residents.

---

## 8. Feature, API & Data Entity Integration Mapping

| Screen / Feature | Primary Component | React Query Hook / API Call | Express Route Handler | Primary Database Tables |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Dashboard** | `CustomerDashboard.tsx` | `useGetCustomerSummary()` | `GET /api/customers/:id/summary` | `customers`, `subscriptions`, `bookings` |
| **Service Booking** | `BookService.tsx` | `useCreateBooking()` | `POST /api/bookings` | `bookings`, `service_contracts`, `addresses` |
| **Asset Management** | `MyAssets.tsx` | `useListVehicles()`, `useCreateVehicle()` | `GET/POST /api/vehicles` | `vehicles`, `service_locations` |
| **DCMS Staff Route** | `StaffDailyRouteSimplified.tsx` | `useStaffDailyRoute()` | `GET /api/dcms/staff/route` | `subscriptions`, `daily_cleaning_assignments` |
| **Wash Completion** | `StaffVehicleCleanDialog.tsx` | `useCompleteVisit()` | `POST /api/dcms/visits/complete` | `daily_cleaning_visits`, `media_records` |
| **Attendance Check-In**| `StaffDashboard.tsx` | `markAttendanceWithLocation()` | `POST /api/staff/:id/attendance` | `staff_attendance`, `staff_locations` |
| **Command Center** | `AdminDashboard.tsx` | `operationsApi.getCommandCenter()` | `GET /api/operations/command-center` | `bookings`, `subscriptions`, `staff` |
| **Payment Ledger** | `PaymentLedgerPage.tsx` | `useQuery(["/api/admin-ledger"])` | `GET /api/admin-ledger` | `payment_transactions`, `invoices`, `customers` |
| **Society Manager** | `SocietiesPage.tsx` | `useSocieties()`, `useCreateSociety()` | `GET/POST /api/societies` | `residential_societies`, `society_towers` |
| **Operational Zones**| `OperationalZonesPage.tsx` | `useQuery(["/api/zones"])` | `GET/POST /api/zones` | `operational_zones`, `zone_coverage_rules` |
| **Micro Pricing** | `LocationPricingPage.tsx` | `useQuery(["/api/location-pricing"])`| `GET/POST /api/location-pricing` | `location_pricing_rules`, `pricing_audit_logs` |

---

## 9. Android Capacitor Parity vs. Web Application

```
+---------------------------------------------------------------------------------------------------+
|                                 PLATFORM CAPABILITY COMPARISON                                    |
+-----------------------------------+-----------------------------+---------------------------------+
| Feature / Hardware Capability     | Web Browser Experience      | Android Capacitor Experience    |
+-----------------------------------+-----------------------------+---------------------------------+
| Native Application Container      | Standard Browser Tab        | Android WebView Container       |
| Hardware Back-Button Handling     | Browser History Back        | AppNativeGuard: Minimize / Back |
| Native Geolocation Precision      | HTML5 Geolocation API       | @capacitor/geolocation (GPS)    |
| Background Field Tracking         | Unavailable / Suspended     | @capacitor-community/background |
| Camera Capture & Gallery Lock     | <input type="file"> chooser | @capacitor/camera (Hardware)    |
| Offline Route Caching             | TanStack Query Cache        | dcmsLocalStorage + OfflineQueue |
| Push Notifications                | Web Push API                | Native Push Service             |
| App State Transition Listener     | visibilitychange event      | App.addListener('appStateChange')|
| Safe Area Insets & Status Bar     | CSS env(safe-area-inset-*)  | @capacitor/status-bar Dark mode |
+-----------------------------------+-----------------------------+---------------------------------+
```

### 9.1 Camera & Photo Evidence Parity
- **Web Client:** Renders standard file upload dialog or file picker. Does not enforce real-time camera shutter.
- **Android Staff APK:** Directly triggers native hardware camera via `@capacitor/camera`. The gallery option is intentionally bypassed (`saveToGallery: false`) to prevent cleaners from uploading pre-existing photos. Every capture extracts timestamp, lens orientation, and GPS coordinates directly at the shutter event.

### 9.2 Geolocation & Geofencing Parity
- **Web Client:** Relies on browser permission prompts which are frequently blocked or spoofed via developer tools.
- **Android Staff APK:** Integrates `@capacitor/geolocation` and `@capacitor-community/background-geolocation`. Checks Android OS system-level location service status via `NativeLocationBridge` ([nativeGeolocation.ts](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/lib/location/nativeGeolocation.ts)). If GPS is disabled in Android quick settings, prompts user with a direct intent to open system location settings.

---

## 10. Code Health, Discrepancies, Dead Ends & Legacy Inventory

During the forensic audit, several architectural discrepancies, legacy redirects, and dead ends were identified in the codebase:

### 10.1 Discrepancy: Customer Information Architecture Freeze vs. Active Routes
In [docs/CUSTOMER_IA_FREEZE_v1.md](file:///d:/cwpdetailersapp/docs/CUSTOMER_IA_FREEZE_v1.md), the IA specification stated:
- `/customer/wallet` -> MUST redirect to `/customer/plans`
- `/customer/services` -> MUST redirect to `/customer/plans`

**Actual Implementation Finding in Code:**
- In `artifacts/cwp-platform/src/App.tsx` (lines 329 & 334):
  - `/customer/wallet` is **NOT** redirected; it renders an active, fully functional `CustomerWallet` component.
  - `/customer/services` is **NOT** redirected; it renders an active `CustomerServices` catalog component.
  - Furthermore, dedicated product detail pages (`/customer/services/:slug`) and DCMS customer views (`/customer/daily-cleaning/*`) were implemented as active routes.

### 10.2 Legacy Redirect Routes
The application maintains several legacy redirect routes for backward compatibility:
1. `/staff/work` -> Redirects dynamically to `/staff/daily-clean` or `/staff/bookings` based on user roles ([Work.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/staff/Work.tsx)).
2. `/staff/team` -> Redirects to `/staff/profile` ([Team.tsx](file:///d:/cwpdetailersapp/artifacts/cwp-platform/src/pages/staff/Team.tsx)).
3. `/staff/schedule` -> Redirects to `/staff/jobs`.
4. `/admin/operations/playbook` -> Redirects to `/admin/playbook`.
5. `/admin/zones` -> Redirects to `/admin/operations/zones`.
6. `/admin/location-pricing` -> Redirects to `/admin/pricing/location-rules`.
7. `/admin/scheduler` -> Redirects to `/admin/automation`.
8. `/admin/operations-wall` -> Redirects to `/admin/service-updates`.

### 10.3 Unfinished / Placeholder Views
- **Franchisee Notifications (`/franchisee/notifications`):** Line 355 of `App.tsx` renders an inline `EmptyState` component ("No notifications yet") rather than a dedicated page component with database-backed notification feed.

---

## 11. Forensic Statistics & Audit Synthesis

### 11.1 Master Metrics Table

| Metric Category | Verified Count | Code Source & Evidence |
| :--- | :--- | :--- |
| **Monorepo Packages** | 5 | `artifacts/` (`cwp-platform`, `api-server`, `cwp-customer-app`, `cwp-staff-app`, `mockup-sandbox`) |
| **Shared Libraries** | 8 | `lib/` (`db`, `api-client-react`, `api-spec`, `api-zod`, `address-model`, `customer-model`, `validation`, `env`) |
| **App.tsx Route Tags** | 159 | `<Route>` tags in `artifacts/cwp-platform/src/App.tsx` |
| **App.tsx Unique URL Paths** | 158 | Verified distinct path attributes in `App.tsx` |
| **Staff Sub-Router Paths** | 14 | 8 active pages + 6 redirects in `StaffPortalRouter.tsx` |
| **Total Ecosystem Route Paths** | 172 | Master catalogued paths across all routers |
| **Admin Operations Routes** | 79 | Paths starting with `/admin` |
| **Branch Manager Routes** | 21 | Paths starting with `/manager` |
| **Customer Application Routes**| 23 | Paths starting with `/customer` |
| **Staff Application Routes** | 17 | Paths starting with `/staff` |
| **Franchisee Routes** | 8 | Paths starting with `/franchisee` |
| **Public & Auth Routes** | 7 | `/`, `/vehicle`, `/solar`, `/login`, `/register`, `/verify-otp`, `/forgot-password` |
| **Public Legal Pages** | 6 | `/privacy-policy`, `/terms-and-conditions`, `/refund-policy`, `/data-deletion`, `/about-us`, `/contact-us` |
| **Top-Level SEO & Aliases** | 11 | 2 SEO dynamic routes (`/:citySlug/:serviceSlug`, `/:citySlug`) + 9 friendly shortcuts |
| **Dialog / Sheet / Drawer Files** | 81 | Unique `.tsx` files containing `<Dialog>`, `<Sheet>`, or `<Drawer>` |
| **Total Modal Instances** | 124 | Verified JSX modal elements across platform components |
| **API Server Route Modules** | 67 | TypeScript modules in `artifacts/api-server/src/routes/` |
| **API HTTP Endpoint Handlers** | 778 | Verified `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()` handlers |
| **System Roles Mapped** | 10 | `customer`, `staff`, `supervisor`, `branch_manager`, `manager`, `city_admin`, `franchisee`, `admin`, `central_admin`, `superadmin` |
| **RBAC Resource Types** | 24 | Mapped in `scripts/src/seed-permissions.ts` and `permissions.ts` |

---

## 12. Verification Baseline & Working Tree Status

In strict conformance with Phase 2 audit requirements, this investigation operated exclusively in **READ-ONLY** mode:
- **No application code, components, or styles were modified.**
- **No database schemas, seeds, or migrations were executed.**
- **No Git commits, branch switches, or pushes were performed.**
- **Pre-existing uncommitted changes from Hotfix A+B were completely preserved:**
  1. `artifacts/api-server/src/routes/location-pricing.ts`
  2. `artifacts/api-server/src/routes/payment-gateway.ts`
  3. `artifacts/api-server/src/routes/societies.ts`
  4. `artifacts/api-server/src/routes/zones.ts`
  5. `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`
  6. `scripts/src/inspect-prod-db.ts`
  7. `scripts/src/reset-production-db.ts`
  8. Untracked test files in `artifacts/api-server/src/__tests__/security/`
  9. Audit reports in `docs/audits/`

---
*Report certified by Principal Software Architect & DevOps Lead — Antigravity Engineering Audit Team.*
