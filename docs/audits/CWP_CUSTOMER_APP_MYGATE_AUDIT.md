# CWP Detailers Customer Application — UI/UX Architecture & Baseline Audit
## Phase 0: Modernization Baseline (MyGate-Inspired Simplicity)

**Date:** 2026-11-15  
**Auditor:** Principal Product Designer, Senior UI/UX Engineer & Frontend Architect  
**Scope:** CWP Detailers Customer Mobile & Responsive Web Application  
**PRD Reference:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md` (`CUX-012`)  
**Design Reference:** MyGate mobile application design patterns (Top app bar, Quick Actions grid, visual hierarchy, restrained surfaces, typography, and separated content feeds)  
**Status:** Audit Complete & Baseline Verified (`CUX-012` Done)  

---

## 1. Executive Summary

A comprehensive architectural and visual UX audit of the CWP Detailers Customer Application was conducted across all customer-facing routes on mobile (Android 390×844 CSS px) and responsive desktop viewports.

While the existing customer app contains robust business logic (multi-city scoping, DCMS daily route tracking, appointment scheduling, vehicle asset management, and payment handling), the current interface suffers from:
1. **High Visual Density & Card-Heavy UI:** Up to 11 distinct, competing sections stacked vertically on the homepage.
2. **Competing Calls-to-Action:** Multiple prominent action buttons ("Pay Now", "Schedule Service", "View Plans", "Explore Services", "Copy Code", "View Rewards") fight for customer attention on a single viewport.
3. **Redundant Status Displays:** An "All Payments Clear" banner appears when dues are ₹0, cluttering the top fold for healthy accounts.
4. **Second-Dashboard Syndrome in Account:** The Account screen duplicates plan progress, vehicle metrics, next scheduled wash, and payment dues already shown on the Home and My Plans screens.
5. **Overloaded Asset Cards:** Each vehicle card currently renders 5+ distinct clickable actions and micro-badges (Purchase Plan, Change Address, Schedule, Edit, History, Health Badge, Next Service, Last Service).

Taking inspiration from **MyGate's mobile design principles**—compact top context bar, unified 4-column Quick Actions icon grid, sleek 18–22% height hero banner carousel, and clean separated content feeds—a controlled modernization roadmap has been established.

---

## 2. Technical & Frontend Architecture

### 2.1 Core Technology Stack
- **Framework:** React 19.0.0 (`@workspace/cwp-platform`) + TypeScript
- **Bundler:** Vite 7.3.2 with `@tailwindcss/vite`
- **CSS Architecture:** Tailwind CSS v4 (`@import "tailwindcss"; @import "tw-animate-css"; @plugin "@tailwindcss/typography";`)
- **Routing:** `wouter` (`artifacts/cwp-platform/src/App.tsx`)
- **State Management & Data Fetching:** TanStack React Query (`@tanstack/react-query`) + Zustand
- **Component Primitives:** Radix UI primitives (`@radix-ui/react-*`), Lucide React icons (`lucide-react`)
- **Native Android Wrapper:** Capacitor 7 (`@workspace/cwp-customer-app` with `@capacitor/android`, `@capacitor/core`, `@capacitor/app`)
- **Feedback & Toasts:** Sonner (`sonner`) + custom toast hooks

### 2.2 Customer Design System Foundations (`@/features/customer-ds`)
The repository already contains the foundation of a consumer design system in `artifacts/cwp-platform/src/features/customer-ds`:
- **Brand Colors:** Primary Blue (`#1677FF`, HSL `215 100% 54%`), Secondary Navy (`#0B1D36`), Background Surface (`#F5F7FA`), Card Surface (`#FFFFFF`), Border (`#E2E8F0`).
- **Typography Fonts:** Primary Body: `Plus Jakarta Sans`, Display Headings: `Outfit`.
- **Existing Primitives:** `CustomerThemeRoot.tsx`, `CustomerButton.tsx`, `domain.tsx`, `primitives.tsx`, `tokens.ts`.
- **Finding:** While these tokens are defined, many customer page components still employ arbitrary ad-hoc Tailwind classes, inconsistent padding (`p-4` vs `p-5` vs `p-6`), and mixed button stylings (`Button` from `@/components/ui/button` vs `CustomerButton`).

---

## 3. Screen-by-Screen UX Audit

### 3.1 Customer Homepage (`/customer/dashboard`)
- **Implementation File:** `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx`
- **Layout & Structure:**
  1. `AppShell` with top bar (BrandLogo, Title, Customer Name, Account avatar icon, Logout button)
  2. `ServiceAddressSelector`: Bulky address container (48px+ height with icon, label, full address, and pill button)
  3. `HomeGreeting`: "Welcome back, {CustomerName}!"
  4. Payment Dues Alert (`pendingDues > 0`) OR "All Payments Clear" banner (`pendingDues === 0`)
  5. Active Membership Strip (`dashboard.primaryPlan`)
  6. `AdaptivePrimaryCTA`: Lifecycle-driven large CTA card
  7. `MarketingHero`: Oversized gradient card with 4-pillar highlights grid taking up ~50% of mobile viewport
  8. `LoyaltyRewardsCard`: Full-width gradient card with copyable referral code
  9. `PromotionalOffersSection`: City/branch-specific coupon vouchers
  10. `TodayServiceCard`: "No Service Scheduled Today" empty card or active tracking card
  11. `ServicesGrid`: 4-column signature services listing
  12. `CustomerReviewsSection`: Customer testimonials
  13. `UpcomingServicePreview` + `PasswordSetupNudge`
  14. Bottom Navigation bar (Home, My Plans, Schedule FAB, Assets, Account)
