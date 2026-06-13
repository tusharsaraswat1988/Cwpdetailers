# Phase 4 Implementation Report — Daily Cleaning Operations Automation

**Date:** 2026-06-13  
**Scope:** T19–T22 operational automation (Daily Cleaning priority)  
**Excluded:** Mobile apps, franchise finance, Razorpay, WhatsApp, analytics, loyalty, coupons

---

## Summary

Phase 4 automates the Daily Cleaning workflow end-to-end: vehicle→staff assignment, idempotent daily booking generation, due-wash detection, low-balance alerts, contract auto-pause/resume, weekly off rules, and an admin scheduling dashboard. The goal is minimum manual intervention for daily operations.

---

## 1. Vehicle → Staff Assignment

| Item | Detail |
|------|--------|
| Schema | `vehicles.assigned_staff_id` (nullable FK to staff) |
| API | `PATCH /api/vehicles/:id` accepts `assignedStaffId` with verified staff + same-branch validation |
| Admin UI | Customer detail page — staff dropdown per vehicle |

---

## 2. Daily Cleaning Scheduler

| Item | Detail |
|------|--------|
| Core | `artifacts/api-server/src/subscriptions/dailyScheduler.ts` |
| Trigger | `runDailyTick()` (cron/6h idempotent) + manual `POST /subscriptions/daily-schedule` |
| Rules | Active `daily_wash` subs with vehicle, assigned staff, sufficient balance, not off-day, no duplicate booking today |
| Output | `serviceType: daily_cleaning`, `status: scheduled`, links subscription/vehicle/staff |

**Env:** `DAILY_CLEANING_OFF_DAYS=3` (comma-separated IST weekdays, 0=Sun; default Wednesday)

---

## 3. Due Wash Detection

| Item | Detail |
|------|--------|
| Types | `monthly_wash`, `solar_amc` with overdue `nextDueDate` and no active booking |
| API | `GET /subscriptions/due-washes` |
| Dashboard | Shown on Daily Ops page with days-overdue |

---

## 4. Low Balance Alerts

| Item | Detail |
|------|--------|
| Threshold | `WALLET_LOW_BALANCE_DAYS=7` × daily rate |
| Triggers | Scheduler (pre-booking), booking completion debit, wallet GET for customer banner |
| Notification | `notifyLowBalance()` via FAST2SMS + in-app (dedupe key per customer/day) |
| Customer UI | Amber banner on customer dashboard when `isLowBalance` |

---

## 5. Contract Auto Pause / Resume

| Pause | Balance &lt; daily rate at schedule time → `pauseSubscription()` |
| Resume | `tryAutoResumeDailyWash()` on admin wallet credit when balance ≥ daily rate |
| API | Credit response includes `resumedSubscriptions[]` |

---

## 6. Weekly Off Rules

| Level | Config |
|-------|--------|
| Global | `DAILY_CLEANING_OFF_DAYS` env var |
| Per contract | `subscriptions.off_days` JSON array (default `[3]` = Wednesday) |
| Behavior | Scheduler skips off days; dashboard shows off-day banner |

---

## 7. Admin Scheduling Dashboard

| Route | `/admin/daily-ops` |
| Nav | Admin sidebar → **Daily Cleaning** |
| Features | KPI cards, today's bookings, unassigned vehicles, due washes, blockers, run schedule / full tick buttons |

**API:** `GET /subscriptions/daily-ops` (read-only preview — does not create bookings on load)

---

## API Endpoints (new/updated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/subscriptions/daily-ops` | Dashboard summary |
| GET | `/subscriptions/due-washes` | Overdue package/AMC washes |
| POST | `/subscriptions/daily-schedule` | Manual booking generation (admin/manager) |
| POST | `/subscriptions/daily-tick` | Full daily tick; `{ force: true }` bypasses 6h guard |
| PATCH | `/vehicles/:id` | Assign `assignedStaffId` |

---

## Schema Changes

```sql
-- vehicles
ALTER TABLE vehicles ADD COLUMN assigned_staff_id integer;

-- subscriptions  
ALTER TABLE subscriptions ADD COLUMN off_days jsonb DEFAULT '[3]';
```

Pushed via `pnpm run push` in `lib/db`.

---

## Verification

### HTTP smoke test (`scripts/src/phase4-http-verify.ts`)

```
Admin login: PASS
GET /subscriptions/daily-ops: PASS (active=2)
GET /subscriptions/due-washes: PASS (count=1)
POST /subscriptions/daily-schedule: PASS
POST /subscriptions/daily-tick (force): PASS
PATCH /vehicles/:id assignedStaffId: PASS
GET wallet (low balance fields): PASS

=== ALL PASS ===
```

### Build / typecheck

- `artifacts/api-server` — build PASS
- `artifacts/cwp-platform` — typecheck PASS

---

## Key Files

| Area | Path |
|------|------|
| Scheduler | `artifacts/api-server/src/subscriptions/dailyScheduler.ts` |
| Daily tick | `artifacts/api-server/src/subscriptions/service.ts` |
| Wallet auto-resume | `artifacts/api-server/src/lib/wallet/service.ts` |
| Routes | `artifacts/api-server/src/routes/subscriptions.ts`, `vehicles.ts`, `bookings.ts`, `wallet.ts` |
| Admin dashboard | `artifacts/cwp-platform/src/pages/admin/DailyOps.tsx` |
| Staff assignment UI | `artifacts/cwp-platform/src/pages/admin/CustomerDetail.tsx` |
| Customer banner | `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` |

---

## Operational Notes

1. **Cron:** Wire `POST /subscriptions/daily-tick` to a Render cron job (e.g. 05:30 IST daily).
2. **Idempotency:** Tick skips if last successful run within 6 hours; use `{ force: true }` for manual reruns.
3. **Wednesday skip:** With default off-day=3, scheduler returns early on Wednesdays.
4. **Seed:** Daily subs linked to vehicles; vehicles pre-assigned to staff (Arjun→Ravi, Rohit→Suresh).

---

## Not Implemented (per scope exclusion)

- WhatsApp notifications
- Razorpay auto-recharge
- Analytics dashboards
- Loyalty / coupons
- Mobile apps
