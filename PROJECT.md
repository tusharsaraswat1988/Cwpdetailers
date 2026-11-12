# Project: Cashfree Payment Gateway Integration

## Architecture
- **Monorepo Structure**:
  - `lib/db`: PostgreSQL Drizzle ORM schema, migrations, connection pool.
  - `artifacts/api-server`: Express REST API, auth middleware, billing service, Cashfree client/webhook/service.
  - `artifacts/cwp-platform`: React 19 + Vite frontend (Wouter router, Tailwind CSS, Customer Design System).
- **Data Flow**:
  1. Customer clicks "Pay Now" on `/customer/dashboard` or `/customer/invoices`.
  2. Frontend opens `CustomerPaymentReviewDialog` displaying trusted server details.
  3. Customer clicks "Proceed to Secure Payment" -> Frontend calls `POST /api/payments/cashfree/create-order`.
  4. Backend verifies customer authentication, calculates outstanding balance via `getCustomerOutstandingDues()`, inserts `payment_attempts` record, calls Cashfree `POST /orders`, and returns `payment_session_id`.
  5. Frontend initializes `@cashfreepayments/cashfree-js` and invokes `cashfree.checkout({ paymentSessionId, redirectTarget: "_self" })`.
  6. Upon completion/cancellation, Cashfree redirects to `/customer/payment/return?order_id={order_id}`.
  7. Return route queries `GET /api/payments/cashfree/verify/:orderId`.
  8. In parallel, Cashfree triggers webhook `POST /api/webhooks/cashfree` signed with HMAC-SHA256.
  9. Backend validates signature with `req.rawBody`, checks idempotency, updates `payment_attempts`, and executes atomic ledger reconciliation via `recordPayment()` / `applyPaymentToInvoice()`.
  10. Return route displays verified status (Success / Failure / Pending / Abandoned), invalidates dashboard dues query, and offers receipt download.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DB Enum Extension | Add `'cashfree'` to PostgreSQL `payment_method` enum | M1 | Survey / R1 |
| 2 | DB Payment Attempts Table | Create `payment_attempts` table for gateway order/session tracking | M1 | Survey / R2 |
| 3 | Raw Body Preservation Middleware | Configure `express.json` with `verify` hook in `app.ts` to store `req.rawBody` | M2 | Survey / R3 |
| 4 | Environment & Config Module | Environment-based config for Cashfree Sandbox/Prod without hardcoding secrets | M2 | Survey / R2 |
| 5 | Cashfree REST API Client | Lightweight client for `POST /orders`, `GET /orders/:id`, `GET /orders/:id/payments` | M2 | Survey / R2 |
| 6 | Server-Side Order Creation API | `POST /api/payments/cashfree/create-order` using server-computed balance | M2 | Survey / R2 |
| 7 | Idempotency & Concurrent Attempt Guard | Ensure unique internal order ID and idempotency key per payment session | M2 | Survey / R2 |
| 8 | Webhook HMAC-SHA256 Verification | Cryptographic verification of `x-webhook-signature` using `timestamp + rawBody` | M3 | Survey / R3 |
| 9 | Public Webhook Ingestion API | `POST /api/webhooks/cashfree` handling success/failed/dropped events idempotently | M3 | Survey / R3 |
| 10 | Server-Side Return Verification API | `GET /api/payments/cashfree/verify/:orderId` querying Cashfree directly | M3 | Survey / R3 |
| 11 | Atomic Ledger Reconciliation | Transactional reconciliation via `recordPayment()` & `applyPaymentToInvoice()` | M3 | Survey / R5 |
| 12 | Dashboard Pay Now Refactor | Interactive button with loading/disabled states and duplicate click prevention | M4 | Survey / R4 |
| 13 | Payment Review Modal | Branded modal displaying customer name, invoice details, payable amount in INR | M4 | Survey / R4 |
| 14 | Cashfree JS SDK Checkout | Load `@cashfreepayments/cashfree-js` and trigger Hosted Web Checkout | M4 | Survey / R4 |
| 15 | Customer Return Route | `/customer/payment/return` with Verifying, Success, Failure, Pending, Retry states | M4 | Survey / R4 |
| 16 | Dashboard Balance Clearance | Automatically refresh and show "All Payments Clear" when balance is zero | M4 | Survey / R4 |
| 17 | Admin Billing Visibility | Admin `PaymentsTab.tsx` shows Cashfree Order ID, status badges, attempts list | M5 | Survey / R5 |
| 18 | Customer Payment History | Integrate Cashfree payments into customer payments list and invoices | M5 | Survey / R6 |
| 19 | Professional Receipt Experience | Branded receipt modal/view with print/download support using trusted business data | M5 | Survey / R6 |
| 20 | Automated Backend/Frontend Tests | Unit/integration tests for order creation, webhooks, reconciliation, status | M6 / E2E Track | Survey / R7 |
| 21 | Responsive Browser QA & Screenshots | Multi-viewport verification across Mobile, Tablet, and Desktop | M6 / E2E Track | Survey / R8 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Migration | Extend `paymentMethodEnum` with `'cashfree'`, create `payment_attempts` table, create migration `063`, run migration | none | DONE (Verified: build exit 0, migrate:pending exit 0, 49/49 assertions, 24/24 adversarial tests, Clean audit) |
| M2 | Backend Cashfree Core & Order Management | Express raw body middleware, Cashfree client, config loader, `POST /api/payments/cashfree/create-order` | M1 | DONE (Verified: clean audit by m2_auditor_iter2, 18/18 challenger stress tests pass, 111/149 master assertions pass) |
| M3 | Webhooks, Return Verification & Atomic Ledger | HMAC-SHA256 signature verification, `POST /api/webhooks/cashfree`, `GET /api/payments/cashfree/verify/:orderId`, atomic ledger sync | M1, M2 | IN_PROGRESS |
| M4 | Frontend Customer Payment Journey & Review | Dashboard Pay Now button, Review modal, Cashfree JS SDK checkout, Return route (`/customer/payment/return`), states | M2, M3 | PLANNED |
| M5 | Admin Visibility, Payment History & Receipts | Admin payments view with Cashfree status & order ID, customer payment history, professional receipt | M3, M4 | PLANNED |
| M6 | E2E Test Pass & Adversarial Hardening | Phase 1: 100% pass of E2E test suite (Tiers 1-4). Phase 2: Adversarial hardening (Tier 5) | M1, M2, M3, M4, M5, TEST_READY | PLANNED |

