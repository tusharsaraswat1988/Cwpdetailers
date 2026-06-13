# CWP World-Class Product Experience Plan

**Document Type:** Product & Experience Strategy  
**Audience:** Product, Design, Engineering Leadership  
**Version:** 1.0  
**Date:** June 2026  
**Status:** Approved for Phased Implementation  
**Phase 0 Started:** June 2026 — App shell foundation + customer portal migration begun

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 0: Foundation** | 🟡 In Progress | AppShell, BottomNav, AppBar, StatusBadge, CompletionRing, ActivityFeed, ErrorState, WalletChip created; PWA manifests added; CustomerLayout migrated to app shell |
| Phase 1: Customer App | ⬜ Pending | |
| Phase 2: Staff App | ⬜ Pending | |
| Phase 3: Admin Dashboard | ⬜ Pending | |
| Phase 4: Visual Polish & PWA | ⬜ Pending | |
| Phase 5: QA & Refinement | ⬜ Pending | |

---

## Executive Summary

CWP today is a capable internal operations platform — bookings run, wallets work, staff execute jobs, admins manage the business. But it **feels like business software built for operators**, not a **premium service experience built for humans**.

Our ambition: transform CWP into a **global-grade service operations platform** where:

- **Customers** feel the clarity and trust of Urban Company
- **Staff** feel the focus and speed of Uber Driver / Swiggy Partner
- **Admins** feel the power and calm of Stripe Dashboard + Linear + HubSpot

This plan covers a full experience transformation — **UI, UX, navigation, visual language, and interaction patterns only**. No business logic changes. No schema changes. No new features. We elevate what already exists.

---

## North Star

> *"Within 10 seconds of opening any portal, the user knows exactly where they are, what matters now, and what to do next."*

| Portal | Mental Model | Benchmark |
|--------|-------------|-----------|
| Customer | "My service life in my pocket" | Urban Company, Airbnb Trips, Uber Ride History |
| Staff | "My work shift, one job at a time" | Uber Driver, Swiggy/Zomato Partner |
| Admin | "Command center for the business" | Stripe Dashboard, Linear, HubSpot, Notion |

---

## Design Philosophy

### Three Portals, Three Experiences

```
┌─────────────────────────────────────────────────────────────────┐
│  CUSTOMER PORTAL          STAFF PORTAL           ADMIN PANEL      │
│  ───────────────          ────────────           ───────────    │
│  Mobile-first             Mobile-first           Desktop-first  │
│  PWA app shell            PWA app shell          SaaS dashboard │
│  Bottom nav               Bottom nav +           Sidebar +      │
│  One-handed use           thumb zone             command bar    │
│  Consumer-grade polish    Field-worker clarity   Ops intelligence│
└─────────────────────────────────────────────────────────────────┘
```

### Critical Principle: Customer & Staff Are Apps, Not Websites

**Customer aur Staff portal ko "responsive website" ki tarah treat mat karo.**

Unhe **PWA-style native app experience** ki tarah design karo — jaise Urban Company ya Uber Driver app browser ke andar chal rahi ho.

| Responsive Website Mindset ❌ | PWA App Mindset ✅ |
|-------------------------------|-------------------|
| Desktop nav on large screens | App shell always; bottom nav primary |
| Page scrolls like a document | Screen = viewport; content zones |
| Header + footer + sidebar | Fixed app chrome; content scrolls inside |
| Hover states, small click targets | 48px touch targets; tap-first |
| "Go back to homepage" | Stack navigation; back gesture |
| Loading = blank page | Skeleton screens per section |
| Forms feel like web forms | Step flows with progress rings |

**Why this matters:**
- **Adoption:** Field staff and customers expect app behavior on phones
- **Cost:** Future native/hybrid apps require minimal redesign — same IA, same components, same flows
- **Performance perception:** App shells feel faster than page reloads
- **Trust:** Premium brands never feel like "a website you log into"

### Admin: Modern SaaS Dashboard

Admin behaves like Stripe or Linear — dense when needed, calm by default. Desktop-first layout with full responsive support for tablet emergency use.

### Universal Rules

1. **Information hierarchy over information volume** — show less, reveal more
2. **Status is always visible** — never hunt for "what's happening"
3. **Primary action is always obvious** — one hero CTA per screen
4. **Progress over lists** — timelines, rings, and feeds over raw tables (where appropriate)
5. **Empty states teach** — every blank screen guides the next action
6. **Errors are recoverable** — never dead ends
7. **All screens fully responsive** — but optimized for their primary device class

---

## Part 1: Full UI/UX Audit

### 1.1 Platform-Level Assessment

| Dimension | Current State | Target State | Gap Severity |
|-----------|--------------|--------------|--------------|
| **Portal identity** | Same shadcn template feel across all portals | Distinct app personalities per portal | 🔴 High |
| **Mobile experience** | Customer has bottom nav; Staff/Admin use sidebar | Customer + Staff = full app shell | 🔴 High |
| **Information density** | Admin pages vary wildly; customer home requires scroll | Key info above fold on every home screen | 🟡 Medium |
| **Visual storytelling** | Cards with numbers; minimal progress/status visuals | Timelines, rings, activity feeds, photo galleries | 🔴 High |
| **Navigation clarity** | 6-item customer grid (3×2); staff uses admin-style sidebar | 5-tab bottom nav; staff = 4-tab app nav | 🟡 Medium |
| **Loading & empty states** | Partial — Skeleton exists, inconsistently applied | Universal skeleton + empty state system | 🟡 Medium |
| **Design system maturity** | CSS tokens + shadcn; no documented spec | Full design system with portal variants | 🟡 Medium |
| **PWA readiness** | None — no manifest, no service worker, no install prompt | Full PWA shell for Customer + Staff | 🔴 High |
| **Accessibility** | Basic; no systematic a11y audit | WCAG 2.1 AA target for all portals | 🟡 Medium |
| **Brand distinction** | Teal + dark sidebar = generic SaaS | Premium service-operations identity | 🔴 High |

### 1.2 Customer Portal Audit

**Current routes:** Home, Book, Assets, History, Invoices, Support  
**Layout:** `CustomerLayout.tsx` — sticky header (desktop nav) + 3×2 bottom grid (mobile)

