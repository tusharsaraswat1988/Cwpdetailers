# CWP Detailers — Project Noida & Multi-City Platform

## Product Requirements Document (PRD) and Living Project Tracker

**Document type:** Living PRD / Project Skill Reference  
**Project:** CWP Detailers Website, Customer App, Staff App and Admin Portal  
**Immediate launch market:** Noida, Uttar Pradesh  
**Existing market:** Varanasi, Uttar Pradesh  
**Planned expansion markets:** Ghaziabad, Greater Noida, Gurgaon, Delhi and additional tier-1/tier-2 cities  
**Status:** Canonical Living PRD — Operational Exceptions, Hardened Geofence Security & Society Operations Hub Verified  
**Version:** 1.3 (Operational Exceptions Triage, Basement GPS Fallback Hardening, Society Daily Operations Hub, Media Privacy & Routine Purge Worker)  
**Last updated:** 2026-11-12  
**Owner:** CWP Detailers Architecture & Engineering Team  
**Canonical Repository Path:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`  

---

## 0. Living PRD Operating Rule — Mandatory

This document is the canonical product requirements and delivery-tracking reference for the CWP Detailers project.

Whenever work under this project involves any of the following, update this PRD in the same work cycle:

- Create a new feature, module, screen, workflow, integration or service.
- Change existing product behavior, UX/UI, architecture, data model, security or configuration.
- Fix a bug or resolve a technical issue.
- Complete, partially complete, defer, cancel or reprioritize planned work.
- Make a product, technical, operational or UX decision.
- Identify a new requirement, dependency, risk, limitation or future plan.

### Required update behavior

1. **Before work:** Check this PRD for relevant requirements, prior decisions, status and dependencies.
2. **During planning:** Add newly identified work to the appropriate backlog section. Record its priority and rationale.
3. **During implementation:** Update the status to `In Progress` and add scope, affected modules and relevant decisions.
4. **After implementation:** Record what was actually delivered, verification performed, test evidence/results, and known limitations. Mark as `Done` only when verified against acceptance criteria.
5. **If incomplete:** Keep the item `In Progress`, `Needs Audit` or `Blocked`; do not report it as completed.
6. **If changed:** Preserve a concise change-history entry and update affected requirements, architecture notes, risks and acceptance criteria.
7. **Keep the PRD synchronized:** The PRD update is part of the task's deliverable, not an optional documentation follow-up.
8. **Do not invent status:** When repository access or test evidence is unavailable, explicitly mark the status `Needs Audit` or `Unverified`.
9. **Maintain traceability:** Assign stable requirement/task IDs and reuse them when referring to work in later conversations.
10. **Update the actual Markdown file:** In this connected repository, edit `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`.

---

# 1. Product Vision

Evolve the existing CWP Detailers product into a secure, scalable, configuration-driven, multi-city and multi-service platform.

**"One platform, multiple cities, independently configurable customer and operational experiences."**

The existing platform was originally built around Varanasi, where CWP offers:
- Daily Car Cleaning (DCMS)
- Car Washing
- Detailing & Ceramic Coating / PPF
- Solar Panel Cleaning

For the immediate Noida launch, only **Daily Car Cleaning** is to be marketed and available to customers. Noida must not expose Varanasi-specific services, prices, banners, contact details, or operational data.

Future cities should be onboarded primarily through admin configuration rather than duplicated applications or city-specific code forks.

## Product goals

- Launch Daily Car Cleaning in Noida using the existing website and apps.
- Preserve the currently working Varanasi business and its workflows without regression.
- Enable city-wise service, pricing, content, coverage, residential society hierarchy, and feature configuration.
- Provide a clear and efficient customer booking and subscription journey.
- Provide staff with assignment-specific, simple, reliable workflows (society, tower, parking bay, GPS, before/after photos).
- Secure customer, staff, location, booking and vehicle-photo data.
- Establish the foundation for city/branch/franchise operations and legal-entity-specific GST invoicing.
- Prepare flexible promotional/ad placements without making a full ad platform launch-critical.
- Maintain a reliable living record of delivered, ongoing and planned work.

## Non-goals for the immediate Noida launch

- Full third-party advertiser self-serve portal, onboarding, billing and advanced ad analytics.
- Full franchise commercial/royalty settlement automation.
- Launching Car Washing, Detailing, PPF, or Solar Panel Cleaning in Noida.
- Duplicating or branching the application repository for each city.
- Rewriting working modules without evidence of need.

---

# 2. Product Principles

1. **Configuration over hardcoding:** City differences should be driven by validated database configuration.
2. **Backend-enforced security:** UI hiding is not authorization. APIs must strictly reject unauthorized requests.
3. **One identity, multiple service addresses:** Customers may use CWP across multiple cities from one account.
4. **Workflow-aware services:** Different services have different operational job steps and completion requirements.
5. **Mobile-first, staff-centered UX:** Reduce staff cognitive load in basement parking lots and low-connectivity zones.
6. **Privacy by design:** Minimize collection, restrict access, define retention policies and support customer data rights.
7. **Incremental and reversible delivery:** Prefer safe additive changes and tested database migrations.
8. **Evidence-based completion:** A task is done only after verification appropriate to its risk.
9. **Backward compatibility:** Varanasi must not regress as Noida capabilities are introduced.
10. **Documentation as part of delivery:** PRD, decisions and status must stay synchronized with code.

---

# 3. Users and Roles

| Role | Expected Access | Code / Auth Scope |
| :--- | :--- | :--- |
| **CWP Super Admin** | All authorized cities, branches, configuration, billing, and reports | `role: super_admin`, bypasses branch filters |
| **City Admin** | Only assigned city data, societies, staff, and settings permitted by role | `role: city_admin`, scoped by `city_id` |
| **Branch/Franchise Manager** | Assigned branch operations, staff assignments, and permitted management | Scoped by `branch_id` / `franchisee_id` |
| **Staff / Cleaner** | Assigned daily jobs and minimum necessary customer/vehicle/society info | Scoped by `staff_id`, `assigned_date`, daily route |
| **Customer** | Own account, vehicles, addresses, bookings, subscriptions and photos | Scoped by `customer_id` (`auth.user.id`) |
| **Advertiser (Future)** | Own campaigns and aggregated permitted metrics; zero customer/staff PII | Scoped by `advertiser_id` (deferred) |

Authorization must be checked server-side for each protected operation.

---

# 4. Functional Requirements

## 4.1 Multi-City Configuration Engine
**Requirement IDs:** `CITY-001` to `CITY-010` | **Priority:** P0

- `CITY-001`: Maintain normalized `cities` records with slug, activation state, timezone, coordinates, and operating hours.
- `CITY-002`: City-level service availability flags (`service_city_availability`) allowing independent activation per city.
- `CITY-003`: City-specific pricing, package overrides, and subscription plan tiers.
- `CITY-004`: Service coverage areas, sectors, pincodes, and residential societies tied to cities.
- `CITY-005`: City-specific homepage banners, hero content, contact phone numbers, and WhatsApp links.
- `CITY-006`: Configuration inheritance model: `Branch override → City override → Global default`.
- `CITY-007`: Strict rule: A service disabled at city level must never become bookable via fallback defaults.
- `CITY-008`: Server-side validation gate in booking and subscription checkout validating city eligibility.
- `CITY-009`: City configuration cache invalidation mechanism upon admin updates.
- `CITY-010`: Support multi-city administrative scoping so city admins cannot view or alter other cities.

## 4.2 City Selection and Customer Experience
**Requirement IDs:** `CUST-001` to `CUST-010` | **Priority:** P0

- `CUST-001`: City selection modal/header with persisted customer preference in state/cookies/storage.
- `CUST-002`: Geolocation-assisted city suggestion with explicit user confirmation.
- `CUST-003`: Seamless city switching allowing multi-city address management under one customer profile.
- `CUST-004`: The selected service address (and its associated city) strictly determines service availability.
- `CUST-005`: Customer-facing home and catalog pages dynamically render city-specific offerings.
- `CUST-006`: For Noida, render ONLY Daily Car Cleaning at launch; completely omit other services.
- `CUST-007`: Disabled services must not appear as "inactive" or "grayed out" cards — they must be completely excluded from customer discovery.
- `CUST-008`: Real-time backend re-validation during address selection and final checkout.
- `CUST-009`: Customer notification preferences (WhatsApp, SMS, Push) scoped per service.
- `CUST-010`: Localized customer support contact details based on selected city.

## 4.3 Customer Accounts, Vehicles and Services
**Requirement IDs:** `CUST-011` to `CUST-020` | **Priority:** P0

- `CUST-011`: Customer profile and phone-based OTP/password authentication.
- `CUST-012`: Multiple delivery/service address support linked to normalized cities and societies.
- `CUST-013`: Multi-vehicle garage management (make, model, color, license plate, vehicle type/segment).
- `CUST-014`: City-scoped subscription plans (DCMS) and single-service booking history.
- `CUST-015`: Vehicle-wise before/after service photo gallery with secure time-limited URLs.
- `CUST-016`: Online payment integration (Cashfree / PG) supporting city-specific gateway profiles.
- `CUST-017`: In-app invoice download for completed services and subscription renewals.
- `CUST-018`: Subscription pause, resume, and cancellation flows with pro-rata handling.
- `CUST-019`: Customer privacy controls (data export request, account deletion request).
- `CUST-020`: Strict customer record isolation (IDOR protection on addresses, vehicles, bookings).

## 4.4 Service Catalog and Workflow Engine
**Requirement IDs:** `SVC-001` to `SVC-010` | **Priority:** P0

- `SVC-001`: Normalized service catalog (`servicesTable`, `serviceCategoriesTable`).
- `SVC-002`: Service workflow definition differentiating Daily Cleaning (quick daily pass, society bay) from Detailing/Washing (time slot, water/electricity requirement).
- `SVC-003`: Dynamic form requirements per service (e.g., parking bay required for DCMS, water source for wash).
- `SVC-004`: City-wise service enablement API (`GET /api/catalog/services?city=noida`).
- `SVC-005`: Dynamic pricing matrix by vehicle category (Hatchback, Sedan, SUV, Luxury) per city.
- `SVC-006`: Service package bundling (e.g., Monthly DCMS + 1 Deep Interior Clean).
- `SVC-007`: Required completion artifacts per service (e.g., 2 photos for daily wash, 6 photos for ceramic).
- `SVC-008`: Service lead-time and operating hours configuration per city.
- `SVC-009`: Add-on service attachments (e.g., windshield treatment, ozone sanitization).
- `SVC-010`: Automated job creation pipeline from active recurring subscription schedules.

## 4.5 Staff Application & Daily Cleaning Operations
**Requirement IDs:** `STAFF-001` to `STAFF-015` | **Priority:** P0

- `STAFF-001`: Role-based staff authentication scoped by city and assigned branch.
- `STAFF-002`: Daily assigned route and job list organized by society, tower, and parking bay.
- `STAFF-003`: Sequenced cleaning itinerary set by supervisor or optimized by parking level.
- `STAFF-004`: Clear vehicle identification (plate number, make, model, color, exact parking bay).
- `STAFF-005`: Single-tap emergency customer calling (with phone number masking/privacy where feasible).
- `STAFF-006`: Structured daily job execution steps: Verify Vehicle → Before Photo (optional) → Clean → After Photo → GPS Log → Complete.
- `STAFF-007`: Daily cleaning quick-complete flow designed for rapid turnover (sub-60 seconds logging).
- `STAFF-008`: Exception reporting (Vehicle not found, Vehicle locked, Gate denied entry, Customer requested skip).
- `STAFF-009`: Offline photo capture with background sync queue for basement parking garages.
- `STAFF-010`: Idempotent completion API preventing duplicate submission on network retry.
- `STAFF-011`: Staff attendance and daily check-in / check-out with GPS verification.
- `STAFF-012`: Zero visibility into services or customer records outside assigned city/branch.
- `STAFF-013`: Water/supply usage logging if required by branch.
- `STAFF-014`: Supervisor inspection and spot-check audit workflow.
- `STAFF-015`: Staff performance and completed job counter dashboard.

## 4.6 Job Assignment, Routing and Notifications
**Requirement IDs:** `JOB-001` to `JOB-012` | **Priority:** P0/P1

- `JOB-001`: Auto-assignment of daily cleaning jobs based on assigned residential society and cluster.
- `JOB-002`: Manual re-assignment tool for supervisors in case of staff absence.
- `JOB-003`: Workload balancing (capping daily cars per cleaner, e.g., 25-30 cars/shift).
- `JOB-004`: Immediate push notification to staff on route update or schedule modification.
- `JOB-005`: Customer notification upon job completion with embedded service photo.
- `JOB-006`: Exception alerts sent to operations manager if cleaner reports unserviceable car.
- `JOB-007`: Reliable push notification queue (BullMQ / PostgreSQL fallback) with retry guarantees.
- `JOB-008`: Notification delivery logging and audit tracking (`push_notification_logs`).
- `JOB-009`: Suppression of sensitive customer information in notification push payloads.
- `JOB-010`: Scheduled morning summary notification to customers confirming scheduled cleaning.
- `JOB-011`: Multi-channel notification dispatch (WebPush, Firebase Cloud Messaging, WhatsApp API).
- `JOB-012`: Automated dead-letter queue monitoring for notification delivery failures.

## 4.7 Geolocation & Proof of Presence
**Requirement IDs:** `GEO-001` to `GEO-008` | **Priority:** P0

- `GEO-001`: Capture GPS coordinates, horizontal accuracy, and timestamp upon job completion.
- `GEO-002`: Handle Android/Capacitor location permissions gracefully with actionable user recovery.
- `GEO-003`: Server-side geofence validation comparing completion coordinates against society/address coordinates.
- `GEO-004`: Configurable distance tolerance (e.g., 250m for open locations, relaxed for basement structures).
- `GEO-005`: Detection of mock locations / fake GPS apps on staff mobile devices.
- `GEO-006`: Fallback mechanism when cleaner is in deep basement parking (B2/B3) with no GPS lock.
- `GEO-007`: Prohibit background continuous staff tracking (privacy and battery conservation).
- `GEO-008`: Store geo-verification audit trail on the `dcms_job_executions` record.

## 4.8 Vehicle Photo and Media Lifecycle
**Requirement IDs:** `MEDIA-001` to `MEDIA-012` | **Priority:** P0

- `MEDIA-001`: Direct-to-storage or buffered upload via private Cloudinary / S3 bucket.
- `MEDIA-002`: Immediate stripping of client EXIF metadata (camera serial, personal metadata).
- `MEDIA-003`: Server-side watermark stamping (Date, Time, City, Vehicle Number, Job ID).
- `MEDIA-004`: Automatic image compression and thumbnail generation (WebP format).
- `MEDIA-005`: Secure signed URLs for image viewing with maximum 1-hour expiration.
- `MEDIA-006`: Strict authorization check before issuing media URLs (customer can only see own vehicle photos).
- `MEDIA-007`: Configurable retention policy (e.g., 30 days default for daily cleaning photos).
- `MEDIA-008`: Automated background purge worker deleting expired photo binaries and database records.
- `MEDIA-009`: Legal/dispute retention hold flag preventing automated purge for contested jobs.
- `MEDIA-010`: Complete deletion of derivative thumbnails and CDN cache purge on deletion.
- `MEDIA-011`: Strict MIME-type and magic-number file validation rejecting non-image payloads.
- `MEDIA-012`: Zero binary blobs stored directly in PostgreSQL database columns.

## 4.9 Admin Portal & Multi-Tenant Scoping
**Requirement IDs:** `ADMIN-001` to `ADMIN-015` | **Priority:** P0/P1

- `ADMIN-001`: Multi-city administrative console with global vs. city-filtered view switcher.
- `ADMIN-002`: City management CRUD (activation, boundaries, contact details, operating hours).
- `ADMIN-003`: Society and tower registry management interface.
- `ADMIN-004`: City-service availability matrix toggles (enable/disable services per city).
- `ADMIN-005`: City-specific DCMS plan builder and pricing management.
- `ADMIN-006`: Staff roster, attendance, society assignment, and route planning UI.
- `ADMIN-007`: Live operational daily cleaning board (Real-time progress, Completed, Pending, Exceptions).
- `ADMIN-008`: Customer and vehicle directory with city and society filters.
- `ADMIN-009`: Invoice and billing management with legal entity selection.
- `ADMIN-010`: Media retention and compliance management dashboard.
- `ADMIN-011`: City-specific promotional banner and homepage content editor.
- `ADMIN-012`: Role-Based Access Control (RBAC) ensuring City Admins cannot access other cities.
- `ADMIN-013`: Comprehensive audit log recording all administrative modifications.
- `ADMIN-014`: Daily operational reports exportable to Excel/CSV by city.
- `ADMIN-015`: System health and background queue telemetry overview.
- `ADMIN-016`: Dedicated Admin Payment Ledger and Financial Reconciliation Dashboard with multi-filter, summary metrics, auto-refresh, transaction details drawer, and CSV export.

## 4.10 Advertisement & Promotional Placements
**Requirement IDs:** `ADS-001` to `ADS-008` | **Priority:** P1

- `ADS-001`: Dynamic banner placements on Customer Homepage, Services List, and Dashboard.
- `ADS-002`: City-targeted banner scheduling (e.g., Noida-specific welcome campaign).
- `ADS-003`: Audience eligibility rules (new customer, active subscriber, expired subscriber).
- `ADS-004`: Secure destination link validation (internal app deep-link or sanitized external URL).
- `ADS-005`: Lightweight impression and click tracking without third-party tracking scripts.
- `ADS-006`: Safe ad banner asset storage and CDN delivery.
- `ADS-007`: Strict zero-PII exposure guarantee: No customer identifiers shared with advertisers.
- `ADS-008`: Admin interface for creating and scheduling city banners (replacing hardcoded hero copy).

## 4.11 Security, Privacy & Data Isolation
**Requirement IDs:** `SEC-001` to `SEC-025` | **Priority:** P0

- `SEC-001`: Strict token validation and session lifecycle management.
- `SEC-002`: Anti-brute force and rate limiting on OTP verification and login endpoints.
- `SEC-003`: Universal tenant/city authorization middleware on all protected API routes.
- `SEC-004`: Comprehensive IDOR protection on booking, subscription, customer, vehicle, and invoice endpoints.
- `SEC-005`: Input sanitization and parameterized SQL queries (preventing SQL injection via Drizzle).
- `SEC-006`: Strict Content Security Policy (CSP), CORS allowlist, and security HTTP headers.
- `SEC-007`: Safe file upload validation preventing malicious script execution.
- `SEC-008`: Environment secret hygiene (no API keys, tokens, or credentials exposed to client bundles).
- `SEC-009`: Least-privilege PostgreSQL user roles.
- `SEC-010`: Defense-in-depth PostgreSQL Row Level Security (RLS) policies where applicable.
- `SEC-011`: Immutable audit logging for security-sensitive administrative operations.
- `SEC-012`: Automated vulnerability scanning of npm/pnpm dependencies.
- `SEC-013`: Data privacy controls compliant with Indian Digital Personal Data Protection (DPDP) Act.
- `SEC-014`: Secure database backup and verified point-in-time restore procedure.
- `SEC-015`: Zero client-side trust: all business rules, prices, and permissions validated server-side.
- `SEC-016` to `SEC-020`: Mobile API security and token protection (OWASP MASVS compliance).
- `SEC-021`: Evidence capture and exploit documentation for validation gate bypass (`POST /api/bookings`).
- `SEC-022`: Automated regression test proving exploit vulnerability prior to patch.
- `SEC-023`: Server-side remediation enforcing mandatory `serviceId` resolution and city check.
- `SEC-024`: Post-patch regression verification confirming authorized calls succeed and bypass fails.
- `SEC-025`: Formal security sign-off before closing security advisory.

---

# 10A. Residential Society, Tower and Parking Domain

**Requirement IDs:** `SOC-001` through `SOC-010` | **Priority:** P0 for Noida operations

Noida and Delhi NCR daily vehicle cleaning operations predominantly take place inside gated high-rise residential societies. City, sector, and GPS coordinates alone are insufficient for a cleaner to locate a car parked in basement B2, pillar 45, Tower C.

```
City (e.g. Noida)
  └── Sector / Zone (e.g. Sector 78)
        └── Residential Society (e.g. Supertech Capetown)
              ├── Tower / Wing (e.g. Tower 14, Wing B)
              │     └── Flat / Unit (e.g. Flat 904 - Optional)
              └── Parking Location (e.g. Basement B2, Bay 114, Near Pillar P-42)
