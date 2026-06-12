# CWP Detailers — Forensic Architecture Audit

**Date:** June 12, 2026  
**Auditor:** AI Architect (codebase forensic review)  
**Scope:** Full-stack audit — no code changes, no schema changes, no feature implementation  
**Reference business:** Varanasi operations (Doorstep Wash · Daily Cleaning · Solar Cleaning · Partner model)

---

## Executive Summary

The codebase is **not greenfield**. It is a **feature-rich MVP skeleton** with a unusually complete backend (20 route modules, 25 DB tables, RBAC, multi-tenant scoping, subscription scheduler, billing, CRM). The **admin portal is largely production-capable**. The **customer and staff portals are structurally built but functionally broken for real users** due to hardcoded demo IDs.

**Verdict:** **Option B — Retain architecture with targeted refactoring.**  
Do **not** rewrite. Fix portal wiring, harden auth/storage/deploy, and fill 6–8 targeted gaps for Varanasi MVP.

| Category | Count |
|---|---|
| Production-ready modules | 8 |
| Partial (needs enhancement) | 14 |
| Completely missing | 11 |
| Dead / premature (do not build for MVP) | 7 |

---

## 1. Current System Overview

### 1.1 Repository Structure

```
CWPDETAILERS/                    pnpm monorepo (TypeScript 5.9, Node 24)
├── lib/
│   ├── db/                      Drizzle ORM — 25 schema modules, push-only (no migrations/)
│   ├── api-spec/openapi.yaml    Contract-first API (~3100 lines, partial coverage)
│   ├── api-zod/                 Generated Zod validators (Orval)
│   └── api-client-react/        Generated React Query hooks (Orval)
├── artifacts/
│   ├── api-server/              Express 5 REST API (port 8080)
│   ├── cwp-platform/            React 19 + Vite 7 production frontend
│   └── mockup-sandbox/          UI prototyping artifact (not production)
└── scripts/                     seed.ts, seed-permissions.ts, dev.mjs
```

**Deployment today:** Replit-oriented (GCS sidecar object storage, `.replit-artifact/`). No `render.yaml`, no `.env.example`.

### 1.2 Existing Modules

| Module | Backend | Admin UI | Customer UI | Staff UI | Franchisee UI |
|---|---|---|---|---|---|
| Auth & sessions | ✅ | ✅ | ✅ | ✅ | ✅ |
| RBAC permissions | ✅ | ✅ | — | — | partial |
| Customers | ✅ | ✅ | ⚠️ demo IDs | — | view only |
| Vehicles | ✅ | via customers | ⚠️ demo | — | — |
| Solar sites | ✅ | via customers | ❌ no self-add | — | — |
| Services catalog | ✅ | ✅ | ✅ list | view | view |
| Bookings | ✅ | ✅ | ⚠️ demo | ⚠️ demo | ✅ branch-scoped |
| Subscriptions | ✅ | ✅ | ⚠️ view only | — | view |
| Staff + verification | ✅ | ✅ | — | ⚠️ demo | read-only list |
| Attendance | ✅ | — | — | ⚠️ demo | — |
| Invoices & payments | ✅ | ✅ | ⚠️ demo | — | view |
| Complaints | ✅ | ✅ | ⚠️ demo | — | — |
| Notifications | ✅ in-app | ✅ | ❌ no page | ❌ no page | ❌ route missing |
| CRM / Leads | ✅ | ✅ | — | — | ✅ |
| Franchisees | ✅ | ✅ | — | — | self |
| Churned customers | ✅ | ✅ | — | — | ✅ |
| Quotations | ✅ | ✅ | — | — | — |
| Expenses | ✅ | ✅ | — | — | — |
| Billing dues | ✅ | ✅ | — | — | view |
| Analytics | ✅ | ✅ | — | performance | dashboard |
| Object storage | ✅ Replit GCS | ✅ | ✅ upload hooks | ✅ | — |
| Landing page | public API | ✅ basic | — | — | — |

### 1.3 Existing Workflows

#### Booking lifecycle (implemented in API)
```
pending → confirmed → scheduled → en_route → in_progress → completed
                              ↘ cancelled / rescheduled / missed
```
- State machine enforced in `POST /bookings/:id/transition`
- Audit trail in `booking_events` (status_change, proof_upload, reassign, reschedule, cancel, note)
- Staff assignment via `POST /bookings/:id/assign` (requires verified staff)
- Proof photos via `POST /bookings/:id/proof` (append to `proofPhotoUrls` JSON array)
- `beforePhotoUrl` / `afterPhotoUrl` columns exist but are **separate from proof flow**
- On completion with `subscriptionId`: atomic transaction decrements subscription counters

#### Subscription lifecycle (implemented in API)
```
active → paused / expiring → expired / cancelled / missed
```
- Pause / resume / cancel endpoints exist
- `runDailyTick()` runs: mark missed bookings, renewal reminders, expiring/expired status updates
- **Does NOT auto-create daily cleaning bookings** (critical gap)

#### Staff onboarding (implemented)
```
Create staff (pending) → Admin verify → Create login account → Assign to bookings
```
- Franchisee account creation also implemented