| Screen | What Works | What Fails | Benchmark Gap |
|--------|-----------|-----------|---------------|
| **Home (`/customer/dashboard`)** | Stats cards, wallet snippet, subscription list | Requires scroll for full picture; no "next service" hero; no assigned staff visibility; no activity feed; feels like admin dashboard not consumer app | Urban Company home shows TODAY's service prominently with staff photo, ETA, and one-tap actions |
| **Book (`/customer/bookings`)** | Multi-service booking, asset selection, pricing | Long form on one page; no step progress; no confirmation delight moment | Urban Company: step-by-step with visual progress, slot picker, instant confirmation animation |
| **Assets (`/customer/assets`)** | Vehicle + solar site registration | List-only; no visual asset cards; no service history per asset | Airbnb listing cards — visual, scannable, status-rich |
| **History (`/customer/history`)** | Past bookings + proof photos | Flat list; no timeline; before/after not compared side-by-side | Uber trip history with map + timeline |
| **Invoices (`/customer/invoices`)** | PDF download, due banner | Functional but transactional; no payment status visual | Urban Company order receipts — clean, branded, shareable |
| **Support (`/customer/complaints`)** | File + track complaints | Dialog-based filing; no chat-like thread feel | Urban Company help center — conversational, status-rich |
| **Register/Login** | Basic forms work | No onboarding wizard; no value proposition during signup | Urban Company: progressive onboarding with immediate value |

**Critical Customer Gaps:**
- No dedicated **Wallet** tab (balance buried in Home)
- No dedicated **Services** view (active subscriptions scattered)
- No **live service tracking** (staff assigned, en route, in progress)
- No **completion proof gallery** with before/after comparison
- Bottom nav is 3×2 grid — feels cramped; labels at 10px are too small
- Desktop experience breaks app metaphor with top nav bar

### 1.3 Staff Portal Audit

**Current routes:** Dashboard, Schedule, Attendance, Performance  
**Layout:** `StaffLayout.tsx` → `PanelShell` with **dark sidebar** (admin pattern)

| Screen | What Works | What Fails | Benchmark Gap |
|--------|-----------|-----------|---------------|
| **Dashboard (`/staff/dashboard`)** | Today's jobs, status transitions, photo upload | Sidebar navigation on mobile; job cards in a list not a focused task view; small action buttons; tabs (today/upcoming/done) require extra taps | Uber Driver: ONE current job fills the screen with giant Start/Complete buttons |
| **Schedule (`/staff/schedule`)** | Chronological list | No calendar view; no route map; read-only | Swiggy Partner: timeline with earnings per slot |
| **Attendance (`/staff/attendance`)** | Self mark attendance | Separate from job flow; extra navigation step | Integrated into shift start/end |
| **Performance (`/staff/performance`)** | KPIs + leaderboard | Feels like admin analytics, not motivator | Swiggy: today's earnings front and center, gamified streaks |

**Critical Staff Gaps:**
- **Wrong navigation paradigm** — sidebar is admin UX, not field-worker UX
- No **current assignment focus mode** — all jobs equal weight
- Photo upload is functional but not **camera-first** (no full-screen capture UI)
- No **offline-friendly** UI patterns (queued actions, sync indicators)
- No **one-tap call/navigate** to customer
- Touch targets below 48px on several controls
- No earnings summary on home screen

### 1.4 Admin Portal Audit

**Current routes:** 22 screens across Operations, Network, Config  
**Layout:** `AdminLayout.tsx` → collapsible dark sidebar + `PanelShell`

| Screen | What Works | What Fails | Benchmark Gap |
|--------|-----------|-----------|---------------|
| **Dashboard (`/admin/dashboard`)** | Stats + subscription health | Single generic dashboard; no role-specific views; no alert/blocker panel; no 10-second health read | Stripe: KPI cards + trend sparklines + alert banner in one glance |
| **Bookings (`/admin/bookings`)** | Full ops board, staff assign, timeline | Dense table-first; good function, weak visual hierarchy | Linear: clean issue board with status lanes |
| **Daily Ops (`/admin/daily-ops`)** | Scheduler, tick, blocked subs | Operator-focused; manual triggers prominent; no autonomous monitoring feel | HubSpot ops dashboard: automated alerts, not manual buttons |
| **Leads (`/admin/leads`)** | DnD pipeline | Functional CRM; not a sales workspace | HubSpot: deal cards with next-action prompts |
| **Customers (`/admin/customers`)** | DataTable + detail page | Detail page is form-heavy; no customer 360 timeline | HubSpot contact record: activity timeline center stage |
| **Analytics (`/admin/analytics`)** | Charts exist | Single page; not split by domain (Ops/Finance/Growth) | Stripe: domain-specific dashboards |
| **Invoices/Dues/Expenses** | All functional | Fragmented across 4 nav items; no unified finance view | Stripe Billing: unified revenue dashboard |
| **Complaints** | Status management | Ticket list; no SLA indicators | Linear: priority + assignee + aging |

**Critical Admin Gaps:**
- No **unified alert center** — blockers scattered across pages
- No **command palette / global search** (Linear-style ⌘K)
- No **domain-specific dashboards** (Operations, Finance, Daily Cleaning, Solar, Support, Staff, Growth)
- Sidebar has 22 items — cognitive overload without grouping UX polish
- Inconsistent page maturity (bookings = polished; expenses = basic)
- No **activity feed** on dashboard
- Dark sidebar + teal = generic admin template aesthetic

### 1.5 Cross-Cutting UX Failures

1. **No portal-specific design language** — Customer, Staff, Admin share the same component defaults
2. **No motion design system** — framer-motion used ad hoc, not systematically
3. **No notification center UI** in any portal (backend exists)
4. **Broken nav link** — Franchisee `/franchisee/notifications` has no route
5. **Dark mode tokens exist but no toggle** — incomplete theming
6. **No installable PWA** — missed mobile adoption opportunity
7. **"Contact CWP" dead ends** — wallet recharge, account linking show support message instead of guided UI (display-only improvement possible)

---

## Part 2: Screen-by-Screen Redesign Recommendations

### 2.1 Customer Portal — Screen Redesigns

#### Navigation Restructure

**From:** Home | Book | Assets | History | Invoices | Support (6 items, 3×2 grid)  
**To:** Home | Services | Book | Wallet | Account (5 items, single-row bottom nav)

| Tab | Route | Contains |
|-----|-------|----------|
| **Home** | `/customer/dashboard` | Today hero, next service, wallet chip, activity feed |
| **Services** | `/customer/services` | Active plans, scheduled visits, solar AMC progress |
| **Book** | `/customer/bookings` | New booking flow (center tab, elevated FAB-style) |
| **Wallet** | `/customer/wallet` | Balance, transactions, dues (merged from dashboard) |
| **Account** | `/customer/account` | Profile, assets, history, invoices, support (hub screen) |

> History, Invoices, Assets, Support become **sections within Account** — reducing bottom nav clutter while keeping IA clean.