```

### Requirements

- `SOC-001` — **Society Registry:** Normalized `residential_societies` table linked to `cities.id` and optional `service_areas.id`.
- `SOC-002` — **Service Availability Link:** A society must inherit city service availability and validate active CWP operational coverage.
- `SOC-003` — **Tower/Wing Hierarchy:** Normalized or structured tower/wing definitions per society.
- `SOC-004` — **Flat/Unit Identification:** Customer flat/unit number for delivery, emergency verification, and customer contact.
- `SOC-005` — **Structured Parking Bay Details:** Mandatory capture of Parking Level (Ground, Stilt, B1, B2, B3), Bay/Slot Number, and Landmark/Pillar.
- `SOC-006` — **Customer Address Flow:** Society auto-complete/picker in customer app, with graceful fallback to manual entry for unlisted societies.
- `SOC-007` — **Staff Job Navigation Card:** Prominent display of Society, Tower, Parking Level, and Bay on staff daily cleaning job cards.
- `SOC-008` — **Society Security & Gate Access Notes:** Storage of society-specific entry protocols (guard gate procedure, cleaning timings) visible to assigned staff.
- `SOC-009` — **Society Cluster Route Optimization:** Grouping of staff daily job batches by society and tower for operational efficiency.
- `SOC-010` — **Data Quality & Privacy:** Residential details treated as sensitive customer data; access restricted strictly to assigned cleaners during active shift.

---

# 10B. Legal Entity, GST and Invoice Series

**Requirement IDs:** `LEG-001` through `LEG-010` | **Priority:** P0 for Multi-City Billing

A city is an operational geography, not inherently an independent tax or legal entity. Billing and GST compliance must be governed by authorized legal entities (company-operated or franchisee).

```
Legal Entity / Billing Profile (e.g. CWP Clean Wheels Pvt Ltd / Franchisee LLP)
  ├── Registered Business Name, Trade Name & Address
  ├── State Code & Valid GSTIN (e.g. 09BYWPS9468R3ZG)
  ├── Tax Calculation Scheme (CGST + SGST vs. IGST based on Place of Supply)
  └── Independent Sequential Invoice Series (e.g. CWP/NOIDA/24-25/0001)
