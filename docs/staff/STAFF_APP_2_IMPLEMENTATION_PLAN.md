# CWP Detailers Staff App 2.0 — Implementation Plan (Phase 7)
**Document Version:** 2.0.0  
**Target:** CWP Staff Field Application 2.0  
**Date:** 2026-11-16  

---

## 1. Prioritized Phased Roadmap

### Phase P0: Operational Correctness & Fraud Prevention
**Objective:** Eliminate gaps in DCMS sequencing, out-of-order execution, capture-time location verification, and multi-service staff navigation.

1. **Task P0-1: Photo-Capture-Time GPS Binding**
   - **Scope:** Bind device GPS coordinates, horizontal accuracy, and timestamp immediately at the moment camera shutter fires.
   - **Files:** `artifacts/cwp-platform/src/lib/native/captureStaffPhoto.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx`.
   - **API / DB Impact:** Pass capture-time coordinates into `completeVisit` payload (`POST /api/daily-cleaning/visits/complete`).
   - **Acceptance Criteria:** Coords sent to backend match the exact moment the photo was taken, preventing GPS drift if staff walks away before tapping submit.

2. **Task P0-2: DCMS Pending vs. Completed Visual Segregation & Sequence Preservation**
   - **Scope:** Reorganize `StaffDailyRouteSimplified.tsx` to display **Pending Customers First (Above)** and **Completed Customers Separately Below**. Maintain original sequence numbers (#1, #2, #3, ...) on pending items even when an out-of-sequence stop is completed. Display actual completion sequence and time in the completed section.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/lib/dcmsLocalStorage.ts`.
   - **Acceptance Criteria:**
     - If assigned sequence is 1 -> 2 -> 3 -> 4 -> 5, and staff cleans #4 first:
       - Pending section retains #1, #2, #3, #5 with original sequence indicators.
       - Completed section displays #4 with "Completed #1 at <time>" badge.
     - Staff can select any assigned pending vehicle at any time.

3. **Task P0-3: Multi-Service Staff Access & Core Navigation Unification**
   - **Scope:** Remove artificial role-based hiding of appointment jobs in `StaffAppShell.tsx`. Consolidate bottom navigation to 4 standard tabs:
     1. **Dashboard** (`/staff/dashboard`)
     2. **DCMS** (`/staff/daily-clean`)
     3. **My Other Jobs** (`/staff/bookings`)
     4. **Account** (`/staff/profile`)
   - **Files:** `artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx`, `artifacts/cwp-platform/src/components/layout/StaffPortalRouter.tsx`.
   - **Acceptance Criteria:** Staff assigned both DCMS and Other Jobs (Car Wash, Solar, Detailing) can access both modules seamlessly without role collisions.

---

### Phase P1: Staff UX Simplification & Hindi-First Experience
**Objective:** Drastically reduce cognitive load for 8th-10th pass cleaners.

1. **Task P1-1: Hindi-First Language Support with English Toggle**
   - **Scope:** Create a lightweight, high-performance translation dictionary (`staffLanguage.ts`) supporting everyday colloquial Hindi and clear English. Persist choice in `localStorage`.
   - **Files:** `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx`, `artifacts/cwp-platform/src/pages/staff/Profile.tsx`.
   - **Acceptance Criteria:** Staff can toggle language with a single tap in the App Bar or Account page; all primary action labels adapt immediately.

2. **Task P1-2: Field-Worker Friendly Dashboard Redesign**
   - **Scope:**
     - Shift Attendance check-in card displayed prominently ONLY when check-in is pending. Once verified, collapse into a subtle top bar badge.
     - Single clean DCMS progress bar with simple count ("X of Y Completed").
     - Exactly ONE primary Next Action hero card.
     - Eliminate redundant 4-box metrics and repetitive section cards.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`.
   - **Acceptance Criteria:** No competing hero cards; cleaners see greeting, progress, and their immediate next action.

3. **Task P1-3: Non-Technical DCMS Completion Modal**
   - **Scope:**
     - Replace OCR percentages and technical strings with simple Hindi/English messages:
       - “गाड़ी के पास जाकर फोटो लें।”
       - “लोकेशन नहीं मिल रही। फिर कोशिश करें।”
       - “फोटो भेजी जा रही है।”
       - “सफाई पूरी हो गई।”
       - “काम सेव नहीं हुआ। फिर कोशिश करें।”
     - Streamline plate verification to a clear green check or a simple number entry fallback.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx`.
   - **Acceptance Criteria:** Cleaners never see technical terminology (hashes, OCR confidence, lat/lng).

4. **Task P1-4: Account Section Consolidation**
   - **Scope:** Consolidate Profile, Attendance Calendar, Earnings & Payouts, Language Toggle, and Logout under `/staff/profile`.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Profile.tsx`.
   - **Acceptance Criteria:** All staff settings and records accessible in one unified location.

5. **Task P1-5: Job Alert Popup Direct Deep Linking**
   - **Scope:** Update `StaffJobAlertPopup.tsx` so "Open Job" links directly to `/staff/bookings?job=${alert.jobKey}`.
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffJobAlertPopup.tsx`.
   - **Acceptance Criteria:** Tapping the alert opens the specific job's action flow directly.

---

### Phase P2: Reliability, Offline Recovery & Verification
**Objective:** Maintain offline resilience, mock location detection, and comprehensive automated test suites.

1. **Task P2-1: Capture-Time Location Verification Tests**
   - Write tests validating that GPS coordinates are locked at capture time and that location errors surface friendly Hindi messages.
2. **Task P2-2: DCMS Route Out-of-Sequence Sorting Tests**
   - Write unit tests verifying that out-of-order completions split correctly into pending and completed lists while preserving original sequence IDs.
3. **Task P2-3: Regression Verification across Entire Platform**
   - Run vitest test suite across all 53 test files and verify 100% pass rate.
