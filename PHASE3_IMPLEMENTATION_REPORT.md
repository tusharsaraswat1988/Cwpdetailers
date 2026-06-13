# Phase 3 Implementation Report

**Project:** CWP Detailers — Varanasi MVP  
**Phase:** 3 only (T13–T18) — Money & Alerts  
**Status:** Complete — Phase 4 not started  
**Date:** 2026-06-13

---

## Summary

Phase 3 implements ledger-first wallet operations, GST-inclusive invoicing with PDF export, a channel-adapter notification dispatcher (FAST2SMS primary, MSG91 fallback), and booking confirm/complete notification triggers. Wallet balance on `customers.walletBalance` is a **cache only**; the append-only `wallet_transactions` ledger is the source of truth.

**Phase 4 items explicitly not implemented:** daily auto-scheduler, low-balance SMS scheduler, auto-pause contract, vehicle→staff mapping.

---

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| T13 | Wallet ledger + admin recharge (cash/UPI/bank transfer) | Done |
| T14 | Wallet debit on daily cleaning booking complete (transactional, blocks insufficient balance) | Done |
| T15 | Customer wallet view + transaction history | Done |
| T16 | Invoice create/view/PDF + GST-inclusive pricing + admin record payment (existing) | Done |
| T17 | Notification dispatcher + channel adapters (FAST2SMS, MSG91 fallback) | Done |
| T18 | Triggers: booking confirmed, booking completed | Done |
| T18 (low balance) | **Not activated** — helper only (`isLowBalance`, `WALLET_LOW_BALANCE_DAYS`) | Deferred to Phase 4 |

---

## Files Modified

### New files

| File | Purpose |
|------|---------|
| `lib/db/src/schema/wallet-transactions.ts` | Ledger table schema |
| `artifacts/api-server/src/lib/wallet/service.ts` | Ledger-first credit/debit, balance sync, low-balance helpers |
| `artifacts/api-server/src/lib/notifications/types.ts` | Channel adapter interfaces |
| `artifacts/api-server/src/lib/notifications/channels/sms.ts` | FAST2SMS + MSG91 SMS adapters |
| `artifacts/api-server/src/lib/notifications/dispatcher.ts` | Notification router (in_app + SMS) |
| `artifacts/api-server/src/routes/wallet.ts` | Wallet API routes |
| `artifacts/cwp-platform/src/pages/admin/CustomerDetail.tsx` | Admin wallet recharge + ledger UI |
| `scripts/src/phase3-verify.ts` | Direct DB/service verification script |
| `scripts/src/phase3-http-verify.ts` | HTTP API verification script |

### Modified files

| File | Change |
|------|--------|
| `lib/db/src/schema/subscriptions.ts` | Added `dailyRate` column |
| `lib/db/src/schema/notifications.ts` | Added `deliveryStatus`, `externalId`, `dedupeKey` |
| `lib/db/src/schema/index.ts` | Export wallet-transactions |
| `artifacts/api-server/src/routes/customers.ts` | Summary uses ledger balance; blocked direct `walletBalance` PATCH |
| `artifacts/api-server/src/routes/bookings.ts` | Debit on daily complete; confirm/complete notification triggers |
| `artifacts/api-server/src/routes/payments.ts` | GST-inclusive invoice create; DB-backed invoice numbers; PDF header text |
| `artifacts/api-server/src/routes/notifications.ts` | Test SMS endpoint; delivery status on create |
| `artifacts/api-server/src/routes/index.ts` | Mount wallet router + test-sms guard |
| `artifacts/api-server/src/lib/gst.ts` | Added `splitGstInclusive()` |
| `artifacts/api-server/build.mjs` | Externalize `pdfkit` (fixes PDF font paths in bundled dist) |
| `artifacts/cwp-platform/src/App.tsx` | Route `/admin/customers/:id` |
| `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx` | Wallet section + recent transactions |
| `artifacts/cwp-platform/src/pages/customer/Invoices.tsx` | GST-inclusive label + PDF download |
| `artifacts/cwp-platform/src/pages/admin/Invoices.tsx` | Create invoice dialog |
| `scripts/src/seed.ts` | `dailyRate` on daily_wash subs; ledger backfill for seed balances |
| `.env.example` | FAST2SMS, WALLET_LOW_BALANCE_DAYS vars |