```

### Requirements

- `LEG-001` — **Legal Entity Registry:** Normalized `legal_entities` / `billing_profiles` table storing legal name, registered address, GSTIN, PAN, state code, and contact email/phone.
- `LEG-002` — **Entity Mapping:** Relational mapping linking branches and cities to their authorized legal billing profile.
- `LEG-003` — **GSTIN Validation:** Server-side validation of 15-character Indian GSTIN format and state code verification.
- `LEG-004` — **Dynamic Invoice Issuer Details:** Invoices dynamically pull issuer legal details from the assigned profile instead of singleton Varanasi constants.
- `LEG-005` — **Independent Invoice Series:** Maintain isolated, gapless, sequential numbering per legal entity and fiscal year (e.g., `CWP/VNS/24-25/0001` vs `CWP/NOIDA/24-25/0001`).
- `LEG-006` — **Concurrency-Safe Sequence Generation:** Transactional locking / PostgreSQL sequence allocation preventing duplicate invoice numbers under concurrent bookings.
- `LEG-007` — **Fiscal Year Transition:** Automatic rollover of invoice numbering sequences on April 1st without altering past issued invoices.
- `LEG-008` — **Tax Calculation Engine:** Correct computation of Place of Supply (POS), SAC codes (e.g., 998714 for car cleaning), CGST/SGST (intra-state) vs. IGST (inter-state).
- `LEG-009` — **Franchisee Billing Mode:** Support for franchise-billed vs. company-billed models, ensuring proper legal issuer representation.
- `LEG-010` — **Billing Immutability & Audit:** Issued invoices stored as immutable snapshots; corrections executed strictly via compliant credit/debit notes.

---

# 10C. Security Exploit Validation and Remediation Gate

**Requirement IDs:** `SEC-021` through `SEC-025` | **Priority:** P0 (Launch Blocker)

### Verified Exploit Analysis (SEC-021)

- **Vulnerability Title:** City Service Availability Validation Gate Bypass via Missing `serviceId` in Booking Creation.
- **Vulnerability Class:** CWE-840: Business Logic Validation Bypass / Missing Authorization Check.
- **Affected Endpoint:** `POST /api/bookings` (`artifacts/api-server/src/routes/bookings.ts`).
- **Affected Validator:** `artifacts/api-server/src/lib/coverage/validators/ServiceValidator.ts`.

#### Code Evidence & Flaw Mechanics

In `artifacts/api-server/src/routes/bookings.ts` (lines 71–115):
```typescript
const {
  serviceId,
  serviceType,
  bookingType,
  scheduledDate,
  timeSlot,
  vehicleId,
  serviceLocationId,
  notes,
  requiresWater,
  requiresElectricity,
} = req.body;

