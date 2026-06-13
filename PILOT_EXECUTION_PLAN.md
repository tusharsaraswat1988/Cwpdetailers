# Pilot Execution Plan — Varanasi 7-Day Trial

**Plan date:** 13 June 2026  
**Scope:** 5 pilot customers · 2 staff members · 7 calendar days  
**Owner:** Tushar (admin) · Field staff: 2 technicians  
**Reference:** `CWP_PILOT_READINESS_AUDIT.md`, `CWP_MVP_IMPLEMENTATION_PLAN.md`, `logindetails.md`

This is an **operational runbook**, not a development sprint. Sprint 4 is out of scope here.

---

## Pilot objective

Run real Varanasi daily cleaning + ad-hoc wash/solar bookings for **5 customers** and **2 staff** for **7 days**, using the platform as the system of record — minimizing WhatsApp coordination and manual booking entry for daily cleans.

**Success criteria (day 7):**
- Daily bookings auto-generated on working days (Mon–Sat, not Wednesday) for enrolled daily customers with balance
- Staff complete jobs with before/after photos on phone
- Admin handles exceptions only: wallet top-up, reassign, complaints
- At least 3 of 5 customers actively used the customer portal once (login + one action)

---

## Pilot roster (target)

| # | Role | How onboarded | Suggested mix |
|---|------|---------------|---------------|
| C1–C3 | Daily cleaning customer | Admin: contract + vehicle + staff assign + wallet credit | 3 daily `daily_wash` |
| C4 | Doorstep wash customer | Self-register or seed; book once | 1–2 one-off washes |
| C5 | Solar / AMC or package | Self-register; solar site + booking or AMC sub | 1 solar or package line |
| S1 | Staff (e.g. Ravi) | Verified staff + login linked | Primary Varanasi route A |
| S2 | Staff (e.g. Suresh) | Verified staff + login linked | Primary Varanasi route B |

**Login rule:** Customers use **`/register`** (self-service) unless using pre-seeded phones from `logindetails.md`. Admin “Add Customer” alone does **not** grant portal access (audit blocker B06).

**Staff rule:** Admin must verify staff and create login via **`/admin/credentials`** (or seed). Staff phone must map to `users.staffId`.

---

## Pre-pilot gate (complete before Day 0)

All items are **P0** from `CWP_PILOT_READINESS_AUDIT.md`.

| # | Task | Verification |
|---|------|--------------|
| G1 | Deploy to production URL (Render or chosen host) | `GET /api/healthz` → 200 over HTTPS |
| G2 | Set env: `DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_*`, `FAST2SMS_*` (or MSG91), `WALLET_LOW_BALANCE_DAYS=7`, `DAILY_CLEANING_OFF_DAYS=3` | Staff test upload returns URL; `POST /api/notifications/test-sms` succeeds |
| G3 | Push DB schema + run `scripts/src/seed.ts` idempotently **or** confirm schema on empty DB | Pilot admin + 2 staff logins work |
| G4 | Configure daily tick: Render cron `POST /api/subscriptions/daily-tick` at ~05:30 IST **or** paid always-on web service | Manual tick creates bookings; Wednesday creates none |
| G5 | Seed Legal CMS / publish privacy + terms | `/privacy-policy` loads content |
| G6 | Execute smoke test checklist (T26 — create `MVP_SMOKE_TEST.md` and run once) | Signed pass/fail log |

**Smoke test minimum (one pass on production):**

1. Customer register → add car → book wash  
2. Admin assign staff to booking  
3. Staff: On My Way → before photo → Start → after photo → Complete  
4. Customer: history shows job + photos; wallet debits if daily clean  
5. Admin: wallet credit ₹500 → customer balance updates  
6. Admin: Daily Ops → Run today's schedule → bookings appear for assigned vehicles  

---

## Roles & daily responsibilities

| Role | Primary screens | Daily actions |
|------|-----------------|---------------|
| **Tushar (admin)** | `/admin/daily-ops`, `/admin/customers/:id`, `/admin/bookings`, `/admin/complaints` | Morning: review Daily Ops blockers; run schedule if needed; wallet top-ups; assign/reassign |
| **City manager** (if separate login) | Same as admin with `manager` role | Same; focus Daily Ops + unassigned vehicles |
| **Staff S1 / S2** | `/staff/dashboard`, `/staff/jobs`, `/staff/profile` | Mark attendance; complete today’s jobs on phone; call/navigate from hero card |
| **Customers C1–C5** | `/customer/dashboard`, `/customer/bookings`, `/customer/wallet` | View balance; book ad-hoc services; file complaint if needed |