#### Customer registration (implemented)
```
POST /auth/register → users + customers rows → link userId ↔ customerId → issue session
```
- Registration flow is **correct** at API level; frontend ignores `user.customerId`

#### Billing (implemented)
```
Booking/subscription → Invoice (GST line items) → Payment record → PDF export
```
- Manual payment recording (cash, UPI, wallet enum values)
- No Razorpay integration (enum placeholder only)
- Wallet balance field on customer; **no wallet debit/credit transaction logic**

### 1.4 Existing User Roles

| Role | DB enum | Portal path | Scope |
|---|---|---|---|
| `superadmin` | ✅ | `/admin/*` | All companies/branches |
| `admin` | ✅ | `/admin/*` | Company-scoped (Tushar) |
| `manager` | ✅ | `/admin/*` (limited) | Single branch ops |
| `franchisee` | ✅ | `/franchisee/*` | City partner — branch + franchiseeId |
| `staff` | ✅ | `/staff/*` | Own bookings + attendance |
| `customer` | ✅ | `/customer/*` | Own data only |

**Permission matrix:** Seeded in `scripts/src/seed-permissions.ts` — 17 resources × 5 actions.  
**Ghost resources in RBAC (no schema/API/UI):** `inventory`, `settings`, `permissions` (admin UI).

### 1.5 Existing Database Entities (25 tables)

| Table | Primary purpose |
|---|---|
| `companies` | Multi-tenant root (underused — seed skips it) |
| `users` | Login accounts, role, linked staffId/customerId |
| `sessions` | Bearer token hashes, 30-day TTL |
| `permissions` | Role × resource × action matrix |
| `permission_overrides` | Per-user/role exceptions |
| `branches` | City branches (Varanasi, Lucknow, Kanpur in seed) |
| `customers` | Profiles, walletBalance, totalDues, GSTIN |
| `vehicles` | Customer cars (make/model/reg/color) |
| `solar_sites` | Panel count, kW capacity, next service date |
| `services` | Global catalog, basePrice, category, assignmentStrategy |
| `subscriptions` | Plans: daily_wash, monthly_wash, solar_amc, detailing_plan |
| `staff` | Field workers, KYC docs, verificationStatus, monthlySalary |
| `bookings` | Job records, geo coords, proof photos, recurrence |
| `booking_events` | Audit log with optional lat/lng on events |
| `attendance` | Staff daily present/absent/late/half_day |
| `complaints` | Customer complaints with resolution workflow |
| `invoices` | GST invoices with JSON line items |
| `payments` | Payment records with reversal support |
| `quotations` | Quote builder → convert to invoice/booking |
| `expenses` | Branch expense tracking |
| `notifications` | In-app (+ channel enum: whatsapp/email/sms — undelivered) |
| `franchisees` | Partner records, agreements, bank details |
| `leads` | CRM pipeline with follow-ups |
| `lead_activities` | Lead timeline |
| `lead_ingestion_log` | Webhook ingestion audit |
| `system_jobs` | Background job idempotency (daily_tick) |

**Critical schema characteristic:** No Drizzle `relations()` or `.references()` FK constraints. All relationships are **implicit integer columns only**. This allows orphan rows and complicates joins but does not block MVP.

---

## 2. Database Audit

### 2.1 Per-Table Analysis

#### Core tenancy

| Table | Purpose | Current usage | Multi-city | Customer self-service | Franchise ops |
|---|---|---|---|---|---|
| **companies** | Tenant root, GSTIN | Schema exists; **seed never populates**; companyId nullable everywhere | ⚠️ Designed but unused | N/A | N/A |
| **branches** | City operations unit | Active — 3 cities seeded | ✅ Yes | ❌ Customer picks branch at register only | ✅ franchiseeId column exists |
| **franchisees** | City partner | API + admin UI + franchisee portal | ✅ branchId link | N/A | ✅ Full CRUD + create-account |

#### Identity & access

| Table | Purpose | Multi-city | Customer SS | Franchise |
|---|---|---|---|---|
| **users** | Auth accounts | branchId on user | ✅ customer role | ✅ franchisee role |
| **sessions** | Token store | N/A | ✅ | ✅ |
| **permissions** | RBAC | N/A | partial (customer perms) | ✅ franchisee matrix |
| **permission_overrides** | Exceptions | Rarely used | — | — |

#### Customer domain

| Table | Purpose | Multi-city | Customer SS | Franchise | Gaps |
|---|---|---|---|---|---|
| **customers** | Profile + wallet + dues | branchId, franchiseeId | ✅ register creates row | ✅ scoped | No home/car lat-lng; no referralCode |
| **vehicles** | Cars | branchId scoped | ⚠️ API exists, UI demo | view | **No assignedStaffId** for daily cleaning mapping |
| **solar_sites** | Installations | branchId scoped | ❌ no customer UI to add | view | No per-panel rate snapshot; no inverterId |

#### Catalog & pricing

| Table | Purpose | Multi-city | Gaps |
|---|---|---|---|
| **services** | Service catalog | ❌ **Global basePrice only** — no branchId column | No addon linkage; no package validity fields; no min billing (solar ₹800) |

#### Operations