#### C-01: Home Screen

**Above the fold (no scroll):**
```
┌──────────────────────────────────────┐
│  Good morning, Rahul          🔔     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  NEXT SERVICE          LIVE ● │  │
│  │  Car Wash · Tomorrow 9 AM      │  │
│  │  Honda City · KA-01-AB-1234    │  │
│  │  Rajesh (Detailer) · ⭐ 4.8    │  │
│  │  [Track Service]               │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Wallet  │ │ Active  │ │ Due    │ │
│  │ ₹2,400  │ │ 3 Plans │ │ ₹0     │ │
│  └─────────┘ └─────────┘ └────────┘ │
└──────────────────────────────────────┘
│  Recent Activity                     │
│  ● Car wash completed · 2 days ago   │
│  ● ₹500 credited to wallet           │
└──────────────────────────────────────┘
```

**Changes:**
- Replace 4 stat cards with 1 hero "Next Service" card + 3 compact chips
- Add activity feed (recent 5 events)
- Add notification bell with badge
- Remove desktop top nav — use app shell on all breakpoints
- Wallet balance always visible in header chip

#### C-02: Services Screen (New IA)

- **Active service cards** with completion ring (e.g., "8/12 washes this month")
- **Solar AMC card** with next visit date + panels cleaned count
- **Paused/cancelled** services in collapsed section
- Tap card → service detail with full timeline

#### C-03: Book Service Flow

**Step flow with progress ring:**
1. Choose service type (visual cards: Car Wash, Detailing, Solar, Pickup)
2. Select asset (visual vehicle/site cards)
3. Pick date & time (calendar + slot chips)
4. Review & confirm (price breakdown, wallet impact preview)
5. Confirmation screen (animated check, booking reference, add-to-calendar)

**UX rules:**
- One step per screen on mobile
- Back gesture / back button always available
- Price visible from step 1
- Cannot proceed without required selections (inline validation)

#### C-04: Wallet Screen (New)

- Large balance display with trend arrow
- Low balance warning banner (existing logic, better visual)
- Transaction list with icons (credit/debit/service charge)
- Dues section with invoice links
- "Contact to recharge" as styled info card (no logic change — better presentation)

#### C-05: Account Hub (New)

- Profile header with avatar initial
- Menu list: My Assets, Service History, Invoices, Support, Settings, Sign Out
- Each opens as sub-screen with back navigation (stack pattern)

#### C-06: Service History (within Account)

- **Timeline view** grouped by month
- Each entry: service card with status badge, date, staff name, photo thumbnail
- Tap → detail with **before/after comparison slider**

#### C-07: Support (within Account)

- Complaint list with status pills (Open, In Progress, Resolved)
- New complaint: bottom sheet with type selector chips (not dialog)
- Thread-style detail view with status timeline

#### C-08: Registration & Onboarding

**Post-registration wizard (3 steps, skippable):**
1. Add your first vehicle/site
2. Explore available services
3. Here's your wallet — how it works

### 2.2 Staff Portal — Screen Redesigns

#### Navigation Restructure

**From:** Sidebar (Dashboard, Schedule, Attendance, Performance)  
**To:** Bottom tab bar (4 tabs)

| Tab | Route | Purpose |
|-----|-------|---------|
| **Today** | `/staff/dashboard` | Current job + today's queue |
| **Jobs** | `/staff/jobs` | All jobs (today/upcoming/completed segments) |
| **Earnings** | `/staff/earnings` | Today/week/month earnings summary |
| **Profile** | `/staff/profile` | Attendance, performance, settings |

#### S-01: Today Screen (Home)

**When job is active — full-screen focus mode:**
```
┌──────────────────────────────────────┐
│  CURRENT JOB                    2/5  │
│  ─────────────────────────────────── │
│  Car Wash · Daily Cleaning           │
│  Rahul Sharma                        │
│  📍 Koramangala, Bangalore           │
│  ⏰ 9:00 AM · Honda City             │
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │     [Before Photo Area]        │  │
│  │     Tap to capture             │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  ▶  START JOB                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  [📞 Call]  [🗺 Navigate]  [💬 Note]  │
└──────────────────────────────────────┘
```

**UX rules:**
- ONE primary job fills 80% of screen
- Remaining jobs as compact list below (collapsed by default)
- All action buttons minimum 56px height
- Status progression: Start → Upload Before → Upload After → Complete
- Each step unlocks the next (visual step indicator)
- Full-screen camera overlay for photo capture

#### S-02: Jobs Screen

- Segmented control: Today | Upcoming | Completed
- Job cards with status color bar (left edge)
- Swipe actions (future): call, navigate
- Completed jobs show before/after thumbnail pair

#### S-03: Earnings Screen

- **Today's earnings** large number at top
- Week/month toggle
- Job-by-job earnings breakdown
- Performance rank badge (from existing leaderboard data)

#### S-04: Profile Screen

- Attendance mark (move from separate page — one tap)
- Performance stats (compact)
- Sign out

#### S-05: Offline-Friendly Patterns (UI Layer)

- Queue indicator: "2 actions pending sync"
- Offline banner: "You're offline — actions will sync when connected"
- Optimistic UI: button shows success immediately, syncs in background
- Photo upload: show local preview instantly, upload progress bar

> **Note:** Offline architecture is UI-recommendation + service worker caching. No business logic changes — existing API calls wrapped in queue UI.

### 2.3 Admin Portal — Screen Redesigns

#### Navigation Restructure

**Sidebar groups refined with visual hierarchy:**

```
OPERATIONS          ← Bold group header
  🏠 Command Center     (new unified dashboard)
  📋 Bookings
  ✨ Daily Cleaning
  📦 Subscriptions
  🎫 Complaints

CUSTOMERS & GROWTH
  🎯 Leads & CRM
  👥 Customers
  📉 Churned

FINANCE
  💰 Revenue Dashboard  (new — merges invoices/dues/expenses overview)
  📄 Invoices
  📊 Dues
  💸 Expenses

WORKFORCE
  👷 Staff
  ✅ Verification
  🔑 Credentials

NETWORK
  🏢 Franchisees
  🌿 Branches

CONFIG
  🔧 Services
  📈 Analytics
  🔔 Notifications
```

#### A-01: Command Center (Dashboard Redesign)

