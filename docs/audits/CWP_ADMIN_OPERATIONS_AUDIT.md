# CWP Detailers — Comprehensive Admin Operations Audit
**Phase 25: Admin Operations Command Center, Customer Support Intelligence & Service Exception Management**
**Date:** 2026-11-14  
**Author:** Principal Product Architect & Engineering Team  
**Scope:** Admin Portal, Operations Workflows, Customer Support, Exception Handling, Customer 360, Reporting & Authorization

---

## 1. Executive Summary

This audit assesses the state of the CWP Detailers Admin Panel, backend operations APIs, customer support workflows, data schemas, and real-time operational visibility across the multi-city platform (Varanasi, Noida, and planned expansions).

### High-Level Assessment
- **Existing Strength:** A rich array of operational modules exists across 17 distinct functional areas. The platform has mature foundations for Daily Car Cleaning (DCMS), Booking Platform, Job Orchestration, Billing/Payment Ledger, SLA policies, and Staff ecosystem.
- **Identified Deficiencies:**
  1. **Isolated & Outdated Admin Homepage (`/admin/dashboard`):** The default landing page rendered high-level monthly revenue and sales leads rather than answering the daily operational triage questions: *"What is happening today?", "What requires immediate attention?", "Which bookings are delayed or unassigned?", "How is each city/branch performing right now?"*
  2. **Fragmented Service Exception Architecture:** Daily Car Cleaning had its own `dcms_operational_exceptions` table, but non-DCMS services (car wash, detailing, solar care) had no unified exception model. Delays beyond threshold, unassigned bookings, payment failures, failed photo evidence, and failed notifications were not aggregated into a centralized triage queue with deduplication and stateful resolution workflows.
  3. **Customer Support Intelligence Gaps:** While `complaintsTable` and `supportTicketMessagesTable` existed, tickets were siloed in `/admin/complaints` without direct contextual linkages to vehicles, bookings, or staff dispatch history, and lacked frictionless 1-click case creation from bookings or customer profiles.
  4. **Customer 360 Incompleteness:** The Customer Detail screen (`/admin/customers/:id`) had basic summary metrics and tabs, but lacked comprehensive, paginated operational visibility across all customer vehicles, addresses, full booking lifecycle history, payment ledger lines, support cases, and notification audit logs with strict PII role protection.
  5. **Static Polling / Operational Visibility:** Real-time visibility was inconsistent across pages; there was no unified "last updated" indicator, manual refresh mechanism, or configurable operational polling cadence across the command center.

---

## 2. Comprehensive Domain Audit (17 Operational Areas)

### 2.1 Admin Dashboard (`Dashboard.tsx`, `FounderDashboard.tsx`, `SystemStatus.tsx`)
- **What Already Exists:** Legacy KPI cards (Jobs, Collections, Open Complaints, Month Revenue) and Recharts charts for sales leads.
- **What Is Functional:** API fetching of basic metrics via `/api/analytics/dashboard` and `/api/operations/timeline`.
- **What Is Incomplete:** Does not answer daily operational triage; missing authoritative counts for today's confirmed vs pending vs completed vs delayed vs cancelled bookings; missing unassigned jobs count; missing dynamic city/branch scope filtering.
- **What Needs Redesign:** Complete redesign into a Unified Operations Command Center answering:
  1. What is happening today?
  2. What requires immediate attention?
  3. Which services are pending or delayed?
  4. Which staff members need intervention?
  5. Which customer issues are unresolved?
  6. How is each city/branch performing?
- **What Can Be Reused:** Existing `AdminScopeHeader`, `useAppStore` (for city/branch scope), and tenant-scoped query functions.

### 2.2 Booking Management (`Bookings.tsx`, `BookServicesPage.tsx`, `AssignServicesPage.tsx`, `JobOrchestrationPage.tsx`)
- **What Already Exists:** Full booking lifecycle table with status filtering (`draft`, `scheduled`, `confirmed`, `waiting_assignment`, `assigned`, `in_progress`, `completed`, `missed`, `rescheduled`, `cancelled`), city/society filter, rescheduling modal, cancel dialog, and event timeline drawer.
- **What Is Functional:** Booking transitions, rescheduling with reason, event audit logging in `booking_events`.
- **What Is Incomplete:** No direct 1-click escalation to support case or service exception from a failed/delayed booking row.
- **What Can Be Reused:** `useListBookings`, `useTransitionBooking`, `useRescheduleBooking`, and `BookingEvent` timeline.