---

## 7-day execution schedule

### Day 0 — Setup (no customer-facing ops)

| Time | Action | Owner |
|------|--------|-------|
| AM | Complete pre-pilot gates G1–G6 | Tushar + tech |
| AM | Create 5 customer accounts: **prefer `/register` with real phones** or use 3 seed customers for dry run | Tushar |
| PM | For C1–C3: add vehicle on admin customer detail or customer self-service | Tushar / customer |
| PM | Create `daily_wash` contract per C1–C3 (`/admin/subscriptions` → Create daily wash contract) | Tushar |
| PM | Assign vehicle → staff on `/admin/customers/:id` (S1/S1 split) | Tushar |
| PM | Wallet credit ≥ 14 days × daily rate per daily customer (`CustomerDetail` → credit UPI/cash) | Tushar |
| PM | Staff install: open `/login` on phone, add to home screen (PWA banner) | S1, S2 |
| PM | Staff test: complete one seed booking with photos if available | S1 |

**Day 0 exit:** All 5 customers exist with vehicles; 3 daily contracts active; 2 staff logins work; Cloudinary upload works on staff phone.

---

### Day 1 — Soft launch (2 customers)

| Focus | Detail |
|-------|--------|
| Customers live | C1, C2 daily cleaning only |
| Automation | After 05:30 IST tick: confirm bookings on Daily Ops for C1, C2 |
| Staff | S1 completes C1 jobs; S2 on standby |
| Admin | Monitor blockers on Daily Ops; top up if low balance banner |
| Customer comms | WhatsApp backup only for Day 1 anomalies — log issues |

**Checks EOD:**
- [ ] 2 daily bookings generated (if working day)  
- [ ] 2 jobs completed with photos  
- [ ] Wallet debited correctly  
- [ ] Customer can see history (optional: ask C1 to log in)  

---

### Day 2 — Expand daily base (+1 customer)

| Focus | Detail |
|-------|--------|
| Add | C3 daily cleaning |
| Staff | Split routes: S1 = C1+C2, S2 = C3 |
| Admin | Run manual `daily-schedule` once if tick missed (Render spin-down) |
| Test | C4 self-registers; books one doorstep wash |

**Checks EOD:**
- [ ] 3 daily customers ran without manual booking entry  
- [ ] C4 booking visible to admin; staff assigned  
- [ ] One SMS received on book or complete (if FAST2SMS live)  

---

### Day 3 — Ad-hoc + solar line

| Focus | Detail |
|-------|--------|
| Customer | C5 adds solar site + books solar clean **or** admin creates AMC sub |
| Staff | Complete C4 wash end-to-end |
| Admin | Resolve any open complaint test (create + resolve in admin) |
| Wednesday? | If off-day: confirm **no** daily bookings; staff only ad-hoc |

**Checks EOD:**
- [ ] Solar/pricing correct on booking (panel count rules)  
- [ ] Complaint open → resolved in admin  

---

### Day 4 — Stress exceptions

| Focus | Detail |
|-------|--------|
| Simulate | Low wallet on one daily customer (drain or small credit) |
| Expected | Low balance banner (customer dashboard); auto-pause if below daily rate; no next-day booking until recharge |
| Admin | Wallet credit → confirm auto-resume (`resumedSubscriptions` on credit response) |
| Staff | Reassign one booking via admin if staff sick |

**Checks EOD:**
- [ ] Auto-pause + recharge resume documented  
- [ ] Reassign works; staff sees job on Today tab  

---

### Day 5 — Customer portal adoption

| Focus | Detail |
|-------|--------|
| Customers | All 5 log in at least once; C1–C3 check wallet + services |
| Staff | Use earnings tab; mark attendance on profile |
| Admin | Generate one invoice PDF for a customer; record payment |

**Checks EOD:**
- [ ] ≥3 customers completed one portal action  
- [ ] Invoice PDF downloads  

---

### Day 6 — Full volume day

| Focus | Detail |
|-------|--------|
| Ops | All 3 daily customers + any due package/AMC washes |
| Staff | Both staff full route; no WhatsApp job list |
| Admin | Daily Ops only — no manual booking creation for daily cleans |
| Monitor | Operations Wall (`/admin/operations-wall`) optional TV check |

**Checks EOD:**
- [ ] Zero manual daily booking entries  
- [ ] Completion rate ≥ 90% of scheduled daily jobs  

