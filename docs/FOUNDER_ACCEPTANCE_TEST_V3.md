# Founder Acceptance Test V3

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Phase:** Revenue-flow blocker remediation — live re-validation  
**Reference:** [`FOUNDER_ACCEPTANCE_TEST_V2.md`](./FOUNDER_ACCEPTANCE_TEST_V2.md)  
**Status:** **Re-test complete — revenue flow signed off for rollout**

---

## Purpose

Close the five blockers that prevented **Revenue Flow Sign-Off** in V2. No new features, architecture work, or UX redesign — only fixes and live proof for the three revenue lines:

1. Car Wash  
2. Daily Cleaning  
3. Solar Cleaning  

**Constraint honored:** Bug fixes and copy only; no scope expansion.

---

## Test environment

| Item | Value |
|------|--------|
| App URL | `http://localhost:21456` |
| Build | Local dev (`pnpm dev`) |
| Session role | **Superadmin** |
| Primary test customer | **Acceptance V2 Test** — phone `9090909092`, customer id **15** |
| Vehicle | Hyundai Creta · `UP32AB1234` |
| Solar site (inline) | **Rooftop Solar V3** · 5 kW |
| Service address | Primary Residence · Assi Ghat Road, Varanasi |

**Screenshots:** [`founder-acceptance-v3-screenshots/`](./founder-acceptance-v3-screenshots/)

---

## Executive verdict (V3 vs V2)

| Priority | Blocker (V2) | V3 | Evidence |
|----------|--------------|-----|----------|
| P1 | Daily cleaning plans missing in Book Service | **Pass** | Plans visible; invoice `CWP/26-27/1001` · booking `#36` |
| P2 | Payment recorded but invoice balance unchanged | **Pass** | `CWP/26-27/1000` ₹600 → paid; balance ₹0 |
| P3 | Solar sales not live-tested | **Pass** | One-time + 6M + 12M via inline solar site |
| P4 | Founder-facing “Contract” copy | **Pass** | “Create Service Booking & Invoice”; “Required for every booking” |
| P5 | Customer not pre-selected from profile deep link | **Pass** | `/admin/book-services?customerId=15` → Service Address step |

### Revenue lines (rollout gate)

| Revenue line | End-to-end in V3 | Invoice / booking proof |
|--------------|------------------|-------------------------|
| **Car Wash** | **Pass** (carried from V2) | `CWP/26-27/1000` · Complete Foam Wash · job `#3` |
| **Daily Cleaning** | **Pass** | `CWP/26-27/1001` · Daily Exterior Cleaning · booking `#36` |
| **Solar Cleaning** | **Pass** | `CWP/26-27/1002` one-time · `#1003` 6M AMC · `#1004` 12M AMC |

**Revenue Flow Sign-Off: APPROVED**

---

## Priority 1 — Daily Cleaning Plan Sale

**Verdict: Pass**

### Root cause

`useDcmsPlans(vehicleId)` called the plans API with `linked=true`. When vehicle context was missing or no plan matched the vehicle category, `listPlans()` returned an empty array — while the HQ catalog listed plans without that filter. Book Service therefore showed wash services only.

### Fix (no symptom patch)

| Layer | Change |
|-------|--------|
| Frontend `features/daily-cleaning/api.ts` | Removed `linked=true`; always request `active=true` plans for booking |
| Backend `lib/dcms/planService.ts` | When `vehicleId` is set: return active plans if vehicle context missing; if zero category matches, fallback to all active plans (never empty for booking) |

### Live verification

| Check | Result |
|-------|--------|
| Plan visibility in service step | Daily Exterior Cleaning (₹1,000), Daily Clean + 1 Full Wash, Daily Clean + 2 Full Washes visible alongside wash/package services |
| Vehicle linkage | Plans shown for `UP32AB1234` (sedan) |
| Service selection | Daily Exterior Cleaning selected |
| Booking completion | Booking `#36` created |
| Invoice generation | `CWP/26-27/1001` · ₹1,000 · status sent |

### Screenshots

| File | Shows |
|------|-------|
| [`01-daily-cleaning-plans-in-book-service.png`](./founder-acceptance-v3-screenshots/01-daily-cleaning-plans-in-book-service.png) | DCMS plans listed in Book Service step 4 |
| [`02-daily-cleaning-review-terminology.png`](./founder-acceptance-v3-screenshots/02-daily-cleaning-review-terminology.png) | Review step with updated founder copy |