---

## Database Changes

Applied via `pnpm run push` in `lib/db`:

| Change | Details |
|--------|---------|
| **New table** `wallet_transactions` | `type` (credit/debit), `amount`, `balanceAfter`, `reference`, `referenceId`, `paymentMode`, `notes`, `createdBy`, `customerId`, `companyId` |
| **New column** `subscriptions.daily_rate` | Explicit daily debit amount for daily_wash |
| **New columns** on `notifications` | `delivery_status`, `external_id`, `dedupe_key` |
| **New enums** | `wallet_transaction_type`, `wallet_payment_mode`, `notification_delivery_status` |

**Migration command used:**
```powershell
# Load .env then:
cd lib/db && pnpm run push
```

---

## API Changes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers/:id/wallet` | Ledger balance + low-balance metadata |
| GET | `/api/customers/:id/wallet/transactions` | Paginated ledger (customer scoped) |
| POST | `/api/customers/:id/wallet/credit` | Admin-only recharge (cash/upi/bank_transfer) |
| POST | `/api/invoices` | Now supports `gstInclusive: true` (default behaviour) |
| GET | `/api/invoices/:id/pdf` | PDF generation (pdfkit externalized in build) |
| POST | `/api/notifications/test-sms` | Admin SMS test via configured adapter |

**Booking transition changes:**
- `→ completed`: debits wallet for `daily_cleaning` or `daily_wash` subscription; blocks if insufficient balance; fires completion notification
- `→ confirmed`: fires confirmation notification

**Removed:** Direct `walletBalance` updates via `PATCH /customers/:id`.

---

## UI Changes

| Surface | Change |
|---------|--------|
| Admin `/admin/customers/:id` | Wallet balance, credit form (amount/mode/remarks), transaction ledger |
| Customer dashboard | Wallet card with balance, last 5 ledger entries, recharge contact note |
| Customer invoices | GST-inclusive label, PDF download link |
| Admin invoices | Create invoice dialog (package / solar AMC / manual) |

---

## Build Results

```text
artifacts/api-server  pnpm run build   → PASS (pdfkit externalized, dist ~3.1mb)
artifacts/cwp-platform pnpm run build  → PASS (dist/public/assets/index-*.js)
lib/db                pnpm run push    → PASS (schema applied)
```

---

## Typecheck Results

| Package | Result | Notes |
|---------|--------|-------|
| `artifacts/api-server` | **PASS** | |
| `artifacts/cwp-platform` | **PASS** | |
| `scripts` | **FAIL** | Pre-existing seed.ts enum typing errors (unchanged by Phase 3) |
| Root `pnpm run typecheck` | **FAIL** | Blocked by scripts package only |

---

## Wallet Flow Evidence

### Direct service verification (`scripts/src/phase3-verify.ts`)

```text
Customer: Arjun Sharma (id=1)
Credit entry: +₹500.00, balanceAfter=₹500.00
Debit entry: -₹100.00, balanceAfter=₹400.00
Ledger sum matches balance: PASS (400 vs 400)
Cache walletBalance synced: PASS (400 vs 400)
```

### HTTP API verification (`scripts/src/phase3-http-verify.ts`)

```text
GET /customers/1/wallet [customer]: 200 balance=₹2400
GET wallet/transactions [customer]: 200 count=4
POST wallet/credit [admin]: 201 balanceAfter=₹3400
POST wallet/credit [customer]: 403 (blocked)
```