---

### Day 7 — Review & go/no-go

| Time | Action |
|------|--------|
| AM | Normal ops run |
| PM | Tushar review: `/admin/founder` + Daily Ops KPIs |
| PM | Pilot retrospective (30 min): blockers hit, WhatsApp fallback count, customer feedback |
| PM | **Go / no-go** for expanding beyond 5 customers |

**Metrics to capture:**

| Metric | Target |
|--------|--------|
| Daily bookings auto-created (working days) | 100% for active daily subs with balance |
| Jobs completed with before+after photos | ≥ 90% |
| Wallet ledger matches admin cash collected | 100% |
| Customer portal login (≥1 action) | ≥ 3 of 5 |
| SMS delivered (book + complete) | ≥ 2 events to real phones |
| Critical P0 incidents | 0 unresolved |

---

## Daily admin checklist (Days 1–7)

**Morning (by 8:00 IST):**
1. Open `/admin/daily-ops`  
2. Confirm off-day banner if Wednesday  
3. Review blockers (unassigned, low balance, paused)  
4. If no bookings and should exist: `Run today's schedule` then `Full daily tick`  
5. Wallet top-up any customer below 7-day threshold  

**During day:**
6. Assign/reassign bookings from `/admin/bookings` or customer detail  
7. Monitor complaints  

**Evening:**
8. Confirm all `scheduled`/`in_progress` jobs closed or rescheduled  
9. Spot-check customer history photos for completed jobs  
10. Log issues in pilot journal (spreadsheet or doc)  

---

## Daily staff checklist (Days 1–7)

1. Login at `/login` → **Today** tab  
2. **Profile** → Mark present  
3. For each active job on **Today** hero: Navigate → On My Way → Before photo → Start → After photo → Complete  
4. **Jobs** tab for upcoming; **Earnings** to verify completed amounts  
5. If upload fails: stop and notify admin (Cloudinary/config issue)  

---

## Customer onboarding script (for Tushar / field team)

**Daily cleaning customer (C1–C3):**
1. Customer registers at `{URL}/register` with their phone  
2. Customer adds vehicle: **Account → Vehicles & Solar** or admin adds on back office  
3. Admin creates daily contract + assigns staff + credits wallet  
4. Explain: balance must stay above ~7 days of daily rate; recharge via call/UPI to CWP office  

**Ad-hoc customer (C4–C5):**
1. Register → add asset → **Book** tab → select service  
2. View history and invoices under Account links  

---

## Contingency playbooks

| Situation | Action |
|-----------|--------|
| Render service asleep; no daily bookings | Admin: Daily Ops → Full daily tick with `{ force: true }`; fix cron/upgrade plan |
| Staff photo upload fails | Check Cloudinary env; staff must not mark complete without photos |
| Customer cannot login | Confirm self-register used; admin-created-only records need register with new phone or manual DB link |
| Wallet empty mid-week | Admin credit immediately; confirm contract resumes |
| SMS not received | Verify FAST2SMS; use WhatsApp for pilot day only; log as B04 |
| Staff sees no jobs | Check vehicle `assignedStaffId`; booking `staffId`; staff login linked |

---

## Pilot data to collect

| Data point | Where |
|------------|-------|
| Booking IDs completed | Admin bookings export / DB |
| Wallet ledger rows | Customer detail ledger |
| Staff completion times | Booking `completedAt` |
| Customer portal logins | Manual tally |
| Incidents | Pilot journal |
| Screenshots | Staff/customer phones (optional) |

---

## Out of scope for this 7-day trial

- Sprint 4 UI (inline Daily Ops assign, admin alert banner)  
- Sprint M legacy migration  
- Online Razorpay recharge  
- New cities / franchisee portal  
- Communication Center inbox  
- Expanding beyond 5 customers until go/no-go on Day 7  

---

## Post-pilot decision tree

| Outcome | Next step |
|---------|-----------|
| **Go** — metrics met, P0 stable | Add 10–20 customers; keep 2 staff; schedule Sprint 4 after 2 stable weeks |
| **Conditional go** — ops OK, UX gaps | Fix P1 blockers (SMS, assign UX); extend pilot 7 days |
| **No-go** — P0 failures | Halt new customers; fix deploy/Cloudinary/tick/SMS; re-run smoke test |

---

*Operational plan only. No implementation committed. Aligns with `CWP_PILOT_READINESS_AUDIT.md` P0 gates.*
