# CWP Detailers Staff App 2.0 — Implementation Plan (Phase 8)
**Document Version:** 2.1.0  
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

---

### Phase P7: Assignment Synchronization, Staff Eligibility & Access Integrity (Completed)
**Objective:** Eliminate assignment staleness, harden cross-staff IDOR access control, ensure removed/reassigned jobs fail gracefully with colloquial Hindi recovery, integrate deep-linked job alerts with deduplication, and provide 1-tap manual refresh.

1. **Task P7-1: Direct Job Alert Deep-Linking & Self-View Suppression (STAFF-051)**
   - **Scope:** Attach jobKey: staffJobKey(job) directly to StaffJobAlert in useStaffJobAlerts.ts and StaffJobAlertPopup.tsx so "काम खोलें" links to /staff/bookings?job={jobKey}. Check whether the staff member is already on that job's screen to avoid redundant banner alerts.
   - **Files:** artifacts/cwp-platform/src/hooks/useStaffJobAlerts.ts, artifacts/cwp-platform/src/components/staff/StaffJobAlertPopup.tsx.

2. **Task P7-2: Assignment Conflict & Reassignment Recovery (STAFF-052)**
   - **Scope:** In StaffOtherServicesPanel.tsx, detect when a selected job key is no longer assigned to this staff member (reassigned or removed by admin), rendering a clear conflict recovery card in colloquial Hindi ("यह काम अब आपके नाम पर नहीं है") with a 1-tap button to return to the active job list. Add manual refresh buttons with spin indicators on both DCMS route and bookings headers.
   - **Files:** artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx, artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx.

3. **Task P7-3: Tenant Scope Staff Scoping with assignedStaffId in rowInScope & Backend Ownership Guard (STAFF-053)**
   - **Scope:** In tenantScope.ts, support assignedStaffId in rowInScope so staff role cannot access or mutate bookings or assignments assigned to a different staff member. Add explicit technician ownership checks on POST /bookings/:id/transition, /confirm, /reschedule, /cancel.
   - **Files:** artifacts/api-server/src/middlewares/tenantScope.ts, artifacts/api-server/src/routes/bookings.ts, artifacts/api-server/src/__tests__/operations/booking-execution-consistency.test.ts.

4. **Task P7-4: Colloquial Hindi Reassignment & Removal Error Formatting (STAFF-054)**
   - **Scope:** In staffLanguage.ts, extend formatStaffOperationalError with patterns for wrong technician ("काम दूसरे साथी को सौंपा गया है"), removed assignment ("काम हटा दिया गया है"), and cancelled executions ("काम रद्द हो चुका है"). In useStaffJobsData.ts, call invalidateJobs() on mutation errors to force synchronization with server reality.
   - **Files:** artifacts/cwp-platform/src/lib/staffLanguage.ts, artifacts/cwp-platform/src/hooks/useStaffJobsData.ts, artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts.

---

### Phase P8: Staff UX Completeness, Performance & Interaction Consistency (Completed)
**Objective:** Standardize interaction patterns, eliminate workflow friction, ensure non-color-only status badge accessibility, optimize mobile caching/performance, and provide reassuring account/session management.

1. **Task P8-1: Non-Color-Only Status Badge Representation (STAFF-055)**
   - **Scope:** Enhanced `StatusBadge.tsx` and `StaffStatusBadge` across the platform to pair color and text with distinct, accessible Lucide iconography (`CheckCircle2` for success/completed/verified, `Clock` for pending/scheduled/waiting, `RotateCw` for in-progress/en_route, `AlertTriangle` for car_not_available/warning/sync_pending, `XCircle` for cancelled/rejected/missed), satisfying WCAG 2.1 non-color-only accessibility and outdoor sunlight readability.
   - **Files:** `artifacts/cwp-platform/src/components/shared/StatusBadge.tsx`, `artifacts/cwp-platform/src/features/staff-ds/components/domain.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

2. **Task P8-2: Two-Step Logout Confirmation & Active Shift Safety Reassurance (STAFF-056)**
   - **Scope:** Refined logout flow in `Profile.tsx` with an `AlertDialog` confirmation dialog in colloquial Hindi assuring cleaners that today's attendance and local/synced progress remain completely safe, preventing accidental mid-shift logouts; standardized confirm/cancel touch targets to >= 44px/48px.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Profile.tsx`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