**10-second business health layout:**
```
┌─────────────────────────────────────────────────────────┐
│  ⚠ ALERTS (3)                                          │
│  · 5 unassigned bookings today                          │
│  · 2 subscriptions blocked (low wallet)                 │
│  · 1 complaint open > 24h                             │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Today    │ │ Revenue  │ │ Active   │ │ Staff    │  │
│  │ 24/30    │ │ ₹1.2L    │ │ 847      │ │ 18/22    │  │
│  │ bookings │ │ this mo  │ │ customers│ │ on duty  │  │
│  │ ▲ 12%    │ │ ▲ 8%     │ │ ▲ 3%     │ │ ▼ 2      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  Today's Operations          │  Action Required          │
│  [Completion ring 80%]       │  · Assign 5 bookings     │
│  [Timeline of events]        │  · Review 2 leads        │
│                              │  · Approve 1 staff        │
└─────────────────────────────────────────────────────────┘
```

**Domain dashboard tabs (within Command Center):**
- Operations | Finance | Daily Cleaning | Solar | Support | Staff | Growth

Each tab filters KPIs and alerts to that domain — same page, different lens.

#### A-02: Bookings Board

- Add **status lane view** toggle (Kanban: Scheduled → En Route → In Progress → Completed)
- Booking detail as **side panel** (not separate page) — Linear-style
- Timeline of booking events prominent in detail panel
- Photo proof gallery in detail panel

#### A-03: Daily Cleaning Dashboard

- **Autonomous feel:** status cards instead of manual trigger buttons
- Today's schedule as visual timeline (hour blocks)
- Blocked subscriptions as alert cards with one-click "notify customer" (existing notification dispatch)
- Completion ring for today's daily wash progress

#### A-04: Customer Detail (360 View)

- **Activity timeline** as center column (bookings, payments, complaints, wallet events)
- Left: customer info + wallet + subscriptions
- Right: quick actions (credit wallet, create booking, view invoices)
- Remove form-heavy layout — progressive disclosure

#### A-05: Leads Pipeline

- Deal cards with **next action prompt** ("Call scheduled · Follow up today")
- Column headers with count + value totals
- Win/loss ratio mini-chart at top

#### A-06: Finance Hub (New Overview)

- Unified revenue dashboard pulling from existing invoices/dues/expenses data
- Collection rate, outstanding dues, monthly trend chart
- Quick links to detail pages

#### A-07: Global Patterns

- **Command palette** (⌘K / Ctrl+K): search customers, bookings, staff, pages
- **Consistent page header** component on every admin page: title + description + primary action
- **Side panel pattern** for detail views (avoid full page navigation for records)
- **Bulk action bar** appears when rows selected in tables

---

## Part 3: Design System Specification

### 3.1 Brand Identity

**CWP Brand Personality:** Premium · Trustworthy · Modern · Operationally Powerful

**Avoid:**
- Generic ERP aesthetic (gray tables, dense forms, no whitespace)
- Bootstrap admin template look
- Over-teal monochrome (current risk)

**Embrace:**
- Clean whitespace with purposeful density zones
- Service photography and proof imagery as first-class UI elements
- Status color system that communicates instantly
- Subtle depth (elevation layers, not flat everything)

### 3.2 Color System

#### Core Brand Palette

| Token | Light Mode | Usage |
|-------|-----------|-------|
| `--brand-primary` | `hsl(180 100% 40%)` | Primary actions, active states, brand mark |
| `--brand-primary-soft` | `hsl(180 60% 95%)` | Backgrounds, selected states |
| `--brand-dark` | `hsl(220 15% 15%)` | Admin sidebar, staff app header |
| `--brand-surface` | `hsl(0 0% 100%)` | Cards, app surfaces |
| `--brand-background` | `hsl(220 20% 97%)` | Page backgrounds |
| `--brand-text-primary` | `hsl(220 40% 10%)` | Headings, primary text |
| `--brand-text-secondary` | `hsl(220 10% 40%)` | Supporting text |

#### Status Colors (Universal)

| Status | Color | Usage |
|--------|-------|-------|
| Scheduled | Sky `#0EA5E9` | Upcoming, pending |
| En Route | Orange `#F97316` | In transit, active movement |
| In Progress | Teal (primary) | Currently executing |
| Completed | Green `#22C55E` | Done, success |
| Cancelled | Red `#EF4444` | Cancelled, failed |
| Paused | Amber `#F59E0B` | Blocked, paused, low balance |
| Resolved | Green soft | Complaint resolved |

#### Portal Accent Variants

| Portal | Accent | Rationale |
|--------|--------|-----------|
| Customer | Primary teal | Consumer trust, freshness |
| Staff | Teal + amber earnings | Motivation, warmth for earnings |
| Admin | Teal + neutral gray | Professional, data-focused |
| Franchisee | Amber (existing) | Partner distinction |

### 3.3 Typography

| Level | Font | Size (Mobile) | Size (Desktop) | Weight | Usage |
|-------|------|----------------|----------------|--------|-------|
| Display | Outfit | 28px | 32px | 700 | Hero numbers, page titles |
| H1 | Outfit | 24px | 28px | 700 | Screen titles |
| H2 | Outfit | 20px | 24px | 600 | Section headers |
| H3 | Plus Jakarta Sans | 16px | 18px | 600 | Card titles |
| Body | Plus Jakarta Sans | 15px | 15px | 400 | Default text |
| Body Small | Plus Jakarta Sans | 13px | 13px | 400 | Secondary text |
| Caption | Plus Jakarta Sans | 11px | 12px | 500 | Labels, timestamps |
| Button | Plus Jakarta Sans | 15px | 14px | 600 | Button labels |
| Tab Label | Plus Jakarta Sans | 10px | 11px | 500 | Bottom nav labels |

**Rules:**
- Customer/Staff: minimum 15px body text (readability on mobile)
- Admin: 14px body acceptable for dense data
- Numbers in KPI cards: Display font, tabular-nums
- Line height: 1.5 body, 1.2 headings

### 3.4 Spacing System

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon gaps, tight padding |
| `space-2` | 8px | Inline spacing, chip padding |
| `space-3` | 12px | Card inner padding (compact) |
| `space-4` | 16px | Default padding, screen margins |
| `space-5` | 20px | Section gaps |
| `space-6` | 24px | Card padding (standard) |
| `space-8` | 32px | Section separation |
| `space-10` | 40px | Large section gaps |
| `space-12` | 48px | Hero spacing |

**App shell spacing:**
- Screen horizontal padding: 16px (mobile), 24px (tablet+)
- Bottom nav height: 64px + safe-area-inset
- Top app bar height: 56px
- Content area: `calc(100dvh - topbar - bottomnav)`

### 3.5 Grid System