- **Key UX Violations Identified:**
  - **Hick's Law Violation:** 11+ major sections on a single screen creates decision paralysis.
  - **Miller's Law Violation:** Active plan is split into an active membership strip, an adaptive CTA, and a "No Service Scheduled Today" card.
  - **Missing Quick Actions Grid:** A `QuickActionsGrid.tsx` component exists in the codebase but is NOT rendered in `Dashboard.tsx`, leaving users without a fast 1-tap utility launcher.
- **MyGate Alignment:**
  - Merge Service Address and Greeting into a compact header unit.
  - Introduce an 8-icon uniform 4-column Quick Actions grid (Book Wash, My Plans, Payments, Helpdesk, etc.).
  - Reduce Marketing Hero to a sleek, swipeable 18–22% height carousel banner.
  - Suppress the "All Payments Clear" banner when dues are ₹0; show Payment Due alert ONLY when an actual balance exists.

---

### 3.2 My Plans Screen (`/customer/plans`)
- **Implementation File:** `artifacts/cwp-platform/src/pages/customer/MyPlans.tsx`
- **Key Components:** `PlanSummaryCard.tsx`, `PlanProgressBar.tsx`, `CustomerSupportCard`
- **Layout & Structure:**
  - Header: "My Plans - Your service entitlements & usage"
  - Active Plans Grid: Full-width `PlanSummaryCard` for active subscriptions
  - Plan History Grid: Past/expired plans
  - Support & Renewal Card: Call / WhatsApp buttons
- **Key UX Violations Identified:**
  - Subscriptions are rendered in a flat list without clear grouping by vehicle. If a customer owns multiple cars with separate plans, they appear as disconnected cards.
  - The usage progress bar and "Visits Remaining" metric are repeated on every card with heavy borders and dark badges.
- **MyGate Alignment:**
  - Group active plans under the corresponding vehicle heading (e.g., "Hyundai Creta • UP16AB1234").
  - Use clean, minimal usage tags (`3 of 4 washes remaining`) rather than multi-layered nested progress elements.

---

### 3.3 Vehicles & Solar Sites (`/customer/assets`)
- **Implementation File:** `artifacts/cwp-platform/src/pages/customer/MyAssets.tsx`
- **Key Components:** `AssetCard.tsx`, `AddAssetSheet.tsx`, `EditAssetSheet.tsx`, `AssetEmptyState.tsx`
- **Layout & Structure:**
  - Top header with "+ Add Asset" action button
  - Segmented Tab Switcher: "Cars / Vehicles" (tab) vs "Solar Rooftops" (tab)
  - Vehicle Card list displaying vehicle thumbnail, make/model, registration tag, health status badge, associated plan link, service address with "Change" button, and action footer (Schedule button, Edit button, History link).
- **Key UX Violations Identified:**
  - **Too Many Competing CTAs:** In each asset card, customers see 5 distinct interactive actions:
    1. "Purchase Plan" / Plan details link
    2. "Change" service address link
    3. Primary "Schedule" button
    4. Outline "Edit" button
    5. "History" text link
  - **Visual Clutter:** High concentration of badges, mono tags, and borders creates a maintenance-dashboard aesthetic rather than a consumer car-care feel.
- **MyGate Alignment:**
  - Keep 1 primary action per card: **"Schedule Service"**.
  - Move secondary actions ("Edit Vehicle", "Service History", "Change Address") into a clean overflow menu (`...`) or secondary text action.
  - Retain the clean segmented tab structure for Solar Rooftops.

---

### 3.4 Account Screen (`/customer/account`)
- **Implementation File:** `artifacts/cwp-platform/src/pages/customer/Account.tsx`
- **Key Components:** `ProfileCard.tsx`, `AccountSummary.tsx`, `SavedAddressesSection.tsx`, `LoyaltyReferralSection.tsx`, `BillingSection.tsx`, `NotificationSection.tsx`, `SupportSection.tsx`, `LogoutSection.tsx`
- **Key UX Violations Identified:**
  - **"Second Dashboard" Syndrome:** `AccountSummary.tsx` displays a 2x2 grid repeating Primary Plan, Vehicle Count, Next Scheduled Wash, and Outstanding Dues. All 4 metrics already belong to Home, My Plans, Vehicles, and Payments!
  - Below that, `BillingSection` repeats outstanding dues again with unpaid invoices.
  - The page is vertically massive (takes 4+ full screen scrolls on mobile).