| Table | Purpose | Multi-city | Customer SS | Franchise | Gaps |
|---|---|---|---|---|---|
| **subscriptions** | Recurring plans | branchId | view/create API | manage | No Wednesday-off rule; no wallet debit on service; totalServices often null in seed |
| **bookings** | Jobs | branchId + lat/lng | create/view API | full ops | No geo-fence flag; before/after not enforced; no addon junction |
| **booking_events** | Audit | scoped via booking | view via booking | view | locationLat/lng captured but never validated |
| **staff** | Workforce | branchId required | N/A | manage | No serviceTypes[]; no perJobRates; no petrol policy |
| **attendance** | Time tracking | via staff.branchId | N/A | view | No geo check-in |

#### Financial

| Table | Purpose | Multi-city | Gaps |
|---|---|---|---|
| **invoices** | Billing | branchId | Duplicate amount fields (dueAmount + balanceDue); no auto-generation trigger on booking complete |
| **payments** | Collections | branchId | razorpay enum unused; no wallet_transactions ledger |
| **quotations** | Pre-sale quotes | branchId | Not in MVP scope |
| **expenses** | OpEx | branchId | Not in MVP scope |

#### CRM & comms

| Table | Purpose | Multi-city | Gaps |
|---|---|---|---|
| **leads** + **lead_activities** | CRM | branchId + city field | Not in MVP scope |
| **lead_ingestion_log** | Webhook audit | — | Unused without integrations |
| **notifications** | Alerts | branchId | **Delivery not implemented** — records only, channel defaults in_app |
| **complaints** | Support tickets | branchId | ✅ adequate for MVP |

#### System

| Table | Purpose | Usage |
|---|---|---|
| **system_jobs** | Job idempotency | daily_tick only |

### 2.2 Duplicate Concepts