| Portal | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| Customer | 4-column | 8-column | 8-column (max 480px centered for app feel) |
| Staff | 4-column | 4-column | 6-column (max 640px centered) |
| Admin | 4-column | 8-column | 12-column (full width) |

### 3.6 Component Specifications

#### App Shell (Customer + Staff)

```
┌──────────────────────────────┐
│  App Bar (56px, fixed top)   │
├──────────────────────────────┤
│                              │
│  Content Area (scrollable)   │
│                              │
├──────────────────────────────┤
│  Bottom Nav (64px, fixed)    │
└──────────────────────────────┘
```

- No sidebar on any breakpoint for Customer/Staff
- Content scrolls independently between fixed chrome
- Safe area insets for notched devices
- Status bar color matches app bar

#### Bottom Navigation

- 4–5 items maximum
- Icon: 24px, Label: 10–11px
- Active: filled icon + primary color + label
- Inactive: outline icon + muted color
- Center FAB option for primary action (Book for customer)
- Touch target: full tab width × 64px height

#### Cards

| Variant | Usage | Spec |
|---------|-------|------|
| **Hero Card** | Next service, current job | Full-width, 16px radius, subtle shadow, gradient optional |
| **Stat Chip** | Wallet, plans, dues | Compact, 12px radius, inline horizontal |
| **Service Card** | Active subscription | 16px radius, left status color bar 4px, completion ring |
| **Job Card** | Staff job list item | 12px radius, status bar, customer name bold |
| **Activity Item** | Feed entries | No card border, bottom divider, icon + text + timestamp |

#### Buttons

| Variant | Height (Mobile) | Height (Desktop) | Usage |
|---------|----------------|-----------------|-------|
| Primary | 52px | 40px | Main action (Start Job, Book Now) |
| Secondary | 48px | 36px | Secondary actions |
| Ghost | 44px | 32px | Tertiary, navigation |
| Icon | 48px × 48px | 36px × 36px | Call, navigate, camera |
| FAB | 56px × 56px | — | Center nav action |

Staff portal: **all primary actions minimum 52px height on mobile**.

#### Badges & Status Indicators

| Type | Style |
|------|-------|
| Status badge | Pill, status color background at 10% opacity, text in status color |
| Count badge | Circle, 18px, primary bg, white text |
| Live indicator | Pulsing green dot + "LIVE" label |
| Progress ring | Circular, 48–64px, percentage in center |

#### Tables (Admin Only)

- Row height: 48px
- Hover: subtle background
- Selected: primary soft background
- Sticky header on scroll
- Column sorting indicators
- Empty row → empty state component
- Mobile: table → card list transformation

#### Forms

- Input height: 48px (mobile), 40px (admin desktop)
- Label above input, 13px, medium weight
- Error inline below field, red, with icon
- Step forms: progress bar or ring at top
- Bottom sheet for mobile form flows (not centered dialog)

#### Dialogs & Sheets

| Context | Pattern |
|---------|---------|
| Customer mobile | Bottom sheet (swipe to dismiss) |
| Staff mobile | Full-screen modal for camera; bottom sheet for confirmations |
| Admin | Side panel (right, 480px) for detail; dialog for confirmations |

#### Charts (Admin)

- Chart height: 240px default, 320px for dashboard hero
- Colors: primary + 3 complementary
- Always show: title, period selector, trend indicator
- Tooltip on hover with formatted values
- Empty chart → "No data for this period" with illustration

#### Empty States

```
┌──────────────────────────────┐
│                              │
│        [Illustration]        │
│                              │
│     No upcoming services     │
│  Book your first service to  │
│       get started            │
│                              │
│      [ Book Now ]            │
│                              │
└──────────────────────────────┘
```

- Every list/table MUST have an empty state
- Include: illustration (or icon), title, description, primary action
- Context-specific copy (not generic "No data")

#### Loading States

- **Never** show blank white screen
- Use skeleton screens matching final layout shape
- Hero card skeleton: pulsing rectangle with rounded corners
- List skeleton: 3–5 `SkeletonRow` items
- Button loading: spinner replacing label, same button size
- Page transition: content fade-in (200ms)

#### Error States

- Inline error for form fields
- Toast for transient failures (existing pattern, keep)
- Full-page error for load failures: illustration + "Something went wrong" + Retry button
- Offline error (Staff): persistent banner, not blocking

---

## Part 4: Navigation Architecture

### 4.1 Customer Navigation Map

```
/customer
├── /dashboard          → Home (default)
├── /services           → Active services & AMC
├── /bookings           → Book service (step flow)
│   └── /bookings/:id   → Booking detail / tracking
├── /wallet             → Balance & transactions
└── /account            → Account hub
    ├── /account/assets     → My vehicles & solar sites
    ├── /account/history    → Service history (timeline)
    ├── /account/invoices   → Invoices
    ├── /account/support    → Complaints & help
    └── /account/settings   → Profile & preferences
```

**Navigation behavior:**
- Bottom tabs switch root screens (no back stack)
- Sub-screens within Account use stack navigation (back button in app bar)
- Deep links supported for booking detail, invoice PDF
- Book flow is modal stack (can dismiss to return to previous tab)

### 4.2 Staff Navigation Map

```
/staff
├── /dashboard          → Today (current job focus)
├── /jobs               → All jobs (segmented)
│   └── /jobs/:id       → Job detail (full-screen task mode)
├── /earnings           → Earnings summary
└── /profile            → Profile, attendance, performance
```

**Navigation behavior:**
- Bottom tabs for root screens
- Job detail opens as full-screen overlay with back
- Camera capture is full-screen modal (no nav visible)
- Status transitions happen in-place (no navigation)

### 4.3 Admin Navigation Map

```
/admin
├── /dashboard          → Command Center (domain tabs)
├── /bookings           → Bookings board
│   └── panel: booking detail
├── /daily-ops          → Daily cleaning dashboard
├── /subscriptions      → Subscription management
├── /complaints         → Support tickets
├── /leads              → CRM pipeline
├── /customers          → Customer list
│   └── /customers/:id  → Customer 360 (side panel or page)
├── /finance            → Revenue dashboard (new)
├── /invoices           → Invoice management
├── /dues               → Collections
├── /expenses           → Expense tracking
├── /staff              → Staff management
├── /staff-approval     → Verification queue
├── /credentials        → Credential management
├── /franchisees        → Franchisee management
├── /churned            → Churned customers
├── /branches           → Branch config
├── /services           → Service catalog
├── /analytics          → Analytics
├── /notifications      → Notification management
└── /quotations         → Quotation builder
```