---

## Priority 2 — Payment Allocation

**Verdict: Pass**

### Root cause

`recordPayment()` only decremented invoice balance when `invoiceId` was explicitly provided. The Record Payment dialog treated invoice ID as optional, so payments were logged without allocation.

### Fix

| Layer | Change |
|-------|--------|
| Backend `lib/billing/invoiceService.ts` | When `invoiceId` omitted, auto-select oldest open invoice (`balanceDue > 0`, FIFO by `createdAt`) and apply payment |
| Frontend `RecordPaymentDialog.tsx` | Fetch open invoices; auto-fill invoice ID and amount; show “Applying to oldest open invoice” hint |

### Live verification — Invoice Before → Payment → Invoice After

| Stage | Invoice `CWP/26-27/1000` | Customer dues |
|-------|--------------------------|---------------|
| **Before** | Total ₹600 · Paid ₹0 · Balance ₹600 · unpaid | Outstanding |
| **Payment** | Record Payment · customer Acceptance V2 Test · auto-filled invoice `#8` · ₹600 UPI | — |
| **After** | Total ₹600 · Paid ₹600 · Balance ₹0 · **paid** | Cleared for this invoice |

Newer open invoice `CWP/26-27/1001` (₹1,000) remained unpaid — correct FIFO behaviour.

### Screenshots

| File | Shows |
|------|-------|
| [`03-payment-invoice-before.png`](./founder-acceptance-v3-screenshots/03-payment-invoice-before.png) | Invoice list before payment |
| [`03b-payment-dialog-auto-allocate.png`](./founder-acceptance-v3-screenshots/03b-payment-dialog-auto-allocate.png) | Auto-allocation to `CWP/26-27/1000` |
| [`04-payment-invoice-after.png`](./founder-acceptance-v3-screenshots/04-payment-invoice-after.png) | Invoice marked paid, balance ₹0 |

---

## Priority 3 — Live Solar Sale (inline solar site flow)

**Verdict: Pass**

### User journey (all three sales)

1. Book Service → `?customerId=15` (customer pre-selected)  
2. Service Address → Primary (pre-selected)  
3. Vehicle / Solar Site → **Add another** → **Solar site** tab → Rooftop Solar V3 · 5 kW → Save  
4. Select solar site → Service step (solar-only catalog)  
5. Complete booking with **Create invoice directly** → **Create Service Booking & Invoice**

| Sale | Service | Type | Booking | Invoice | Amount |
|------|---------|------|---------|---------|--------|
| One-time solar cleaning | One Time Cleaning | One-time job | `#37` | `CWP/26-27/1002` | ₹1,499 |
| 6 Month Solar Plan | 6 Month Solar AMC | Monthly plan | `#38` | `CWP/26-27/1003` | ₹5,499 |
| 12 Month Solar Plan | 12 Month Solar AMC | Monthly plan | `#39` | `CWP/26-27/1004` | ₹9,999 |

All three completed through inline solar site registration — no separate Assets screen required.

### Screenshots

| File | Shows |
|------|-------|
| [`05-inline-solar-site-form.png`](./founder-acceptance-v3-screenshots/05-inline-solar-site-form.png) | Inline Solar site tab during booking |
| [`06-solar-services-available.png`](./founder-acceptance-v3-screenshots/06-solar-services-available.png) | Solar catalog filtered for solar site asset |
| [`07-solar-one-time-review.png`](./founder-acceptance-v3-screenshots/07-solar-one-time-review.png) | Review: One Time Cleaning · Rooftop Solar V3 |
| [`08-solar-one-time-complete.png`](./founder-acceptance-v3-screenshots/08-solar-one-time-complete.png) | Sale recorded · invoice `1002` |
| [`09-solar-6month-complete.png`](./founder-acceptance-v3-screenshots/09-solar-6month-complete.png) | 6 Month Solar AMC · invoice `1003` |
| [`10-solar-12month-complete.png`](./founder-acceptance-v3-screenshots/10-solar-12month-complete.png) | 12 Month Solar AMC · invoice `1004` |
| [`11-billing-all-revenue-invoices.png`](./founder-acceptance-v3-screenshots/11-billing-all-revenue-invoices.png) | Billing list: all Acceptance V2 Test revenue invoices |

---

## Priority 4 — Remove founder-facing Contract terminology

**Verdict: Pass** (booking flow)

