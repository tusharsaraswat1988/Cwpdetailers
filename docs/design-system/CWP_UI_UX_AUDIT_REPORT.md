# CWP Detailers — Comprehensive UI/UX Audit Report

**Document:** Comprehensive UI/UX Audit & Component Consolidation Matrix  
**System:** CWP Detailers Platform (Admin, Staff, Customer, Franchisee)  
**Version:** 1.0.0  
**Audit Methodology:** Universal Design System Inspection (`.agents/skills/universal-design-system/SKILL.md`)  
**Applicable Standards:** WCAG 2.2 Level AA, Material Design 3 Icon Guidelines, DTCG 2025.10  
**Living PRD Reference:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md` (`UDS-005`)  

---

## 1. Executive Summary

This audit evaluated all primary UI surfaces across the CWP Detailers ecosystem:
1. **Admin Operations Portal** (40+ routes: Dashboards, Customer/Staff directories, DCMS Operations, Bookings, Billing/Ledgers, Operational Zones, Differential Pricing, Master Data).
2. **Staff Field Portal & PWA** (Dashboard, DCMS Daily Route, Appointment Jobs, Photo Evidence & Shutter GPS Capture, Offline Queue, Profile).
3. **Customer Portal & PWA** (Homepage, Service Discovery, Product Details, 4-Step Booking Stepper, My Plans, Vehicles & Solar Assets, Invoices, Account Hub).

The audit identified critical consolidation opportunities, token fragmentation points, iconography inconsistencies, and ergonomic friction points.

---

## 2. Categorized Audit Findings Matrix

### Category P0: Critical Functional & Usability Issues

| ID | Application & Screen | Existing Issue | User Impact | Recommended Design Solution | Relevant Components | Dependencies / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-P0-1** | **Global (Admin, Staff, Customer)** | **Root Token & Primary Color Disconnect:** Root `:root` in `index.css` defaults to teal (`180 100% 40%`), whereas Admin uses `#0072F8`, Customer uses `#1677FF`, and Staff uses `#0072F8`. Portaled dialogs and toasts mounting outside theme roots inherit unaligned cyan/teal hues. | Jarring color flashes, visual dissonance, and broken contrast on system toasts and portaled dialogs. | Standardize a unified CWP token foundation (`src/lib/design-system/tokens.ts`) with canonical CWP Electric Blue (`#1677FF` / `215 100% 54%`) as default, while cleanly allowing role-specific surface overrides. | `index.css`, `admin-ds/tokens.ts`, `customer-ds/tokens.ts`, `staff-ds/tokens.ts` | None; purely CSS variable alignment. |
| **AUD-P0-2** | **Global Navigation & Badges** | **Icon Library Fragmentation & Missing M3 Standard:** Multiple icon sets (`lucide-react`, `react-icons`) and ad-hoc strokes (1.5px to 2.5px) are mixed across screens. Material Design 3 icon standards (https://m3.material.io/styles/icons/overview) are not uniformly enforced. | Inconsistent visual weight, unaligned optical centers, and unprofessional interface feel. | Introduce a canonical `MaterialSymbol` primitive in `src/lib/design-system/MaterialSymbol.tsx` supporting official Google Material Symbols Outlined and SVG fallback, enforcing standard weights (400 regular, 500 active) and optical sizes (18px, 20px, 24px, 32px, 48px). | `MaterialSymbol.tsx`, `adminNavConfig.ts`, `BottomNav.tsx`, `StaffAppShell.tsx` | Ensure backward compatibility with existing Lucide icons. |

---

### Category P1: Major UX, Navigation & Consistency Problems

| ID | Application & Screen | Existing Issue | User Impact | Recommended Design Solution | Relevant Components | Dependencies / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-P1-1** | **Admin: Creation & Edit Modals** | **Long Modal Viewport Clipping:** Several admin modals (e.g. Society Creation, Branch Setup, Zone Polygon Mapping) lack explicit viewport constraints, causing primary action buttons to be pushed below the viewport boundary on laptops (1366×768). | Operations managers cannot see or click "Save" / "Submit" without tedious page zooming. | Standardize all Admin modals with `max-h-[88vh] flex flex-col`, scrollable body (`overflow-y-auto flex-1`), and sticky bottom action bar with high-contrast primary CTA. | `Dialog`, `Modal`, `Branches.tsx`, `SocietiesPage.tsx`, `OperationalZonesPage.tsx` | Test across 1366×768 and 1920×1080 screens. |
| **AUD-P1-2** | **Staff: Field Touch Targets & Sunlight Readability** | **Sub-44px Field Actions:** In `StaffDailyRouteSimplified.tsx` and `StaffExecutionActionsSheet.tsx`, secondary action buttons (notes, exception triggers, GPS status check) are 36px–40px tall. | Field workers with wet, soapy, or gloved hands miss clicks, leading to dropped actions and frustration. | Enforce strict 48px–52px touch targets (`min-h-12`) across all field buttons; pair every status badge with an official M3 symbol and high-contrast text. | `StaffDailyRouteSimplified.tsx`, `StaffExecutionActionsSheet.tsx`, `StaffButton.tsx` | Preserve existing single-action dashboard hierarchy. |
| **AUD-P1-3** | **Customer: Empty States & Asset Switching** | **Inconsistent Empty State Styling:** When customers have 0 registered vehicles or 0 solar sites, empty states display plain dashed containers without guided actions. | Drops conversion; customers do not understand how to proceed to book. | Build a shared `<CustomerEmptyState>` component with 48px M3 Symbol, encouraging headline, one-line instruction, and prominent 48px CTA ("+ Add Vehicle" / "+ Add Solar Site"). | `MyAssets.tsx`, `MyPlans.tsx`, `CustomerHistory.tsx` | Must preserve return state to booking funnel. |
| **AUD-P1-4** | **Admin: Multi-City Network Tables** | **Unconstrained Table Text & Missing Tabular Digits:** Long addresses and customer names in `AdminCustomers.tsx` and `AdminBookings.tsx` wrap unevenly across multiple rows, pushing table lines out of visual sync. | Harder for dispatchers to scan 50+ jobs quickly during morning peak hours. | Implement strict single-line truncation with tooltip preview (`truncate max-w-[200px]`) and tabular numerals (`font-mono tabular-nums`) for phone numbers, dates, and currency. | `AdminCustomers.tsx`, `AdminBookings.tsx`, `DataTable.tsx` | Verify tooltips remain accessible via keyboard focus. |

---

### Category P2: Visual Refinement & Polish

| ID | Application & Screen | Existing Issue | User Impact | Recommended Design Solution | Relevant Components | Dependencies / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-P2-1** | **Global: Form Focus Rings** | **Inconsistent Focus Outlines:** Certain form inputs and custom buttons suppress focus outlines without a distinct visible ring. | Violates WCAG 2.2 SC 2.4.7 (Focus Visible) and SC 2.4.11 (Focus Appearance) for keyboard users. | Enforce standardized visible focus indicator: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none`. | `components/ui/input.tsx`, `components/ui/button.tsx`, `CustomerButton.tsx`, `AdminButton.tsx` | None; purely CSS styling polish. |
| **AUD-P2-2** | **Financial & Billing Surfaces** | **Currency Alignment:** In `PaymentLedgerPage.tsx` and `BillingFinancePage.tsx`, monetary columns are left-aligned in some tables and right-aligned in others. | Inefficient scanning of financial statements. | Strictly enforce right-alignment and tabular font (`text-right font-mono tabular-nums`) on all currency values across invoices, ledgers, and dues tables. | `PaymentLedgerPage.tsx`, `BillingFinancePage.tsx`, `CustomerInvoices.tsx` | None. |
| **AUD-P2-3** | **Staff App: Android Gesture Bar Safe Area** | **Bottom Sheet Occlusion on Android:** On modern Android devices with gesture navigation bars, bottom sheet buttons sit directly against the physical edge. | Workers accidentally trigger Android Home/Back gestures when tapping "Save" or "Complete". | Apply `pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]` to all modal action footers and bottom sheets. | `StaffAppShell.tsx`, `StaffVehicleCleanDialog.tsx`, `StaffExecutionActionsSheet.tsx` | Native Android testing. |

---

## 3. Component Consolidation Opportunities

1. **Button Primitives Consolidation:**
   - Currently: `Button` (`components/ui/button.tsx`), `AdminButton` (`features/admin-ds`), `StaffButton` (`features/staff-ds`), `CustomerButton` (`features/customer-ds`).
   - Solution: Keep role-specific buttons as ergonomic wrappers around a shared design system core (`CwpButton`), standardizing token consumption while preserving role-specific sizing (Admin: 36px/32px, Staff: 52px/48px, Customer: 48px/44px).
2. **Status Badge Consolidation:**
   - Standardize all status badges across Admin, Staff, and Customer to consume the central CWP Status Token Map with official M3 icons.
3. **Empty State Standardization:**
   - Replace 8 different custom empty state implementations with a unified `<EmptyState>` component.