**Navigation behavior:**
- Sidebar for primary navigation (desktop)
- Collapsible sidebar (existing, keep)
- Detail views open in **right side panel** (480px) — no full page navigation for records
- Command palette (⌘K) for global search
- Breadcrumbs for deep admin pages

### 4.4 Navigation Component Hierarchy

```
AppShell (Customer/Staff)
├── AppBar
│   ├── BackButton (conditional)
│   ├── Title
│   └── Actions (notification, wallet chip)
├── ContentArea (scrollable)
└── BottomNav
    └── TabItem × 4-5

AppShell (Admin)
├── Sidebar
│   ├── Logo
│   ├── NavGroup × 3-4
│   └── UserMenu
├── TopBar
│   ├── Breadcrumbs
│   ├── Search (⌘K trigger)
│   └── UserMenu
├── ContentArea
└── SidePanel (conditional, overlay)
```

---

## Part 5: Mobile Architecture

### 5.1 PWA App Shell Strategy

Customer and Staff portals ship as **Progressive Web Apps** — installable, offline-capable shells that feel native.

#### PWA Configuration

| Feature | Customer | Staff | Admin |
|---------|----------|-------|-------|
| Web manifest | ✅ | ✅ | ❌ (desktop-first) |
| Service worker | ✅ Cache app shell + assets | ✅ Cache + offline queue UI | ❌ |
| Install prompt | ✅ After 2nd visit | ✅ On first login | ❌ |
| Push notifications | ✅ Future-ready UI | ✅ Future-ready UI | ❌ |
| Splash screen | ✅ Branded | ✅ Branded | ❌ |
| Standalone display | ✅ | ✅ | browser |

#### Manifest Differentiation

**Customer:** `"name": "CWP — My Services"`, theme_color: teal, start_url: `/customer/dashboard`  
**Staff:** `"name": "CWP Staff"`, theme_color: dark, start_url: `/staff/dashboard`

#### App Shell Caching Strategy

- **Cache-first:** App shell (HTML, JS, CSS, fonts, icons)
- **Network-first:** API data (React Query handles with stale-while-revalidate)
- **Offline fallback:** Cached last-known data + offline banner
- **Background sync:** Queue staff status transitions and photo uploads (UI layer)

### 5.2 Mobile Layout Specifications

#### Viewport & Safe Areas

```css
/* App content area */
.app-content {
  height: calc(100dvh - var(--app-bar-height) - var(--bottom-nav-height));
  padding-bottom: env(safe-area-inset-bottom);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Bottom nav safe area */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(64px + env(safe-area-inset-bottom));
}
```

#### Touch Target Requirements

| Element | Minimum Size | Spacing |
|---------|-------------|---------|
| Bottom nav tab | Full width × 64px | — |
| Primary button | Full width × 52px | 16px margin |
| Icon button | 48px × 48px | 8px gap |
| List item | Full width × 56px | — |
| Form input | Full width × 48px | 12px vertical gap |
| Chip/tag | 36px height | 8px gap |

#### One-Handed Use (Android First)

- Primary actions in **bottom 40%** of screen
- Destructive actions require confirmation but button still in thumb zone
- Swipe-back gesture support (via stack navigation)
- FAB for Book (customer) centered in bottom nav
- Pull-to-refresh on list screens

### 5.3 Mobile Screen States

Every mobile screen must implement 4 states:

1. **Loading** — Skeleton matching layout
2. **Empty** — Illustration + guidance + action
3. **Populated** — Normal content
4. **Error** — Message + retry action

### 5.4 Future Native App Readiness

By designing Customer + Staff as PWA apps now:

| PWA Component | Maps to Native |
|--------------|-------------|
| AppShell | Activity/ViewController shell |
| BottomNav | TabBarController |
| Stack navigation | NavigationController |
| Bottom sheet | Bottom sheet / Action sheet |
| Full-screen camera | CameraViewController |
| Service cards | CollectionView cells |
| Activity feed | TableView with sections |
| Progress ring | Custom UIView / Canvas |

**Estimated native app migration effort reduction: 60–70%** — IA, components, and flows transfer directly.

---

## Part 6: Desktop Architecture

### 6.1 Admin Desktop Layout

```
┌──────────┬──────────────────────────────────────────────┐
│          │  Top Bar: Breadcrumbs · Search · User        │
│ Sidebar  ├──────────────────────────────────────────────┤
│  240px   │                                              │
│          │  Page Content (max-width: none, 24px pad)     │
│  Collaps │                                              │
│  to 64px │                                              │
│          ├──────────────────────┬───────────────────────┤
│          │                      │  Side Panel (480px)   │
│          │                      │  (conditional)        │
└──────────┴──────────────────────┴───────────────────────┘
```

### 6.2 Admin Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| ≥ 1280px | Full sidebar + content + side panel |
| 1024–1279px | Collapsed sidebar + content + side panel overlay |
| 768–1023px | Hidden sidebar (hamburger) + full-width content |
| < 768px | Single column; tables become card lists; emergency use only |

### 6.3 Customer/Staff on Desktop

Even on desktop, Customer and Staff maintain **app shell with bottom nav** — centered in a max-width container (480px customer, 640px staff) to preserve app metaphor.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Window                        │
│                                                         │
│          ┌───────────────────────┐                      │
│          │    App Shell (480px)  │                      │
│          │    centered           │                      │
│          │                       │                      │
│          │    [Content]          │                      │
│          │                       │                      │
│          │    [Bottom Nav]       │                      │
│          └───────────────────────┘                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This ensures:
- No redesign needed when wrapping in Capacitor/React Native
- Consistent experience across phone, tablet, desktop
- Desktop users still get full functionality

---

## Part 7: Customer Journey Maps

### 7.1 New Customer Journey

```
DISCOVER          SIGN UP           ONBOARD            FIRST BOOKING         ONGOING
────────          ───────           ───────            ─────────────         ───────
Landing page  →   Register     →    Add vehicle   →    Choose service   →   Home screen
See services      Phone verify     See wallet         Pick slot            Track service
See pricing       Auto-login         Explore plans      Confirm              Rate (future)
                  Welcome screen     Skip option        Confirmation joy     Wallet auto-debit
```

**Emotion target:** Curious → Confident → Delighted → Trusting

**Key moments of truth:**
1. Registration completes in < 60 seconds
2. First vehicle added with visual confirmation
3. First booking confirmed with clear next steps
4. First service completed with before/after proof

### 7.2 Daily Customer Journey (Active Subscriber)