3. **Task P8-3: Query Caching & Mobile Network Performance Tuning (STAFF-057)**
   - **Scope:** Configured `staleTime: 15_000` in `useStaffJobsData.ts` and `useStaffDailyRoute` in `api.ts` (and `staleTime: 30_000` for booking history), eliminating aggressive immediate background refetches on rapid tab navigation, preserving mobile device battery and eliminating UI stutter on weak 3G/4G connections.
   - **Files:** `artifacts/cwp-platform/src/hooks/useStaffJobsData.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/api.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

4. **Task P8-4: Staff Account, Version & Field Support Infrastructure (STAFF-058)**
   - **Scope:** Built dedicated Field Support card in `Profile.tsx` with 1-tap phone dialer to operations hotline (`tel:+919999999999` or supervisor phone), displayed official app version `v2.0 (Build 2026.11)` and active session ID, sanitized customer phone dialer URIs (`tel:${phone.replace(/[^\d+]/g, "")}`) across `NextTaskCard.tsx`, `StaffServiceJobFlow.tsx`, and `StaffJobListItem.tsx`, and expanded colloquial Hindi vocabulary in `staffLanguage.ts`.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Profile.tsx`, `artifacts/cwp-platform/src/components/staff/NextTaskCard.tsx`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`, `artifacts/cwp-platform/src/components/staff/StaffJobListItem.tsx`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

---

### Phase P9: Operational Exceptions, Incomplete Work & Recovery Workflows (Completed)
**Objective:** Provide robust, structured operational exception handling for both DCMS routes and appointment services, enforce mandatory evidence proof for exception visits without falsifying completions, guarantee service checklist state persistence across interruptions, and deliver reassuring recovery guidance for field technicians.

1. **Task P9-1: DCMS Vehicle Exception Handling & Mandatory Evidence Photo Contract (STAFF-059)**
   - **Scope:** Extended `StaffExecutionActionsSheet.tsx` and `dcmsLocalStorage.ts` to support new operational exceptions (`water_unavailable` / पानी उपलब्ध नहीं and `already_cleaned` / पहले से साफ) alongside vehicle absent, plate obscured, customer skip, and access denied. Strictly enforced that an evidence photo (empty bay or site condition) is mandatory proof before exception submission, disabling the confirm button if `!photo` and validating against the backend contract (`/daily-cleaning/visits/car-not-available`), ensuring customer cleaning quota is preserved (`consumed = false`) and admin reports record reason prefixes without false cleaner penalties.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffExecutionActionsSheet.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/lib/dcmsLocalStorage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

2. **Task P9-2: Appointment Service Exception Reporting & Authoritative Terminal Transition (STAFF-060)**
   - **Scope:** Created `StaffAppointmentExceptionDialog.tsx` presenting 7 structured field exception scenarios (customer unreachable, customer unavailable at location, customer refused/postponed, scope/condition mismatch, water/power unavailable, site access blocked, other field issue) with optional remarks and clear colloquial Hindi guidance. Integrated with `missExecution` / `cancelExecution` via `useStaffJobsData.ts`, enabling authoritative transitions to `missed` / `cancelled` with event timeline logging, preventing staff from needing to fake completion photos or leaving blocked jobs hanging.
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffAppointmentExceptionDialog.tsx`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`, `artifacts/cwp-platform/src/hooks/useStaffJobsData.ts`, `artifacts/cwp-platform/src/features/service-executions/api.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

3. **Task P9-3: Service-Specific Checklist Integrity, Persistence & Required-Step Gating (STAFF-061)**
   - **Scope:** In `StaffServiceJobFlow.tsx`, persisted interactive service checklist state in `localStorage` under `staff_job_checklist_${source}_${id}`, preventing accidental loss of checked steps during app reloads, task switching, or pauses. Added visual checklist progress badge (`X/Y Steps Done`) and strictly gated "Service Done — After Photos" transition until all required steps are completed, accompanied by helpful colloquial Hindi warnings.
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