**Ledger rules enforced:**
- Every credit/debit creates a `wallet_transactions` row with `balanceAfter`
- `customers.walletBalance` updated only via `syncWalletBalanceCache()` after ledger write
- Row lock (`FOR UPDATE`) on customer during credit/debit
- Insufficient balance returns `400` with `INSUFFICIENT_BALANCE` on booking complete

---

## Invoice Flow Evidence

### HTTP API

```text
POST /invoices: 201 invoice#=CWP-2026-1004 total=₹14999.00
GET /invoices/:id/pdf: 200 content-type=application/pdf
```

### GST-inclusive split (unit test via verify script)

```text
₹1180 inclusive → subtotal ₹1000, GST ₹180, total ₹1180
```

Invoice creation uses `splitGstInclusive()` when `gstInclusive: true`. PDF header states prices are GST-inclusive.

**Fix applied:** Invoice number generator now queries DB max to avoid duplicate `CWP-YYYY-NNNN` collisions after server restart.

---

## SMS Flow Evidence

### Dispatcher architecture

```
Business Event → dispatchNotification() → in_app row + SMS adapter
                                              ↓
                                    Fast2SmsAdapter (primary)
                                    Msg91Adapter (fallback if FAST2SMS unset)
```

### HTTP test endpoint

```text
POST /notifications/test-sms: 200
  adapter=fast2sms
  success=false
  error=FAST2SMS_API_KEY not configured
```

### In-app notification dispatch (verify script)

```text
Notification dispatch (in_app only): {"skipped":false,"results":[{"channel":"in_app","status":"sent"}]}
```

### Booking triggers

Implemented in `bookings.ts` transition handler:
- `notifyBookingConfirmed()` on `→ confirmed` (dedupe key: `booking:{id}:confirmed`)
- `notifyBookingCompleted()` on `→ completed` (dedupe key: `booking:{id}:completed`)

Both create in_app notification + attempt SMS via dispatcher.

### Not verified (blocked)

| Item | Reason |
|------|--------|
| Live SMS delivery to phone | `FAST2SMS_API_KEY` not set in environment |
| Low balance SMS | Intentionally deferred to Phase 4 |

**To enable live SMS:** Set `FAST2SMS_API_KEY` (and optional `FAST2SMS_SENDER_ID`, `FAST2SMS_TEMPLATE_ID` for DLT) in `.env`, restart API server, call `POST /api/notifications/test-sms`.

---

## Low Balance Foundation (Phase 4 prep)

| Item | Status |
|------|--------|
| `WALLET_LOW_BALANCE_DAYS` env (default 7) | Implemented |
| `isLowBalance(customerId, dailyRate)` helper | Implemented |
| `GET /customers/:id/wallet` returns `isLowBalance`, `lowBalanceThreshold` | Implemented |
| Scheduler / SMS on low balance | **Not implemented** (Phase 4) |

---

## Phase 4 — Explicitly Not Started

- T19 Vehicle → staff mapping  
- T20 Daily cleaning auto-scheduler  
- T21 Wednesday off-day  
- T22 Low balance alert + auto-pause  
- T23–T26 Post-launch polish and smoke test  

---

## How to Verify Locally

```powershell
# 1. Apply schema
cd lib/db; pnpm run push

# 2. Build
cd ../..; pnpm -r --filter "./artifacts/**" run build

# 3. Start API
cd artifacts/api-server; node dist/index.mjs

# 4. Run verification scripts
npx tsx scripts/src/phase3-verify.ts
npx tsx scripts/src/phase3-http-verify.ts
```

**Manual UI checks:**
1. Admin → Customers → View → Add ₹1000 wallet credit (UPI) → ledger row appears  
2. Customer login → Dashboard → wallet balance + transactions visible  
3. Admin → Invoices → Create Invoice → customer sees it + PDF downloads  
4. Confirm a booking → in_app notification created (SMS if FAST2SMS configured)  

---

*Phase 3 complete. Ledger is source of truth. Phase 4 automation not started.*
