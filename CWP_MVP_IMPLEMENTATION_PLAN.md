# CWP Detailers — Varanasi MVP Implementation Plan

**Goal:** Launch real operations in Varanasi with real customers and real staff.  
**Scope:** Customer portal · Staff portal · Doorstep wash · Daily car cleaning · Solar cleaning · Before/after photos · Notifications · Billing · Wallet · Daily cleaning automation  
**Out of scope:** Patna, multi-city pricing, franchisee portal, CRM/leads, coupons, Razorpay, geofencing, PWA, partner settlement  
**Strategy:** Reuse existing backend and admin UI. Fix wiring, add missing automation, extend — do not rewrite.

**Companion docs:** `MASTER_PLAN.md` · `CWP_ARCHITECTURE_AUDIT.md` · `CWP_TARGET_ARCHITECTURE.md`

---

## MVP Success Definition

Tushar (admin) and field staff can run Varanasi daily operations **without WhatsApp coordination or manual booking entry for daily cleans**, using:

1. Customers register, add car/solar, book doorstep or solar jobs, see history and invoices  
2. Staff see **their** jobs on phone, upload before/after photos, mark complete  
3. Daily cleaning customers have wallet balance; each completed clean debits wallet; low balance alerts fire  
4. Daily scheduler auto-creates today’s cleaning bookings for mapped cars (Wednesday off)  
5. SMS notifies customer on booking confirm and job complete  
6. Admin records cash/UPI wallet top-ups and generates invoices when needed  

---

## Task Index (by ID)

| ID | Task | Phase | Priority |
|---|---|---|---|
| T1 | Production deploy foundation | 1 | P0 |
| T2 | Secure password hashing | 1 | P0 |
| T3 | Object storage (Cloudinary) | 1 | P0 |
| T4 | Wire customer portal to auth | 1 | P0 |
| T5 | Wire staff portal to auth | 1 | P0 |
| T6 | Staff login linkage on create-account | 1 | P0 |
| T7 | Varanasi seed + pilot accounts | 1 | P0 |
| T8 | Customer asset onboarding (vehicles + solar) | 2 | P0 |
| T9 | Doorstep wash booking flow | 2 | P0 |
| T10 | Solar cleaning booking + pricing | 2 | P0 |
| T11 | Staff job workflow + before/after photos | 2 | P0 |
| T12 | Admin: daily contract + staff assignment | 2 | P0 |
| T13 | Wallet ledger + admin recharge | 3 | P0 |
| T14 | Wallet debit on booking complete | 3 | P0 |
| T15 | Customer wallet view + history | 3 | P0 |
| T16 | Billing: customer invoices + admin record payment | 3 | P0 |
| T17 | SMS notification dispatcher | 3 | P0 |
| T18 | Notification triggers (book + complete + low balance) | 3 | P0 |
| T19 | Vehicle → staff mapping | 4 | P0 |
| T20 | Daily cleaning auto-scheduler | 4 | P0 |
| T21 | Wednesday off-day rule | 4 | P0 |
| T22 | Low balance alert + auto-pause contract | 4 | P0 |
| T23 | Solar AMC customer progress view | 4 | P1 |
| T24 | Customer service history photos polish | 4 | P1 |
| T25 | Admin ops checklist + hide non-MVP nav | 4 | P1 |
| T26 | End-to-end pilot smoke test | 4 | P0 |

---

## Detailed Tasks

---

### T1 — Production deploy foundation

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1 day |
| **Dependencies** | None |

**Files likely affected**
- `render.yaml` (new)
- `.env.example` (new)
- `artifacts/api-server/src/index.ts`
- `artifacts/cwp-platform/vite.config.ts`
- `scripts/dev.mjs`

**Database changes** | None  
**API changes** | Bind `0.0.0.0:$PORT`; health check already exists  
**Frontend changes** | Static site or web service config; `/api` proxy in prod  

**Acceptance criteria**
- [ ] App deploys to Render (or chosen host) with Postgres attached  
- [ ] `.env.example` documents all required vars (`DATABASE_URL`, `PORT`, storage keys, SMS keys)  
- [ ] `GET /api/healthz` returns 200 in production  
- [ ] Frontend loads and reaches login page over HTTPS  

---