### 2.3 Customer Management (`Customers.tsx`, `CustomerDetail.tsx`, `CustomerMigration.tsx`, `ChurnedCustomers.tsx`)
- **What Already Exists:** Customer list with search, status filters, phone/email validation, persona badges, active contracts summary, billing panel, communication timeline, and saved location manager.
- **What Is Functional:** Customer CRUD, address assignment, wallet dues display, and CSV migration.
- **What Is Incomplete:** Customer detail page does not provide a true "Customer 360" view: vehicles list is not interactive; booking history is limited to 5 records without pagination; payment history is limited to 5 records; support cases are not listed with case creation modal; notification logs are not visible.
- **What Needs Redesign:** Customer 360 overview tab with lazy-loaded paginated sections, vehicle status badges, society/tower/bay details, and support case history.
- **What Can Be Reused:** Existing `/api/customers/:id/summary`, `/api/customers/:id/services`, and `CustomerProfileLink` components.

### 2.4 Staff Management (`Staff.tsx`, `StaffDetail.tsx`, `StaffApproval.tsx`)
- **What Already Exists:** Staff directory with role filtering (cleaners, supervisors, technicians, managers), document verification queue, profile detail with phone/email/branch, and attendance logs.
- **What Is Functional:** Staff verification approval, role assignment, branch scoping.
- **What Is Incomplete:** Real-time visibility into which staff members have delayed jobs or missed routes today, and 1-tap dial/contact actions.
- **What Can Be Reused:** Staff directory APIs, `/api/staff`, and staff role ecosystem utilities.

### 2.5 City and Branch Management (`Cities.tsx`, `Branches.tsx`, `SocietiesPage.tsx`, `Franchisees.tsx`, `MasterData.tsx`)
- **What Already Exists:** Multi-city lifecycle management (active, launch_ready, coming_soon), branch assignment, residential society master catalog with tower and parking bay counts, franchisee agreements.
- **What Is Functional:** Dynamic city and branch master tables, society geo-fencing metadata.
- **What Can Be Reused:** `/api/masters/cities`, `/api/branches`, `/api/societies`, and multi-city database scoping.

### 2.6 Service Catalog (`Services.tsx`, `ProductsAndPlans.tsx`)
- **What Already Exists:** Dynamic catalog matrix supporting Car Wash, Detailing, Daily Car Cleaning, and Solar Panel Care with duration minutes, pricing by vehicle segment, and GST configuration.
- **What Is Functional:** Catalog retrieval, category segmentation, city-specific pricing overrides.
- **What Can Be Reused:** `/api/services`, `/api/products-and-plans`, and catalog resolution services.

### 2.7 Daily Car Cleaning Management (`DcmsDashboardPage.tsx`, `DcmsSubscriptionsPage.tsx`, `DcmsAssignmentsPage.tsx`, `DcmsServiceHistoryPage.tsx`)
- **What Already Exists:** Society-level morning route manager, cleaner assignments, subscription plans (frequency, morning/evening slots), CNA (Car Not Available) logs, and monthly visit history.
- **What Is Functional:** DCMS subscription lifecycle, daily visit generation, cleaner route assignment.
- **What Needs Integration:** DCMS exceptions (`dcms_operational_exceptions`) need to roll up into the unified operations command center alongside general booking exceptions.
- **What Can Be Reused:** `dcmsSubscriptionsTable`, `dcmsVisitsTable`, `dcmsOperationalExceptionsTable`, and `dailyRouteService`.

### 2.8 Car Washing and Detailing Operations (`Bookings.tsx`, `JobOrchestrationPage.tsx`, `OperationsWall.tsx`)
- **What Already Exists:** Execution board (`/admin/jobs`) managing field statuses (`ready_for_execution`, `started`, `completed`), operational statuses (`in_field`, `pending_quality_review`, `approved`, `ready_for_billing`), photo review, and timeline auditing.
- **What Is Functional:** Job approval, cancellation, reopening, and billing readiness.
- **What Can Be Reused:** `fetchJobs`, `approveJob`, `cancelJob`, `recordExecutionTimeline`.

