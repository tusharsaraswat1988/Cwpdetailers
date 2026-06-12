# CWP Detailers — Master Platform Plan
**Prepared by:** AI Architect | **Date:** June 12, 2026  
**Owner:** Tushar Saraswat | **Current Operations:** Varanasi

---

## Table of Contents
1. [Business Model Understanding](#1-business-model-understanding)
2. [Ecosystem & Hierarchy](#2-ecosystem--hierarchy)
3. [Service Catalog Deep Dive](#3-service-catalog-deep-dive)
4. [Tech Stack Assessment](#4-tech-stack-assessment)
5. [Current Codebase Audit](#5-current-codebase-audit)
6. [Gap Analysis — What Needs to Change](#6-gap-analysis--what-needs-to-change)
7. [External Services Required](#7-external-services-required)
8. [Phase-wise Implementation Roadmap](#8-phase-wise-implementation-roadmap)
9. [MVP Definition — Varanasi Launch](#9-mvp-definition--varanasi-launch)
10. [Database Schema Changes Required](#10-database-schema-changes-required)
11. [Feature Modules Breakdown](#11-feature-modules-breakdown)
12. [Financials & Billing Logic](#12-financials--billing-logic)
13. [Staff Operations Logic](#13-staff-operations-logic)
14. [Customer Experience Flow](#14-customer-experience-flow)
15. [Admin / Partner Control Center](#15-admin--partner-control-center)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Future Roadmap (Post-MVP)](#17-future-roadmap-post-mvp)

---

## 1. Business Model Understanding

CWP Detailers is a **multi-service, multi-city, franchise-based field operations platform** — think UrbanClap/Housejoy model, but specialized in:

| Business Line | Type | Billing Model |
|---|---|---|
| Doorstep Car Wash | On-demand + packages | Per wash / Package with validity |
| Daily Car Cleaning | Subscription | Monthly package (wallet-based) |
| Solar Panel Cleaning | One-time + AMC | Per-panel rate / Annual contract |

### Core Revenue Mechanics

**Doorstep Car Wash:**
- Single wash: Per visit pricing
- Wash packages: e.g. 10 washes valid for 6 months — customer pays upfront, balance tracks down
- Addons: Car waxing, windshield glass treatment (sold with wash)

**Daily Car Cleaning:**
- Packages: "Daily Exterior Cleaning + 2 deep washes/month, Wednesday off"
- OR: Only daily cleaning
- Wednesday off means 24–25 working days/month typically
- Customer pays upfront (wallet/recharge model) or monthly
- Platform alerts customer when balance is running low

**Solar Panel Cleaning:**
- One-time: ₹60/panel, minimum ₹800 billing
- Slab-based pricing for large installations (>X panels = different rate)
- AMC (6-month / 12-month): Pay once → monthly scheduled cleanings
- Customer dashboard shows: total cleanings contracted, done, remaining, dates, before/after

---

## 2. Ecosystem & Hierarchy

```
TUSHAR SARASWAT (Super Admin / Software Owner)
│
├── Creates Cities / Branches
├── Creates City Partners (Franchisees)
├── Sets Global Pricing (city-wise overrides allowed)
├── Validates Staff Documents
├── Manages Payment Inflows
│
└── CITY PARTNER (Franchisee — e.g., Patna Partner)
    │
    ├── Manages city-level leads, complaints, bookings
    ├── Assigns staff to jobs
    ├── Monitors daily operations
    ├── Views city-level financials (read-only for now)
    │
    └── STAFF (Field Workers)
        ├── Salaried staff (fixed duty hours)
        ├── Per-job staff (paid per completed task)
        ├── Petrol-inclusive rate OR per-km rate
        ├── Specialized: Car Wash only / Daily Cleaning only / Solar only / Mixed
        │
        └── CUSTOMER
            ├── Web portal + PWA
            ├── Books services, tracks orders
            ├── Views invoices, cleaning history
            ├── Files complaints
            └── Receives automated notifications
```

### Partner Types (Current: Type 1 Only)
| Type | Model | Status |
|---|---|---|
| **Type 1: City Partner** | Full city ops, own staff, manages everything | **Implement Now** |
| Type 2: Staff Partner | Works independently on platform bookings | Future |
| Type 3: Existing Car Wash Center | Overflow bookings, on-platform branding | Future |

---

## 3. Service Catalog Deep Dive

### 3A. Doorstep Car Wash

```
Services:
  - Basic Exterior Wash
  - Full Wash (exterior + interior vacuum)
  - Deep Clean Wash

Packages (validity-based):
  - 5 washes / 3 months
  - 10 washes / 6 months
  - 15 washes / 12 months

Addons (per booking):
  - Car Waxing: ₹XXX
  - Windshield Glass Treatment: ₹XXX
  - Dashboard Polish: ₹XXX

Pricing: City-wise (Varanasi rates ≠ Patna rates)
GST: Inclusive in displayed price
```

### 3B. Daily Car Cleaning (Subscription)

```
Packages:
  - Daily Exterior + 2 Deep Washes/month (Wed off)
  - Daily Exterior Only (Wed off)
  - Custom frequency packages

Working days: ~24-25/month (all days except Wednesday)
Staff assigned: 1 staff per car (mapped relationship)
Reassignment: Manager can reassign for a specific day

Billing:
  - Monthly prepaid (wallet top-up)
  - Platform alerts at X% balance remaining
  - Pause/resume allowed
```

### 3C. Solar Panel Cleaning

```
One-time:
  - ₹60/panel (minimum billing ₹800)
  - 11-15 panels: ₹55/panel
  - 16-30 panels: ₹50/panel
  - 31+ panels: Custom quote

AMC (Annual Maintenance Contract):
  - 6-month plan: X cleanings
  - 12-month plan: Y cleanings
  - Monthly scheduled cleaning
  - Customer tracks: Total contracted / Done / Remaining

Data captured per cleaning:
  - Date, staff, before photo, after photo
  - Status (completed/skipped/rescheduled)
  - Future: kW generation before/after (IoT integration)
```

---

## 4. Tech Stack Assessment

### Current Stack (Already Chosen — Keep)

| Layer | Technology | Assessment |
|---|---|---|
| **Monorepo** | pnpm workspaces | ✅ Good choice |
| **Language** | TypeScript 5.9 | ✅ Strong typing throughout |
| **Frontend** | React 19 + Vite 7 | ✅ Modern, fast |
| **Routing** | Wouter | ✅ Lightweight, sufficient |
| **State** | TanStack Query + Zustand | ✅ Industry standard |
| **UI** | Tailwind CSS 4 + shadcn/ui | ✅ Excellent component library |
| **Backend** | Express 5 | ✅ Simple and effective |
| **Database** | PostgreSQL + Drizzle ORM | ✅ Strong choice for this use case |
| **API Design** | OpenAPI 3.1 + Orval codegen | ✅ Contract-first is correct |
| **Auth** | Bearer tokens in sessions table | ⚠️ Needs security hardening |
| **Storage** | Google Cloud Storage | ✅ But must decouple from Replit |
| **PDF** | pdfkit | ✅ Invoice PDF generation ready |

### What Needs to be Added

| Need | Technology | Reason |
|---|---|---|
| **Password Security** | `argon2` or `bcryptjs` | Current SHA-256 + static salt is insecure |
| **SMS Notifications** | MSG91 or Twilio | WhatsApp + SMS OTP + reminders |
| **WhatsApp Business** | MSG91 WhatsApp API | Service updates, payment reminders |
| **Email** | Resend.com or SendGrid | Booking confirmations, invoices |
| **Push Notifications** | Firebase FCM | Mobile/PWA push alerts |
| **Payment Gateway** | Razorpay | Online payments (Phase 2) |
| **Geofencing** | Google Maps API | Staff location validation |
| **Maps/Location** | Google Maps JavaScript API | Customer location picker |
| **PWA** | vite-plugin-pwa | Service worker, installable app |
| **Background Jobs** | `node-cron` (already via daily-tick) | Extend for reminders, dues |
| **File Upload** | Cloudinary or keep GCS | Profile photos, proof photos |
| **OTP Auth** | MSG91 OTP | Phone verification |

### Deployment Target

| Service | Platform | Why |
|---|---|---|
| **API Server** | Render Web Service | Free tier → paid, easy deploy |
| **Frontend** | Render Static Site or Vercel | CDN delivery |
| **Database** | Render PostgreSQL | Managed, same network as API |
| **File Storage** | Cloudinary (free tier generous) | Photos, documents |
| **Background Jobs** | Same API server (cron routes) | Phase 1 simplicity |

---

## 5. Current Codebase Audit

### What's Already Built (Production-Ready or Near-Ready)

| Module | Backend | Frontend | Status |
|---|---|---|---|
| Multi-role Auth | ✅ Complete | ✅ Complete | 🔧 Needs security fix |
| RBAC System | ✅ Complete | ✅ Complete | ✅ Good |
| Multi-tenant (company/branch) | ✅ Complete | ✅ Complete | ✅ Good |
| Customer Management | ✅ Complete | ✅ Complete | ✅ Good |
| Staff Management | ✅ Complete | ✅ Complete | ✅ Good |
| Booking Workflow | ✅ Complete | ✅ Complete | 🔧 Needs geo-fence |
| Subscription Engine | ✅ Complete | ✅ Partial | 🔧 Needs customer UI |
| Daily Tick Scheduler | ✅ Complete | N/A | ✅ Good |
| Invoice & PDF | ✅ Complete | ✅ Complete | ✅ Good |
| CRM / Leads | ✅ Complete | ✅ Complete | ✅ Good |
| Complaints | ✅ Complete | ✅ Complete | ✅ Good |
| Analytics Dashboard | ✅ Complete | ✅ Complete | ✅ Good |
| Franchisee Portal | ✅ Complete | ✅ Partial | 🔧 Needs work |
| Notifications (in-app) | ✅ Complete | ✅ Complete | 🔧 Need SMS/WA |
| Object Storage | ✅ Complete | ✅ Complete | 🔧 Decouple from Replit |
| Landing Page | ✅ Basic | ✅ Basic | 🔧 Needs SEO + content |
| Payment Gateway | ❌ Missing | ❌ Missing | Phase 2 |
| Geofencing | ❌ Missing | ❌ Missing | Phase 1 (MVP) |
| PWA / Mobile | ❌ Missing | ❌ Missing | Phase 1 (MVP) |
| OTP / Phone Verify | ❌ Missing | ❌ Missing | Phase 1 (MVP) |
| Solar AMC Dashboard | 🔧 Partial | 🔧 Partial | Needs enhancement |
| Vehicle mapping (daily wash) | ✅ Schema | ⚠️ Weak UI | Needs work |
| Staff payment logic | ⚠️ Schema | ❌ Missing UI | Build fresh |
| Coupon system | ❌ Missing | ❌ Missing | Phase 2 |
| City-wise pricing | ⚠️ Schema | ⚠️ Weak UI | Needs work |

### Critical Bugs to Fix Before MVP

1. **Customer portal uses hardcoded `customerId = 1`** — must use authenticated user ID
2. **Staff portal uses hardcoded `staffId = 1`** — must use authenticated user ID
3. **Password hashing is insecure** — SHA-256 + static salt → must migrate to argon2
4. **No `.env.example`** — anyone deploying has no guidance
5. **OpenAPI drift** — Leads, franchisees, quotations, expenses routes missing from spec

---

## 6. Gap Analysis — What Needs to Change

### Critical Gaps (Block MVP)

| Gap | Impact | Effort |
|---|---|---|
| Hardcoded user IDs in portals | Customer/staff can't use real accounts | Low (1-2 days) |
| Password security | Security risk | Low (1 day) |
| Customer booking flow UX | Customers can't self-serve properly | Medium (3-4 days) |
| Staff mobile-first UI | Staff work on phones, current UI is desktop | Medium (3-4 days) |
| Geofencing for staff | Prevent fake photo uploads | Medium (3-4 days) |
| Notification delivery (SMS/WhatsApp) | Core workflow depends on notifications | Medium (3-4 days) |
| Daily car cleaning — auto-scheduling | Prevents missed washes (core problem) | Medium (3-4 days) |
| Solar AMC — customer tracking view | AMC customers need self-service visibility | Medium (2-3 days) |
| PWA manifest + service worker | Mobile installation needed for staff | Low (1-2 days) |
| Deploy config (Render) | Can't go live without this | Low (1 day) |

### Important Gaps (Phase 1, post-MVP)

| Gap | Impact | Effort |
|---|---|---|
| Payment gateway (Razorpay) | Online booking payments | High (1 week) |
| Coupon system | Marketing conversion | Medium (2-3 days) |
| Automated payment reminders | Reduces dues | Medium (2-3 days) |
| Staff payment/earnings module | Staff satisfaction | Medium (3-4 days) |
| City-wise pricing in admin UI | Pricing flexibility | Low (1-2 days) |
| Addon services in booking flow | Revenue increase | Low (1-2 days) |
| Before/after photo requirement in daily wash | Quality control | Low (1-2 days) |
| Customer wash scheduling UI | Daily cleaning due-date scheduling | Medium (2-3 days) |

### Future Gaps (Phase 2+)

| Gap | Description |
|---|---|
| Hybrid mobile app | React Native or Capacitor wrapper |
| Razorpay subscription auto-debit | Auto payment collection |
| Solar IoT integration | kW before/after via inverter API |
| Staff training & exam module | Certification system |
| Multi-language support | Hindi UI option |
| Type 2/3 partner onboarding | Staff-partner, Car wash center partner |
| Partner financial settlement | Franchise revenue sharing |

---

## 7. External Services Required

### Phase 1 (MVP — Must Have)

| Service | Provider | Cost (approx) | Purpose |
|---|---|---|---|
| **SMS + WhatsApp** | MSG91 | ₹0.15/SMS, ₹0.50/WA | OTP, booking alerts, reminders |
| **Email** | Resend.com | Free 3000/month | Invoices, confirmations |
| **Maps + Geofencing** | Google Maps API | $200 free credit/month | Customer location, staff validation |
| **File Storage** | Cloudinary | Free 25GB | Photos: staff, customer, before/after |
| **Hosting** | Render.com | Free tier → Starter $7/month | API + DB + Frontend |
| **Domain** | GoDaddy/Namecheap | ₹800/year | cwpdetailers.com |
| **SSL** | Auto via Render | Free | HTTPS |

### Phase 2 (Post-MVP)

| Service | Provider | Purpose |
|---|---|---|
| **Payment Gateway** | Razorpay | Online payments, subscriptions |
| **Push Notifications** | Firebase FCM | Mobile/PWA push |
| **WhatsApp Business API** | Official Meta / MSG91 | Rich WA notifications |
| **Analytics** | PostHog (self-host) or Mixpanel free | User behavior tracking |
| **Error Monitoring** | Sentry free tier | Bug tracking |
| **Uptime Monitoring** | UptimeRobot free | Alert on downtime |

### Phase 3 (Future)

| Service | Purpose |
|---|---|
| **Razorpay Subscription** | Auto-debit monthly plans |
| **Solar IoT API** | Generation monitoring |
| **Twilio** | International SMS if expanding |
| **Firebase** | If going hybrid mobile |

---

## 8. Phase-wise Implementation Roadmap

### Phase 0: Foundation Fixes (Week 1-2) — Do This First
**Goal:** Stabilize existing code, fix critical bugs, make it deployable

- [ ] Fix hardcoded `customerId = 1` and `staffId = 1` in portals
- [ ] Migrate password hashing to `argon2`
- [ ] Create `.env.example` with all required variables
- [ ] Sync OpenAPI spec with all implemented routes (leads, franchisees, etc.)
- [ ] Create `render.yaml` for deployment
- [ ] Set up Cloudinary (replace Replit GCS dependency)
- [ ] Add `vite-plugin-pwa` for PWA support
- [ ] Write basic E2E test for login + booking flow
- [ ] Document database setup instructions

**Outcome:** Stable, deployable, secure foundation

---

### Phase 1: MVP — Varanasi Launch (Week 3-6)
**Goal:** Real customers in Varanasi can use the platform end-to-end

#### 1A. Customer Portal Completion (Week 3)
- [ ] Customer registration with phone OTP verification (MSG91)
- [ ] Customer profile: name, phone, email, home address, car details
- [ ] Car registration within account (make/model/color/reg number)
- [ ] Location picker using Google Maps (save home + car location)
- [ ] Book doorstep car wash (select car, service, time slot, addon options)
- [ ] View active subscriptions and balance remaining
- [ ] Daily car cleaning: see today's status, history, before/after photos
- [ ] Solar AMC: see total/done/remaining cleanings with dates and photos
- [ ] View invoices + download PDF
- [ ] Submit complaint + track resolution
- [ ] In-app notifications (+ SMS for critical updates)
- [ ] Customer dashboard with next wash due, balance alerts

#### 1B. Staff Mobile-First Portal (Week 3-4)
- [ ] Staff app optimized for mobile (responsive, thumb-friendly)
- [ ] Login via phone + password
- [ ] Today's jobs list (clear, prioritized)
- [ ] Job detail: customer name, address, car, service type
- [ ] Google Maps link → navigate to customer
- [ ] Geo-fence check: must be within 100m of customer location to:
  - Mark job as "started"
  - Upload before/after photos
  - Mark job as "completed"
- [ ] For daily car cleaning: car is pre-mapped, just show list
- [ ] Submit remarks if issues (parking, car not found, customer not available)
- [ ] View own attendance, earnings summary
- [ ] Staff payment breakdown: jobs done × rate, petrol, deductions

#### 1C. Admin Portal Completion (Week 4)
- [ ] City-wise pricing configuration (per service, per city)
- [ ] Addon services management (create, price, attach to services)
- [ ] Service packages with validity (create, manage)
- [ ] Staff payment type setup (salaried vs per-job, petrol config)
- [ ] Booking auto-assignment rules configuration
- [ ] Coupon code creation and management
- [ ] Broadcast notification to customers (SMS/email/WA)
- [ ] Financial dues dashboard (who hasn't paid, follow-up tools)
- [ ] City partner (franchisee) creation and onboarding flow

#### 1D. Notification Engine (Week 4-5)
- [ ] MSG91 integration for SMS
- [ ] MSG91 WhatsApp template messages
- [ ] Resend.com for email
- [ ] Notification templates: booking confirmed, staff assigned, job completed, invoice generated, balance low, wash due
- [ ] Customer opt-in/opt-out preferences
- [ ] Admin configurable notification triggers

#### 1E. Auto-Scheduling Engine (Week 5)
- [ ] Daily tick enhancement: generate daily car cleaning bookings automatically
- [ ] Check: subscription active + balance available + staff mapped
- [ ] Check Wednesday off (and custom off days)
- [ ] If wash due + staff available → auto-create booking
- [ ] If wash due + balance low → send payment reminder to customer
- [ ] Send "your car wash is scheduled for today" notification morning
- [ ] After completion: send completion notification + next wash date

#### 1F. Geofencing (Week 5)
- [ ] Google Maps API integration
- [ ] Customer location stored as lat/lng
- [ ] Staff app: `navigator.geolocation` API to get current location
- [ ] Server-side validation: check staff lat/lng vs customer lat/lng (Haversine formula, 150m radius)
- [ ] Block "mark complete" if not within geofence
- [ ] Log staff location at job start and completion

#### 1G. Landing Page — SEO & Marketing (Week 6)
- [ ] Professional marketing landing page (not just a placeholder)
- [ ] Services with pricing (city-switchable)
- [ ] Testimonials section
- [ ] Service area map (cities served)
- [ ] Lead capture form ("Get a Quote" / "Book Now")
- [ ] WhatsApp chat widget
- [ ] SEO: meta tags, structured data (LocalBusiness schema), sitemap.xml
- [ ] Mobile-first, page speed optimized
- [ ] Blog section stub (for future content marketing)

**Phase 1 Outcome:** End-to-end working platform for Varanasi customers, Tushar managing, staff operating in the field

---

### Phase 2: Patna Expansion + Payments (Month 2-3)
**Goal:** Onboard Patna franchisee, collect payments online

- [ ] Razorpay payment gateway integration
- [ ] Online booking payment (credit card, UPI, net banking)
- [ ] Razorpay payment links for invoice dues
- [ ] Wallet top-up via Razorpay
- [ ] Patna franchisee onboarding
- [ ] City-specific staff roster and operations
- [ ] Franchisee analytics dashboard (city-level)
- [ ] Coupon code system (create, validate, apply in booking flow)
- [ ] Staff earnings module (calculate, display, export)
- [ ] Advanced auto-scheduling (handle staff unavailability, reassignment)
- [ ] Customer app installable PWA promotion
- [ ] Review and rating system after job completion
- [ ] Referral system (basic)

---

### Phase 3: Scale & Intelligence (Month 4-6)
**Goal:** Business intelligence, reduce manual intervention to near-zero

- [ ] Advanced analytics: revenue per city, staff efficiency, churn prediction
- [ ] Predictive reminders (ML-based wash due prediction)
- [ ] Automated payment collection (Razorpay subscriptions)
- [ ] Solar IoT integration prep
- [ ] Staff training module (videos, quiz, certification)
- [ ] Multi-language Hindi UI option
- [ ] Customer loyalty program (points, rewards)
- [ ] B2B solar cleaning contracts (corporate accounts)
- [ ] Type 2/3 partner onboarding
- [ ] Partner revenue sharing module

---

### Phase 4: Mobile App (Month 6-9)
**Goal:** Native-feeling mobile experience

- [ ] Capacitor wrapper on existing React app (iOS + Android)
- [ ] Push notifications via FCM
- [ ] App Store + Play Store submission
- [ ] Offline mode for staff (queue actions when no network)
- [ ] Barcode/QR scanner for vehicle verification
- [ ] In-app payment via UPI deep links

---

## 9. MVP Definition — Varanasi Launch

**The MVP must allow this exact workflow to work without any manual intervention:**

### Customer Journey (MVP)
```
1. Customer visits website → sees services + pricing
2. Customer registers (phone OTP verification)
3. Customer adds car details + saved location
4. Customer books doorstep car wash / daily cleaning / solar cleaning
5. Booking confirmed → SMS + WhatsApp notification
6. Staff assigned (auto or by admin) → Customer notified
7. Staff arrives, marks "started" (geo-verified)
8. Staff uploads before photo
9. Staff completes job, uploads after photo, marks "done"
10. Customer gets completion notification + invoice generated
11. Customer views history, before/after photos on their portal
```

### Staff Journey (MVP)
```
1. Staff logs in on phone (mobile-first UI)
2. Sees today's jobs in priority order
3. Taps job → sees customer, car, location, map link
4. Navigates to location
5. Within 150m → can mark "started" + upload before photo
6. Does the job
7. Uploads after photo + marks "completed"
8. Sees next job in list
```

### Admin (Tushar) Journey (MVP)
```
1. Sees all bookings, today's schedule
2. Can manually assign/reassign staff
3. Gets alerted on complaints
4. Creates new customers if needed (walk-in)
5. Generates invoice + sends payment reminder
6. Views daily operations report
```

---

## 10. Database Schema Changes Required

### New Tables Needed

```sql
-- Addon services (waxing, windshield treatment etc.)
addon_services (
  id, companyId, branchId,
  name, description, price, gstRate,
  applicableServiceTypes[], isActive
)

-- Booking addons (many-to-many)
booking_addons (
  id, bookingId, addonServiceId,
  price, quantity
)

-- Solar panel details (extend existing solar_sites)
ALTER TABLE solar_sites ADD COLUMNS:
  panelCount, panelBrand, installationDate,
  inverterBrand, inverterId (for IoT future),
  monthlyGenerationKwh

-- Solar cleaning records (extend bookings or separate)
solar_cleaning_records (
  id, siteId, bookingId, cleaningDate,
  staffId, beforePhoto, afterPhoto,
  generationBeforeKw, generationAfterKw,
  weatherCondition, remarks
)

-- Staff compensation config
staff_compensation (
  id, staffId, companyId, branchId,
  compensationType: 'salaried' | 'per_job',
  baseSalary, -- if salaried
  perJobRates: { serviceType: amount }[],
  petrolPolicy: 'included' | 'per_km',
  petrolRatePerKm,
  effectiveFrom, effectiveTo
)

-- Staff earnings (computed/tracked)
staff_earnings (
  id, staffId, branchId,
  month, year,
  jobsCompleted, totalJobEarnings,
  petrolAllowance, deductions,
  netPayable, settledAmount, settledAt
)

-- Coupon codes
coupons (
  id, companyId, branchId,
  code, discountType: 'flat' | 'percent',
  discountValue, maxDiscountAmount,
  minOrderValue, validFrom, validTill,
  usageLimit, usedCount,
  applicableServices[], isActive
)

-- Coupon usages
coupon_usages (
  id, couponId, customerId, bookingId,
  discountApplied, usedAt
)

-- OTP verification
otp_verifications (
  id, phone, email, otp, purpose,
  expiresAt, verifiedAt, attempts
)

-- Staff location logs (geofencing audit)
staff_location_logs (
  id, staffId, bookingId,
  latitude, longitude, accuracy,
  action: 'job_start' | 'job_complete' | 'checkin',
  recordedAt
)

-- Customer wallet transactions
wallet_transactions (
  id, customerId, companyId,
  transactionType: 'credit' | 'debit',
  amount, balance_after,
  reference, referenceId, notes,
  createdAt
)

-- Service pricing overrides (city-wise)
service_pricing_overrides (
  id, serviceId, branchId,
  price, gstRate,
  effectiveFrom, effectiveTo
)

-- Notification templates
notification_templates (
  id, companyId, name, trigger_event,
  channel: 'sms' | 'whatsapp' | 'email' | 'push' | 'in_app',
  subject, body, variables[],
  isActive
)
```

### Schema Modifications

```sql
-- services table: add
  category: 'car_wash' | 'daily_cleaning' | 'solar_cleaning'
  serviceType: 'one_time' | 'package' | 'subscription' | 'amc'
  
-- subscriptions table: add
  pausedAt, resumedAt,
  autoRenew, reminderDaysBefore

-- bookings table: add
  addonServices (via junction table),
  geoFenceVerified: boolean,
  staffLocationAtStart: point,
  staffLocationAtComplete: point,
  customerRating: 1-5,
  customerReview: text

-- customers table: add
  walletBalance (currently exists, verify),
  referredBy, referralCode,
  preferredNotificationChannel

-- vehicles table: add
  assignedStaffId (for daily cleaning),
  assignedSince

-- staff table: add  
  serviceTypes: [] (what services they can do),
  operatingRadius (km),
  maxDailyJobs
```

---

## 11. Feature Modules Breakdown

### Module 1: Authentication & Onboarding
- [ ] Phone OTP registration (MSG91)
- [ ] Email verification
- [ ] Profile completion wizard (car details, location)
- [ ] Staff document upload (Aadhaar, driving license)
- [ ] Password reset via OTP
- [ ] Session management improvements

### Module 2: Service & Pricing Engine
- [ ] Service catalog with categories
- [ ] Package builder (validity, wash counts)
- [ ] Addon services management
- [ ] City-wise pricing overrides
- [ ] GST calculation engine (inclusive pricing display)
- [ ] Coupon validation engine

### Module 3: Booking & Scheduling Engine
- [ ] Multi-step booking wizard (service → date/time → car → addons → confirm)
- [ ] Real-time slot availability
- [ ] Staff auto-assignment (based on availability, location, service type)
- [ ] Booking state machine (pending → confirmed → in-progress → completed/cancelled)
- [ ] Recurring booking generation (daily cleaning)
- [ ] Rescheduling with constraints
- [ ] Cancellation policy enforcement
- [ ] Waitlist management

### Module 4: Staff Operations App
- [ ] Mobile-optimized job list
- [ ] Job acceptance flow
- [ ] Navigation to job (Google Maps integration)
- [ ] Geofence verification
- [ ] Before photo upload
- [ ] After photo upload
- [ ] Issue remarking
- [ ] Mark complete
- [ ] Daily check-in / attendance
- [ ] Earnings tracker

### Module 5: Auto-Scheduling System
- [ ] Daily tick at configurable time (currently midnight)
- [ ] Generate daily car cleaning jobs
- [ ] Validate: subscription active + balance available + staff mapped
- [ ] Handle Wednesday off (configurable off days)
- [ ] Balance check: alert if < X days remaining
- [ ] Wash due notifications to customers
- [ ] Staff schedule notification morning (7 AM)

### Module 6: Notification Hub
- [ ] Multi-channel dispatcher (SMS, WhatsApp, Email, In-app)
- [ ] Template management by admin
- [ ] Preference management by customer
- [ ] Bulk notification to segments
- [ ] Delivery status tracking
- [ ] Retry logic on failure

### Module 7: Solar AMC Portal
- [ ] AMC contract view for customer
- [ ] Cleaning history timeline
- [ ] Before/after photo gallery
- [ ] Progress: X of Y cleanings done
- [ ] Next cleaning date
- [ ] kW data capture (manual for now, IoT later)
- [ ] Renewal alerts

### Module 8: CRM & Leads
- [ ] Lead capture from landing page
- [ ] Lead pipeline: new → contacted → demo → converted → lost
- [ ] Follow-up reminders for city partner
- [ ] Lead assignment to city partner by admin
- [ ] Convert lead to customer + booking
- [ ] Source tracking (website, referral, walk-in, WhatsApp)

### Module 9: Billing & Financials
- [ ] Invoice auto-generation on booking completion
- [ ] GST-inclusive pricing display, exclusive in invoice
- [ ] PDF invoice
- [ ] Payment recording (cash, UPI — Phase 1; online — Phase 2)
- [ ] Wallet management and history
- [ ] Payment reminders (automated)
- [ ] Outstanding dues report
- [ ] Staff earnings calculator

### Module 10: Admin Control Center
- [ ] City/branch management
- [ ] Service + pricing configuration
- [ ] Staff onboarding + verification
- [ ] Franchisee management
- [ ] System-wide announcements
- [ ] Role permissions configuration
- [ ] Notification trigger settings

---

## 12. Financials & Billing Logic

### Pricing Rules
```
GST: 18% (already in codebase)
Display price: GST INCLUSIVE (₹100 means ₹84.75 + ₹15.25 GST)
Invoice shows: base + GST breakdown

City-wise pricing:
  Default price set globally
  Branch override takes precedence if set
  
Solar one-time pricing tiers:
  1-10 panels:  ₹60/panel (min ₹800)
  11-15 panels: ₹55/panel
  16-30 panels: ₹50/panel
  31+:          Custom quote
```

### Wallet / Subscription Model
```
Daily Car Cleaning:
  Customer has a wallet balance
  Each day's cleaning debits from wallet
  Admin configures: price per day's cleaning
  Platform alerts when balance < 7 days worth
  Customer tops up (cash/UPI in Phase 1, online Phase 2)
  
  Balance runs out → bookings auto-pause
  Customer tops up → bookings auto-resume
```

### Staff Payment
```
Per-job staff:
  Rate defined per service type
  e.g., car wash = ₹80/job, daily clean = ₹40/job, solar = ₹100/job
  
  Petrol policy A: Included in rate
  Petrol policy B: ₹X per km (tracked per job)
  
Salaried staff:
  Monthly fixed salary
  Duty hours defined (e.g., 8 AM - 6 PM)
  Attendance-linked payment
  Leaves deduct proportionally
  
Monthly earnings report:
  Jobs done × rate (per-job)
  OR monthly salary × attendance% (salaried)
  + petrol allowance
  - deductions
  = Net payable
```

---

## 13. Staff Operations Logic

### Job Assignment
```
Priority 1 (Auto): Staff mapped to vehicle (daily cleaning)
Priority 2 (Auto): Auto-assign based on:
  - Staff available that time slot
  - Staff handles that service type
  - Staff within operating radius of customer
  - Staff hasn't exceeded max daily jobs
Priority 3 (Manual): Admin/partner manually assigns
```

### Geofencing Logic
```
Customer location: lat/lng stored on profile (mandatory for booking)
Staff app: browser Geolocation API
Validation: Haversine distance < 150 meters (configurable)

Cannot mark "Job Started" without geo-check passing
Cannot upload proof photos without geo-check passing
Cannot mark "Completed" without geo-check passing

Exception: Admin can override geo-fence for specific booking
```

### Daily Car Cleaning — Staff Workflow
```
Morning: Staff app shows list of cars to clean (sorted by route)
For each car:
  1. See car details + location + any special notes
  2. Navigate (Google Maps)
  3. Geo-check triggers when within 150m
  4. Take "before" photo
  5. Clean car
  6. Take "after" photo
  7. Mark complete → customer notified
  8. Next car in list
  
End of day: All done → system calculates earnings for the day
```

### Staff Reassignment (Daily Cleaning)
```
Normal: Staff A is assigned to Car X always
Exceptional: Manager reassigns Car X to Staff B for today
  → Staff A's list updates (Car X removed)
  → Staff B's list updates (Car X added)
  → Customer notified of the change (optional)
```

---

## 14. Customer Experience Flow

### First-Time Customer
```
1. Lands on website (SEO / referral / word of mouth)
2. Sees services, pricing, testimonials
3. Clicks "Book Now" or "Get Started"
4. Phone OTP registration (30 seconds)
5. Profile setup wizard:
   - Name, email
   - Add car (make, model, color, registration number)
   - Pin home location on map
   - Pin car's usual parking location
6. Choose service + date/time
7. Review order (service + addons + pricing with GST)
8. Confirm booking
9. SMS + WhatsApp confirmation
```

### Returning Customer
```
Login → Dashboard shows:
  - Next scheduled wash
  - Active subscriptions + balance
  - Recent jobs (with photos)
  - Outstanding invoices
  - Any pending complaints
Quick actions: Book wash, Top up wallet, Contact support
```

### Daily Cleaning Customer
```
Monthly view shows calendar:
  ✅ Green: Cleaned, tap to see before/after photos
  ❌ Red: Missed (tap to see reason)
  ⏰ Scheduled: Today or future
  
Running: Days remaining in current balance
Alert banner: "Your balance runs out in 5 days. Top up now."
```

### Complaint Flow
```
Customer submits complaint:
  - Category (quality, staff behavior, no-show, billing)
  - Description
  - Photos (optional)
  - Booking reference
→ City partner gets notified immediately
→ City partner responds within 24h (SLA configurable)
→ Customer gets update notification
→ Customer marks resolved or escalates
→ Escalation goes to super admin
```

---

## 15. Admin / Partner Control Center

### Super Admin (Tushar) — Full Access
- Create companies, branches, cities
- Create and manage franchisee partners
- Set global service catalog
- Set global pricing (with city overrides)
- View all transactions, financials
- Configure system settings
- Broadcast notifications
- Staff document verification
- Add/remove any user

### City Partner (Franchisee) — City Scope
- View city bookings, assign/reassign staff
- Manage city-level leads, follow-ups
- Handle customer complaints (respond, resolve)
- View city analytics
- Manage own staff (within verified list)
- View outstanding dues for city customers
- Limited pricing changes (if super admin allows)

### Manager Role
- Day-to-day ops management
- Booking management, staff assignment
- Complaint resolution
- Cannot change pricing, cannot create franchisees
- View analytics

---

## 16. Non-Functional Requirements

### Performance
- Page load < 2 seconds (LCP)
- API response < 500ms (P95)
- Search results < 200ms
- Photo upload: progress indicator, background upload

### Security
- Argon2 password hashing
- Phone OTP for registration
- Geofencing to prevent fake job completions
- Rate limiting on auth endpoints
- HTTPS everywhere
- Document storage: private bucket (Cloudinary private)
- Staff documents: accessible only to super admin
- API: all endpoints require authentication except public ones

### Reliability
- Auto-retry failed notifications (3 attempts, exponential backoff)
- Daily tick: if missed, retry at next startup
- Booking scheduler: idempotent (re-running doesn't create duplicates)
- Database: connection pooling, query timeout

### Scalability
- Multi-tenant architecture already in place ✅
- Horizontal scaling via stateless API (sessions in DB) ✅
- City-level data isolation ✅

### Accessibility & SEO
- WCAG 2.1 AA compliance for landing page
- Structured data (LocalBusiness, Service schema)
- Sitemap.xml, robots.txt
- Open Graph tags for social sharing
- Meta descriptions for all service pages

### PWA Requirements
- Installable on Android and iOS
- Offline view of last loaded data (service worker cache)
- Push notification support
- Camera access for photo upload
- Geolocation access for geo-fence

---

## 17. Future Roadmap (Post-MVP)

| Timeline | Feature |
|---|---|
| Month 3 | Razorpay payment gateway |
| Month 3 | Coupon & referral system |
| Month 4 | Staff ratings by customers |
| Month 4 | Staff training module (videos, quiz) |
| Month 5 | Solar kW monitoring (manual entry) |
| Month 5 | Franchisee financial settlement |
| Month 6 | Hindi language support |
| Month 6 | Loyalty points program |
| Month 7 | Hybrid mobile app (Capacitor) |
| Month 8 | Solar IoT integration (inverter API) |
| Month 9 | B2B corporate accounts |
| Month 10 | Type 2/3 partner onboarding |
| Month 12 | AI-based demand forecasting |
| Month 12 | Auto-route optimization for staff |

---

## Quick Reference: What To Build When

### This Week (Do First — Blockers)
1. Fix `customerId = 1` / `staffId = 1` hardcoding
2. Upgrade password hashing to argon2
3. Create `.env.example`
4. Add `render.yaml`
5. Setup Cloudinary (remove Replit GCS dependency)
6. Add `vite-plugin-pwa`

### Next 2 Weeks (Core MVP Features)
1. MSG91 SMS + WhatsApp integration
2. Resend email integration
3. Phone OTP registration flow
4. Customer profile + car details + location setup
5. Booking flow (multi-step wizard)
6. Staff mobile-first UI overhaul
7. Geofencing for job start/complete

### Week 4-5 (MVP Completion)
1. Auto-scheduling engine for daily car cleaning
2. Solar AMC tracking dashboard for customers
3. Notification templates + triggers
4. City-wise pricing in admin
5. Addon services in booking flow
6. Landing page SEO overhaul

### Month 2 (Scale Preparation)
1. Razorpay payment integration
2. Coupon system
3. Staff earnings module
4. Patna franchisee onboarding
5. Advanced analytics

---

*This document should be treated as a living plan. Update it as decisions are made, features are completed, or scope changes.*

**Next Action:** Start with Phase 0 foundation fixes — these are quick wins that make everything else possible.