4. **Task P9-4: Staff Recovery Guidance & Exception State Compatibility (STAFF-062)**
   - **Scope:** Added read-only terminal status card for `job.status === "missed"` displaying recorded reason, reassuring notes, and explicit guidance to proceed with remaining scheduled work or contact the field supervisor. Updated `formatStaffOperationalError` to provide clear reassurance upon reporting exceptions, and implemented automated cleanup of `localStorage` acceptance and checklist keys on all terminal job states (`completed`, `cancelled`, `missed`).
   - **Files:** `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

---

### Phase P10: Operational State Consistency, Race Conditions & Stale-Data Recovery (Completed)
**Objective:** Eliminate lifecycle race conditions, enforce double-tap and in-flight mutation protection, ensure idempotent API behavior across bookings, executions, and attendance check-in, safeguard technician ownership boundaries with non-crashing recovery views, reconcile multi-day caches and offline queue entries, and guarantee deterministic operational timeline ordering with duplicate event suppression.

1. **Task P10-1: Lifecycle Transition Race-Condition Audit & In-Flight Lock (STAFF-063)**
   - **Scope:** Added in-flight action deduplication lock `if (locatingJobId != null || transitionMutation.isPending || executionMutation.isPending) return;` in `useStaffJobsData.ts` to block duplicate concurrent requests from rapid double-tapping; hardened backend state machines across `executionService.ts` and `bookings.ts` ensuring terminal states (`completed`, `cancelled`, `missed`) strictly reject reverse transitions.
   - **Files:** `artifacts/cwp-platform/src/hooks/useStaffJobsData.ts`, `artifacts/api-server/src/lib/booking/services/trackingService.ts`, `artifacts/api-server/src/routes/bookings.ts`, `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

2. **Task P10-2: Idempotency & Duplicate Action Protection for Execution, Booking and Attendance (STAFF-064)**
   - **Scope:** Updated `POST /staff/:id/attendance` in `routes/staff.ts` to return HTTP 200 with the existing attendance record rather than HTTP 409 Conflict when already marked for that date, ensuring network retries and offline queue flushes succeed without duplicate rows; hardened `POST /bookings/:id/confirm`, `/transition`, and `/cancel` in `routes/bookings.ts` to return the existing record idempotently when already at the requested status; prevented duplicate events and quota depletion on retries.
   - **Files:** `artifacts/api-server/src/routes/staff.ts`, `artifacts/api-server/src/routes/bookings.ts`, `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

3. **Task P10-3: Admin Reassignment & Ownership Conflict Recovery with Hindi Guidance (STAFF-065)**
   - **Scope:** Enforced server-side technician ownership validation on booking and execution transition routes; updated `formatStaffOperationalError` in `staffLanguage.ts` to translate terminal status errors, assignment removals, and wrong technician conflicts into clear colloquial Hindi with non-crashing recovery view, preserving offline evidence and attendance records.
   - **Files:** `artifacts/api-server/src/routes/bookings.ts`, `artifacts/cwp-platform/src/features/staff-jobs/components/StaffOtherServicesPanel.tsx`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

4. **Task P10-4: Stale Cache & Offline Queue Reconciliation across DCMS and Appointments (STAFF-066)**
   - **Scope:** In `useStaffJobsData.ts`, added query invalidation for `["dcms", "staff", "daily-route"]` inside `invalidateJobs()`; verified multi-day DCMS localStorage isolation in `dcmsLocalStorage.ts` and automated cleanup of previous dates; verified offline queue deduplication in `offlineQueue.ts` preventing redundant pending mutations.
   - **Files:** `artifacts/cwp-platform/src/hooks/useStaffJobsData.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/lib/dcmsLocalStorage.ts`, `artifacts/cwp-platform/src/services/offlineQueue.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

