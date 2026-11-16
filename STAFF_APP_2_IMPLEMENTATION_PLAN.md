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

---

### Phase P3: Operational Workflow Hardening & UX Refinement (Completed)
**Objective:** Bulletproof field reliability across basement signal drops, honest offline indicators, cross-session completion persistence, and job deduplication.

1. **Task P3-1: Basement GPS Signal Loss Recovery & Audited Fallback**
   - **Scope:** Enhance `captureStaffPhotoWithGps` in `captureStaffPhoto.ts` to detect signal failure in concrete-shielded parking garages (B1/B2/B3). If GPS times out, fallback to recent campus fix or pass `gpsUnavailable: true` + `gpsUnavailableReason: "underground_basement_no_signal"`.
   - **Enforcement:** In `StaffVehicleCleanDialog.tsx`, check if vehicle is in a residential society or assigned bay. If yes, permit completion under audited fallback with non-technical indicator. If open street, enforce GPS fix per `SEC-024`.
   - **Files:** `artifacts/cwp-platform/src/lib/native/captureStaffPhoto.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx`.

2. **Task P3-2: Cross-Session Server Completion Persistence**
   - **Scope:** Expose `completedAt` on `DailyRouteStop` from backend `dailyRouteService.ts`. In `StaffDailyRouteSimplified.tsx`, automatically format `completedAtTime` and compute chronological `completionOrder` for stops completed on the server, ensuring full data continuity across app restarts, re-logins, or device switches.
   - **Files:** `artifacts/api-server/src/lib/dcms/dailyRouteService.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`.

3. **Task P3-3: Honest Offline Sync Tracking & Banner Integration**
   - **Scope:** Add `isPendingSync` flag to `DcmsLocalRecord` and `saveDcmsLocalRecord`. Show an amber pulse badge (`सिंक पेंडिंग`) when queued offline, transitioning to green server-verified check once synced. Mount `StaffPendingSyncBanner` in `StaffAppShell.tsx` so staff has instant visibility of all queued punches, photos, and visits with 1-tap retry.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/lib/dcmsLocalStorage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`, `artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx`.

4. **Task P3-4: Other Jobs Deduplication & Android Back Navigation**
   - **Scope:** In `useStaffJobsData.ts` `mergeJobs`, filter out bookings that already exist as linked executions, preventing duplicate job cards. In `StaffOtherServicesPanel.tsx`, handle null/empty `selectedJobKey` on Android back button presses to cleanly close detail views.
   - **Files:** `artifacts/cwp-platform/src/hooks/useStaffJobsData.ts`, `artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx`.

5. **Task P3-5: Field Stepper & Action Localization in Hindi**
   - **Scope:** Expand `staffLanguage.ts` with all lifecycle steps (Route, Before, Work, After, Done) and action buttons (Resume, Pause, Start Work, After Photos, Submit). Integrate into `StaffServiceJobFlow.tsx` with minimum 48px touch targets (`h-12`).
   - **Files:** `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`.

---

### Phase P4: Lifecycle Prioritization, Deep Linking & Offline Resilience (Completed)
**Objective:** Harden task focus priority, deep linking between execution/booking records, accessible touch targets, and honest offline sync messaging.

1. **Task P4-1: Operational Lifecycle Priority on Dashboard**
   - **Scope:** Refine hero task derivation in `Dashboard.tsx`: if an appointment job is actively in-progress, en-route, or paused, prioritize it as the active hero card; otherwise prioritize morning DCMS route stops; once all DCMS stops are completed, prioritize the next scheduled appointment job.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`.

2. **Task P4-2: Execution & Booking Deep Linking in NextTaskCard**
   - **Scope:** In `NextTaskCard.tsx`, add `jobKey?: string;` to `NextTaskData`. Link to `/staff/bookings?job=${encodeURIComponent(task.jobKey)}` rather than hardcoding `booking-${task.id}`, supporting both execution jobs and booking jobs without navigation failures.
   - **Files:** `artifacts/cwp-platform/src/components/staff/NextTaskCard.tsx`.

3. **Task P4-3: NextTaskCard & StaffJobCard Hindi Localization & 48px Touch Targets**
   - **Scope:** Integrate `useStaffLanguage()` into `NextTaskCard.tsx` and `StaffJobCard` (`domain.tsx`). Localize priority badge, action buttons (Navigate, Call, Open Route, Open Job), and enforce >= 44px/48px touch targets (`h-11`/`h-12`).
   - **Files:** `artifacts/cwp-platform/src/components/staff/NextTaskCard.tsx`, `artifacts/cwp-platform/src/features/staff-ds/components/domain.tsx`.

4. **Task P4-4: Honest Offline Sync Communication & Localized Banner Retry**
   - **Scope:** Localize `StaffPendingSyncBanner.tsx` in Hindi and English. Honest status messaging that punches and photos are safely stored on the device and will sync upon network restoration. Enforce 44-48px touch target for Retry action.
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffPendingSyncBanner.tsx`.

5. **Task P4-5: Resilient Job Resolution across Today and All Sets**
   - **Scope:** In `StaffOtherServicesPanel.tsx`, fall back to searching `jobs.all` if a deep linked job is not present in `jobs.today`, preventing blank views when navigating to assigned appointments.
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx`.