### 2.9 Solar Panel Cleaning Operations (`solar-sites.ts`, `SolarExperience.tsx`, `solar-rate-card`)
- **What Already Exists:** Solar site registry (kilowatt capacity, panel count, roof type, water access, inverter model), site address snapshotting, and solar-specific checklist items.
- **What Is Functional:** Solar booking integration via `solar_site_id` on `bookingsTable`.
- **What Can Be Reused:** `solarSitesTable` and solar execution verification.

### 2.10 Payments and Transaction Ledger (`PaymentLedgerPage.tsx`, `BillingFinancePage.tsx`, `Invoices.tsx`, `Dues.tsx`)
- **What Already Exists:** Dual-entry transaction ledger with Cashfree gateway reconciliation, invoice generation, GST breakdown, outstanding dues tracking, and refund status.
- **What Is Functional:** Ledger row inspection drawer, payment attempt logging, dues collection actions.
- **What Is Incomplete:** Payment failures (abandoned webhooks, failed card transactions) were not automatically flagged as operational exceptions for admin triage.
- **What Can Be Reused:** `paymentsTable`, `paymentAttemptsTable`, and `invoicesTable`.

### 2.11 Notifications (`Notifications.tsx`, `PushLogs.tsx`, `communications.ts`)
- **What Already Exists:** In-app, push, SMS, and WhatsApp notification engine with deduplication keys, template registry, and privacy masking.
- **What Is Functional:** Template-based dispatching, deduplication prevention, audit logging in `notificationsTable`.
- **What Needs Integration:** Delivery failures should create/link operational exceptions when critical customer communications fail.
- **What Can Be Reused:** `dispatchNotification` in `dispatcher.ts`, `notificationsTable`, and template catalogs.

### 2.12 Marketing CMS (`MarketingCMSPage.tsx`, `LegalCMS.tsx`, `BrandIdentity.tsx`, `BusinessInfo.tsx`, `SeoSettings.tsx`)
- **What Already Exists:** Banner management, promotion codes, city/branch targeting, legal entity terms & conditions, brand logo/favicon uploader.
- **What Is Functional:** Marketing banners and promo discount application.
- **What Can Be Reused:** Promotional discount validations and branding context providers.

### 2.13 Loyalty and Referrals (`LoyaltyAdminPage.tsx`, `CustomerReferralPanel.tsx`)
- **What Already Exists:** Customer referral tracking, reward point ledger, redemption policies, tier advancement (Bronze, Silver, Gold, Platinum).
- **What Is Functional:** Referral code generation and loyalty transaction recording.
- **What Can Be Reused:** `loyaltyRewardsTable` and `CustomerReferralPanel`.

### 2.14 Automation Dashboard (`AutomationOpsCenter.tsx`, `scheduler.ts`, `system-jobs.ts`)
- **What Already Exists:** Background job orchestration (SLA monitoring, morning visit generation, invoice aging, retention checks) with worker heartbeats and manual job triggers.
- **What Is Functional:** Job runner execution, heartbeat tracking, run history.
- **What Can Be Reused:** Background scheduler for automated exception scanning (e.g. overdue unassigned bookings).

### 2.15 Customer Support Functionality (`Complaints.tsx`, `QualityHub.tsx`, `support.ts`, `slaService.ts`)
- **What Already Exists:** Support ticket system with ticket numbering (`TKT-xxx`), customer messages vs internal notes, SLA countdown timers, escalation levels (L1 supervisor, L2 central superadmin), and resolution actions (makeup credit, reclean, reassignment).
- **What Is Functional:** Ticket listing, message thread, status updates, SLA clock pauses on `awaiting_customer`.
- **What Needs Enhancement:** Centralized Customer Support Intelligence with direct context linking to customer vehicle, booking ID, staff ID, and city/branch filters; strict internal notes privacy ensuring customer views never leak staff-only comments.
- **What Can Be Reused:** `complaintsTable`, `supportTicketMessagesTable`, `slaPoliciesTable`, and `supportTicketService.ts`.

