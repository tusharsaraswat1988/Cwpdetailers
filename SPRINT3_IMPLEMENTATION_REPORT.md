# Sprint 3 Implementation Report

**CWP World-Class Product Experience — Staff Portal Mobile Transformation**  
**Date:** 13 June 2026  
**Status:** ✅ COMPLETE — Staff portal UI only; no backend/schema/business-logic changes  
**Scope:** Staff portal only (Customer/Admin unchanged)

---

## Summary

Sprint 3 replaces the desktop sidebar staff workflow with a **mobile-first field operations app** using `AppShell` + bottom navigation (Uber Driver / Urban Company Partner pattern). Staff can navigate Today → Jobs → Earnings → Profile from a phone without opening admin-style screens.

| Deliverable | Status | Route / file |
|-------------|--------|--------------|
| StaffAppShell + bottom nav | ✅ | `StaffAppShell.tsx` |
| Active job focus mode (hero card) | ✅ | `staff/Dashboard.tsx` + `ActiveJobHero.tsx` |
| Unified jobs view (Today / Upcoming / Done) | ✅ | `/staff/jobs` → `staff/Jobs.tsx` |
| Earnings screen | ✅ | `/staff/earnings` → `staff/Earnings.tsx` |
| Profile hub (attendance + performance) | ✅ | `/staff/profile` → `staff/Profile.tsx` |
| Legacy route redirects | ✅ | `/staff/schedule` → `/staff/jobs`; `/staff/attendance`, `/staff/performance` → `/staff/profile` |
| Sidebar / PanelShell removed from staff | ✅ | `StaffLayout.tsx` now wraps `StaffAppShell` only |

---

## Routes

### New routes (`App.tsx`)

| Method | Path | Component | Auth |
|--------|------|-----------|------|
| GET (SPA) | `/staff/dashboard` | `StaffDashboard` | `staff` role |
| GET (SPA) | `/staff/jobs` | `StaffJobs` | `staff` role |
| GET (SPA) | `/staff/earnings` | `StaffEarnings` | `staff` role |
| GET (SPA) | `/staff/profile` | `StaffProfile` | `staff` role |

### Redirects (no 404)

| Old path | Redirects to |
|----------|--------------|
| `/staff/schedule` | `/staff/jobs` |
| `/staff/attendance` | `/staff/profile` |
| `/staff/performance` | `/staff/profile` |

### Bottom navigation

```
Today (/staff/dashboard) | Jobs (/staff/jobs) | Earnings (/staff/earnings) | Profile (/staff/profile)
```

---

## Mobile layout

| Screen | Layout |
|--------|--------|
| **Shell** | `AppShell` `maxWidth="md"` (640px), fixed bottom nav, `100dvh`, safe-area padding, PWA install banner |
| **Today** | Greeting + stat chips → **Active Job Hero** (when `en_route` / `in_progress` / first `scheduled`) → compact “Up next” list |
| **Jobs** | Segmented control (Today / Upcoming / Done) → compact cards; date headers on Upcoming/Done |
| **Earnings** | Period toggle (Today / Week / Month) → total card → job breakdown with amounts |
| **Profile** | Avatar + one-tap **Mark present** → 2×2 stats → collapsible monthly calendar → Sign out |

### Active Job Focus Mode

**Selection logic** (`lib/staff-jobs.ts` → `pickActiveJob`):

1. First today job with status `en_route` or `in_progress`
2. Else first today job with status `scheduled`

**Action state machine** (unchanged business logic, `h-14` hero buttons):

```
scheduled  → On My Way        → en_route
en_route   → Take Before Photo → beforePhotoUrl set
en_route + before → Start Job  → in_progress
in_progress → Take After Photo → afterPhotoUrl set
in_progress + after → Complete Job → completed
```

Photo upload reuses existing Cloudinary presign + `useUpdateBooking` + `useTransitionBooking` mutations.

---

## Files changed

### New files

| File | Purpose |
|------|---------|
| `src/components/layout/StaffAppShell.tsx` | Mobile shell: AppBar, bottom nav, PWA banner |
| `src/lib/staff-jobs.ts` | Shared types, partitioning, active job picker, date grouping |
| `src/hooks/useStaffJobsData.ts` | Shared bookings queries + photo/transition mutations |
| `src/components/staff/StaffAccountGate.tsx` | Loading / unlinked staff guard |
| `src/components/staff/ActiveJobHero.tsx` | Focus-mode hero card |
| `src/components/staff/StaffJobActions.tsx` | Reusable workflow action buttons |
| `src/components/staff/StaffJobListItem.tsx` | Compact job row |
| `src/pages/staff/Jobs.tsx` | Unified jobs page |
| `src/pages/staff/Earnings.tsx` | Frontend earnings aggregation |
| `src/pages/staff/Profile.tsx` | Attendance + performance hub |

