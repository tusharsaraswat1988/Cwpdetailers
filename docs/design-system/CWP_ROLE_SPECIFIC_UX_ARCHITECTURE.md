# CWP Detailers — Role-Specific Design Architecture

**Document:** CWP Role-Specific UX Architecture & Platform Guidelines  
**Authority:** Universal Design System Methodology (`.agents/skills/universal-design-system/SKILL.md`)  
**Target Surfaces:** Admin Application, Staff Field Application, Customer Application  
**Living PRD Reference:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md` (`UDS-003`, `UDS-004`)  

---

## Part A: Admin Application Architecture

### 1. User & Operational Context
- **Users:** Operations Managers, Dispatchers, Billing/Finance Admins, Central Superadmins.
- **Environment:** Multi-monitor desktop, laptop (1280px–1920px), frequent high-speed mouse and keyboard workflows.
- **Primary Need:** Maximum situational awareness, fast scanning, quick triage, bulk management, and zero accidental destructive actions.

### 2. Information Density & Layout Rhythm
- **Rhythm:** Dense, structured, table-first.
- **Header:** Sticky `AdminScopeHeader` displaying active City and Branch scope, live breadcrumbs, quick search, and notification center.
- **Sidebar:** Multi-tier collapsible navigation grouping operations by operational domains:
  - Command & Operations (Dashboard, Bookings, DCMS Cleaning, Jobs, Calendar, Quality Hub)
  - Network & Infrastructure (Cities, Branches, Zones & Geofences, Societies, Service Locations)
  - Customers & Assets (Customer Directory, Vehicles, Rooftops, Leads, Churn)
  - Commercial & Billing (Invoices, Payment Ledgers, Quotations, Expenses, Legal Entities)
  - Staff & Workforce (Cleaners, Supervisors, KYC Approvals, Performance)
- **Table Density:** Compact row heights (`py-2.5 px-3`), monospaced tabular numbers for amounts and dates, inline status pills, and sticky right-hand action columns (`⋮`).
- **Data Filtering:** Unified toolbar with auto-complete `SearchableCombobox`, status dropdowns, date range picker, and 1-click filter reset.

### 3. Contextual Help & Decision Support
- Complex operational concepts (e.g. Postgres `FOR UPDATE SKIP LOCKED`, differential pricing resolution, SLA breach levels) incorporate accessible `ContextHelp` tooltips and popovers so operations managers understand system behavior without leaving the screen.

---

## Part B: Staff Application Architecture

### 1. User & Operational Context
- **Users:** Daily Car Cleaners (`daily_car_cleaner`), Mobile Washers (`car_washer`), Detailing Specialists, Solar Cleaning Technicians.
- **Environment:** Bright outdoor sunlight, dim basement parking levels (B1/B2/B3), weak or zero cellular connectivity, wet or gloved hands.
- **Primary Need:** Extreme simplicity, high visual contrast, immediate visibility of assigned work, 1-tap completion, honest offline sync, and non-blocking GPS evidence capture.

### 2. High-Contrast Field Chrome & Touch Ergonomics
- **Touch Targets:** Minimum 48px–52px height (`h-12` / `h-13`) across all action buttons and route items.
- **Outdoor Sunlight Readability:** Deep contrast (`#0F172A` text on `#FFFFFF` cards, `#0072F8` high-visibility primary blue, `#16A34A` verified checkmark).
- **Single Primary Action Flow:** The staff dashboard presents exactly ONE primary next task (e.g., "Next Car to Clean: MH-02-AB-1234" or "En Route to Booking #108"). Secondary information is collapsed or grouped below.
- **Bilingual Hindi-First Field UX:** Primary labels default to everyday colloquial Hindi (e.g., "गाड़ी साफ हो गई", "सिंक पेंडिंग", "चेक-इन करें", "फोटो लें") with 1-tap English toggle in the top bar.

### 3. Field Evidence & Offline Resilience
- **Shutter-Time GPS Lock:** Concurrent camera shutter and GPS coordinate acquisition prevents GPS drift.
- **Basement Garage Signal Fallback:** Clear, audited fallback ("underground_basement_no_signal") prevents technicians from getting stuck when underground.
- **Honest Sync Indicators:** Unsynced work displays an amber "सिंक पेंडिंग" badge; once acknowledged by the PostgreSQL backend, it transitions to a solid green checkmark.
- **Non-Blocking Queue:** Technicians can continue completing the next car even while previous photos upload in the background.

---

## Part C: Customer Application Architecture

### 1. User & Operational Context
- **Users:** Vehicle owners, residential society tenants, rooftop solar owners.
- **Environment:** Mobile phone browsers, PWA installed apps, desktop web (360px–430px mobile viewports, 1280px+ desktop).
- **Primary Need:** Immediate service confidence, price transparency, effortless booking in < 4 steps, scannable subscription status, and zero intrusive popups.

### 2. Information Architecture & Clean White Surfaces
- **Header Architecture:** Streamlined 3-part flex header with CWP logo (left), compact interactive address selector capsule (`MapPin` + Locality + Chevron) (center), and profile/notification trigger (right).
- **Restrained 6-Tier Homepage Rhythm:**
  1. Header with Address Capsule
  2. Single-Line Calm Greeting (`Good morning, Arjun`)
  3. Conditional Payment Alert (renders ONLY when `pendingDues > 0`; zero-clutter when clear)
  4. Conditional Active Plan Strip (compact 1-row summary)
  5. Promotional Banner (compact 18–20% viewport height)
  6. Visual-First Services Grid (16:10 aspect ratio photography, clear starting prices, single primary CTA)
- **4-Tab Navigation:**
  - `Home`: Service discovery & catalog
  - `My Plans`: Active subscriptions & visit counters
  - `Schedule`: Dynamic booking stepper
  - `Assets`: Vehicles & Solar Rooftops
  - `Account`: Invoices, saved addresses, support

### 3. Low-Friction Booking Journey
- Dynamic category chips (`Daily Car Cleaning`, `Car Wash`, `Detailing`, `Solar Care`) that automatically hide categories with zero operational availability in the customer's selected city.
- Asset isolation: Automotive services show only cars; solar services show only solar rooftops.
- Persistent 48px bottom booking CTA with transparent pricing breakdown and zero surprise charges.