### 2.16 Reports and Analytics (`Analytics.tsx`, `OperationsWall.tsx`, `QualityHub.tsx`, `BookingFunnelDashboard.tsx`, `UxExperimentsDashboard.tsx`)
- **What Already Exists:** Multi-city platform analytics, quality hub SLA metrics, cleaner scorecards, revenue breakdowns, and UX experiment conversion funnels.
- **What Is Functional:** Multi-city analytics service (`getUnifiedPlatformAnalytics`), supervisor quality metrics.
- **What Needs Addition:** City-wise operational reporting metrics with authoritative mathematical definitions, data sources, and calculations (completion rate, cancellation rate, delay rate, assignment coverage).
- **What Can Be Reused:** `multiCityAnalyticsService.ts` and `qualityApi`.

### 2.17 Role Permissions, API Contracts, and Real-Time/Polling Mechanisms
- **What Already Exists:** Server-side RBAC (`permissions.ts`), tenant isolation middlewares (`tenantScope.ts`), `AdminScopeHeader` with `useAppStore` for active city and branch selection.
- **What Is Functional:** Multi-tenant scoping and role verification.
- **What Needs Improvement:** Consistent operational polling (30-60s) with visible "Last refreshed at" timestamps and manual instant refresh across command center screens.

---

## 3. Data Model & Architecture Gap Analysis

| Domain | Existing Schema | Identified Gap | Required Enhancement |
| :--- | :--- | :--- | :--- |
| **Command Center** | Legacy dashboard stats | No unified endpoint for today's operational triage across bookings, visits, delayed jobs, and exceptions | Authoritative `GET /api/operations/command-center` endpoint with dynamic city/branch scoping |
| **Service Exceptions** | `dcms_operational_exceptions` only | No unified table for booking delays, unassigned jobs, staff issues, payment failures, or failed notifications | Create `service_exceptions` table (Migration 084) with deterministic `dedupe_key`, category, severity, status, and foreign keys |
| **Customer Support** | `complaints` & `support_ticket_messages` | Missing streamlined ticket creation with pre-filled booking/vehicle/staff context from operations; needs category normalization | Enhanced support intelligence with standardized categories, owner assignment, and private internal notes |
| **Customer 360** | `/api/customers/:id/summary` | Limited to 5 recent items; no paginated history of bookings, payments, vehicles, or notifications | Paginated Customer 360 endpoints and enriched UI with vehicle cards, full bookings, payment ledger, and support tickets |
| **Operational Actions** | Fragmented across pages | Operational actions (reassign, reschedule, cancel, resolve exception) lacked unified confirmation dialogs and audit logging | Unified contextual action handlers with mandatory confirmation and `admin_audit_logs` persistence |

---

## 4. Prioritized Modernization Roadmap (Phase 25 Deliverables)

1. **Database Migration 084 (`DB-003`):** Create `service_exceptions` table with indexes, status enums, and deduplication keys.
2. **Authoritative Operations Backend (`ADMIN-010`):** Build `operationsCommandCenterService.ts` and route `GET /api/operations/command-center`.
3. **Unified Operations Command Center UI (`ADMIN-011`):** Completely modernize `Dashboard.tsx` into a high-visibility operations command center with dynamic city/branch filters, today's metrics, immediate attention triage, and city performance matrix.
4. **Service Exception Management Engine & Hub (`ADMIN-012`):** Build `exceptionService.ts`, automated exception scanner, and `ExceptionsHub.tsx` (`/admin/exceptions`) supporting acknowledge, reassign, reschedule, and resolve workflows.
5. **Customer Support Intelligence (`ADMIN-013`):** Modernize Support & Complaints triage with context linking to Customer, Vehicle, Booking, Staff, SLA badges, and strict internal notes segregation.
6. **Customer 360 Profile Modernization (`ADMIN-014`):** Upgrade Customer Detail into a rich 360 view with vehicle management, address clarity, full paginated booking history, payment transactions, support cases, and communication logs.
7. **Safe Operational Actions & Audit Logging (`ADMIN-015`):** Standardize contextual actions (reassign, reschedule, cancel) with confirmation modals and immutable audit logging in `admin_audit_logs`.
8. **Real-Time Visibility & Configurable Polling (`ADMIN-016`):** Implement last-refreshed timestamps, instant refresh triggers, and resilient 30s-60s background polling.
9. **City-Wise Operations Analytics (`ADMIN-017`):** Authoritative operational reporting with clearly documented metric definitions, formulas, and limitations.
10. **Comprehensive Testing Suite & Verification (`TEST-013`):** Author exhaustive backend tests, frontend component tests, and live browser verification.