## Interface Contracts

### M1 ↔ M2 / M3 (`lib/db` -> `artifacts/api-server`)
- `paymentMethodEnum`: `"cash" | "upi" | "card" | "bank_transfer" | "wallet" | "razorpay" | "cashfree"`
- `paymentAttemptsTable`:
  - `id`: serial / uuid primary key
  - `attemptId`: text / varchar unique (e.g. `cwp_att_...`)
  - `cfOrderId`: text / varchar unique (e.g. `cwp_order_...`)
  - `customerId`: integer foreign key -> `customersTable.id`
  - `invoiceId`: integer nullable foreign key -> `invoicesTable.id`
  - `amount`: numeric(10, 2)
  - `currency`: varchar(3) default 'INR'
  - `cfPaymentSessionId`: text nullable
  - `status`: text (`"initiated" | "active" | "paid" | "failed" | "user_dropped" | "expired"`)
  - `cfPaymentId`: text nullable (gateway payment reference)
  - `paymentMethod`: text nullable (e.g. 'upi', 'card', 'netbanking')
  - `idempotencyKey`: text unique
  - `rawWebhookPayload`: jsonb nullable
  - `rawVerificationPayload`: jsonb nullable
  - `createdAt`, `updatedAt`: timestamp with timezone

### M2 ↔ M4 (`artifacts/api-server` -> `artifacts/cwp-platform`)
- `POST /api/payments/cashfree/create-order`:
  - Auth: Bearer token (Customer portal session, `req.scope.customerId`)
  - Request body: `{ invoiceId?: number, returnUrl?: string }` (amount is strictly NOT accepted from client)
  - Response 200:
    ```json
    {
      "success": true,
      "orderId": "cwp_order_12345",
      "paymentSessionId": "session_...",
      "orderAmount": 1300.00,
      "orderCurrency": "INR",
      "environment": "sandbox"
    }
    ```
  - Response 400: `{ "error": "NO_OUTSTANDING_BALANCE" | "INVALID_INVOICE" }`

### M3 ↔ M4 (`artifacts/api-server` -> `artifacts/cwp-platform`)
- `GET /api/payments/cashfree/verify/:orderId`:
  - Auth: Bearer token (Customer portal session)
  - Response 200:
    ```json
    {
      "success": true,
      "status": "PAID" | "FAILED" | "PENDING" | "USER_DROPPED",
      "orderId": "cwp_order_12345",
      "amount": 1300.00,
      "paymentId": "cf_pay_98765",
      "paymentTime": "2026-11-11T06:30:00Z",
      "paymentMethod": "upi",
      "receipt": {
        "paymentId": 123,
        "receiptNumber": "REC-2026-001",
        "invoiceNumber": "INV-2026-001",
        "customerName": "Tushar",
        "amount": 1300.00,
        "date": "2026-11-11"
      }
    }
    ```

### Cashfree ↔ M3 (`Cashfree Gateway` -> `artifacts/api-server`)
- `POST /api/webhooks/cashfree`:
  - Headers: `x-webhook-signature`, `x-webhook-timestamp`
  - Body: Raw JSON bytes verified via HMAC-SHA256 with `CASHFREE_SECRET_KEY`
  - Response: 200 `{ "received": true }`

## Code Layout
- `lib/db/src/schema/invoices.ts`: `paymentMethodEnum` with `'cashfree'`
- `lib/db/src/schema/payment-attempts.ts`: `paymentAttemptsTable`
- `lib/db/src/schema/index.ts`: export `paymentAttemptsTable`
- `lib/db/migrations/063_cashfree_payment_gateway.sql`: SQL migration script
- `artifacts/api-server/src/app.ts`: `express.json` with `verify` hook for `req.rawBody`
- `artifacts/api-server/src/lib/cashfree/`:
  - `cashfreeConfig.ts`: config validation & credentials
  - `cashfreeClient.ts`: REST client for Cashfree PG APIs
  - `cashfreeWebhook.ts`: signature validation & timestamp drift check
  - `cashfreeService.ts`: order creation & atomic reconciliation using `recordPayment`
- `artifacts/api-server/src/routes/cashfree.ts`: Cashfree customer & webhook routes
- `artifacts/cwp-platform/src/lib/cashfree.ts`: Cashfree SDK loader & checkout helper
- `artifacts/cwp-platform/src/components/payment/`:
  - `CustomerPaymentReviewDialog.tsx`: Payment review modal
  - `ReceiptModal.tsx`: Professional receipt view & print helper
- `artifacts/cwp-platform/src/pages/customer/PaymentReturn.tsx`: `/customer/payment/return` page
- `artifacts/cwp-platform/src/pages/customer/Dashboard.tsx`: Pay Now button & balance card refactor
- `artifacts/cwp-platform/src/features/billing/components/PaymentsTab.tsx`: Admin payment visibility
- `artifacts/api-server/test/cashfree/`: Backend unit & integration test suite
- `artifacts/cwp-platform/test/payment/`: Frontend component & flow test suite
