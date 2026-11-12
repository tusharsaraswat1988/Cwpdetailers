# E2E Test Infra: Cashfree Payment Gateway Integration

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Derives strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md` contracts.
- Methodology: Category-Partition + BVA (Boundary Value Analysis) + Pairwise Combinatorial Testing + Workload Application Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | DB Enum Extension (`cashfree`) | ORIGINAL_REQUEST §R1, R5 | 5 | 5 | ✓ |
| 2 | DB Payment Attempts Tracking | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Raw Body Preservation Middleware | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 4 | Environment & Config Module | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Cashfree REST API Client | ORIGINAL_REQUEST §R2, R3 | 5 | 5 | ✓ |
| 6 | Server-Side Order Creation API | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Idempotency & Concurrency Guard | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Webhook HMAC-SHA256 Verification | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 9 | Public Webhook Ingestion API | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 10 | Server-Side Return Verification API | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 11 | Atomic Ledger Reconciliation | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 12 | Dashboard Dues Calculation | ORIGINAL_REQUEST §R1, R4 | 5 | 5 | ✓ |
| 13 | Payment Review Data | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 14 | Cashfree JS Checkout Session Token | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 15 | Customer Return Route State Handling | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 16 | Dashboard Balance Clearance | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 17 | Admin Billing Visibility | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 18 | Customer Payment History | ORIGINAL_REQUEST §R6 | 5 | 5 | ✓ |
| 19 | Professional Receipt Experience Data | ORIGINAL_REQUEST §R6 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**:
  - Standalone, automated runner executable via `tsx artifacts/api-server/test/cashfree/run-all.ts` and `pnpm --filter @workspace/api-server test:cashfree`.
  - Pass/fail semantics: Clean console reporting with tier breakdowns, suite-level assertions, exit code `0` on all passes, exit code `1` on failure.
- **Mock Cashfree Gateway**:
  - Embedded HTTP mock server simulating Cashfree API (`POST /pg/orders`, `GET /pg/orders/:orderId`, `GET /pg/orders/:orderId/payments`).
  - Capable of generating valid cryptographic signatures with HMAC-SHA256 matching official Cashfree specification.
- **Directory Layout**:
  ```
  artifacts/api-server/test/cashfree/
  ├── harness/
  │   ├── mockCashfreeServer.ts    # Embedded mock gateway
  │   ├── testClient.ts            # Supertest / HTTP API wrapper
  │   ├── dbHelpers.ts             # Test DB seeding & verification helpers
  │   └── signatureHelper.ts       # HMAC-SHA256 header generation
  ├── tier1-features/
  │   ├── test-f1-f5-core.ts       # Features 1-5
  │   ├── test-f6-f10-gateway.ts   # Features 6-10
  │   ├── test-f11-f15-journey.ts  # Features 11-15
  │   └── test-f16-f19-admin.ts    # Features 16-19
  ├── tier2-boundaries/
  │   └── test-tier2-boundaries.ts # Zero amounts, replay attacks, tampered HMAC, expired sessions
  ├── tier3-combinations/
  │   └── test-tier3-combinations.ts # Race conditions: webhook vs return, concurrent webhooks, partial payments
  ├── tier4-scenarios/
  │   └── test-tier4-scenarios.ts  # 5 realistic full user journeys
  └── run-all.ts                   # Master runner with tier accounting and assertion summary
  ```

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Happy-Path Payment: Dashboard Pay Now -> Order Creation -> Successful Webhook -> Return Verification -> Dues Cleared -> Receipt Issued | F6, F7, F8, F9, F10, F11, F12, F15, F16, F18, F19 | High |
| 2 | Invoice-Specific Settlement: Customer pays dedicated single invoice -> Ledger settles specific invoice -> Other pending invoices remain | F6, F10, F11, F12, F17, F18 | High |
| 3 | Payment Failure Followed by Successful Retry: Initial attempt fails at gateway -> Status marked failed -> Customer retries -> Second attempt succeeds | F6, F7, F9, F10, F11, F15, F18 | High |
| 4 | Webhook Arrives Before Customer Return: Fast webhook reconciles ledger first -> Customer return route cleanly displays already-paid state | F8, F9, F10, F11, F15, F16, F19 | High |
| 5 | Concurrent Duplicate Webhooks & Replay Defense: Gateway retries webhook simultaneously -> First triggers ledger settlement, duplicate is safely deduplicated without double crediting | F7, F8, F9, F11, F17 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (19 features × 5 = 95 test assertions)
- Tier 2: ≥5 per boundary area (6 areas × 5 = 30 boundary assertions)
- Tier 3: pairwise coverage of major interactions (≥15 interaction assertions)
- Tier 4: ≥5 realistic full application scenarios (5 comprehensive user journeys)
- **Total Minimum Target: ≥145 verified test assertions**
