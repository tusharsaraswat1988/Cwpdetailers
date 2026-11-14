# CWP Detailers — Staff Operations Portal UX Audit & Field Execution Architecture Review

**Phase:** Phase 24 — Staff Operations Portal UX Modernization, Field Execution Intelligence & Service Quality  
**PRD Version Baseline:** v5.3 → **Target PRD:** v5.4  
**Date:** 2026-11-14  
**Auditor:** Principal Product Designer, Senior Full-Stack Engineer, Field Operations Architect  
**Scope:** Staff Portal routes, mobile execution workflows, daily car cleaning, bookings/service executions, offline resilience, and city-service configuration adaptation.

---

## 1. Executive Summary

The CWP Detailers platform powers field cleaning and vehicle detailing operations across multiple cities (starting with Varanasi and Noida). Field staff operate in challenging physical environments: underground basement parking garages, open society parking bays, high-rise residential towers, and low-connectivity mobile networks.

This comprehensive audit inspected all staff-facing interfaces, state machines, API contracts, local storage caching, geolocation permissions, and native Capacitor Android behavior. While the underlying backend operational capabilities (`dcmsVisitsTable`, `service_executions`, `queuedApi`, `staff_role_assignments`) are robust and functional, the staff frontend previously suffered from key UX bottlenecks:
1. **Homepage Lack of Immediate Task Action:** Cleaners on opening `/staff/dashboard` saw static metric cards and attendance, but no immediate **Next Task Card** showing their first assigned vehicle, society, tower, parking bay, and one-tap directions.
2. **Ambiguous Completion and Exception Actions:** Cleaners had only two binary choices ("Clean karein" vs "Gaadi nahi mili"), with no structured options for plate obscured/covered, customer skip, basement entry blocked, or vehicle pre-existing damage reports.
3. **No Vehicle Number Search / Fast Filtering:** Cleaners with 25–40 assigned vehicles in large societies had to scroll through the entire list to find cars out of sequence.
4. **City & Role Over-Exposure:** Service tabs and navigation were not dynamically adapted to the staff member's city/branch service availability matrix.
5. **Basement Connectivity Anxiety:** Local completion state needed resilient local caching in `localStorage` keyed by `Asia/Kolkata` date to guarantee zero data loss during page refreshes or route navigation without cell reception.

---

## 2. Screen-by-Screen & Route Audit Findings

### 2.1 Staff Homepage (`/staff/dashboard`)
- **Status:** Functional but sub-optimal task guidance.
- **Current Strengths:** Shift attendance punch-in with selfie and GPS verification (`markAttendanceWithLocation`) is reliable. High-level metric boxes show Assigned, Done, and Pending.
- **Identified Friction:**
  - For Daily Car Cleaners (the majority of field crew), the dashboard displayed a generic section linking to `/staff/daily-clean` without previewing the **Next Task**.
  - Missing visual progress bar with completion percentage (e.g., "18 of 24 completed • 75%").
  - Cleaners had to tap through multiple pages simply to identify which car to clean first.
- **Modernization Deliverable:**
  - Introduce **Daily Progress Bar** with percentage and breakdown (Done, Pending, Unavailable/Skipped).
  - Introduce **Next Task Hero Card** answering: *Who is next? Which car? Which tower/parking bay? How do I get there?*
  - Add quick action pills: *Navigate to Next*, *Scan & Clean*, *View Full Route*.

### 2.2 Daily Car Cleaning Route (`/staff/daily-clean`)
- **Status:** Working core flow, lacks search and structured exceptions.
- **Current Strengths:** Sequential route ordering joined with `residentialSocietiesTable`, `societyTowersTable`, and parking bays. Plate normalization and OCR verification work effectively.
- **Identified Friction:**
  - No quick search bar: Cleaners cannot type "1234" or customer name to immediately filter the vehicle list.
  - Ambiguous exception flow: Only one button labeled "Gaadi nahi mili" was present. It failed to capture whether the car was absent, covered, locked out by security, or skipped at the customer's request.
  - Ambiguous completion options: Ambiguous generic dropdowns violate mobile field speed standards.
- **Modernization Deliverable:**
  - Add instant search bar filtering by registration plate number (e.g., "UP65" or "1234") and customer name.
  - Add tabbed quick status filters: *All*, *Pending*, *Completed*, *Exceptions*.
  - Implement a contextual **Action Bottom Sheet / Dialog** replacing ambiguous buttons with 5 structured actions:
    1. *Car Found — Cleaning Completed* (Guided photo & plate verification)
    2. *Car Not Available* (Vehicle absent from assigned parking bay)
    3. *Vehicle Number Not Visible* (Number plate obscured, covered, or removed)
    4. *Customer Requested Skip* (Customer requested no cleaning today)
    5. *Unable to Access Parking* (Security entry denied, basement gate locked)
    6. *Report an Issue* (Pre-existing scratch, flat tire, fluid leak)