### T2 — Secure password hashing

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1 day |
| **Dependencies** | T1 (deploy env ready) |

**Files likely affected**
- `artifacts/api-server/src/lib/passwords.ts`
- `artifacts/api-server/src/routes/auth.ts`
- `scripts/src/seed.ts`

**Database changes** | None (same column; re-hash on login or reset seed passwords)  
**API changes** | Replace SHA-256 with argon2; verify on login/register  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] New registrations use argon2 hashes  
- [ ] Existing seed users can log in (re-seed or migration-on-login)  
- [ ] No plaintext or static-salt SHA-256 for new passwords  

---

### T3 — Object storage (Cloudinary)

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T1 |

**Files likely affected**
- `artifacts/api-server/src/lib/objectStorage.ts`
- `artifacts/api-server/src/routes/storage.ts`
- `lib/object-storage-web/` (if upload component needs URL shape change)

**Database changes** | None  
**API changes** | Presigned upload → Cloudinary signed upload; return stable public URL for photos  
**Frontend changes** | Staff/customer upload flows use new URL response (minimal if API shape preserved)  

**Acceptance criteria**
- [ ] Staff can upload photo on Render (not Replit)  
- [ ] Uploaded image URL loads in browser  
- [ ] Before/after URLs persist on booking record  

---

### T4 — Wire customer portal to auth

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 0.5 day |
| **Dependencies** | None |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx`
- `artifacts/cwp-platform/src/pages/customer/BookService.tsx`
- `artifacts/cwp-platform/src/pages/customer/History.tsx`
- `artifacts/cwp-platform/src/pages/customer/Invoices.tsx`
- `artifacts/cwp-platform/src/pages/customer/Complaints.tsx`

**Database changes** | None  
**API changes** | None (tenant scope already filters by `customerId` on token)  
**Frontend changes** | Replace all `customerId = 1` with `user?.customerId`; guard if null  

**Acceptance criteria**
- [ ] Customer A sees only Customer A data after login  
- [ ] Customer B cannot see Customer A bookings (different login)  
- [ ] Register → dashboard shows correct name and summary  

---

### T5 — Wire staff portal to auth

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 0.5 day |
| **Dependencies** | T6 (staff user must have `staffId` on account) |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`
- `artifacts/cwp-platform/src/pages/staff/Schedule.tsx`
- `artifacts/cwp-platform/src/pages/staff/Attendance.tsx`
- `artifacts/cwp-platform/src/pages/staff/Performance.tsx`

**Database changes** | None  
**API changes** | None  
**Frontend changes** | Replace `staffId = 1` with `user?.staffId`  

**Acceptance criteria**
- [ ] Staff member sees only their assigned/today jobs  
- [ ] Second staff login shows different job list  
- [ ] Unlinked staff user shows clear error (“account not linked”)  

---

### T6 — Staff login linkage on create-account

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 0.5 day |
| **Dependencies** | None |

**Files likely affected**
- `artifacts/api-server/src/routes/staff.ts` (`POST /staff/:id/create-account`)
- `artifacts/api-server/src/routes/auth.ts` (ensure `/auth/me` returns `staffId`)

**Database changes** | None (`users.staffId` exists)  
**API changes** | On create-account: set `users.staffId = staff.id` on new user row  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] Admin creates staff login → staff can log in at `/login`  
- [ ] `GET /auth/me` returns correct `staffId`  
- [ ] Staff portal loads jobs for that staff member  

---

### T7 — Varanasi seed + pilot accounts

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 0.5 day |
| **Dependencies** | T2 |

**Files likely affected**
- `scripts/src/seed.ts`

**Database changes** | None (data only)  
**API changes** | None  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] One Varanasi branch (disable or ignore Lucknow/Kanpur for pilot)  
- [ ] 2–3 pilot customers with `userId` linked + known passwords  
- [ ] 2 verified staff with login accounts + `staffId` linked  
- [ ] Admin login documented in `.env.example` or ops doc  

---