```
MORNING              SERVICE DAY           POST-SERVICE          MONTHLY
───────              ───────────           ────────────          ───────
Open app         →   Push: "Today!"    →   Push: "Completed!" →   Wallet low?
See next service     Track staff            View before/after       Recharge prompt
Wallet OK              ETA updates            Rate service            Invoice ready
                                             Share proof
```

### 7.3 Customer Support Journey

```
ISSUE OCCURS         REPORT              TRACK                RESOLUTION
────────────         ──────              ─────                ──────────
Service quality  →   Tap Support    →    See status      →   Push: "Resolved"
Billing question     Select type          Agent assigned       View resolution
App confusion        Describe issue       Timeline updates     Rebook if needed
                     Submit
```

---

## Part 8: Staff Journey Maps

### 8.1 Daily Staff Shift

```
START SHIFT          EXECUTE JOBS              END SHIFT
───────────          ────────────              ─────────
Open app         →   See current job      →    View earnings
Mark attendance      Navigate to customer       Review completed
See today's count    Start job                  Mark attendance out
Earnings preview     Before photo               Performance update
                     Complete service
                     After photo
                     Next job auto-loads
```

**Emotion target:** Ready → Focused → Accomplished

**Key moments of truth:**
1. Today's job count and earnings visible immediately
2. Current job fills screen — no hunting
3. Photo capture feels like camera app, not file upload
4. Job completion shows instant earnings update

### 8.2 First-Day Staff Journey

```
ONBOARDING           FIRST JOB                LEARNING
──────────           ─────────                ────────
Admin creates    →   See assigned job    →    Complete with photos
account              Large clear buttons       See earnings
Login on phone       Call customer if needed   Check performance
App install prompt   Follow status steps       Done for the day
Simple 4-tab nav
```

---

## Part 9: Admin Journey Maps

### 9.1 Daily Operations Manager

```
MORNING REVIEW       MID-DAY OPS              END OF DAY
──────────────       ───────────              ──────────
Open Command     →   Assign unassigned   →    Review completion
Center               Handle blocked subs        Check dues
Check alerts         Monitor daily ops          Plan tomorrow
Review today's       Resolve complaints         Export/report
schedule
```

**10-second test:** Alerts visible → KPIs scanned → First action identified

### 9.2 Customer Support Agent

```
COMPLAINT ARRIVES    TRIAGE                   RESOLVE
─────────────────    ──────                   ───────
Alert on Command →   Open complaint      →    Update status
Center               Assign to self             Add resolution note
                     Contact customer           Customer notified
                     Check booking history
```

### 9.3 Finance Manager

```
MONTH START          ONGOING                  MONTH END
───────────          ───────                  ─────────
Revenue dashboard →  Track collections   →    Review outstanding
Outstanding dues     Record payments          Expense summary
Collection rate      Invoice generation       Revenue report
```

---

## Part 10: Visual Improvements Catalog

### 10.1 New Visual Components to Introduce

| Component | Portal | Description |
|-----------|--------|-------------|
| **Service Timeline** | Customer, Admin | Vertical timeline with status nodes and timestamps |
| **Completion Ring** | Customer, Admin | Circular progress (8/12 washes) |
| **Activity Feed** | Customer, Admin | Chronological event list with icons |
| **Before/After Slider** | Customer, Staff, Admin | Draggable image comparison |
| **Status Lane Board** | Admin | Kanban-style booking board |
| **KPI Card with Sparkline** | Admin | Number + mini trend chart |
| **Alert Banner** | Admin | Dismissible top banner for blockers |
| **Job Focus Card** | Staff | Full-screen current job UI |
| **Earnings Counter** | Staff | Animated number for today's earnings |
| **Photo Capture Overlay** | Staff | Full-screen camera with guide frame |
| **Step Progress Ring** | Customer | Multi-step flow indicator |
| **Wallet Chip** | Customer | Compact balance in app bar |
| **Customer 360 Timeline** | Admin | Unified activity timeline |
| **Empty State Illustrations** | All | Custom SVG illustrations per context |
| **Side Panel** | Admin | Record detail without page navigation |
| **Command Palette** | Admin | ⌘K search overlay |

### 10.2 Photography & Imagery Guidelines

- Service proof photos displayed prominently (not thumbnail-only)
- Before/after pairs always shown together
- Vehicle/site photos on asset cards
- Staff avatar with initials fallback
- No stock photography — use illustrations for empty states

### 10.3 Motion Design

| Interaction | Animation | Duration |
|------------|-----------|----------|
| Tab switch | Crossfade content | 150ms |
| Card tap | Scale 0.98 → 1 | 100ms |
| Step flow advance | Slide left | 250ms |
| Step flow back | Slide right | 250ms |
| Job status change | Color transition + checkmark | 300ms |
| Booking confirmation | Scale-up check + confetti | 500ms |
| Skeleton pulse | Opacity 0.5 → 1 | 1500ms loop |
| Side panel open | Slide from right | 200ms |
| Bottom sheet open | Slide from bottom | 250ms |
| Earnings counter | Number count-up | 800ms |

**Rule:** Motion serves feedback, not decoration. No animation exceeds 500ms except earnings counter.

---

## Part 11: Workflow Redesign Summary

| Workflow | Current Pain | Redesign Focus |
|----------|-------------|----------------|
| **Customer onboarding** | Register → empty dashboard | 3-step wizard: vehicle → services → wallet education |
| **Asset onboarding** | Form on assets page | Visual card-based add flow with photo |
| **Booking flow** | Single long page | 5-step flow with progress ring |
| **Wallet flow** | Balance on dashboard, "contact us" | Dedicated wallet screen with transaction timeline |
| **Invoice flow** | List + PDF download | Invoice cards with status badge + one-tap download |
| **Complaint flow** | Dialog form | Bottom sheet + thread-style tracking |
| **Staff workflow** | Job list with tabs | Focus mode: one job per screen |
| **Daily cleaning** | Admin manual triggers | Autonomous dashboard with completion ring |
| **Solar AMC** | Hidden in generic subscriptions | Dedicated service card with visit tracker |
| **Scheduling** | Date picker in form | Visual calendar + slot chips |
| **Admin workflow** | 22 flat sidebar items | Grouped sidebar + command center + side panels |
| **Support workflow** | Separate complaint page | Alert-driven from command center |

**Reminder:** All workflow redesigns use existing API endpoints and business logic. We are restructuring UI flows, not creating new backend capabilities.

---

## Part 12: Implementation Roadmap

### Phase 0: Foundation (Week 1–2)
**Goal:** Design system + app shell infrastructure