---

### Phase P5: Operational Workflow Hardening, State Consistency, Idempotency & Lifecycle Integrity (Completed)
**Objective:** Harden appointment job lifecycle transitions, eliminate state fragility across reloads, enforce backend transition idempotency, resolve active job priority, and ensure honest sync states.

1. **Task P5-1: Honest Sync Reconciliation (`STAFF-043`)**
   - **Scope:** In `StaffDailyRouteSimplified.tsx`, ensure `isPendingSync` flag on local DCMS route stops automatically clears to `false` (green checkmark) when the server confirms `todayStatus === 'completed'`.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`.

2. **Task P5-2: Terminal Lifecycle State Protection & Reopening Prevention (`STAFF-044`)**
   - **Scope:** Ensure completed and cancelled executions cannot reopen. Enforced on backend via `assertNotCompleted` in `executionService.ts` and on frontend with read-only terminal cards for both `completed` and `cancelled` statuses in `StaffServiceJobFlow.tsx`.
   - **Files:** `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`.

3. **Task P5-3: Active Focus Job Priority Resolution (`STAFF-045`)**
   - **Scope:** In `staff-jobs.ts` (`pickActiveJob`), resolve multiple assigned jobs with strict precedence: `in_progress` > `paused` > `en_route` > `confirmed` > `scheduled`. Completed or cancelled jobs return null.
   - **Files:** `artifacts/cwp-platform/src/lib/staff-jobs.ts`.

4. **Task P5-4: Idempotent Execution Transitions & State Persistence (`STAFF-046`)**
   - **Scope:**
     - In `executionService.ts`, added idempotency guards to `startExecution`, `pauseExecution`, `resumeExecution`, and `completeExecution` so network retries return the current execution view rather than 409 Conflict.
     - In `trackingService.ts` (`markTechnicianEnRoute`), added full support for standalone service executions without legacy booking records.
     - In `StaffServiceJobFlow.tsx`, persisted execution job acceptance across app refreshes/reloads via `localStorage`, preventing loss of accepted state.
     - Added interactive service-specific checklists for Solar Cleaning and Vehicle Detailing/Wash during Step 3 (`onSiteForWashing`) with >= 44px touch targets.
   - **Files:** `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/api-server/src/lib/booking/services/trackingService.ts`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`.

---

### Phase P6: Android Lifecycle, Camera/GPS Evidence Integrity & Recovery (Completed)
**Objective:** Harden Android app lifecycle resilience, photo capture and preview workflows, honest GPS source categorization, offline upload queue stall recovery, and colloquial Hindi field-worker operational error recovery.

1. **Task P6-1: Shutter-Time GPS Evidence Classification & Integrity (STAFF-047)**
   - **Scope:** Concurrently lock GPS at the camera shutter moment. Accurately categorize GPS evidence source (resh_shutter for accuracy <= 200m, low_accuracy for > 200m, last_known_fallback for cached fix, underground_basement for garage signal loss, and permission_denied). Never disguise cached location as fresh GPS. Provide interactive photo preview and retake dialog in GeoPhotoSlotGrid.tsx with honest status chips (GPS वेरिफाइड, कैंपस लोकेशन, कमजोर GPS) and >= 48px touch targets, hiding raw coordinates from staff.
   - **Files:** rtifacts/cwp-platform/src/lib/native/captureStaffPhoto.ts, rtifacts/cwp-platform/src/components/staff/GeoPhotoSlotGrid.tsx, rtifacts/cwp-platform/src/hooks/useStaffJobsData.ts, rtifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx.

2. **Task P6-2: Photo Upload Queue Crash Recovery & Deduplication (STAFF-048)**
   - **Scope:** In offlineQueue.ts, recover orphaned syncing queue entries left over from Android process terminations/crashes by resetting them to pending on restart. Add duplicate upload prevention in enqueue() to prevent duplicate queue items for the same photo or visit payload.
   - **Files:** rtifacts/cwp-platform/src/services/offlineQueue.ts.

3. **Task P6-3: Android App Lifecycle Resilience & Active Job Auto-Restoration (STAFF-049)**
   - **Scope:** In StaffAppShell.tsx, register listeners for @capacitor/app ppStateChange (isActive === true) and isibilitychange to invalidate React Query caches and resume offline sync processing on resume. In StaffOtherServicesPanel.tsx, auto-restore active in-progress, en-route, or paused jobs when navigating to the jobs tab without losing confirmed server state.
   - **Files:** rtifacts/cwp-platform/src/components/layout/StaffAppShell.tsx, rtifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx.

4. **Task P6-4: Colloquial Hindi Field Error Recovery & Settings Deep Linking (STAFF-050)**
   - **Scope:** In staffLanguage.ts, implement ormatStaffOperationalError providing reassuring, non-technical everyday Hindi guidance confirming that work is safely saved on the device and detailing actionable next steps. Add 1-tap phone settings deep link (openNativeAppSettings) in GeoPhotoSlotGrid.tsx and StaffVehicleCleanDialog.tsx for permanent camera/location permission denials.
   - **Files:** rtifacts/cwp-platform/src/lib/staffLanguage.ts, rtifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx, rtifacts/cwp-platform/src/components/staff/GeoPhotoSlotGrid.tsx.