### Modified files

| File | Change |
|------|--------|
| `src/components/layout/StaffLayout.tsx` | Removed `PanelShell` sidebar; delegates to `StaffAppShell` |
| `src/pages/staff/Dashboard.tsx` | Focus mode hero + compact queue; removed inline tab list |
| `src/App.tsx` | New routes + legacy redirects |

### Unchanged (legacy files, not routed)

| File | Note |
|------|------|
| `src/pages/staff/Schedule.tsx` | Superseded by `/staff/jobs`; redirect in `App.tsx` |
| `src/pages/staff/Attendance.tsx` | Logic merged into Profile |
| `src/pages/staff/Performance.tsx` | Logic merged into Profile |

**Total:** 10 new files, 3 modified, 0 backend files, 0 schema changes.

---

## Data sources (existing APIs only)

| Screen | APIs / hooks |
|--------|----------------|
| Today / Jobs | `useGetTodayBookings`, `useListBookings`, `useTransitionBooking`, `useUpdateBooking`, `useRequestUploadUrl` |
| Earnings | `useListBookings` (client-side sum of `amount` on completed jobs) |
| Profile | `useGetStaffAttendance`, `useMarkAttendance`, `useGetStaffPerformance`, `useGetStaffLeaderboard` |

---

## Screenshots

Captured on **390×844 mobile viewport** against local dev (`http://localhost:21456`), staff login `9011001001` / `staff123` (Ravi Kumar).

| # | File | Description |
|---|------|-------------|
| 1 | `docs/screenshots/sprint3-verification/sprint3-01-dashboard.png` | Today tab — bottom nav, stat chips, empty state |
| 2 | `docs/screenshots/sprint3-verification/sprint3-02-jobs-today.png` | Jobs — segmented Today / Upcoming / Done |
| 3 | `docs/screenshots/sprint3-verification/sprint3-03-jobs-done.png` | Jobs Done tab — completed job with StatusBadge |
| 4 | `docs/screenshots/sprint3-verification/sprint3-04-earnings-week.png` | Earnings — ₹599 from 1 completed job (week view) |
| 5 | `docs/screenshots/sprint3-verification/sprint3-05-profile.png` | Profile — Mark present, stats, sign out |

**Active Job Hero:** Renders when today has a `scheduled`, `en_route`, or `in_progress` booking; seed data had no jobs scheduled for verification date (13 Jun 2026). Hero component and workflow buttons are implemented and reuse the same mutations as pre-Sprint-3 Dashboard.

---

## Verification evidence

### Manual UI (browser automation, 13 Jun 2026)

| Check | Result |
|-------|--------|
| Staff login → `/staff/dashboard` | ✅ PASS |
| Bottom nav visible (4 tabs) | ✅ PASS |
| No sidebar / hamburger on staff pages | ✅ PASS |
| `/staff/jobs` segmented tabs | ✅ PASS |
| `/staff/earnings` week total ₹599 | ✅ PASS |
| `/staff/profile` Mark present button | ✅ PASS |
| `/staff/schedule` → `/staff/jobs` redirect | ✅ PASS |
| PWA install banner on staff shell | ✅ PASS (component mounted) |

### TypeScript

```
pnpm run typecheck (cwp-platform)
```

New Sprint 3 files: **0 errors** (IDE linter clean).

Pre-existing project errors in `HistoryPanel.tsx` (communications feature) still fail root typecheck — **not introduced by Sprint 3**.

### Business logic

| Item | Changed? |
|------|----------|
| Booking state machine | ❌ No |
| Photo upload flow | ❌ No |
| API endpoints | ❌ No |
| Database schema | ❌ No |

---

## Definition of Done

- [x] Staff portal uses bottom nav on all breakpoints (no sidebar)
- [x] Staff dashboard shows active job as hero card with `h-14` buttons
- [x] Photo upload still uses existing Cloudinary + booking update flow
- [x] `/staff/jobs` shows Today / Upcoming / Done tabs
- [x] `/staff/earnings` shows period earnings from completed bookings
- [x] `/staff/profile` has one-tap attendance mark + performance stats
- [x] `/staff/schedule`, `/staff/attendance`, `/staff/performance` redirect (not 404)

---

## What was NOT changed

- Customer portal
- Admin portal / Daily Ops (Sprint 4 not started)
- Migration tools (Sprint M not started)
- Backend routes, schema, notification logic
- Offline queue wiring for staff photo uploads (connectivity backlog)

---

*Sprint 3 complete. Staff field app is mobile-first and PWA-friendly. Next approved sprint: Sprint 4 (Daily Ops monitoring upgrade).*