### T8 — Customer asset onboarding (vehicles + solar)

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 2 days |
| **Dependencies** | T4 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` (add “Add car” / “Add solar”)
- New: `artifacts/cwp-platform/src/pages/customer/MyAssets.tsx` (optional) or modal on dashboard
- `artifacts/cwp-platform/src/pages/customer/BookService.tsx` (empty state → link to add asset)
- `lib/api-spec/openapi.yaml` (already has vehicle/solar CRUD — verify codegen)

**Database changes** | None (tables exist)  
**API changes** | Ensure customer can `POST /vehicles` and `POST /solar-sites` scoped to own `customerId`  
**Frontend changes** | Forms: car make/model/reg/color; solar panelCount, address, city=Varanasi  

**Acceptance criteria**
- [ ] New customer can add at least one car without admin help  
- [ ] New customer can add solar site with panel count  
- [ ] BookService dropdown shows customer’s own vehicles/sites  

---

### T9 — Doorstep wash booking flow

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T4, T8 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/BookService.tsx`
- `artifacts/api-server/src/routes/bookings.ts` (create booking — verify customer scope)

**Database changes** | None  
**API changes** | On create: stamp `branchId` Varanasi, compute amount from service `basePrice`, status `pending` or `confirmed`  
**Frontend changes** | Service type filter (car_wash); date/time; vehicle select; success message  

**Acceptance criteria**
- [ ] Customer books Basic/Premium wash for own car  
- [ ] Booking appears in admin Bookings list  
- [ ] Booking appears in customer History  
- [ ] Admin can assign verified staff  

---

### T10 — Solar cleaning booking + pricing

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 2 days |
| **Dependencies** | T4, T8 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/BookService.tsx`
- `artifacts/api-server/src/routes/bookings.ts`
- New: `artifacts/api-server/src/lib/solarPricing.ts` (₹60/panel, min ₹800)

**Database changes** | None  
**API changes** | Accept `solarSiteId`; compute `amount = max(800, panelCount × 60)` at booking create; `serviceType: solar_cleaning`  
**Frontend changes** | Solar tab; show computed price before confirm; link to solar site  

**Acceptance criteria**
- [ ] 10 panels → ₹800 (minimum)  
- [ ] 20 panels → ₹1200  
- [ ] Booking tied to solar site; visible in admin and staff queue after assign  

---

### T11 — Staff job workflow + before/after photos

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 2 days |
| **Dependencies** | T3, T5 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/staff/Dashboard.tsx`
- `artifacts/api-server/src/routes/bookings.ts` (transition + PATCH)

**Database changes** | None (`beforePhotoUrl`, `afterPhotoUrl` exist)  
**API changes** | On transition to `in_progress`: require `beforePhotoUrl` (optional enforce in API or UI first)  
| On transition to `completed`: require `afterPhotoUrl`  
| Deprecate sole reliance on `proofPhotoUrls` for MVP — set before/after explicitly  
**Frontend changes** | Two upload buttons: Before (enables Start) → After (enables Complete); mobile-friendly; use camera input  

**Acceptance criteria**
- [ ] Staff cannot mark complete without after photo  
- [ ] Customer History shows before/after for completed job  
- [ ] Booking events log proof uploads  

---

### T12 — Admin: daily contract + staff assignment

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T7 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/admin/Subscriptions.tsx`
- `artifacts/cwp-platform/src/features/customers/pages/Customers.tsx` (wallet top-up field exists — link to T13)
- `artifacts/cwp-platform/src/features/staff/pages/Staff.tsx`

**Database changes** | None for contract create (subscriptions table exists)  
**API changes** | Create `daily_wash` subscription with `frequencyDays: 1`, link `vehicleId`, set `price` = monthly package rate  
**Frontend changes** | Admin flow: pick customer → vehicle → daily plan → start date; document manual steps in UI  

**Acceptance criteria**
- [ ] Admin creates active daily_wash subscription for pilot customer + car  
- [ ] Admin assigns staff to one-time bookings (existing assign dialog)  
- [ ] Only verified staff appear in assign list  

---

### T13 — Wallet ledger + admin recharge

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 2 days |
| **Dependencies** | T7 |

**Files likely affected**
- New: `lib/db/src/schema/wallet-transactions.ts`
- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/routes/customers.ts` or new `wallet.ts`
- `artifacts/cwp-platform/src/features/customers/pages/Customers.tsx`