5. **Task P10-5: Operational Timeline Consistency & Duplicate Event Suppression (STAFF-067)**
   - **Scope:** In `executionTimeline.ts` and `bookings.ts`, added event deduplication suppressing identical consecutive events occurring within 5 seconds for the same entity and type, preserving deterministic chronological ordering and ensuring staff status and admin timeline match.
   - **Files:** `artifacts/api-server/src/lib/executions/executionTimeline.ts`, `artifacts/api-server/src/routes/bookings.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

---

### Phase P11: Field Usability, Accessibility & Workflow Friction Audit (Completed)
**Objective:** Optimize the Staff App 2.0 experience for field cleaners and technicians with limited technical literacy, establish strict single primary action hierarchy, ensure colloquial Hindi-first clarity across all app indicators, enforce minimum 44px–48px touch targets and non-color-only accessibility, add empty and error state recovery on the dashboard, and incorporate Android system safe-area padding preventing gesture navigation bar overlap.

1. **Task P11-1: Field Usability Audit & Operational Task Priority Hierarchy (STAFF-068)**
   - **Scope:** Completed comprehensive usability audit from the perspective of field workers; established strict single primary action resolution: active booking (`in_progress`, `en_route`, `paused`) takes immediate top priority, morning DCMS pending route stops take second priority, scheduled bookings take third priority when DCMS is done, celebration state when all tasks are complete, and reassuring empty state when 0 tasks are assigned today.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`, `artifacts/cwp-platform/src/components/staff/NextTaskCard.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

2. **Task P11-2: Hindi-First Language & Status Consistency across App Indicators (STAFF-069)**
   - **Scope:** Integrated `getStaffLanguage()` into `LocationStatusIndicator.tsx` ("GPS चालू", "GPS बंद", "जांच हो रही…") and `SyncStatusIndicator.tsx` ("सिंक पूरा", "सिंक हो रहा…", "ऑफलाइन"); fully localized all 8 operational exceptions in `StaffExecutionActionsSheet.tsx` into colloquial Hindi; added localized Hindi error messages and retry guidance in `StaffOtherServicesPanel.tsx`; fixed missing `isHindi` destructuring in `StaffVehicleCleanDialog.tsx`.
   - **Files:** `artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx`, `artifacts/cwp-platform/src/lib/location/LocationStatusIndicator.tsx`, `artifacts/cwp-platform/src/components/connectivity/SyncStatusIndicator.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffExecutionActionsSheet.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffVehicleCleanDialog.tsx`, `artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

3. **Task P11-3: Touch Targets, Typography & Accessibility Standards (STAFF-070)**
   - **Scope:** Upgraded touch target dimensions across all interactive elements to meet or exceed 44px–48px minimum standards: AppShell language toggle (`min-h-[44px] min-w-[44px]`), NextTaskCard phone dialer (`min-h-[48px] min-w-[48px]`), navigate button (`min-h-[48px]`), copy address button (`min-h-[44px] min-w-[44px]`), DailyRoute header refresh (`min-h-[44px] min-w-[44px]`), search clear (`min-h-[44px] min-w-[44px]`), options trigger (`min-w-[48px] h-12`), ServiceJobFlow copy button (`min-w-[48px] h-12`), report issue button (`h-12 min-h-[48px]`), OtherServicesPanel back button (`min-h-[44px] min-w-[44px]`), refresh jobs button (`min-h-[44px] px-3`), Profile language selector buttons (`min-h-[48px] h-12`), and logout dialog actions (`h-12 min-h-[48px]`).
   - **Files:** `artifacts/cwp-platform/src/components/layout/StaffAppShell.tsx`, `artifacts/cwp-platform/src/components/staff/NextTaskCard.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`, `artifacts/cwp-platform/src/components/staff/StaffServiceJobFlow.tsx`, `artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx`, `artifacts/cwp-platform/src/pages/staff/Profile.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

4. **Task P11-4: Primary Action & Route Sequence Simplification (STAFF-071)**
   - **Scope:** Ensured hero next task card on Dashboard renders exactly one primary action CTA at a time; verified DCMS daily route preserves assigned route sequence while allowing direct selection of pending vehicles without rigid locking.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/StaffDailyRouteSimplified.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

5. **Task P11-5: Loading, Empty, Error & Recovery States with Actionable Triggers (STAFF-072)**
   - **Scope:** Built dedicated empty state card on Dashboard when 0 DCMS routes and 0 appointments are assigned today, displaying reassuring colloquial Hindi guidance (`t("no_assignments_today")`, `t("no_assignments_desc")`) and an accessible 44px refresh CTA (`RotateCcw`); updated `StaffOtherServicesPanel.tsx` with localized Hindi title, description, and actionable `onRetry` trigger in `StaffErrorState`.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`, `artifacts/cwp-platform/src/components/staff/StaffOtherServicesPanel.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

6. **Task P11-6: Android Screen & Interaction Consistency with Safe-Area Inset Support (STAFF-073)**
   - **Scope:** Added Android system navigation safe-area bottom padding `pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]` on `StaffExecutionActionsSheet.tsx` and `StaffAppointmentExceptionDialog.tsx` DialogContent containers to prevent action buttons from being clipped by system gesture bars on Android devices; verified double-tap prevention on modal submissions.
   - **Files:** `artifacts/cwp-platform/src/features/daily-cleaning/components/StaffExecutionActionsSheet.tsx`, `artifacts/cwp-platform/src/components/staff/StaffAppointmentExceptionDialog.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