- **MyGate Alignment:**
  - Transform Account into a clean, focused profile and settings destination (inspired by MyGate's Settings screen).
  - Profile header card: Avatar, Customer Name, Phone number, and membership badge.
  - Streamlined settings list:
    - Saved Addresses (`Manage >`)
    - Notification Preferences
    - Loyalty & Referrals
    - Help & Support (Phone & WhatsApp)
    - Terms & Privacy
    - Sign Out

---

### 3.5 Schedule Journey Screen (`/customer/schedule`)
- **Implementation File:** `artifacts/cwp-platform/src/pages/customer/BookService.tsx`
- **Key Components:** `ScheduleStepProgress.tsx`, `ScheduleAssetStep.tsx`, `SchedulePlanStep.tsx`, `ScheduleServiceStep.tsx`, `ScheduleDateStep.tsx`, `ScheduleTimeStep.tsx`, `ScheduleReviewStep.tsx`, `ScheduleSuccessScreen.tsx`
- **Current Flow:** 6-step booking wizard (`asset` → `plan` → `service` → `date` → `time` → `review`).
- **Defect / Finding Uncovered During Audit:**
  - When customer selects a vehicle located in Noida, `filterServicesForCoverage` checks the city availability matrix. Because Noida only has Daily Car Cleaning active (on-demand washing/detailing are currently Varanasi-only), `services` evaluates to an empty array.
  - `ScheduleServiceStep.tsx` currently renders an unhelpful dashed box: `"No services are currently available at this location"` and leaves "Continue" disabled without guiding the customer on what to do next (e.g. "Only Daily Car Cleaning subscriptions are available in Noida. View plans or change location").
- **MyGate Alignment:**
  - Streamline wizard progression.
  - Replace unguided empty states with proactive resolution paths (direct link to daily cleaning plans or address switcher).

---

## 4. Reusable vs. Redundant Components Inventory

| Component Path | Current Role | Recommendation |
| :--- | :--- | :--- |
| `src/components/home/QuickActionsGrid.tsx` | Unused quick actions component | **Reuse & Elevate:** Modernize into MyGate-style 4-column rounded tile grid and integrate on Homepage. |
| `src/components/home/ServiceAddressSelector.tsx` | Service address selector button | **Simplify:** Make compact (single line address pill with icon and change arrow). |
| `src/components/home/MarketingHero.tsx` | Full-screen promotional hero | **Simplify:** Reduce height from 380px to ~160px; convert to sleek auto-sliding carousel banner. |
| `src/components/home/TodayServiceCard.tsx` | Today's service card | **Refactor:** Suppress completely when no service is active/scheduled; eliminate "No Service Scheduled Today" empty card. |
| `src/components/home/CustomerReviewsSection.tsx` | Customer testimonials | **Relocate:** Move off the operational homepage into catalog/service details. |
| `src/components/home/LoyaltyRewardsCard.tsx` | Bulky referral card | **Relocate:** Retain primary access in Account / Rewards screen; reduce to compact shortcut on homepage. |
| `src/components/assets/AssetCard.tsx` | Vehicle card with 5+ buttons | **Refactor:** Retain 1 primary CTA ("Schedule Service"); consolidate edit/history/address into overflow menu. |
| `src/pages/customer/account/AccountSummary.tsx` | 2x2 duplicate metrics grid | **Remove from Account:** Move plan info to Plans, vehicle counts to Assets, dues to Payments. |
| `src/components/app-shell/BottomNav.tsx` | 5-item bottom navigation | **Retain & Refine:** Polish touch padding and active pill indicators. |

---

## 5. Modernization Roadmap & Next Steps

| Phase | Title | Scope & Objectives | Status |
| :---: | :--- | :--- | :---: |
| **Phase 0** | **Codebase Audit & UX Baseline** | Comprehensive analysis, browser baseline screenshots, PRD synchronization. | **COMPLETE** |
| **Phase 1** | **Design System Modernization** | Tokens, typography scale, subtle surfaces, buttons, and restrained badges in `@/features/customer-ds`. | Awaiting Approval |
| **Phase 2** | **Customer Homepage Redesign** | Compact header, 4-col Quick Actions grid, merged vehicle/plan card, compact promo banner, contextual alerts. | Planned |
| **Phase 3** | **My Plans Screen Redesign** | Group subscriptions by vehicle, streamlined usage indicators, clean renewal actions. | Planned |
| **Phase 4** | **Vehicles & Solar Sites Redesign** | Single dominant primary CTA (Schedule), overflow secondary menu, refined tabs. | Planned |
| **Phase 5** | **Account Screen Redesign** | Lean profile and settings destination inspired by MyGate Settings screen. | Planned |
| **Phase 6** | **Schedule Screen Review & Polish** | Guided step navigation, calendar/slot visual hierarchy, city coverage guidance. | Planned |
| **Phase 7** | **Global Polish & Regression QA** | Cross-viewport testing, safe areas, accessibility, and end-to-end regression verification. | Planned |