### 2.3 Other Services & Bookings (`/staff/bookings`, `/staff/jobs`)
- **Status:** Functional backend execution lifecycle.
- **Current Strengths:** Strict 10-state booking lifecycle with service executions (`scheduled` → `en_route` → `in_progress` → `completed`), GPS tracking, and before/after photo requirements.
- **Identified Friction:**
  - When a staff member is assigned strictly to Daily Car Cleaning in Noida (where Car Washing is not yet launched), exposing the "Bookings" tab creates confusion.
  - Car washing and solar care workflows needed a clearer visual phase stepper (En Route → Before Photos → Work → After Photos → Done).
- **Modernization Deliverable:**
  - Dynamically hide or show "Bookings" in `StaffAppShell` based on city service availability and assigned operational roles.
  - Upgrade `StaffServiceJobFlow` with a visual 4-step progress stepper and photo upload retry resilience.

### 2.4 Navigation and Geolocation (`LocationPermissionGate`, Maps)
- **Status:** Robust GPS permissions, needs address copy and web fallback.
- **Current Strengths:** High-accuracy geolocation capture with basement GPS fallback (`gpsUnavailable: true` with reason tracking).
- **Identified Friction:**
  - Cleaners frequently need to copy society addresses to share with gate security.
  - Web preview / headless browser testing without native GPS could get blocked on the location gate.
- **Modernization Deliverable:**
  - Add one-tap **Copy Address** button with instant visual toast feedback.
  - Add convenient "Navigate to Next Task" external Google Maps deep link.
  - Provide a safe web preview bypass for desktop browser verification while preserving strict native Android GPS gating.

### 2.5 Local Storage Resilience & Asia/Kolkata Daily Reset
- **Status:** Preserved existing business rule.
- **Core Rule:** Daily Cleaning completion data is maintained locally in `localStorage` for field resilience, resets daily at midnight IST (`Asia/Kolkata`), and synchronizes cleanly with backend endpoints without silent backend schema shifts.
- **Modernization Deliverable:**
  - Build `dcmsLocalStorage.ts` managing:
    - Namespace: `cwp_staff_dcms_${staffId}_${getTodayIstDate()}`
    - Automatic stale day purging (cleaning up past days)
    - Optimistic UI state preservation across page reloads
    - Prevention of duplicate submissions

---

## 3. Architecture & Security Evaluation

1. **City & Branch Boundary Enforcement:**
   - Server-side validation via `tenantScope.ts` strictly rejects cross-city queries.
   - Staff cannot view or mutate assignments from other cities by tampering with query parameters.
2. **Customer Contact Privacy:**
   - Customer phone numbers are masked where required, and calling actions open standard native dialers (`tel:...`) without exposing customer credentials.
3. **Photo Retention & Evidence:**
   - Proof photos are stored securely via Cloudinary / storage service with GPS metadata.
   - 7-day GPS retention purge worker preserves customer privacy while satisfying quality audit requirements.

---

## 4. Phase 24 Requirements Traceability Matrix

| Requirement ID | Module | Title | Priority | Target Status |
| :--- | :--- | :--- | :--- | :--- |
| `STAFF-025` | `Dashboard.tsx`, `NextTaskCard.tsx` | Task-Oriented Staff Home Dashboard & Next Task Intelligence | P0 | Planned |
| `STAFF-026` | `StaffDailyRouteSimplified.tsx` | Real-Time Registration & Customer Search with Quick Status Filters | P0 | Planned |
| `STAFF-027` | `StaffVehicleCleanDialog.tsx`, `StaffExceptionSheet.tsx` | Contextual Daily Cleaning Completion & Structured Operational Exceptions | P0 | Planned |
| `STAFF-028` | `dcmsLocalStorage.ts` | Resilient Local Storage Persistence & Asia/Kolkata Daily Reset | P0 | Planned |
| `STAFF-029` | `StaffAppShell.tsx`, `cityAdaptation.ts` | Configuration-Driven City & Branch Service Dynamic Adaptation | P0 | Planned |
| `STAFF-030` | `domain.tsx`, `maps.ts` | Route Navigation Convenience, Address Copy & Bay Visibility | P1 | Planned |
| `STAFF-031` | `StaffServiceJobFlow.tsx` | Enhanced Car Washing & Solar Care Workflow Stepper | P1 | Planned |
| `STAFF-032` | `StaffPhotoCapture.tsx`, `GeoPhotoSlotGrid.tsx` | Photo Evidence Capture Guidance & Network Upload Recovery | P1 | Planned |
| `STAFF-033` | `StaffProductivityCard.tsx` | Staff Daily Productivity Intelligence & Effort Breakdown | P1 | Planned |
| `STAFF-034` | `LocationPermissionGate.tsx` | Location Gate Reliability & Browser Preview Adaptation | P1 | Planned |
| `TEST-012` | `staff-portal-ux-modernization.test.ts` | Automated Unit & Integration Test Suite for Staff Operations | P0 | Planned |