**Database changes** | **New table** `wallet_transactions`: id, customerId, type (credit/debit), amount, balanceAfter, reference, notes, createdAt, createdBy  
**API changes** | `POST /customers/:id/wallet/credit` (admin: cash/UPI recharge); `GET /customers/:id/wallet/transactions`  
**Frontend changes** | Admin customer detail: “Add wallet credit” form + transaction list  

**Acceptance criteria**
- [ ] Admin adds ₹5000 credit → customer.walletBalance increases  
- [ ] Ledger row created with balanceAfter  
- [ ] Cannot credit negative amount  

---

### T14 — Wallet debit on booking complete

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T13, T11 |

**Files likely affected**
- `artifacts/api-server/src/routes/bookings.ts` (transition → completed)
- `artifacts/api-server/src/subscriptions/service.ts`

**Database changes** | None (uses wallet_transactions + customers.walletBalance)  
**API changes** | When booking completes AND linked to `daily_wash` subscription: debit daily rate (config: subscription.price / 30 or explicit `dailyRate` field on subscription — **add** `dailyRate` numeric column OR derive from service)  
| Transaction in same DB transaction as booking complete  
**Frontend changes** | None  

**Database changes (addendum)** | Optional: `subscriptions.dailyRate` numeric — cleaner than price/30  

**Acceptance criteria**
- [ ] Complete daily cleaning booking → wallet decreases by one day’s rate  
- [ ] Ledger shows debit with booking reference  
- [ ] If balance insufficient at complete time → block complete OR allow negative (decision: **block** with error)  

---

### T15 — Customer wallet view + history

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1 day |
| **Dependencies** | T13, T4 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx`
- New page or section: wallet transactions

**Database changes** | None  
**API changes** | Customer-scoped `GET /customers/:id/wallet/transactions` (own id only)  
**Frontend changes** | Dashboard shows balance + last 5 transactions; “Contact us to recharge” message (no online pay in MVP)  

**Acceptance criteria**
- [ ] Customer sees current wallet balance  
- [ ] Customer sees credit/debit history after services  

---

### T16 — Billing: customer invoices + admin record payment

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T4 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/Invoices.tsx`
- `artifacts/cwp-platform/src/pages/admin/Invoices.tsx`
- `artifacts/api-server/src/routes/payments.ts`

**Database changes** | None  
**API changes** | Admin creates invoice for package purchase / AMC; record payment method cash/UPI/wallet  
**Frontend changes** | Customer downloads/views PDF if endpoint exists; admin “Record payment” on open invoices  

**Acceptance criteria**
- [ ] Admin generates invoice for solar AMC or wash package purchase  
- [ ] Customer sees invoice in portal  
- [ ] PDF download works for at least one invoice  
- [ ] Payment recorded marks invoice paid  

---

### T17 — SMS notification dispatcher

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 2 days |
| **Dependencies** | T1 (MSG91 env vars) |

**Files likely affected**
- New: `artifacts/api-server/src/lib/notifications/dispatcher.ts`
- New: `artifacts/api-server/src/lib/notifications/msg91.ts`
- `artifacts/api-server/src/routes/notifications.ts`

**Database changes** | Optional: `notifications.deliveryStatus`, `externalId` columns  
**API changes** | `sendNotification({ userId, phone, template, vars, channel: 'sms' })` — writes in_app row + sends SMS  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] Test SMS delivers to real phone with MSG91 credentials  
- [ ] Failed SMS logged; in_app notification still created  
- [ ] No SMS sent if phone missing (log warning)  

---

### T18 — Notification triggers (book + complete + low balance)

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T17, T9, T11, T22 (low balance part can land with T22) |

**Files likely affected**
- `artifacts/api-server/src/routes/bookings.ts`
- `artifacts/api-server/src/routes/customers.ts` or wallet service
- `artifacts/api-server/src/subscriptions/service.ts`

**Database changes** | None  
**API changes** | Trigger SMS on: booking confirmed/assigned; booking completed; wallet low (T22)  
**Frontend changes** | Optional: customer “Notifications” link reading in_app list (P1 if time short)  

**Acceptance criteria**
- [ ] Customer receives SMS when booking confirmed  
- [ ] Customer receives SMS when job completed  
- [ ] Templates include customer name, service, date  

---

### T19 — Vehicle → staff mapping

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1 day |
| **Dependencies** | T12 |