---

### Phase P12: Security, Privacy, Permission & Evidence Integrity Audit (Completed)
**Objective:** Eliminate data authorization leaks, prevent cross-staff and cross-customer record access, enforce secure protocol schemes and geo-coordinates for evidence and signatures, prevent cached locations from being disguised as fresh shutter-time fixes, protect offline queues against cross-account contamination on shared mobile devices, warn staff before logout when unsynced work exists, and sanitize server logs to prevent raw GPS coordinate leakage.

1. **Task P12-1: Staff Data Access & Tenant Ownership Isolation (STAFF-074)**
   - **Scope:** Hardened `tenantScope.ts` (`rowInScope`) so that when the caller has `role === "staff"`, unassigned records (`assignedStaffId == null`) and records assigned to other technicians are strictly denied; added `staffCol: bookingsTable.assignedStaffId` to `SCOPE_COLS` in `bookings.ts` ensuring booking list queries automatically filter by assigned technician; guarded `/customers` and `/customers/:id/*` dossier endpoints in `customers.ts` to reject staff role with HTTP 403 Forbidden (`STAFF_FORBIDDEN`); locked `staffId` in `executionService.ts` (`listStaffExecutions`) to the caller's authenticated identity, preventing query ID substitution.
   - **Files:** `artifacts/api-server/src/middlewares/tenantScope.ts`, `artifacts/api-server/src/routes/bookings.ts`, `artifacts/api-server/src/routes/customers.ts`, `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

2. **Task P12-2: Photo Evidence Privacy & Integrity Verification (STAFF-075)**
   - **Scope:** Hardened `addExecutionPhotos` and `completeExecution` in `executionService.ts` to strictly validate evidence and signature URLs against secure `https://` protocols, eliminating arbitrary schemes (`javascript:`, `file:`, `data:`); verified shutter-time geo-coordinates (`latitude`, `longitude`) requirement; prevented pending/failed uploads from ever being falsely displayed as server-confirmed.
   - **Files:** `artifacts/api-server/src/lib/executions/executionService.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

3. **Task P12-3: GPS & Location Permission Privacy and Evidence Source Distinction (STAFF-076)**
   - **Scope:** Updated `types.ts`, `locationStore.ts`, and `getStaffLocation.ts` to track evidence source origin (`fresh`, `cache`, `last_known`); verified that `action` mode (attendance, photo capture, visit completion) strictly forbids cached coordinates (`modeUsesCache("action") === false`), guaranteeing that last-known locations cannot be disguised as fresh shutter-time evidence.
   - **Files:** `artifacts/cwp-platform/src/lib/location/types.ts`, `artifacts/cwp-platform/src/lib/location/locationStore.ts`, `artifacts/cwp-platform/src/lib/location/getStaffLocation.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

4. **Task P12-4: Local Storage & Offline Data Cross-Staff Protection (STAFF-077)**
   - **Scope:** Extended `QueueItem` in `offlineQueue.ts` with `staffId` and `userId` metadata, auto-stamped upon enqueuing; isolated queue execution in `runSync()` to skip pending items queued by other staff accounts, preventing cross-account mutation contamination on shared mobile devices.
   - **Files:** `artifacts/cwp-platform/src/services/offlineQueue.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

5. **Task P12-5: Session, Logout & Account Switching Integrity (STAFF-078)**
   - **Scope:** Subscribed `Profile.tsx` logout dialog to `offlineQueue.getPendingCount()`; when unsynced work exists (`pendingSyncCount > 0`), rendered an amber warning alert in colloquial Hindi assuring the worker that their data remains safely stored on the device and will sync upon logging back into this account.
   - **Files:** `artifacts/cwp-platform/src/pages/staff/Profile.tsx`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.

6. **Task P12-6: Security Error Handling & Logging Hygiene (STAFF-079)**
   - **Scope:** In `dcms.ts` (`POST /daily-cleaning/visits/complete`), redacted micro-degree GPS coordinates from server logs, logging `hasGps: boolean` and rounded accuracy; verified `formatStaffOperationalError` shields technical database stack traces and internal errors into reassuring colloquial Hindi.
   - **Files:** `artifacts/api-server/src/routes/dcms.ts`, `artifacts/cwp-platform/src/lib/staffLanguage.ts`, `artifacts/cwp-platform/src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts`.
