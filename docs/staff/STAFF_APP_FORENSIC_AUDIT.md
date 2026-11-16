# CWP Detailers Staff App — Forensic Technical Audit (Phase 0 & 2)
**Document Version:** 2.0.0  
**Target:** CWP Detailers Staff System Architecture  
**Date:** 2026-11-16  
**Auditor:** Principal Systems Engineer & Security Auditor  

---

## 1. Architectural Tracing & Forensic Findings

### 1.1 Multi-Service Eligibility vs. Operational Role Restrictions
- **Finding**: In `StaffAppShell.tsx` (lines 74-84), the navigation item for "Bookings" was conditionally hidden based on operational role slugs:
  ```ts
  if (item.href === "/staff/bookings") {
    const staffHasOtherRoles = slugs.some(s => s !== OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
    if (slugs.length > 0 && !staffHasOtherRoles) return false;
  }
  ```
- **Operational Reality**: Under CWP field operations, a cleaner who primarily performs DCMS (Daily Car Cleaning) can also be dispatched for Car Wash (bundled monthly washes or one-off bookings) and Solar Panel Cleaning. Restricting navigation based on a mutually exclusive role concept prevents staff from seeing active appointment assignments.
- **Backend Model**: The backend already models multi-service capability cleanly:
  - `dcms_staff_assignments`: Enduring subscription route assignments for daily cleaning.
  - `service_assignments` & `service_executions`: Date-specific appointment dispatch for car wash, solar panel cleaning, and detailing.
  - `staff_operational_roles`: Staff can have multiple role assignments (`daily_car_cleaner`, `car_detailer`, `solar_cleaner`, `technician`).
- **Correction Required**: Remove the artificial filter that blocks access to appointment-based jobs. Provide a dedicated "My Other Jobs" tab for all staff who have assigned appointments.

---

### 1.2 DCMS Route Sequencing & Completion Flow
- **Finding in Backend**:
  - `artifacts/api-server/src/lib/dcms/dailyRouteService.ts` queries `dcmsStaffAssignmentsTable` ordered by `asc(routeOrder)`:
    ```ts
    .orderBy(asc(dcmsStaffAssignmentsTable.routeOrder), asc(dcmsStaffAssignmentsTable.id));
    ```
  - Each stop has an assigned sequence (`routeOrder`).
- **Finding in Frontend**:
  - `StaffDailyRouteSimplified.tsx` was displaying all route stops in a single tabbed list (`all`, `pending`, `completed`, `exceptions`).
  - When a stop was completed out of order (e.g., stop #4 cleaned before stop #2), there was no clear visual distinction between remaining pending jobs and finished jobs unless the user manually switched tabs.
- **Operational Requirement**:
  - Pending vehicles must appear first (above).
  - Completed vehicles must appear separately below.
  - Original sequence order (e.g. #1, #2, #3, #4, #5) must be preserved in the pending list when a car is completed out of order.
  - Actual completion order (e.g., "Completed 1st at 06:15 AM") must be recorded and displayed.
  - Staff must be able to select ANY assigned pending customer at any time.

---

### 1.3 Location-Verified Photo Evidence Forensic Trace
- **Finding in Photo Capture**:
  - `StaffVehicleCleanDialog.tsx` calls `captureStaffPhoto("rear")`.
  - In native Android (`captureStaffPhoto.ts`), `@capacitor/camera` is invoked with `source: CameraSource.Camera` and `saveToGallery: false`. This enforces in-app camera capture and disallows selecting old images from the device gallery.
- **Finding in Location Capture Timing**:
  - In `StaffVehicleCleanDialog.tsx`:
    1. Line 110: `const captured = await captureStaffPhoto("rear");` — photo is captured and local state is updated.
    2. Lines 116-154: OCR is executed and verified.
    3. Line 191: `const gps = await getStaffLocation("action");` — **Location was queried inside `handleSubmitCompletion`**, which could occur minutes later after the cleaner walked away from the car!
- **Operational & Fraud Prevention Impact**:
  - If location is obtained on submit, a cleaner could take a photo near the vehicle, walk to another tower or outside the society gates, and submit from outside the geofence, triggering a false rejection. Conversely, capturing at submit allows GPS drift.
- **Correction Required**:
  - Acquire device GPS coordinates, horizontal accuracy, and timestamp **immediately at the time of photo capture**.
  - Pass the capture-time GPS payload directly into the completion submission.

---

### 1.4 Geofence Validation & Basement Parking Fallback
- **Backend Implementation in `visitService.ts`**:
  - Lines 309-320: Compares staff coordinates against `dcmsSubscriptionLocationsTable` coordinates using haversine formula within `location.radiusMeters` (default 250m).
  - Lines 287-307: `validateBasementGpsFallback` handles underground basement parking (B1/B2/B3). If a society has basement parking and GPS lock fails, it allows completion with an audit flag if photo proof is attached, rather than failing silently.
  - Lines 321-373: If geofence fails outside basement exception, the visit is saved as `status: "rejected"` with `rejectionReason: "Outside Service Area"`, and emits a `fraud_alert` notification event.
- **Frontend Presentation Issue**:
  - When GPS is weak or acquisition fails, technical error messages like `"GPS_TIMEOUT"` or `"accuracy 280m exceeds threshold"` were surfacing to cleaners.
  - Cleaners need clear, non-technical Hindi instructions:
    - “गाड़ी के पास जाकर फोटो लें।”
    - “लोकेशन नहीं मिल रही। फिर कोशिश करें।”
    - “फोटो भेजी जा रही है।”
    - “सफाई पूरी हो गई।”
    - “काम सेव नहीं हुआ। फिर कोशिश करें।”

---

### 1.5 Push Notification & Job Alerts Forensic Trace
- **Components**:
  - `StaffJobAlertLayer.tsx`: Polls `/api/bookings/today` and `/api/service-executions/today` every 30 seconds.
  - `useStaffJobAlerts.ts`: Triggers vibration (`staff-vibration.ts`) and pops up `StaffJobAlertPopup`.
  - `StaffJobAlertPopup.tsx`:
    - Displayed alert message with "Open Today" button.
    - **Defect**: The button was hardcoded to `<Link href="/staff/dashboard">`, sending the cleaner to the dashboard where they had to find the job again, rather than navigating directly to the specific job in `/staff/bookings?job=<key>`.
- **Correction**:
  - Link the alert action directly to `/staff/bookings?job=${alert.jobKey}` (or the new "My Other Jobs" view).

---

### 1.6 Cognitive Load & Field Usability Audit
- **Cleaners' Educational Profile**: The CWP cleaning workforce includes staff with 8th to 10th standard education levels.
- **Current UI Barriers**:
  1. Dense English copy across all primary screens.
  2. Four separate metrics cards (Assigned, Done, Pending, Skipped) followed by another four metrics inside the route card.
  3. Redundant Attendance Card on the Dashboard even after shift check-in is complete.
  4. Multiple competing primary buttons on the Dashboard.
  5. Technical OCR confidence percentages displayed during plate scanning.
  6. Bottom navigation contains 5 tabs (Dashboard, Daily Clean, Bookings, Earnings, Profile), causing confusion over where to find tasks.
- **Simplification Target**:
  - 4 bottom tabs: **Dashboard**, **DCMS**, **My Other Jobs**, **Account**.
  - Hindi-first UI with a persistent English toggle.
  - Dashboard shows: Greeting, today's DCMS progress, Other Jobs status, and ONE clear next action.
  - DCMS screen clearly shows Pending customers first, Completed customers below, with a prominent "सफाई पूरी करें" button.