**Files likely affected**
- `lib/db/src/schema/vehicles.ts`
- `artifacts/api-server/src/routes/vehicles.ts`
- `artifacts/cwp-platform/src/features/customers/pages/Customers.tsx` or admin Subscriptions UI

**Database changes** | **Add** `vehicles.assignedStaffId` integer nullable  
**API changes** | `PATCH /vehicles/:id` accept assignedStaffId; validate staff verified + same branch  
**Frontend changes** | Admin UI: dropdown to assign default staff to vehicle for daily cleaning  

**Acceptance criteria**
- [ ] Each daily-cleaning car has one default staff  
- [ ] Admin can change assignment  
- [ ] Invalid staff rejected  

---

### T20 — Daily cleaning auto-scheduler

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 3 days |
| **Dependencies** | T19, T13, T14 |

**Files likely affected**
- `artifacts/api-server/src/subscriptions/service.ts` (`runDailyTick` extension)
- New: `artifacts/api-server/src/subscriptions/dailyScheduler.ts`
- `artifacts/api-server/src/routes/subscriptions.ts` (daily-tick endpoint — add cron or manual trigger for ops)

**Database changes** | None (optional `subscriptions.dailyRate`)  
**API changes** | In `runDailyTick`: for each active `daily_wash` with vehicleId + assignedStaffId + wallet ≥ dailyRate + not paused: create booking if none exists for today  
| Idempotent: skip if booking already scheduled/completed for today  
**Frontend changes** | Admin dashboard note: “Daily tick runs at 5 AM IST” + manual “Run daily tick” button (existing endpoint)  

**Acceptance criteria**
- [ ] Running daily tick creates today’s bookings for all eligible daily contracts  
- [ ] Each booking has correct staffId, vehicleId, customerId, serviceType daily_cleaning  
- [ ] Re-running tick does not duplicate bookings  

---

### T21 — Wednesday off-day rule

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 0.5 day |
| **Dependencies** | T20 |

**Files likely affected**
- `artifacts/api-server/src/subscriptions/dailyScheduler.ts`

**Database changes** | None (hardcode Wed=3 for MVP) or `subscriptions.offDays` json `[3]`  
**API changes** | Skip booking generation when IST weekday is Wednesday  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] No daily bookings auto-created on Wednesday  
- [ ] Thursday tick creates Thursday booking normally  

---

### T22 — Low balance alert + auto-pause contract

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1.5 days |
| **Dependencies** | T13, T20, T17 |

**Files likely affected**
- `artifacts/api-server/src/subscriptions/dailyScheduler.ts`
- `artifacts/api-server/src/subscriptions/service.ts`

**Database changes** | None  
**API changes** | Before create booking: if wallet < dailyRate → skip create, send low balance SMS once per day; if wallet < 1 day rate → auto `pauseSubscription`  
| After debit in T14: if balance < 7 × dailyRate → send warning SMS  
**Frontend changes** | Customer dashboard banner when balance low  

**Acceptance criteria**
- [ ] Customer with ₹0 balance → contract paused; no new daily bookings  
- [ ] Customer receives SMS when balance below 7-day threshold  
- [ ] Admin recharge + resume → bookings resume next tick  

---

### T23 — Solar AMC customer progress view