| V2 copy | V3 copy | Location |
|---------|---------|----------|
| Create Contract & Invoice | **Create Service Booking & Invoice** | Review step submit button |
| Required for every Contract | **Required for every booking** | Payment Terms step |
| Contract-centric GST note | Booking / invoice language | Review step |

Live session: review and success screens use **“Sale recorded”**, **“Booking ref”**, **“Book another service”** — no “contract” in the booking wizard UI.

**Note:** Internal API names (`service-contracts`, `createServiceContract`) and dashboard KPI “Active Contracts” remain — these are not founder booking-flow surfaces. Franchise churn page terminology was out of scope for this pass (unchanged from V2).

---

## Priority 5 — Customer auto-selection from profile

**Verdict: Pass**

### Root cause

`useLocation()` from wouter did not reliably include the query string for `customerId`. Customer fetch via generated api-client hook was inconsistent in dev.

### Fix

| File | Change |
|------|--------|
| `BookServicesPage.tsx` | Parse `customerId` from `window.location.search`; fetch via `useQuery` + `/api/customers/:id`; skeleton until loaded; wizard `key` reset on customer |
| `BookServicesWizard.tsx` | Start at step 1 (Service Address) when `initialCustomer` present |
| `CustomerSelect.tsx` | Show “Booking for {name} · {phone}” when pre-selected |

### Live verification

Navigate from Customer Profile → **Book Service** or open `/admin/book-services?customerId=15`:

- Customer step skipped  
- Lands on **Service Address** with Primary pre-selected  
- No manual customer search required  

### Screenshot

[`05-customer-preselect-service-address.png`](./founder-acceptance-v3-screenshots/05-customer-preselect-service-address.png)

---

## Additional fix during testing

**React hooks error on booking submit:** Early return for `contractResult` was placed before `useMemo(stepContent)` in `BookServicesWizard.tsx`, causing “Rendered fewer hooks than expected” on success. Moved success render after all hooks.

---

## Cross-cutting: all revenue invoices (Acceptance V2 Test)

| Invoice | Service | Asset | Amount | Payment status (at sign-off) |
|---------|---------|-------|--------|------------------------------|
| `CWP/26-27/1000` | Complete Foam Wash `#31` | UP32AB1234 | ₹600 | **Paid** (P2 proof) |
| `CWP/26-27/1001` | Daily Exterior Cleaning `#36` | UP32AB1234 | ₹1,000 | Open |
| `CWP/26-27/1002` | One Time Cleaning `#37` | Rooftop Solar V3 | ₹1,499 | Open |
| `CWP/26-27/1003` | 6 Month Solar AMC `#38` | Rooftop Solar V3 | ₹5,499 | Open |
| `CWP/26-27/1004` | 12 Month Solar AMC `#39` | Rooftop Solar V3 | ₹9,999 | Open |

---

## Files changed (remediation summary)

| Area | Path |
|------|------|
| DCMS plans (frontend) | `artifacts/cwp-platform/src/features/daily-cleaning/api.ts` |
| DCMS plans (backend) | `artifacts/api-server/src/lib/dcms/planService.ts` |
| Payment allocation (backend) | `artifacts/api-server/src/lib/billing/invoiceService.ts` |
| Payment dialog (frontend) | `artifacts/cwp-platform/src/features/billing/components/RecordPaymentDialog.tsx` |
| Customer deep link | `artifacts/cwp-platform/src/pages/admin/BookServicesPage.tsx` |
| Wizard hooks / pre-select | `artifacts/cwp-platform/src/features/book-services/components/BookServicesWizard.tsx` |
| Customer display | `artifacts/cwp-platform/src/features/book-services/components/CustomerSelect.tsx` |
| Terminology | `ReviewSummaryStep.tsx`, `PaymentTermsStep.tsx` |

---

## Recommendation

**Approve franchise rollout** from a revenue-flow perspective. All three revenue lines complete end-to-end in live admin:

- Car wash (V2 + payment fix)  
- Daily cleaning plan sale (P1)  
- Solar one-time + 6M + 12M plans via inline solar site (P3)  

Payment collection now correctly reduces invoice balance (P2). Founder booking copy and customer deep link are aligned with daily operations (P4, P5).

**Suggested follow-ups (non-blocking):**

- Branch-role smoke test (non-superadmin)  
- Pay remaining open invoices on test customer for clean dues view  
- Franchise churn page terminology (`/franchisee/churned`) — deferred from V2  

---

*Generated after live browser validation, 15 June 2026.*