- [ ] Document design tokens in `index.css` (extend existing)
- [ ] Create `AppShell` component (Customer/Staff)
- [ ] Create `BottomNav` component
- [ ] Create `AppBar` component
- [ ] Create universal `EmptyState`, `ErrorState`, `LoadingSkeleton` components
- [ ] Create `StatusBadge`, `CompletionRing`, `ActivityFeed` components
- [ ] Create `SidePanel` component (Admin)
- [ ] Add PWA manifest files (customer + staff)
- [ ] Add service worker for app shell caching
- [ ] Add safe-area CSS utilities

**Files affected:**
- `src/components/ui/` — new primitives
- `src/components/shared/` — new patterns
- `src/components/layout/` — new app shells
- `public/manifest-customer.json`, `public/manifest-staff.json`
- `src/index.css` — token extensions

### Phase 1: Customer App Transformation (Week 3–5)
**Goal:** Customer portal feels like Urban Company

- [ ] Replace `CustomerLayout` with `CustomerAppShell`
- [ ] Restructure bottom nav: Home | Services | Book | Wallet | Account
- [ ] Redesign Home screen (hero card + activity feed)
- [ ] Create Services screen (active plans + completion rings)
- [ ] Redesign Book flow as step wizard
- [ ] Create Wallet screen
- [ ] Create Account hub with sub-screens
- [ ] Redesign History as timeline with before/after
- [ ] Redesign Support as thread-style
- [ ] Add onboarding wizard post-registration
- [ ] Apply skeleton/empty/error states to all customer screens

### Phase 2: Staff App Transformation (Week 6–8)
**Goal:** Staff portal feels like Uber Driver

- [ ] Replace `StaffLayout` sidebar with `StaffAppShell` + bottom nav
- [ ] Redesign Today screen with job focus mode
- [ ] Create full-screen job detail / task view
- [ ] Create photo capture overlay component
- [ ] Redesign Jobs screen with segments
- [ ] Create Earnings screen
- [ ] Create Profile screen (attendance + performance)
- [ ] Add offline banner + queue indicator UI
- [ ] Enlarge all touch targets to 48px+
- [ ] Add one-tap call/navigate buttons on job cards

### Phase 3: Admin Dashboard Elevation (Week 9–11)
**Goal:** Admin feels like Stripe + Linear

- [ ] Redesign Command Center dashboard (alerts + KPIs + actions)
- [ ] Add domain tabs (Operations, Finance, Daily Cleaning, Solar, Support, Staff, Growth)
- [ ] Implement side panel pattern for booking/customer detail
- [ ] Add status lane view toggle to bookings
- [ ] Redesign Daily Ops as monitoring dashboard
- [ ] Create Finance overview hub page
- [ ] Redesign Customer Detail as 360 view with timeline
- [ ] Add KPI sparkline cards
- [ ] Implement command palette (⌘K)
- [ ] Refine sidebar grouping and icons
- [ ] Apply consistent PageHeader to all admin pages

### Phase 4: Visual Polish & PWA (Week 12–13)
**Goal:** Premium finish + installable apps

- [ ] Add motion design system (tab transitions, step flows)
- [ ] Create empty state illustrations (6–8 SVGs)
- [ ] Implement before/after comparison slider
- [ ] Add booking confirmation animation
- [ ] Wire PWA install prompts
- [ ] Add splash screens
- [ ] Fix franchisee notifications broken route
- [ ] Accessibility audit pass (focus rings, aria labels, contrast)
- [ ] Cross-device testing (Android, iOS Safari, desktop browsers)

### Phase 5: QA & Refinement (Week 14)
**Goal:** Ship-ready quality

- [ ] Full responsive testing matrix
- [ ] Performance audit (LCP, CLS, FID on mobile)
- [ ] Visual regression review
- [ ] Stakeholder walkthrough
- [ ] Fix polish issues
- [ ] Update component documentation

---

## Success Metrics

| Metric | Current (Est.) | Target | How Measured |
|--------|---------------|--------|-------------|
| Customer home screen comprehension | ~30 sec | < 5 sec | User testing |
| Staff job start taps | 4+ taps | 2 taps | Flow audit |
| Admin morning review time | ~5 min | < 30 sec | Timed walkthrough |
| Mobile touch target compliance | ~60% | 100% | Component audit |
| Empty state coverage | ~30% | 100% | Screen audit |
| PWA install rate | 0% | 20%+ of mobile users | Analytics |
| Customer portal mobile session share | Unknown | 80%+ | Analytics |

---

## Appendix A: Current → Target File Mapping

| Current File | Target Change |
|-------------|--------------|
| `CustomerLayout.tsx` | Replace with `CustomerAppShell.tsx` |
| `StaffLayout.tsx` | Replace with `StaffAppShell.tsx` |
| `PanelShell.tsx` | Keep for Admin/Franchisee only |
| `customer/Dashboard.tsx` | Redesign with hero + feed |
| `customer/BookService.tsx` | Convert to step wizard |
| `customer/History.tsx` | Timeline + before/after |
| `customer/Complaints.tsx` | Move to account/support |
| `customer/Invoices.tsx` | Move to account/invoices |
| `customer/MyAssets.tsx` | Move to account/assets |
| `staff/Dashboard.tsx` | Job focus mode |
| `staff/Schedule.tsx` | Merge into jobs |
| `staff/Attendance.tsx` | Move to profile |
| `staff/Performance.tsx` | Move to profile/earnings |
| `admin/Dashboard.tsx` | Command center redesign |
| `admin/DailyOps.tsx` | Monitoring dashboard |
| `admin/CustomerDetail.tsx` | 360 timeline view |

## Appendix B: Reference Product Patterns Adopted

| Pattern | Source | Applied To |
|---------|--------|-----------|
| Bottom nav + app shell | Urban Company | Customer portal |
| Next service hero card | Urban Company | Customer home |
| Step booking flow | Urban Company | Customer booking |
| One-job-at-a-time focus | Uber Driver | Staff today screen |
| Large action buttons | Uber Driver | Staff job actions |
| Today's earnings prominent | Swiggy Partner | Staff earnings |
| KPI + sparkline dashboard | Stripe | Admin command center |
| Side panel detail view | Linear | Admin booking/customer detail |
| Status lane board | Linear | Admin bookings |
| Activity timeline | HubSpot | Customer history, admin customer 360 |
| Alert banner + action items | HubSpot | Admin command center |
| Deal card next-action | HubSpot | Admin leads pipeline |
| Bottom sheet forms | Urban Company / iOS HIG | Customer mobile forms |

---

*This plan transforms CWP's experience without touching business logic, database schema, or feature scope. Every recommendation maps to existing data and API capabilities — we're building the presentation layer that the product deserves.*