| Field | Detail |
|---|---|
| **Priority** | P1 |
| **Effort** | 1 day |
| **Dependencies** | T4, T10 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx`
- `artifacts/cwp-platform/src/pages/customer/History.tsx`

**Database changes** | None  
**API changes** | Use existing subscription `servicesUsed`, `servicesRemaining`, `totalServices`  
**Frontend changes** | AMC card: “4 of 12 cleanings done”; next date; link to history filtered solar  

**Acceptance criteria**
- [ ] Solar AMC customer sees progress on dashboard  
- [ ] Completed solar bookings listed with photos  

---

### T24 — Customer service history photos polish

| Field | Detail |
|---|---|
| **Priority** | P1 |
| **Effort** | 0.5 day |
| **Dependencies** | T11 |

**Files likely affected**
- `artifacts/cwp-platform/src/pages/customer/History.tsx`

**Database changes** | None  
**API changes** | None  
**Frontend changes** | Before/after thumbnails; tap to enlarge; show daily vs wash vs solar badge  

**Acceptance criteria**
- [ ] History row shows service type and both photos when present  

---

### T25 — Admin ops checklist + hide non-MVP nav

| Field | Detail |
|---|---|
| **Priority** | P1 |
| **Effort** | 0.5 day |
| **Dependencies** | Phase 4 complete |

**Files likely affected**
- `artifacts/cwp-platform/src/components/layout/AdminSidebar.tsx`
- New: `docs/VARANASI_OPS.md` (ops runbook — allowed as MVP ops doc)

**Database changes** | None  
**API changes** | None  
**Frontend changes** | Hide sidebar links: Leads, Churned, Franchisees, Quotations, Expenses, Analytics (optional keep Dashboard)  

**Acceptance criteria**
- [ ] Admin sidebar shows only MVP-relevant pages  
- [ ] Ops doc lists daily routine: run tick, assign exceptions, wallet recharge  

---

### T26 — End-to-end pilot smoke test

| Field | Detail |
|---|---|
| **Priority** | P0 |
| **Effort** | 1 day |
| **Dependencies** | All P0 tasks |

**Files likely affected**
- New: `docs/MVP_SMOKE_TEST.md` (manual test script)

**Database changes** | None  
**API changes** | None  
**Frontend changes** | None  

**Acceptance criteria**
- [ ] Script passes: register → add car → admin daily sub + wallet credit + staff map → tick → staff complete → wallet debit → SMS received → customer sees history  
- [ ] Second script: doorstep wash book → assign → complete with photos  
- [ ] Third script: solar book → complete → AMC counter decrements  

---

## Implementation Phases

---

## Phase 1 — Deployable & Authenticated (Week 1)

**Milestone:** Platform live on production URL. Real customer and staff logins see **their own** data (not demo user 1).

### Tasks
T1 · T2 · T3 · T4 · T5 · T6 · T7

### Deliverables
- Production URL + Postgres  
- Cloudinary photo uploads working  
- Customer portal scoped to logged-in customer  
- Staff portal scoped to logged-in staff  
- Varanasi pilot seed accounts  

### How to test
1. Deploy to Render; open site; login as admin  
2. Register new customer → dashboard loads empty (not Arjun Sharma’s data)  
3. Admin: verify staff → create staff login → staff logs in → sees empty or assigned jobs only  
4. Upload test image via staff flow (if storage wired early) or storage test endpoint  

### Exit criteria
✅ **No hardcoded IDs remain in customer/staff pages**  
✅ **Photos upload on production host**  
✅ **Passwords hashed with argon2**

---

## Phase 2 — Field Operations Core (Week 2)

**Milestone:** Customer can onboard assets and book doorstep wash or solar job. Staff completes job with before/after photos. Admin manages assignments.

### Tasks
T8 · T9 · T10 · T11 · T12

### Deliverables
- Customer adds car and solar site  
- Doorstep wash booking end-to-end  
- Solar booking with correct panel pricing  
- Staff workflow: before photo → start → after photo → complete  
- Admin creates daily wash subscription  

### How to test
1. Customer adds car → books Basic Wash tomorrow  
2. Admin assigns verified staff  
3. Staff opens job → uploads before → starts → after → completes  
4. Customer History shows job + photos  
5. Customer with 15 panels books solar → amount ₹900 (15×60); 10 panels → ₹800 min  

### Exit criteria
✅ **Three service lines bookable (wash, solar; daily sub created by admin)**  
✅ **Before/after photos mandatory for complete**  
✅ **Admin assignment works**

---

## Phase 3 — Money & Alerts (Week 3)

**Milestone:** Wallet recharge and debit work. Invoices visible. Customers get SMS on key events.

### Tasks
T13 · T14 · T15 · T16 · T17 · T18

### Deliverables
- Wallet ledger + admin credit  
- Auto debit on daily job complete  
- Customer wallet balance + history  
- Invoice create/view/PDF  
- MSG91 SMS on confirm + complete  

### How to test
1. Admin credits customer wallet ₹3000  
2. Customer sees balance on dashboard  
3. Manually complete a daily-type booking (before Phase 4 scheduler) → wallet debits  
4. Admin creates invoice for AMC → records UPI payment  
5. Book wash → customer SMS received; complete → second SMS  

### Exit criteria
✅ **Wallet balance matches ledger sum**  
✅ **SMS delivers on real phone for 2 events**  
✅ **Customer sees invoices**

---

## Phase 4 — Daily Automation & Go-Live (Week 4)

**Milestone:** Varanasi daily car cleaning runs automatically. Platform ready for real paying customers.

### Tasks
T19 · T20 · T21 · T22 · T23 · T24 · T25 · T26

### Deliverables
- Car → staff mapping  
- Daily tick auto-creates bookings (Mon–Sat, not Wed)  
- Low balance SMS + auto-pause  
- Solar AMC progress on customer dashboard  
- Admin sidebar trimmed  
- Full smoke test passed  

### How to test
1. Admin: daily subscription + wallet ₹5000 + assign Car X → Staff Y  
2. Run daily tick (cron or manual POST) on Tuesday → booking appears for Staff Y  
3. Run tick on Wednesday → no booking  
4. Staff completes → wallet debits → customer SMS  
5. Drain wallet below 7-day threshold → warning SMS; at ₹0 → pause, no Thursday booking until recharge  
6. Execute full `MVP_SMOKE_TEST.md` checklist  

### Exit criteria
✅ **Daily cleaning runs without manual booking entry**  
✅ **Real customer + real staff pilot for 3–5 days in Varanasi**  
✅ **Tushar operates from admin only for exceptions (reassign, recharge, complaints)**

---

## Phase Summary

| Phase | Duration | Testable milestone |
|---|---|---|
| **1** | Week 1 | Live site; real logins; own data; secure storage |
| **2** | Week 2 | Book wash/solar; staff photos; admin assigns |
| **3** | Week 3 | Wallet + invoices + SMS |
| **4** | Week 4 | Daily auto-schedule; go-live |

**Total estimated effort:** ~28–32 developer-days (1 full-stack dev ≈ 4–5 weeks; 2 devs ≈ 2.5–3 weeks with parallel Phase 3/2 overlap after T11).

---

## Dependency Graph (critical path)

```
T1 → T3 → T11
T1 → T17 → T18
T2 → T7
T4 → T8 → T9, T10
T6 → T5 → T11
T13 → T14 → T20
T19 → T20 → T21, T22
T20 + T17 → T22 → T18
All P0 → T26
```

---

## Explicitly NOT in MVP (do not build)

| Item | Reason |
|---|---|
| Patna / second city | Out of scope |
| Franchisee portal | Tushar runs Varanasi directly |
| Razorpay / online payment | Cash/UPI recorded by admin |
| Geofencing | Not required for launch |
| Coupons / addons | Revenue uplift, not launch |
| CRM / Leads / Churned | Hide from nav |
| WhatsApp (beyond SMS) | SMS sufficient for MVP; WA is P1 post-launch |
| Auto-invoice on every complete | Manual invoice OK; wallet debit is mandatory |
| Customer self-schedule included washes | Admin/tick handles daily; package wash manual book OK |
| Migration history | `drizzle push` acceptable for MVP pilot |
| OpenAPI sync for leads/franchisees | Not used in MVP UI |

---

## Risk Register (MVP)

| Risk | Mitigation |
|---|---|
| MSG91 approval delay | Start DLT template registration in Phase 1 |
| Cloudinary quota | Free tier sufficient for pilot; monitor usage |
| Daily rate ambiguity | Add explicit `subscriptions.dailyRate` column in T14 |
| Staff forgets photos | UI blocks Complete without after photo |
| Wallet race on concurrent completes | Debit in booking completion transaction with row lock on customer |
| Cron not running on Render | External cron hits `POST /api/subscriptions/daily-tick` with auth secret |

---

## Launch Checklist (Day 0 Varanasi)

- [ ] Production deployed; `.env` set  
- [ ] Varanasi branch only in catalog  
- [ ] Services priced (GST-inclusive display note on landing)  
- [ ] 2+ staff verified with logins  
- [ ] Daily tick scheduled 05:00 IST  
- [ ] MSG91 templates approved  
- [ ] Tushar admin login + phone for alerts  
- [ ] `MVP_SMOKE_TEST.md` all green  
- [ ] First 5 real customers onboarded manually if needed  

---

*This plan reuses the existing Express + Drizzle + React monorepo. No rewrite. Every task extends what already exists.*