| Duplication | Details | Recommendation |
|---|---|---|
| **Photo storage on bookings** | `proofPhotoUrls[]` (used by staff UI) vs `beforePhotoUrl` / `afterPhotoUrl` (schema + OpenAPI, unused in staff flow) | **Refactor:** Standardize on before/after fields; migrate proof endpoint or map UI |
| **Invoice amount fields** | `dueAmount`, `balanceDue`, `paidAmount`, `totalAmount` — overlapping semantics | Clarify in billing service; don't redesign for MVP |
| **Dues tracking** | `customers.totalDues` + invoice `balanceDue` + billing `/dues` endpoint | Keep invoice as source of truth; derive customer dues |
| **Staff role enums** | `users.role = staff` vs `staff.role = technician/supervisor/...` | Retain — different concepts (login role vs job function) |
| **Subscription types vs booking serviceType** | `subscription_type` enum ≠ full `booking_service_type` enum | Map explicitly in booking generator (missing today) |
| **Admin pages vs features/** | 3 pages re-export to `features/`; rest inline in `pages/` | Continue gradual migration — not blocking |

### 2.3 Dead / Premature Tables & RBAC Resources

| Item | Status |
|---|---|
| `inventory` permission resource | **Dead** — no table, API, or UI |
| `settings` permission resource | **Dead** — no admin settings pages |
| `permissions` admin UI | **Dead** — matrix only via seed script |
| `companies` table | **Underused** — never seeded; all rows have null companyId |
| `lead_ingestion_log` | **Premature** — no webhook consumers configured |
| `mockup-sandbox` artifact | **Non-production** — separate Vite app |

### 2.4 Missing Relationships (Logical, Not FK)

| Missing link | Business need | Impact |
|---|---|---|
| `vehicles.assignedStaffId` | Daily cleaning: car mapped to staff | **High** — core daily ops model unsupported |
| `vehicles.parkingLat/Lng` | Car location ≠ home address | **High** — staff navigation |
| `services ↔ branches` pricing | City-wise rates | **Medium** — Varanasi-only MVP can defer |
| `bookings ↔ addon_services` | Waxing, windshield treatment | **Low for MVP** |
| `staff ↔ serviceTypes` | Staff qualified for wash/solar/daily | **Medium** — manual assignment works for MVP |
| `subscriptions ↔ recurrence off-days` | Wednesday off | **High** — daily cleaning accuracy |
| `customers.userId` on seed customers | Demo customers have no login | **Medium** — seed issue, not schema |

### 2.5 Scalability Concerns

| Concern | Severity | Notes |
|---|---|---|
| No FK constraints | Medium | Orphan rows possible; app-layer must enforce |
| No migration history | High | `drizzle-kit push` only — risky for production deploys |
| No DB indexes beyond sessions + permissions | Medium | bookings by date/staff/customer will slow at scale |
| `optionalAuth` never rejects bad tokens | Low | Safe default; invalid tokens silently ignored |
| SHA-256 + static salt passwords | **Critical** | Must fix before public launch |
| Replit GCS coupling | **Critical** | Blocks Render/any non-Replit host |
| OpenAPI drift (~30% routes undocumented) | Medium | Leads, franchisees, churned, billing, quotations, expenses, auth extras |
| Daily tick doesn't generate bookings | **Critical** | Manual booking creation required for daily cleaning |
| Raw SQL in analytics | Low | Acceptable at Varanasi scale |
| Serial integer PKs | Low | Fine for MVP; UUIDs later if multi-region |

---

## 3. Business Alignment Audit

### 3.1 Doorstep Car Wash

| Requirement | Current state | Gap |
|---|---|---|
| Single wash booking | ✅ `serviceType: car_wash`, booking flow | Customer UI uses demo ID |
| Wash packages (N washes / validity) | ⚠️ `subscriptions.totalServices`, `servicesRemaining` | No dedicated package UX; counters often unset in seed |
| Addons (wax, windshield) | ❌ | No addon table or booking junction |
| City-wise pricing | ❌ | Global `services.basePrice` only |
| GST inclusive display | ⚠️ | GST computed additive in `lib/gst.ts` — display logic inconsistent |
| Staff accepts job | ⚠️ | Admin assigns; no staff "accept" flow |
| Before/after photos | ⚠️ | Schema ✅; staff uses `proofPhotoUrls` not before/after split |
| Customer notification on complete | ⚠️ | No auto-notification on transition to completed |

**Alignment score: 45%** — backend foundation solid; product flows incomplete.

### 3.2 Daily Car Cleaning

| Requirement | Current state | Gap |
|---|---|---|
| Monthly/wallet subscription | ⚠️ | `walletBalance` field exists; **no debit on service completion** |
| Car mapped to staff | ❌ | No `assignedStaffId` on vehicles |
| Staff daily car list | ⚠️ | Staff sees bookings by staffId — works if bookings pre-created |
| Wednesday off | ❌ | No off-day rules in recurrence |
| Auto-generate daily bookings | ❌ | **Daily tick does NOT create bookings** |
| Wash due reminders (included washes) | ❌ | No wash quota tracking separate from daily clean |
| Payment reminder on low balance | ❌ | No automated wallet threshold alerts |
| Manager reassignment for a day | ⚠️ | Admin can reassign booking; no "override for date X" model |
| Geo-fence at car location | ❌ | lat/lng on booking exists; no validation |

**Alignment score: 25%** — largest business gap. Schema hints at intent; automation missing.

### 3.3 Solar Panel Cleaning

| Requirement | Current state | Gap |
|---|---|---|
| One-time cleaning booking | ✅ | `serviceType: solar_cleaning`, solarSiteId on booking |
| Per-panel pricing (₹60, min ₹800) | ❌ | Flat `services.basePrice` (seed: ₹1499 flat) |
| Slab pricing by panel count | ❌ | Not modeled |
| AMC 6/12 month packages | ⚠️ | `subscription_type: solar_amc` exists | Customer AMC dashboard missing |
| Track cleanings done/remaining | ⚠️ | `servicesUsed` / `servicesRemaining` on subscription | Not exposed in customer UI |
| Before/after per cleaning | ⚠️ | Same as car wash photo gap |
| kW before/after | ❌ | Future — correctly absent |

**Alignment score: 40%** — booking + subscription skeleton exists; pricing model wrong.

### 3.4 Multi-City Operations

| Requirement | Current state | Gap |
|---|---|---|
| Branch per city | ✅ | branches.city, branchId on all entities |
| Tenant isolation | ✅ | `tenantScope.ts` middleware — well implemented |
| City-specific pricing | ❌ | services table has no branch override |
| Patna launch ready | ⚠️ | Architecture supports; seed has Lucknow/Kanpur not Patna |
| Super admin creates partner | ✅ | Franchisee CRUD + create-account |
| Partner manages city ops | ✅ | Franchisee portal: bookings, staff, leads, churned |

**Alignment score: 65%** — best-aligned area architecturally.

### 3.5 Partner Model (Type 1 — City Partner)

| Requirement | Current state | Gap |
|---|---|---|
| Tushar creates partner + staff | ✅ | Admin franchisee + staff + credentials pages |
| Partner manages leads | ✅ | Franchisee leads page (691-line admin clone) |
| Partner handles complaints | ⚠️ | Admin complaints; franchisee has no complaints page |
| Partner assigns bookings | ✅ | Franchisee bookings with assign |
| Payment to admin (not partner) | ✅ | No partner settlement logic — correct for current phase |
| Partner finances | ❌ | Correctly deferred |

**Alignment score: 70%** for Type 1 MVP (Varanasi = Tushar as admin, partner portal optional at launch).

### 3.6 Cross-Cutting Business Requirements

| Requirement | Status |
|---|---|
| Coupon codes | ❌ Missing |
| Payment gateway | ❌ Enum only |
| SMS / WhatsApp / Email delivery | ❌ Channel enum; in_app records only |
| SEO landing page | ⚠️ Basic landing with live services API |
| Testimonials on site | ⚠️ Likely static/hardcoded in landing |
| WhatsApp chat widget | ❌ |
| Staff per-job payment | ❌ monthlySalary only |
| Staff document verification | ✅ verificationStatus + admin approval flow |
| Customer complaint → city admin resolve | ✅ API + admin UI |
| PWA installable | ❌ No vite-plugin-pwa |

---

## 4. Core Engine Audit

### 4.1 Customer Engine

**Status: PARTIAL**

| Component | Ready | Partial | Missing |
|---|---|---|---|
| Registration + login | ✅ API links userId↔customerId | | |
| Profile (name, phone, email, address) | ✅ | city only — no map pin | |
| Vehicle CRUD | ✅ API | UI doesn't use auth ID | |
| Solar site CRUD | ✅ API | | Customer UI |
| Wallet balance display | | ✅ dashboard reads summary | Debit/credit logic |
| Self-service booking | ✅ API | UI hardcoded customerId=1 | |
| History + photos | | ✅ History page reads before/after | Demo ID |
| Invoices view | | ✅ | Demo ID |
| Complaints | | ✅ | Demo ID |
| Subscription view | | ✅ dashboard | No monthly calendar |

**Justification:** Backend and tenant scoping are production-grade. Frontend customer portal is a **demo shell** — every page hardcodes `customerId = 1`. Registration API is correct; wiring is ~1 day of work.

### 4.2 Asset Engine (Vehicles + Solar Sites)

**Status: PARTIAL**

| Ready | Partial | Missing |
|---|---|---|
| Vehicle CRUD with make/model/reg/color | solar_sites panelCount, panelCapacityKw | Vehicle parking location (lat/lng) |
| | lastCleanedDate, nextServiceDate on solar | assignedStaffId for daily cleaning |
| | | Separate home vs car address |
| | | Solar slab pricing snapshot at booking time |

**Justification:** Tables cover 70% of data model. Operational mapping (staff↔car) and geolocation for field work are absent.

### 4.3 Booking Engine

**Status: PARTIAL (backend near-ready)**

| Ready | Partial | Missing |
|---|---|---|
| Full state machine with validation | Transition + assign + reschedule + events | Auto-assignment (round_robin enum unused) |
| Tenant-scoped CRUD | Recurrence via regenerate-occurrences | Auto daily booking generation |
| Proof photo upload endpoint | before/after columns | Geo-fence enforcement |
| Subscription counter sync on complete | | Completion → invoice auto-generation |
| | Staff mobile UI | Customer booking → staff notification |

**Justification:** `bookings.ts` (432 lines) is the strongest module. Missing pieces are automation and field-validation layers, not core CRUD.

### 4.4 Subscription Engine

**Status: PARTIAL**

| Ready | Partial | Missing |
|---|---|---|
| CRUD + pause/resume/cancel | daily_wash / solar_amc types | Wallet integration |
| Counter decrement on completion | frequencyDays, nextDueDate recompute | Wednesday / off-day rules |
| Daily tick (missed, renewal, expiry) | servicesRemaining check constraint | **Booking auto-generation from active subs** |
| system_jobs idempotency | | Wash-quota tracking (2 washes/month) |
| | | Balance-low pause logic |

**Justification:** Scheduler infrastructure exists (`runDailyTick`, IST helpers, transactional completion). The **highest-value missing piece** is generating tomorrow's daily cleaning bookings from active subscriptions + staff mapping.

### 4.5 Billing Engine

**Status: PARTIAL**

| Ready | Partial | Missing |
|---|---|---|
| Invoice CRUD with GST line items | PDF generation (pdfkit) | Auto-invoice on booking complete |
| Payment recording + reversal | Wallet as payment method enum | Wallet transaction ledger |
| Dues dashboard | customers.totalDues field | Automated payment reminders |
| Quotation → convert | | Razorpay |
| GST compute helper | GST **inclusive** display (business req) | Coupon discounts |

**Justification:** Manual billing (matching current billbook workflow) can work for MVP if admin creates invoices. Auto-billing on completion is P1 enhancement.

### 4.6 Workforce Engine

**Status: PARTIAL**

| Ready | Partial | Missing |
|---|---|---|
| Staff CRUD + KYC fields | Verification workflow | Per-job compensation config |
| Attendance API + UI | monthlySalary field | Petrol policy (included vs per-km) |
| Performance + leaderboard | Staff roles (technician, solar_technician) | Staff earnings / payable dashboard |
| Create login account | Today's jobs for staffId | Service-type qualification matrix |
| Assign to booking (verified only) | Mobile-friendly layout exists | Geo-validated check-in |

**Justification:** HR/onboarding path is complete. Compensation and field-operations validation are future scope for MVP.

### 4.7 Notification Engine

**Status: PARTIAL (storage only)**

| Ready | Partial | Missing |
|---|---|---|
| notifications table with types/channels | In-app notification CRUD | SMS delivery (MSG91) |
| Missed service → in_app record | Renewal reminder → in_app record | WhatsApp templates |
| Admin broadcast POST | | Email (Resend) |
| | | Push / PWA notifications |
| | | Trigger on booking confirmed/complete |
| | | Customer preference management |

**Justification:** Notification **records** are created by subscription service. No dispatcher sends outside the database. MVP requires at least one external channel (SMS or WhatsApp) for operational reliability.

### 4.8 CRM Engine

**Status: READY (backend) / PARTIAL (frontend)**

| Ready | Partial | Missing |
|---|---|---|
| Full leads pipeline + activities | Admin 691-line Leads page | **Not in MVP scope** |
| Convert lead → customer/booking/sub | Franchisee leads clone | Website lead capture form |
| Lead stats + follow-ups API | Raw fetch (not in OpenAPI/codegen) | |
| Ingest endpoint | | |

**Justification:** Complete for post-MVP. Do not prioritize for Varanasi MVP launch.

---

## 5. MVP Readiness Report

**MVP definition (strict):** Varanasi operations with customer portal, staff portal, daily cleaning, doorstep wash, solar cleaning, before/after photos, notifications, invoicing. **Nothing else.**

### 5.1 P0 — Launch Blockers (must fix before any real customer uses the system)

| # | Item | Current state | Effort |
|---|---|---|---|
| P0-1 | **Customer portal uses `customerId = 1` everywhere** | 5 customer pages hardcoded | 0.5 day |
| P0-2 | **Staff portal uses `staffId = 1` everywhere** | 4 staff pages hardcoded | 0.5 day |
| P0-3 | **Password hashing insecure** (SHA-256 + static salt) | `lib/passwords.ts` | 1 day (+ migration) |
| P0-4 | **Object storage tied to Replit GCS** | Photo upload breaks off Replit | 1–2 days (Cloudinary/S3) |
| P0-5 | **No deployment configuration** | Cannot go live | 1 day (Render + env) |
| P0-6 | **Before/after photo flow not standardized** | Staff uses proofPhotoUrls; schema has before/after | 1–2 days |
| P0-7 | **Daily cleaning cannot run without manual booking creation** | Daily tick doesn't generate bookings | 3–4 days |
| P0-8 | **No external notification delivery** | in_app only — customers won't see alerts | 2–3 days (MSG91 SMS minimum) |
| P0-9 | **Customer cannot add vehicles/solar sites after register** | BookService assumes vehicles exist | 1–2 days (profile wizard) |
| P0-10 | **Seed/demo data not linked to logins** | Real registration works but demo seed customers have no userId | 0.5 day (fix seed for Varanasi pilot) |

### 5.2 P1 — Required Soon After Launch (first 2–4 weeks of operations)

| # | Item | Rationale |
|---|---|---|
| P1-1 | Vehicle ↔ staff mapping for daily cleaning | Core ops model |
| P1-2 | Wallet debit on daily service completion | Matches "jitna recharge utna kaam" |
| P1-3 | Payment reminder when wallet low | Business requirement |
| P1-4 | Auto-invoice on booking completion | Reduces manual billbook work |
| P1-5 | Solar AMC customer progress view | AMC customers need self-service visibility |
| P1-6 | Solar per-panel pricing (₹60/panel, min ₹800) | Current flat price wrong |
| P1-7 | Wednesday off-day in scheduling | Daily cleaning accuracy |
| P1-8 | OpenAPI sync for undocumented routes | Prevents frontend/API drift |
| P1-9 | Drizzle migrations (replace push-only) | Production safety |
| P1-10 | `.env.example` + setup documentation | Onboarding / Patna prep |
| P1-11 | Completion notification to customer | Operational expectation |
| P1-12 | Staff mobile UX polish (thumb targets, camera capture) | Field usage |

### 5.3 P2 — Scale Features (post-MVP, pre-Patna)

| Item | Notes |
|---|---|
| City-wise pricing overrides | Needed for Patna, not Varanasi-only |
| Razorpay payment gateway | Online payments |
| Coupon system | Marketing |
| Addon services (wax, windshield) | Revenue uplift |
| Geofencing validation | Fraud prevention — **not in MVP list** |
| PWA (vite-plugin-pwa) | Mobile install — planned but not MVP |
| CRM / Leads module | Already built; enable when sales scales |
| Franchisee complaints page | Partner ops completeness |
| Staff earnings module | When per-job staff join |
| Churned customer re-engagement | Already built |
| Quotations builder | B2B solar quotes |
| Analytics deep dive | Business intelligence |
| Auto staff assignment | round_robin enum exists |

### 5.4 P3 — Future Features (explicitly NOT MVP)

| Item | Reason |
|---|---|
| Payment gateway subscriptions / auto-debit | Phase 2 |
| Solar IoT kW monitoring | Future per business plan |
| Staff training & exam module | Future |
| Type 2/3 partner models | Hypothetical |
| Partner revenue settlement | Deferred by owner |
| Hybrid mobile app (Capacitor/RN) | Post web/PWA |
| Inventory module | RBAC ghost resource |
| Multi-language Hindi UI | Scale |
| Referral / loyalty programs | Growth |
| AI route optimization | Scale |
| `mockup-sandbox` artifact | Design tool only |

### 5.5 MVP Feature Checklist (Strict Scope)

| MVP requirement | Ready? | Blocker |
|---|---|---|
| Customer portal (real users) | ❌ | P0-1, P0-9 |
| Staff portal (real users) | ❌ | P0-2 |
| Daily cleaning operations | ❌ | P0-7, P1-1 |
| Doorstep wash booking | ⚠️ | P0-1 (UI wiring) |
| Solar cleaning booking | ⚠️ | P0-1, P1-6 (pricing) |
| Before/after photos | ⚠️ | P0-6 |
| Notifications | ❌ | P0-8 |
| Invoicing | ⚠️ | Works in admin; customer view needs P0-1 |

**Estimated MVP readiness: 35%** — strong backend, broken customer/staff wiring, missing daily automation.

---

## 6. Architecture Recommendation

### **Recommendation: B — Retain Architecture with Refactoring**

Do **not** choose full redesign (D). Do **not** choose retain-as-is (A). Partial redesign (C) is unnecessary — the domain model is 80% correct.

#### What to RETAIN (high reuse value)

| Layer | Rationale |
|---|---|
| **pnpm monorepo structure** | Clean separation; works |
| **PostgreSQL + Drizzle ORM** | Schema matches business; 25 tables cover domain |
| **Express 5 API + route modules** | 20 modules, RBAC guards, tenant scoping — mature |
| **OpenAPI + Orval codegen** | Correct long-term pattern; fix drift, don't abandon |
| **React 19 + Vite + shadcn/ui** | Admin UI is polished; customer/staff shells reusable |
| **Wouter routing + AuthProvider** | Role guards work; fix ID wiring only |
| **Tenant scope middleware** | `tenantScope.ts` is well-designed — keep |
| **Booking state machine** | Correct transitions; extend, don't replace |
| **Subscription service + daily tick** | Extend to generate bookings, don't rewrite |
| **Staff verification flow** | Matches business onboarding |
| **Invoice/PDF pipeline** | Matches manual billbook replacement path |
| **Franchisee portal** | Ready for Patna; optional at Varanasi launch |

#### What to REFACTOR (targeted, not rewrite)

| Item | Action |
|---|---|
| Customer/staff portal ID wiring | Use `useAuth().user.customerId` / `staffId` |
| Photo upload flow | Unify on `beforePhotoUrl` + `afterPhotoUrl`; require both before complete |
| Password hashing | Migrate to argon2 |
| Object storage | Replace Replit GCS with Cloudinary or S3-compatible |
| OpenAPI spec | Add missing ~8 route groups; regenerate hooks |
| API client usage | Replace raw `fetch` in admin pages with generated hooks (gradual) |
| `features/` migration | Continue moving admin pages (non-blocking) |
| GST display | Implement inclusive pricing helper (price shown = final price) |
| Seed script | Varanasi-only realistic data with linked logins |

#### What to REDESIGN (small scoped additions, not platform rewrite)

| Item | Action |
|---|---|
| Daily cleaning scheduler | **New logic** in `subscriptions/service.ts`: generate bookings from active subs + staff map + off-days |
| Wallet ledger | **New table** `wallet_transactions` + debit on service |
| Vehicle-staff assignment | **New column** `vehicles.assignedStaffId` + admin assignment UI |
| Notification dispatcher | **New service** layer: write notification → dispatch to MSG91/Resend based on channel |
| Solar pricing calculator | **New function** in booking create: panelCount × rate with min ₹800 |

#### What to NEVER BUILD in MVP

- Geofencing / GPS validation
- Razorpay / online payments
- Coupon codes
- Addon services catalog
- CRM leads pipeline (already built — **disable/hide**, don't extend)
- Churned bulk SMS campaigns
- Quotation builder
- Expense tracking
- Analytics beyond basic dashboard
- Franchisee portal (if Tushar operates Varanasi solo — use admin only)
- Inventory module
- Partner financial settlement
- PWA / native app
- Solar IoT integration
- Staff training/exams
- Multi-city pricing admin (single city Varanasi rates sufficient)

#### Why NOT full redesign?

1. **~4,300 lines of API route logic** already implements the booking/subscription/billing state machines correctly.
2. **Tenant isolation** is implemented properly — rare in early-stage codebases.
3. **RBAC matrix** covers all roles including franchisee.
4. Rewriting would take 3–6 months; refactoring MVP blockers takes **3–4 weeks**.
5. Schema aligns with business entities (vehicles, solar_sites, subscriptions, franchisees) — gaps are **columns and jobs**, not wrong tables.

---

## 7. Implementation Roadmap

*Ordered for fastest path to production with maximum reuse. No code in this document.*

### Phase A — Unblock Production (Week 1)
**Goal:** Deployable, secure, storable

1. Create `.env.example` + Render `render.yaml` (API + static frontend + Postgres)
2. Replace Replit GCS with Cloudinary (or S3) in `objectStorage.ts`
3. Migrate password hashing to argon2 (+ re-hash on login or force reset)
4. Fix customer portal: replace all `customerId = 1` with `user.customerId`
5. Fix staff portal: replace all `staffId = 1` with `user.staffId`
6. Update seed script: Varanasi-only data, link demo customers/staff to user accounts
7. Smoke test: register → book → staff complete → view history

**Reuse:** 100% existing code; wiring fixes only.  
**Output:** Tushar can deploy and demo with real accounts.

### Phase B — MVP Core Flows (Week 2)
**Goal:** End-to-end Varanasi operations for 3 service lines

8. Customer profile wizard: add vehicle + address after registration
9. Standardize before/after photos in staff Dashboard (require before → start, after → complete)
10. Wire `PATCH /bookings/:id` to set `beforePhotoUrl` / `afterPhotoUrl` explicitly
11. Notification dispatcher: MSG91 SMS for booking confirmed + service complete (minimum)
12. Admin manual invoice creation flow verified + customer invoice view working
13. Solar booking: compute price from `panelCount × ₹60`, min ₹800 at booking create
14. Doorstep wash: verify package subscription creation from admin + customer booking

**Reuse:** Existing booking/subscription/invoice APIs; new dispatcher + pricing function only.

### Phase C — Daily Cleaning Automation (Week 3)
**Goal:** Daily car cleaning runs without manual booking entry

15. Add `vehicles.assignedStaffId` column + admin UI to map car → staff
16. Extend `runDailyTick()`: for each active `daily_wash` subscription:
    - Skip if Wednesday (configurable off-day)
    - Check wallet balance ≥ daily rate (or pause + notify)
    - Create `scheduled` booking for today with mapped staff
17. Wallet debit on daily booking completion
18. Low-balance notification (in_app + SMS when balance < 7 days)
19. Staff morning job list shows auto-generated daily cleans first

**Reuse:** Existing daily tick infrastructure, booking insert, subscription counters.

### Phase D — MVP Hardening (Week 4)
**Goal:** Stable enough for 20–50 Varanasi customers

20. Sync OpenAPI spec with leads/franchisees/churned/billing routes (or exclude from MVP UI)
21. Add Drizzle migration baseline (snapshot current schema)
22. Solar AMC customer view: show servicesUsed/Remaining + cleaning history with photos
23. Customer complaint flow end-to-end test
24. Admin training doc: daily ops checklist (assign staff, handle complaints, record payments)
25. Hide non-MVP admin nav items (Leads, Churned, Quotations, Expenses, Franchisees if unused)

**Reuse:** Existing pages; hide rather than delete.

### Post-MVP Sequence (P1 → P2)

| Order | Item | Depends on |
|---|---|---|
| 1 | Auto-invoice on booking complete | Phase B billing verified |
| 2 | Wash quota tracking (2 washes/month in daily package) | Phase C scheduler |
| 3 | City-wise pricing table | Patna planning |
| 4 | Razorpay integration | Stable MVP ops |
| 5 | PWA manifest | Customer adoption data |
| 6 | Geofencing | Staff scale / fraud concern |
| 7 | Addon services | Wash upsell validation |
| 8 | Franchisee portal for Patna partner | Patna branch created |
| 9 | CRM leads activation | Sales team hired |

---

## Appendix A — API Coverage vs OpenAPI

**Documented in OpenAPI (~45 paths):** health, auth (login/register only), customers, vehicles, solar-sites, services, subscriptions, bookings, storage, staff, complaints, invoices, payments, branches, analytics, notifications.

**Implemented but NOT in OpenAPI:**
- `GET /auth/me`, `/auth/permissions`, `POST /auth/logout`
- All `/leads/*` (9 endpoints)
- All `/franchisees/*` (5 endpoints)
- All `/churned/*` (3 endpoints)
- All `/quotations/*` (5 endpoints)
- All `/expenses/*` (4 endpoints)
- All `/billing/*` (2 endpoints)
- `POST /staff/:id/verify`, `/create-account`
- `POST /subscriptions/daily-tick`

**Impact:** Admin pages using raw `fetch` work but bypass type safety. Generated hooks incomplete for ~30% of API.

---

## Appendix B — Frontend Hardcoded ID Map

| File | Line pattern | Fix |
|---|---|---|
| `customer/Dashboard.tsx` | `customerId = 1` | `user?.customerId!` |
| `customer/BookService.tsx` | `customerId: 1` | `user?.customerId!` |
| `customer/History.tsx` | `customerId: "1"` | `String(user?.customerId)` |
| `customer/Invoices.tsx` | `customerId: "1"` | `String(user?.customerId)` |
| `customer/Complaints.tsx` | `customerId: "1"` / `1` | `user?.customerId!` |
| `staff/Dashboard.tsx` | `staffId = 1` | `user?.staffId!` |
| `staff/Schedule.tsx` | `staffId: "1"` | `String(user?.staffId)` |
| `staff/Attendance.tsx` | `staffId = 1` | `user?.staffId!` |
| `staff/Performance.tsx` | `staffId = 1` | `user?.staffId!` |

**AuthUser already carries both IDs** — no backend change needed.

---

## Appendix C — Retain vs Refactor vs Redesign vs Never (MVP) Summary

| Verdict | Items |
|---|---|
| **RETAIN** | Monorepo, Postgres, Drizzle, Express, React, shadcn, RBAC, tenant scope, booking FSM, subscription tick shell, invoice PDF, staff verification, franchisee model, admin portal |
| **REFACTOR** | Customer/staff ID wiring, photo flow, passwords, storage, OpenAPI sync, GST inclusive display, seed data |
| **REDESIGN (additive)** | Daily booking generator, wallet ledger, vehicle-staff map, notification dispatcher, solar pricing calculator |
| **NEVER IN MVP** | Geofencing, Razorpay, coupons, addons, CRM, churned, quotations, expenses, analytics, PWA, IoT, partner settlement, inventory |

---

*This audit is read-only. No schema migrations, no code changes, no feature implementations were performed. Proceed to Phase A implementation only after owner review and approval.*