// ... resolves customer city from serviceLocationId ...

// VULNERABLE VALIDATION GATE:
if (serviceId) {
  const isAvailable = await ServiceValidator.isServiceAvailableInCity(
    serviceId,
    city
  );
  if (!isAvailable) {
    return res.status(400).json({
      error: `Service is not available in ${city}`,
      code: "SERVICE_UNAVAILABLE_IN_CITY",
    });
  }
}
// If serviceId is omitted, validation block is completely SKIPPED!
// Booking creation proceeds directly to db.insert(bookingsTable)!
```

#### Exploit Payload (Reproduction)
An attacker or malicious client targeting a Noida service location sends:
```http
POST /api/bookings HTTP/1.1
Host: 127.0.0.1:8080
Authorization: Bearer <Customer_Token>
Content-Type: application/json

{
  "serviceType": "ceramic_coating",
  "scheduledDate": "2026-11-20",
  "timeSlot": "10:00 AM - 01:00 PM",
  "vehicleId": 1,
  "serviceLocationId": 42
}
```
*(Where `serviceLocationId: 42` is in Noida, where Ceramic Coating is strictly prohibited).*

**Result:** Because `serviceId` is undefined, `if (serviceId)` evaluates to `false`. The validation is bypassed, and a confirmed booking for Ceramic Coating is created in Noida!

#### Remediation Implemented (`SEC-022` to `SEC-023`, `CWP-029`)
1. **SEC-022 (Automated Regression Suite):** Created `artifacts/api-server/src/__tests__/security/booking-city-bypass.test.ts` testing 7 required scenarios:
   - **Test 1 — Exploit Reproduction:** Prohibited `ceramic_coating` in Noida omitting `serviceId` is rejected with HTTP 400 and `code: "SERVICE_UNAVAILABLE_IN_CITY"`.
   - **Test 2 — Explicit `serviceId` Bypass:** Prohibited `serviceId: 5` (Ceramic Coating) in Noida is rejected with HTTP 400 and `code: "SERVICE_UNAVAILABLE_IN_CITY"`.
   - **Test 3 — Service Type Manipulation:** Attempting to pair `serviceId: 1` (Car Wash) with `serviceType: "ceramic_coating"` is rejected with HTTP 400 and `code: "SERVICE_TYPE_MISMATCH"`.
   - **Test 4 — Legitimate Noida Daily Car Cleaning:** Submitting Daily Car Cleaning in Noida with valid DCMS plan contract succeeds with HTTP 201 Created.
   - **Test 5 — Varanasi Regression:** Valid Car Wash booking in Varanasi succeeds with HTTP 201 Created without disruption to legacy operations.
   - **Test 6 — Missing / Invalid Service Identification:** Submitting non-existent `serviceId: 999999`, unresolvable `serviceType`, or missing service identifiers is safely rejected with HTTP 400 and `code: "INVALID_SERVICE"`.
   - **Test 7 — Zero Side Effects on Rejection:** Verified that 0 booking rows were inserted, 0 queue bridge tasks were scheduled, and 0 timeline events were emitted on rejected requests.
2. **SEC-023 (Authoritative Server-Side Service Resolution & Mandatory City Availability Gate):**
   - Created authoritative service resolution service `artifacts/api-server/src/lib/booking/services/ServiceResolutionService.ts` (`resolveAuthoritativeService`, `checkServiceTypeMatch`, `findServiceByType`, `mapServiceToBookingType`).
   - Hardened `ServiceValidator.ts` (`artifacts/api-server/src/lib/coverage/validators/ServiceValidator.ts`) to fail-closed (`result.halt("SERVICE_UNAVAILABLE", "SERVICE_UNAVAILABLE_IN_CITY")`) whenever `serviceId` is missing for booking requests, and strictly validate city availability against `ServiceAvailabilityRepository`.
   - Updated `BookingService.ts` to derive `effectiveServiceId` server-side before coverage validation, ensuring both `bookingValidationPolicy` and `bookingCreationPolicy` operate on the authoritative service catalog.
   - Updated `POST /api/bookings` in `artifacts/api-server/src/routes/bookings.ts` to catch `BookingCoverageError` with `SERVICE_UNAVAILABLE_IN_CITY` and return HTTP 400 with `{ error: "Service is not available in <City>", code: "SERVICE_UNAVAILABLE_IN_CITY" }`.
3. **Evidence:** 7/7 automated tests passing in `booking-city-bypass.test.ts`, 30/30 test suites passing across `@workspace/api-server` (292 tests total), and esbuild bundle verified.

---

# 11. Traceability & Verified Requirement Status Matrix

| Req ID | Requirement Title | Category | Priority | Status | Verified Code References / Evidence | Required Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CITY-001** | Cities Registry & Slug | Multi-City | P0 | **Done** | `lib/db/src/schema/cities.ts` (`citiesTable`), `cities.ts` route | Table exists; need to standardize FK links |
| **CITY-002** | City Service Availability | Multi-City | P0 | **Done** | `lib/db/src/schema/service-city-availability.ts`, `ServiceValidator.ts`, `ServiceResolutionService.ts` | Authoritative server-side resolution, fail-closed city availability validation |
| **CITY-003** | City-Specific Pricing & Plans | Multi-City | P0 | **Done** | `CityAvailabilityMatrix.tsx`, `serviceCityAvailabilityTable` | City-specific price overrides with immediate cache invalidation |
| **CITY-004** | Service Coverage & Pincodes | Multi-City | P0 | **Done** | `service-areas.ts`, `pincodes.ts`, `CoverageValidator.ts` | Residential societies linked to cities and service areas |
| **CITY-005** | City Content & Banners | Multi-City | P0 | **Done** | `promotionsTable`, `PromotionsManager.tsx`, `MarketingHero.tsx` | City-targeted campaigns and dynamic marketing copy |
| **CITY-006** | Config Inheritance Hierarchy | Multi-City | P0 | **Planned** | Missing resolver logic | Build `Branch → City → Global` resolver |
| **CITY-007** | Strict Disabled Service Rule | Multi-City | P0 | **Done** | `ServiceValidator.ts`, `routes/bookings.ts`, `booking-city-bypass.test.ts` | Fail-closed validation gate completely blocks disabled city services |
| **CITY-008** | Booking City Validation Gate | Multi-City | P0 | **Done** | `booking-city-bypass.test.ts`, `ServiceResolutionService.ts` | 7 automated tests verified, HTTP 400 `SERVICE_UNAVAILABLE_IN_CITY` |
| **CITY-009** | Configuration Cache Invalidation | Multi-City | P0 | **Done** | `serviceAvailabilityRepo.ts`, `admin/availability` routes | Invalidation hook clears cache on matrix updates |
| **CITY-010** | City Admin Scoping | Multi-City | P0 | **Done** | `tenantScope.ts`, `adminNavConfig.ts` | City filtering and tenant scoping across admin routes |
| **CUST-001** | City Selection State | Customer | P0 | **Done** | `useSelectedAddress`, `Dashboard.tsx` | Resolves city from selected address/geolocation with fallback, binds to dynamic services grid & marketing hero |
| **CUST-004** | Address Determines Eligibility | Customer | P0 | **Done** | `CoverageValidator.ts`, `ServiceValidator.ts` | Enforced strictly across all booking routes with city availability validation |
| **CUST-006** | Noida Launch: DCMS Only | Customer | P0 | **Done** | `ServicesGrid.tsx`, `useCityCatalogServices`, `MarketingHero.tsx` | Dynamically filters catalog for Noida to Daily Car Cleaning only; Varanasi preserves all 6 services; city copy dynamic |
| **CUST-012** | Multi-Address & Society | Customer | P0 | **Done** | `ServiceLocationForm.tsx`, `service-locations.ts` | Complete society picker, tower selector, flat number, parking level, and parking bay integration |
| **CUST-013** | Multi-Vehicle Garage | Customer | P0 | **Done** | `vehicles.ts` (`vehiclesTable`) fully implemented | Maintain existing working model |
| **CUST-016** | Cashfree PG Hosted Checkout | Customer | P0 | **Done** | `cashfreeService.ts`, `routes/cashfree.ts`, `CustomerPaymentReviewDialog.tsx`, `PaymentReturn.tsx` | Full Cashfree Hosted Checkout integration with resilient returnUrl normalization, webhook HMAC validation, server verification, billing ledger reconciliation, and 149 passing assertions |
| **CUST-020** | Customer IDOR Protection | Customer | P0 | **Done** | `bookings.ts`, `vehicles.ts` check `customerId = req.user.id` | Retain universal ownership filters |
| **SVC-001** | Service Catalog Schema | Services | P0 | **Done** | `services.ts`, `service-categories.ts` | Maintain normalized schema |
| **SVC-002** | Workflow Engine per Service | Services | P0 | **Planned** | Daily cleaning vs Detailing mixed | Separate DCMS daily route from one-off detailing |
| **SVC-004** | City Service Catalog API | Services | P0 | **Done** | `routes/services.ts`, `serviceCityAvailabilityTable` | `GET /api/services?citySlug=...` returns active city services with `basePriceOverride`; verified in unit tests |
| **STAFF-001** | Staff Auth & Scoping | Staff | P0 | **Done** | `tenantScope.ts`, `SCOPE_COLS`, `bookings.ts` | Strictly scopes staff access to authorized cities (`cityCol: bookingsTable.cityId`) and assigned routes |
| **STAFF-002** | Daily Society Route List | Staff | P0 | **Done** | `dailyRouteService.ts`, `StaffDailyRouteSimplified.tsx` | Joins `residentialSocietiesTable` and `societyTowersTable`; displays society, tower, flat, and parking bay on cleaner cards |
| **STAFF-006** | Daily Cleaning Execution UX | Staff | P0 | **Done** | `StaffDailyRouteSimplified.tsx`, `dcms_job_executions` | Cleaned-karein dialog, high-contrast society & slot badge, map navigation link |
| **STAFF-010** | Idempotent Job Completion | Staff | P0 | **Done** | `dcms.ts` handles unique constraint on daily execution | Preserve idempotency checks |
| **JOB-001** | Auto-Assignment by Society | Operations | P0 | **Planned** | Current assignment is manual or single-cleaner | Build society cluster auto-assigner |
| **JOB-007** | Push Queue & Retry Fallback | Operations | P0 | **Done** | BullMQ + PostgreSQL fallback in `push_notification_logs` | Verified working in `queue.ts` |
| **NOTIF-001** | Operational Notification Engine | Operations | P0 | **Done** | `dispatcher.ts`, `bookings.ts`, `visitService.ts`, `assignmentService.ts`, `subscriptionService.ts` | Multi-channel event dispatcher with deterministic deduplication; delivers alerts for booking confirmation, staff assignment, visit completion, and car-not-available exceptions |
| **GEO-001** | GPS Capture on Completion | Geolocation | P0 | **Done** | `dcms_job_executions.latitude/longitude` | Verified in schema and execution routes |
| **GEO-003** | Geofence Validation & Basement Tolerance | Geolocation | P0 | **Done** | `geoFence.ts`, `visitService.ts`, `operational-lifecycle.test.ts` | Tuned +250m tolerance for residential society campus and underground parking basements (B1/B2/B3); handles GPS deadzones (`GEO-006`); 11/11 tests passing |
| **GEO-006** | Deep Basement GPS Fallback | Geolocation | P0 | **Done** | `geoFence.ts`, `visitService.ts`, `routes/dcms.ts`, `operational-exceptions.test.ts` | Graceful GPS loss `(0, 0)` fallback for deep B2/B3 garages with audit reason requirement; 12/12 unit tests passing |
| **MEDIA-001** | Private Media Storage | Media | P0 | **Done** | Cloudinary integration in `cloudinaryStorage.ts` | Private bucket & signed delivery verified |
| **MEDIA-003** | Automated Watermarking | Media | P0 | **Done** | `watermark.ts` applies timestamp & branding | Preserved |
| **MEDIA-007** | Media Retention & Purge | Media | P0 | **Done** | `mediaRetentionService.ts`, `routes/dcms.ts`, `SocietiesPage.tsx`, migration 067 | 30-day routine photo retention worker, dry-run & live purge controls, and dispute retention hold support; 12/12 unit tests passing |
| **ADMIN-001** | Multi-City Admin Switcher | Admin | P0 | **Done** | `adminNavConfig.ts`, `SocietiesPage.tsx`, `Bookings.tsx`, `CityAvailabilityMatrix.tsx` | City filters and context across all operational admin modules |
| **ADMIN-008** | Multi-City Booking Operations UI | Admin | P0 | **Done** | `Bookings.tsx`, `routes/bookings.ts` | City and Society filter dropdowns, search across customer/phone/society/ID, and prominent Society, Tower, and Parking Bay badges in table and drawer |
| **ADMIN-004** | City-Service Toggle Grid | Admin | P0 | **Done** | `CityAvailabilityMatrix.tsx`, `ProductsAndPlans.tsx` | Visual matrix table for services (rows) vs cities (columns), Active/Disabled switches, price overrides popover, disable confirmation, live cache invalidation |
| **ADMIN-016** | Admin Payment Ledger | Admin | P0 | **Done** | `PaymentLedgerPage.tsx`, `admin-ledger.ts`, `TransactionDetailsDrawer.tsx` | Dedicated payment ledger at `/admin/payments/ledger` with 7 IST summary metric cards, 30s auto-refresh, search & filter toolbar, streaming CSV export, and raw payload audit drawer; 40/40 assertions passing |
| **ADS-001** | Dynamic Banner Engine | Marketing | P1 | **Done** | `promotionsTable`, migration 066, `routes/promotions.ts`, `PromotionsManager.tsx`, `MarketingHero.tsx` | Configurable city-targeted banners, homepage hero slots, campaign dates, CTR metrics, atomic click tracking, 5/5 automated unit tests |
| **SEC-003** | Universal Tenant Middleware | Security | P0 | **Done** | `tenantScope.ts` | Updated `tenantFilters`, `tenantStamp`, `sqlTenant`, and `rowInScope` for `cityCol` isolation |
| **SEC-021** | Booking City Bypass Audit | Security | P0 | **Done (Verified)** | Confirmed in `POST /api/bookings` | Exploit verified and reproduced via automated test |
| **SEC-022** | Bypass Regression Test | Security | P0 | **Done** | `artifacts/api-server/src/__tests__/security/booking-city-bypass.test.ts` | 7 automated regression tests passing (exploit reproduction, explicit serviceId, service type manipulation, Noida DCMS success, Varanasi regression, invalid service, zero side effects) |
| **SEC-023** | Validation Gate Patch | Security | P0 | **Done** | `ServiceResolutionService.ts`, `ServiceValidator.ts`, `routes/bookings.ts` | Authoritative server-side resolution, fail-closed city validation, HTTP 400 `SERVICE_UNAVAILABLE_IN_CITY` |
| **CWP-029** | Phase 0 Booking City Validation Security Fix | Security & Architecture | P0 | **Done** | `ServiceResolutionService.ts`, `ServiceValidator.ts`, `booking-city-bypass.test.ts` | Closed city validation bypass vulnerability; proved non-bypassability with automated regression suite |
| **SOC-001** | Residential Societies Table | Society | P0 | **Done** | `lib/db/src/schema/societies.ts`, `routes/societies.ts`, `SocietiesPage.tsx` | Schema created with `residentialSocietiesTable` and `societyTowersTable`; migration 064; 8 API unit tests; Admin Societies CRUD UI with tower management |
| **SOC-005** | Structured Parking Bay Data | Society | P0 | **Done** | `service-locations.ts`, `ServiceLocationForm.tsx` | Added `societyId`, `towerId`, `flatNumber`, `parkingLevel`, `parkingBay`, `parkingNotes` to DB schema & customer address form |
| **SOC-007** | Staff Job Society Display | Society | P0 | **Done** | `dailyRouteService.ts`, `StaffDailyRouteSimplified.tsx` | Joined societies & towers in staff daily route API; high-contrast society & parking slot badge rendered on cleaner cards |
| **LEG-001** | Legal Entity / Billing Schema | Billing | P0 | **Done** | `lib/db/src/schema/legal-entities.ts`, migration 065, `LegalEntitiesManager.tsx` | Normalized `legal_entitiesTable`, `invoice_number_sequencesTable`, branch & franchisee mappings, Admin Legal Entities management tab |
| **LEG-004** | Dynamic Invoice Issuer Data | Billing | P0 | **Done** | `legalEntityService.ts`, `invoicePdfGenerator.ts`, `invoices.legal_entity_snapshot` | Invoices capture immutable legal entity snapshot at creation; PDF generator renders entity GSTIN/PAN/bank/address with fallback |
| **LEG-005** | Isolated Invoice Number Series| Billing | P0 | **Done** | `invoice_number_sequences`, `legalEntityService.ts`, `legal-entities.test.ts` | Concurrency-safe atomic invoice sequence generation (`INSERT ... ON CONFLICT DO UPDATE SET current_value = current_value + 1`), distinct series per entity; 5/5 unit tests passed |
| **CWP-023** | Fix Branches ↔ Franchisees FK | Architecture | P0 | **Done** | `branches.ts`, `franchisees.ts`, migration 064 | Normalized schema, resolved circular FK dependency |
| **CWP-024** | Backfill City IDs | Architecture | P0 | **Done** | `migration 064`, `schema/*.ts` | Added `cityId` to `branches`, `franchisees`, `customers`, `service_locations`, `dcms_plans`, `dcms_subscriptions` |
| **CWP-025** | Local Dev API Proxy & Base URL Isolation | Architecture | P0 | **Done** | `apiConfig.ts`, `.env`, `apiConfig.test.ts` | Local web on localhost/127.0.0.1 routes to relative `/api` proxy; tests pass; browser login verified |
| **CUST-016** | Online Payment Gateway (Cashfree PG) | Billing & Customer | P0 | **Done** | `payment_attempts`, `cashfreeService.ts`, `cashfreeWebhook.ts`, `CustomerPaymentReviewDialog.tsx`, `PaymentReturn.tsx` | Full Cashfree Hosted Web Checkout integration, raw-body HMAC-SHA256 signature verification, strict server-side amount derivation, atomic ledger reconciliation, 149/149 passing automated tests, browser QA verified |
| **ADMIN-016** | Admin Payment Ledger & Reconciliation Dashboard | Billing & Admin | P0 | **Done** | `routes/admin-ledger.ts`, `PaymentLedgerPage.tsx`, `TransactionDetailsDrawer.tsx`, `admin-ledger.test.ts` | Dedicated `/admin/payments/ledger` page, 7 summary metric cards in IST, multi-filters, real-time auto-refresh (30s), transaction drawer with raw payloads, CSV export, RBAC enforcement, 40/40 tests passing |
| **CUST-017** | In-App Invoice PDF Download & Direct Navigation Auth | Customer & Billing | P0 | **Done** | `sessionCookie.ts`, `downloadInvoicePdf.ts`, `CommercialOperationsCenter.tsx`, `auth-regression.test.ts` | Multi-portal session cookie fallback on direct browser navigation without `x-auth-portal` header; query token/portal support; Commercial Operations drawer upgraded to `InvoicePdfButton`; explicit credentials inclusion; 26/26 unit tests passed |
| **SEC-024** | Basement Geofence Fallback Security Hardening | Security & Geolocation | P0 | **Done** | `geoFence.ts`, `visitService.ts`, `operational-exceptions.test.ts` | Strict fail-closed validation for degraded / 0,0 GPS: street coordinates strictly rejected; underground completions require valid reason code (`underground_basement_no_signal`, etc.) and photo evidence; automatically flags `requiresAudit: true` and logs operational exception for supervisor triage |
| **EXC-001** | Daily Cleaning Operational Exception Management | Operations | P0 | **Done** | `dcms_operational_exceptions`, migration 067, `exceptionService.ts`, `routes/dcms.ts`, `SocietiesPage.tsx` | Full lifecycle for Car Not Available (CNA), vehicle moved bay, gate access denied, staff unavailable, missed cleaning, customer complaints, reclean requests, basement audits; atomic resolution actions (`grant_makeup_credit`, `reassign_staff`, `schedule_reclean`, `dismiss`) with customer notifications |
| **DASH-002** | Society Daily Operations Hub & Cleaner Route Tracking | Operations & Admin | P0 | **Done** | `societyOperationsService.ts`, `SocietiesPage.tsx` | Real-time society-level operational dashboard: total active subscriptions, completed vs pending, CNA rates, cleaner route performance breakdown, open exception badges, multi-city filtering, 15s auto-polling |
| **DCMS-010** | DCMS Subscription Lifecycle (Cancel & Expiring Subscriptions) | Operations & Subscriptions | P0 | **Done** | `subscriptionService.ts`, `routes/dcms.ts` | Graceful subscription cancellation (`POST /api/daily-cleaning/subscriptions/:id/cancel`) deactivating active assignments; expiring/inactive query API (`GET /api/daily-cleaning/subscriptions/expiring`) for low-balance (<3 cleanings) renewals |

---

# 12. Prioritized Implementation Roadmap

### Phase 0 — Core Architecture, Foreign Key Fixes & Security Gate (P0)
- **Goal:** Fix schema integrity, resolve circular foreign keys, eliminate the security bypass in booking creation, and standardize `cityId` across all primary tables.
- **Deliverables:**
  1. Fix circular FK between `branches` and `franchisees`.
  2. Add `cityId` integer foreign keys to `branches`, `customers`, `service_locations`, and `dcms_plans`.
  3. Write reproduction test `booking-city-bypass.test.ts` for `SEC-021`.
  4. Patch `POST /api/bookings` validation gate to mandate city availability checks for all services (`SEC-023`).
  5. Add `requireCityScope` middleware for tenant isolation.

### Phase 1 — Society, Tower, and Parking Hierarchy (P0 for Noida)
- **Goal:** Enable high-rise residential society mapping for Noida daily car cleaning.
- **Deliverables:**
  1. Create `residential_societies` and `society_towers` schema and migrations.
  2. Extend `customer_addresses` with `societyId`, `tower`, `flat`, `parkingLevel`, `parkingBay`, and `parkingNotes`.
  3. Update customer address UI with searchable society picker and parking bay inputs.
  4. Update Admin Portal with Society Management CRUD.

### Phase 2 — Multi-City Service Engine & Dynamic Customer Catalog (P0)
- **Goal:** Deliver true configuration-driven service availability, ensuring Noida exposes ONLY Daily Car Cleaning.
- **Deliverables:**
  1. Update `GET /api/catalog/services` to filter strictly by `cityId`.
  2. Implement city-specific pricing and vehicle tier multipliers in `dcmsPlansTable`.
  3. Refactor customer frontend (`ServicesGrid.tsx`, `ProductDetail.tsx`) to consume dynamic catalog API instead of `cwp-products-data.ts`.
  4. Remove hardcoded Varanasi copy from `MarketingHero.tsx` and connect to dynamic city content API.

### Phase 3 — Staff Daily Cleaning Operations UX (P0)
- **Goal:** Optimize staff daily cleaning workflow for Noida residential societies.
- **Deliverables:**
  1. Update staff job query to include society, tower, parking level, and bay details.
  2. Enhance `StaffJobs.tsx` with high-contrast parking location cards.
  3. Streamline single-tap before/after photo submission and offline queue sync.
  4. Add geofence tolerance for underground parking basements (B1/B2/B3).

### Phase 4 — Legal Entity, GST, and Independent Invoice Series (P0)
- **Goal:** Ensure legal and GST compliance across Varanasi, Noida, and future franchise branches.
- **Deliverables:**
  1. Create `legal_entities` table and map branches/cities to legal entities.
  2. Implement concurrency-safe, entity-specific invoice series generator (`CWP/VNS/24-25/0001` vs `CWP/NOIDA/24-25/0001`).
  3. Replace singleton `invoiceBillingSettings.ts` with dynamic legal entity resolution.
  4. Verify GST Place of Supply (POS) and SAC code tax calculation.

### Phase 5 — Promotional Placements, Media Retention & Admin Enhancements (P1/P2)
- **Goal:** Long-term platform scalability, promotional banners, and compliance automation.
- **Deliverables:**
  1. Dynamic homepage banner engine (`promotionsTable`) with city targeting.
  2. Automated 30-day photo retention purge worker with dispute retention hold.
  3. Admin Portal multi-city switcher and city-service availability matrix UI.
  4. Backward compatibility verification suite ensuring zero regression in Varanasi operations.

---

# 13. Change Log

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-11-12** | 0.1 | Architecture Team | Initial PRD baseline created from Project Noida requirements. Captured multi-city scope, staff operations, media lifecycle, security, roadmap, and living PRD operating rule. |
| **2026-11-12** | 0.2 | Architecture Team | Added Sections 9A (Audit Sync), 10A (Residential Society Domain), 10B (Legal Entity/GST Series), 10C (Security Exploit Validation Gate). |
| **2026-11-12** | 0.3 | Engineering Team | **Canonical Repository Installation (`docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`)**. Completed full codebase audit against live repository. Verified circular FKs, missing `cityId` on DCMS plans, hardcoded Varanasi frontend components, and captured exact code evidence and exploit payload for `SEC-021` validation bypass. Created 45-point verified requirement traceability matrix. |
| **2026-11-12** | 0.4 | Engineering Team | **Fixed Local Web Dev API Proxy & Base URL Isolation (`CWP-025`)**. Resolved issue where `VITE_API_URL` pointed to Railway production in `.env`, causing localhost browser fetches to `/api/*` (`/api/branding`, `/api/healthz`, `/api/auth/login`) to bypass the local API server and trigger CORS preflight `ERR_FAILED` errors. Updated `apiConfig.ts` to enforce relative proxy paths during localhost web development, added Vitest coverage in `apiConfig.test.ts`, and verified end-to-end admin login via browser subagent. |
| **2026-11-12** | 0.5 | Engineering Team | **Complete Cashfree Payment Gateway Integration & Return Flow (`CUST-016`)**. Delivered full end-to-end Cashfree Hosted Web Checkout for customer dashboard and invoices dues settlement. Created `payment_attempts` table with unique indexes and idempotency keys, implemented backend order creation (`POST /api/payments/cashfree/create-order`), raw request body HMAC-SHA256 signature verification (`POST /api/webhooks/cashfree`), and server-side verification (`GET /api/payments/cashfree/verify/:orderId`). Implemented atomic billing ledger reconciliation updating invoices, customer dues, and payment records. Built customer UI journey including `CustomerPaymentReviewDialog`, `/customer/payment/return` return flow, and admin payment visibility. Executed 149-assertion automated test suite with 100% pass rate. Verified via browser QA. |
| **2026-11-12** | 0.6 | Engineering Team | **Phase 0 Booking City Validation Security Fix & Regression Test (`SEC-021`, `SEC-022`, `SEC-023`, `CWP-029`)**. Resolved critical vulnerability where omitting `serviceId` and providing `serviceType` allowed booking prohibited services in Noida. Implemented authoritative service resolution service (`ServiceResolutionService.ts`), hardened `ServiceValidator.ts` to fail-closed on missing serviceId in booking context, updated `BookingService.ts` to resolve `effectiveServiceId` before policy execution, and mapped `SERVICE_UNAVAILABLE_IN_CITY` to HTTP 400. Implemented full automated regression suite in `booking-city-bypass.test.ts` covering exploit reproduction, explicit serviceId bypass, service type manipulation, Noida Daily Car Cleaning success, Varanasi regression, missing/invalid service, and zero side effects on rejection. 7/7 tests passed; 30/30 API test suites passed (292 tests total). |

| **2026-11-12** | 0.7 | Engineering Team | **Multi-City Foundation, Residential Societies & Dynamic Customer Discovery (`SOC-001`, `SOC-005`, `SOC-007`, `CUST-001`, `CUST-006`, `SVC-004`, `STAFF-002`, `CWP-023`, `CWP-024`, `SEC-003`)**. Delivered full residential society hierarchy (`residentialSocietiesTable`, `societyTowersTable`, migration 064). Backfilled normalized `cityId` across branches, franchisees, customers, service locations, and DCMS plans. Implemented Society CRUD and tower management APIs (`/api/societies`, `/api/societies/:id/towers`) with 8 automated unit tests. Built dedicated Admin Societies Management page (`/admin/societies`) with city filtering and tower management sheet. Connected customer `ServicesGrid` and `MarketingHero` to dynamic city catalog, restricting Noida to Daily Car Cleaning while preserving all 6 services in Varanasi. Integrated society, tower, flat, and parking bay selection into customer `ServiceLocationForm`. Enriched staff daily route API and `StaffDailyRouteSimplified` with prominent high-contrast society and parking slot badges. All 31 test suites (300 tests total) passing; esbuild and Vite production builds passing with zero errors. |
| **2026-11-12** | 0.8 | Engineering Team | **Fixed In-App Invoice PDF Download & Direct Browser Navigation Authentication (`CUST-017`, `SEC-004`)**. Resolved issue where opening invoice PDF links (`/api/invoices/:id/pdf`) in a browser tab returned `{"error":"Authentication required"}` (401). Root cause: top-level browser navigations do not send custom HTTP headers (`X-Auth-Portal`), and `listSessionTokens` previously only fell back to the legacy cookie rather than inspecting portal-scoped cookies (`cwp_session_admin`, `cwp_session_customer`, `cwp_session_staff`, `cwp_session_franchisee`). Updated `sessionCookie.ts` to iterate all active portal cookies when no portal header is present, added query portal and token support. Upgraded `CommercialOperationsCenter` drawer invoice PDF action from a raw anchor to `InvoicePdfButton` with loading indicators, and enforced `credentials: "include"` in `downloadInvoicePdf`. Added automated regression tests in `auth-regression.test.ts`. Verified with 26/26 tests passing, esbuild API server build, and Vite production bundle. |
| **2026-11-12** | 0.9 | Engineering Team | **Billing & Legal Entity Architecture, City-Service Availability Matrix & City-Targeted Promotions Engine (`LEG-001`, `LEG-004`, `LEG-005`, `ADMIN-004`, `ADS-001`)**. Delivered: (1) Full `legal_entities` & `invoice_number_sequences` architecture (migrations 065 & 066). Explicit mapping between operational branches and issuing legal entities. Atomic concurrency-safe invoice sequence generation via PostgreSQL `INSERT ... ON CONFLICT DO UPDATE SET current_value = current_value + 1 RETURNING current_value` eliminating duplicate invoice numbers. Immutable `legal_entity_snapshot` JSON on invoices preserving historical tax/entity fidelity. Admin Legal Entities Management UI (`LegalEntitiesManager.tsx`) with branch mapping and default toggles, plus explicit entity selection in `CreateInvoiceDialog`. (2) Admin City-Service Availability Matrix (`CityAvailabilityMatrix.tsx`, `ADMIN-004`) with interactive service-by-city switches, city price override popovers, disable confirmation dialogs, and instant coverage cache invalidation without code deployments. (3) City-Targeted Promotions & Banner Engine (`promotionsTable`, `routes/promotions.ts`, `PromotionsManager.tsx`, `ADS-001`) featuring dynamic homepage slots, city-targeted campaigns, impression and atomic click tracking, live CTR reporting, and customer `MarketingHero.tsx` dynamic integration eliminating hardcoded city banners. Verified across 33 test suites (311 tests passing), with clean `@workspace/db`, API server esbuild, and Vite production builds. |
| **2026-11-12** | 0.10 | Engineering Team | **Admin Payment Ledger & Financial Reconciliation Dashboard (`ADMIN-016`, `CUST-016`)**. Delivered dedicated Admin Payment Ledger at `/admin/payments/ledger` with responsive navigation, 7 top dashboard summary cards in IST (Today Collected, Today Txns, This Month Collected, Pending, Failed, Total Collected, Outstanding Dues), dense transaction table with copyable Cashfree Order IDs, IST timestamps, and action buttons. Implemented real-time 30s auto-refresh polling via TanStack React Query (`refetchInterval: 30000`, background pause, manual refresh with spin indicator, Last Updated timestamp). Built full-featured `TransactionDetailsDrawer` with customer details, payment identifiers, invoice link, copy buttons, and collapsible raw gateway verification/webhook JSON payloads for forensic auditing. Created backend routes in `routes/admin-ledger.ts` (`/api/admin/payments/ledger`, `/summary`, `/export`, `/:id`) uniting settled payments and gateway attempts, with multi-filter (date presets, status, method, city, debounced search) and streaming CSV export. Enforced strict administrator RBAC. Implemented automated test suite in `admin-ledger.test.ts` with 40/40 assertions passing (100% pass rate). All migrations applied cleanly. |
| **2026-11-12** | 1.0 | Engineering Team | **End-to-End Operational Lifecycle, Basement Geofence Tolerance & Multi-City Booking Operations (`GEO-003`, `NOTIF-001`, `STAFF-001`, `ADMIN-008`, `CUST-012`)**. Delivered: (1) Tuned high-rise residential campus & underground basement parking geofence validation with +250m tolerance (`geoFence.ts`, `visitService.ts`) and graceful GPS loss `(0, 0)` fallback for deep B2/B3 garages (`GEO-006`). (2) Operational Notification Engine (`dispatcher.ts`) connecting booking confirmation (`notifyBookingConfirmed`), staff route/booking assignment (`notifyStaffAssigned`), visit completion (`notifyVisitCompleted`), and car-not-available exception alerts (`notifyCarNotAvailable`) with deterministic deduplication across customer and staff channels. (3) Multi-City Booking Engine (`routes/bookings.ts`): added `cityCol: bookingsTable.cityId` for tenant scoping, enriched queries and joins with `residentialSocietiesTable`, `societyTowersTable`, `serviceLocationsTable`, and `citiesTable`, supporting filtering by `cityId`, `societyId`, `serviceId`, and full-text search. (4) Customer `BookService.tsx` automatically binds one-time wash bookings to selected vehicle's society, parking level, and bay. (5) Admin Bookings UI (`Bookings.tsx`) upgraded with City and Society filter dropdowns, multi-field search, and high-contrast Society, Tower, and Parking Bay badges in table and drawer. Verified with 11 automated unit tests in `operational-lifecycle.test.ts`, 34/34 passing API test suites (322 tests total), and zero-error production builds for both API server and frontend platform. |
| **2026-11-12** | 1.1 | Engineering Team | **Cashfree Return URL Resilient Fallback & Production Deployment Hardening (`CUST-016`, `ADMIN-016`)**. (1) Resolved production Cashfree checkout failure on `cwpdetailers.in/customer/dashboard` where client returnUrl triggered `INVALID_RETURN_URL` error. Replaced brittle client-supplied return URL rejection with intelligent self-healing fallback to canonical `/customer/payment/return?order_id={order_id}` on any malformed, legacy, or omitted client input, preventing checkout failure while maintaining open-redirect defense. (2) Upgraded dynamic request origin resolution to enforce `https://` for production domains (`cwpdetailers.in`) to eliminate payment return redirect hops. (3) Promoted `tsx` from devDependencies to dependencies in `scripts/package.json` ensuring Railway `preDeployCommand` (`pnpm migrate:pending`) executes without dependency errors. (4) Enriched Admin Ledger API endpoints (`GET /summary`, `GET /ledger`) with structured error details for forensic observability. (5) Verified across 149 Cashfree PG test assertions (100% pass rate) and verified production builds for both API server (esbuild) and frontend platform (Vite). |
| **2026-11-12** | 1.2 | Engineering Team | **Customer Dues Reconciliation & Dashboard Consistency Fix (`CUST-016`, `BILL-001`, `ADMIN-016`)**. Resolved reported user discrepancy where customer dashboard showed "All Payments Clear" while `/customer/invoices` showed "Due ₹1,300" with invoice `CWP/26-27/1000` (status: sent). Root cause analysis revealed: (1) `GET /api/customers/:id/summary` crashed with HTTP 500 when sub-queries (`countActiveCustomerContracts` or booking metrics) encountered missing columns/unhandled exceptions on production, causing frontend `Dashboard.tsx` to default `pendingDues` to 0 without fallback. (2) Fixed backend `GET /api/customers/:id/summary` by safely wrapping all analytics in independent try/catch blocks and authoritatively calculating `pendingDues` from `getCustomerOutstandingDues` with fallback to `customer.totalDues` and open invoices. (3) Hardened `getCustomerOutstandingDues` to coalesce `balanceDue` and `dueAmount` across both modern and legacy invoices. (4) Updated `Dashboard.tsx` to intelligently fallback to `customerQuery.data?.totalDues` if `summaryQuery` is absent. (5) Updated `Invoices.tsx` to explicitly exclude `paid` and `cancelled` invoices from `totalDue` and suppress "Pay Now" on settled items. (6) Mounted `adminLedgerRouter` in API server routes index. (7) Added `ensureStartupMigrations()` running on server startup to idempotently ensure tables (`residential_societies`, `legal_entities`, `invoice_number_sequences`, `promotions`, `payment_attempts`) and columns (`bookings.city_id`, `bookings.service_location_id`) are always provisioned. Verified with automated test suites (`billing-dues-reconciliation.test.ts`, `admin-ledger.test.ts`), esbuild API build, and Vite production bundle. |

---

# 14. Project Tracking Instructions for AI Agents and Contributors

For every future task under the CWP Detailers project:

1. **Read this PRD before proposing or implementing changes.**
2. **Find and reuse relevant requirement IDs (`CITY-*`, `CUST-*`, `SVC-*`, `STAFF-*`, `JOB-*`, `GEO-*`, `MEDIA-*`, `ADMIN-*`, `ADS-*`, `SEC-*`, `SOC-*`, `LEG-*`, `CWP-*`).**
3. If a new requirement is introduced, assign a stable ID and register it in Section 11.
4. Mark items `In Progress` when implementation starts.
5. **Mark an item `Done` only after its acceptance criteria have been verified with concrete automated tests or observable evidence.**
6. Do not assume prior assistant statements are proof of implementation. Inspect live repository files and test results.
7. Record the actual changes, affected modules, migration notes, and verification evidence in this PRD in the same work cycle.
8. **Keep this canonical PRD synchronized with the actual codebase at all times.**
