import "./harness/loadEnv";

import { MockCashfreeGateway } from "./harness/mockCashfreeServer";
import { TestClient } from "./harness/testClient";
import {
  createTestCustomerFixture,
  cleanupCustomerFixture,
  createAdditionalInvoice,
  getPaymentAttempts,
} from "./harness/dbHelpers";
import { db, paymentAttemptsTable, invoicesTable, customersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getClientSafeConfig } from "../../src/lib/cashfree/cashfreeConfig";

interface TestReport {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  details?: Record<string, any>;
}

const reports: TestReport[] = [];

async function runTestCase(
  id: string,
  category: string,
  name: string,
  fn: () => Promise<Record<string, any> | void>
) {
  const start = Date.now();
  process.stdout.write(`  [TEST] ${id}: ${name} ... `);
  try {
    const details = (await fn()) || {};
    const durationMs = Date.now() - start;
    reports.push({ id, category, name, passed: true, durationMs, details });
    console.log(`PASSED (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const error = err?.stack || err?.message || String(err);
    reports.push({ id, category, name, passed: false, durationMs, error });
    console.log(`FAILED (${durationMs}ms)`);
    console.error(`    Error: ${err?.message || err}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${msg} (expected: ${expected}, got: ${actual})`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("       EMPIRICAL CHALLENGER (m2_challenger_2) — STRESS TEST HARNESS");
  console.log("================================================================================");
  console.log(`Node: ${process.version} | Timestamp: ${new Date().toISOString()}`);
  console.log("Scope: Milestone 2 Concurrency, Idempotency, Session Reuse, Timeout & Sanitization\n");

  const mockGateway = new MockCashfreeGateway();
  const testClient = new TestClient();

  const { baseUrl: mockBaseUrl } = await mockGateway.start();
  process.env.CASHFREE_BASE_URL = mockBaseUrl;
  process.env.CASHFREE_APP_ID = mockGateway.clientId;
  process.env.CASHFREE_SECRET_KEY = mockGateway.secretKey;
  process.env.CASHFREE_ENV = "sandbox";
  process.env.CASHFREE_API_VERSION = "2023-08-01";

  const apiBaseUrl = await testClient.start();
  console.log(`Mock Gateway at: ${mockBaseUrl}`);
  console.log(`API Server at:   ${apiBaseUrl}\n`);

  let customer1: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;
  let customer2: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    customer1 = await createTestCustomerFixture({ balanceDue: 1500.0 });
    customer2 = await createTestCustomerFixture({ balanceDue: 2200.0 });

    // =========================================================================
    // CATEGORY 1: CONCURRENCY & IDEMPOTENCY RACES
    // =========================================================================
    console.log(">>> CATEGORY 1: CONCURRENCY & IDEMPOTENCY RACES");

    await runTestCase(
      "EMP-CONC-01",
      "Concurrency",
      "10x simultaneous parallel requests with identical idempotency key resolve to 1 order",
      async () => {
        mockGateway.reset();
        const idempotencyKey = `conc_key_10x_${Date.now()}`;
        const headers = {
          ...customer1!.authHeaders,
          "x-idempotency-key": idempotencyKey,
        };

        // Fire 10 parallel requests
        const promises = Array.from({ length: 10 }, () =>
          testClient.post("/api/payments/cashfree/create-order", { invoiceId: customer1!.invoiceId }, headers)
        );

        const responses = await Promise.all(promises);

        // 1. All 10 must succeed with HTTP 200
        for (let i = 0; i < responses.length; i++) {
          assertEqual(responses[i].status, 200, `Response #${i + 1} status must be 200`);
          assertEqual(responses[i].data?.success, true, `Response #${i + 1} data.success must be true`);
        }

        // 2. All 10 must return identical orderId and paymentSessionId
        const firstOrderId = responses[0].data?.orderId;
        const firstSessionId = responses[0].data?.paymentSessionId;
        assert(Boolean(firstOrderId), "firstOrderId must be non-empty");
        assert(Boolean(firstSessionId), "firstSessionId must be non-empty");

        for (let i = 1; i < responses.length; i++) {
          assertEqual(responses[i].data?.orderId, firstOrderId, `Response #${i + 1} orderId must match firstOrderId`);
          assertEqual(
            responses[i].data?.paymentSessionId,
            firstSessionId,
            `Response #${i + 1} paymentSessionId must match firstSessionId`
          );
        }

        // 3. Database check: Exactly 1 record in payment_attempts
        const attempts = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));

        assertEqual(attempts.length, 1, "Database must contain exactly 1 payment_attempt for idempotencyKey");
        assertEqual(attempts[0].cfOrderId, firstOrderId, "Database row cfOrderId must match returned orderId");
        assertEqual(attempts[0].status, "initiated", "Database row status must be 'initiated'");

        return {
          concurrentRequests: 10,
          returnedOrderId: firstOrderId,
          dbRecordCount: attempts.length,
        };
      }
    );

    await runTestCase(
      "EMP-CONC-02",
      "Concurrency",
      "Rapid sequential duplicate requests with same key return cached session without DB expansion",
      async () => {
        const idempotencyKey = `seq_key_5x_${Date.now()}`;
        const headers = {
          ...customer1!.authHeaders,
          "x-idempotency-key": idempotencyKey,
        };

        let initialSession: string | undefined;
        let initialOrder: string | undefined;

        for (let i = 0; i < 5; i++) {
          const res = await testClient.post(
            "/api/payments/cashfree/create-order",
            { invoiceId: customer1!.invoiceId },
            headers
          );
          assertEqual(res.status, 200, `Sequential call #${i + 1} status must be 200`);
          if (i === 0) {
            initialSession = res.data?.paymentSessionId;
            initialOrder = res.data?.orderId;
            assert(Boolean(initialSession), "initialSession must exist");
          } else {
            assertEqual(res.data?.paymentSessionId, initialSession, `Sequential call #${i + 1} must reuse initialSession`);
            assertEqual(res.data?.orderId, initialOrder, `Sequential call #${i + 1} must reuse initialOrder`);
          }
        }

        const attempts = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));
        assertEqual(attempts.length, 1, "Exactly 1 attempt record in DB across 5 sequential calls");

        return { sequentialCount: 5, dbRecordCount: attempts.length };
      }
    );

    await runTestCase(
      "EMP-CONC-03",
      "Concurrency",
      "Different idempotency keys for different invoices create distinct isolated orders",
      async () => {
        const inv2 = await createAdditionalInvoice(customer1!.customerId, 850.0);
        const key1 = `diff_key_inv1_${Date.now()}`;
        const key2 = `diff_key_inv2_${Date.now()}`;

        const [res1, res2] = await Promise.all([
          testClient.post(
            "/api/payments/cashfree/create-order",
            { invoiceId: customer1!.invoiceId },
            { ...customer1!.authHeaders, "x-idempotency-key": key1 }
          ),
          testClient.post(
            "/api/payments/cashfree/create-order",
            { invoiceId: inv2.invoiceId },
            { ...customer1!.authHeaders, "x-idempotency-key": key2 }
          ),
        ]);

        assertEqual(res1.status, 200, "Order 1 must return 200");
        assertEqual(res2.status, 200, "Order 2 must return 200");
        assert(res1.data?.orderId !== res2.data?.orderId, "Order IDs must be distinct");
        assert(res1.data?.paymentSessionId !== res2.data?.paymentSessionId, "Session IDs must be distinct");
        assertEqual(res1.data?.orderAmount, 1500.0, "Order 1 amount matches invoice 1");
        assertEqual(res2.data?.orderAmount, 850.0, "Order 2 amount matches invoice 2");

        return { order1: res1.data?.orderId, order2: res2.data?.orderId };
      }
    );

    await runTestCase(
      "EMP-CONC-04",
      "Concurrency",
      "Cross-Customer Idempotency Investigation: Customer B sending Customer A's idempotency key",
      async () => {
        const sharedKey = `cross_tenant_key_${Date.now()}`;
        // Customer 1 creates an order with sharedKey
        const resA = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer1!.invoiceId },
          { ...customer1!.authHeaders, "x-idempotency-key": sharedKey }
        );
        assertEqual(resA.status, 200, "Customer A order must succeed");

        // Customer 2 attempts to use the exact same sharedKey
        const resB = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          { ...customer2!.authHeaders, "x-idempotency-key": sharedKey }
        );

        // Record finding: what does resB return?
        console.log(`\n      [INVESTIGATION] Customer B with Customer A key: status=${resB.status}, orderId=${resB.data?.orderId}, customerA_orderId=${resA.data?.orderId}`);

        return {
          customerA_orderId: resA.data?.orderId,
          customerB_status: resB.status,
          customerB_orderId: resB.data?.orderId,
        };
      }
    );

    // =========================================================================
    // CATEGORY 2: 20-MINUTE ACTIVE SESSION REUSE WINDOW
    // =========================================================================
    console.log("\n>>> CATEGORY 2: 20-MINUTE ACTIVE SESSION REUSE WINDOW");

    let reusableOrderId: string = "";
    let reusableSessionId: string = "";

    await runTestCase(
      "EMP-REUSE-01",
      "SessionReuse",
      "Immediate consecutive requests without idempotency key reuse active unexpired session",
      async () => {
        mockGateway.reset();
        // Request 1: Fresh order creation without custom idempotency key
        const res1 = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          customer2!.authHeaders
        );
        assertEqual(res1.status, 200, "Initial request must return 200");
        reusableOrderId = res1.data?.orderId;
        reusableSessionId = res1.data?.paymentSessionId;
        assert(Boolean(reusableOrderId), "reusableOrderId must exist");

        // Count attempts in DB
        const attemptsBefore = await db
          .select()
          .from(paymentAttemptsTable)
          .where(
            and(
              eq(paymentAttemptsTable.customerId, customer2!.customerId),
              eq(paymentAttemptsTable.invoiceId, customer2!.invoiceId)
            )
          );
        const countBefore = attemptsBefore.length;

        // Request 2: Follow-up request within 20 mins without idempotency key
        const res2 = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          customer2!.authHeaders
        );
        assertEqual(res2.status, 200, "Follow-up request must return 200");
        assertEqual(res2.data?.orderId, reusableOrderId, "Follow-up request must return identical orderId");
        assertEqual(
          res2.data?.paymentSessionId,
          reusableSessionId,
          "Follow-up request must return identical paymentSessionId"
        );

        // Count attempts in DB after: must NOT increase
        const attemptsAfter = await db
          .select()
          .from(paymentAttemptsTable)
          .where(
            and(
              eq(paymentAttemptsTable.customerId, customer2!.customerId),
              eq(paymentAttemptsTable.invoiceId, customer2!.invoiceId)
            )
          );
        assertEqual(attemptsAfter.length, countBefore, "Database must not create duplicate attempt during reuse window");

        return { orderId: reusableOrderId, reused: true, dbCount: attemptsAfter.length };
      }
    );

    await runTestCase(
      "EMP-REUSE-02",
      "SessionReuse",
      "Session created 19 minutes ago is reused; session created 21 minutes ago expires and generates fresh order",
      async () => {
        // Step A: Artificially backdate the existing attempt to 19 minutes ago (should still be reused)
        const nineteenMinutesAgo = new Date(Date.now() - 19 * 60 * 1000);
        await db
          .update(paymentAttemptsTable)
          .set({ createdAt: nineteenMinutesAgo })
          .where(eq(paymentAttemptsTable.cfOrderId, reusableOrderId));

        const res19 = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          customer2!.authHeaders
        );
        assertEqual(res19.status, 200, "19-minute request must succeed");
        assertEqual(res19.data?.orderId, reusableOrderId, "Session from 19 minutes ago MUST be reused");
        assertEqual(res19.data?.paymentSessionId, reusableSessionId, "Payment session ID must match 19-min old session");

        // Step B: Artificially backdate the existing attempt to 21 minutes ago (must expire)
        const twentyOneMinutesAgo = new Date(Date.now() - 21 * 60 * 1000);
        await db
          .update(paymentAttemptsTable)
          .set({ createdAt: twentyOneMinutesAgo })
          .where(eq(paymentAttemptsTable.cfOrderId, reusableOrderId));

        const res21 = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          customer2!.authHeaders
        );
        assertEqual(res21.status, 200, "21-minute request must succeed with new order");
        assert(
          res21.data?.orderId !== reusableOrderId,
          `Session from 21 minutes ago MUST NOT be reused (new order: ${res21.data?.orderId}, old: ${reusableOrderId})`
        );
        assert(
          res21.data?.paymentSessionId !== reusableSessionId,
          "New payment session ID must be issued after 20-minute window"
        );

        return {
          reusedAt19m: true,
          expiredAt21m: true,
          newOrderId: res21.data?.orderId,
        };
      }
    );

    await runTestCase(
      "EMP-REUSE-03",
      "SessionReuse",
      "Previous attempt with status 'failed' is NOT reused; fresh session generated",
      async () => {
        // Mark all customer2 attempts for invoice as failed
        await db
          .update(paymentAttemptsTable)
          .set({ status: "failed" })
          .where(
            and(
              eq(paymentAttemptsTable.customerId, customer2!.customerId),
              eq(paymentAttemptsTable.invoiceId, customer2!.invoiceId)
            )
          );

        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer2!.invoiceId },
          customer2!.authHeaders
        );

        assertEqual(res.status, 200, "Request after failure must succeed with new session");
        assert(Boolean(res.data?.orderId), "Must return new orderId");
        assert(Boolean(res.data?.paymentSessionId), "Must return new paymentSessionId");

        // Confirm new attempt in DB has status 'initiated'
        const [latestAttempt] = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.cfOrderId, res.data?.orderId))
          .limit(1);

        assertEqual(latestAttempt?.status, "initiated", "New attempt status must be 'initiated'");

        return { freshOrderId: res.data?.orderId, status: latestAttempt?.status };
      }
    );

    // =========================================================================
    // CATEGORY 3: GATEWAY TIMEOUT & ERROR SANITIZATION (ZERO CREDENTIAL LEAKAGE)
    // =========================================================================
    console.log("\n>>> CATEGORY 3: GATEWAY TIMEOUT & ERROR SANITIZATION");

    const SECRET_KEY_CANARY = mockGateway.secretKey; // "mock_secret_key_testing_123456789"
    const APP_ID_CANARY = mockGateway.clientId;      // "mock_client_id_test"

    await runTestCase(
      "EMP-SEC-01",
      "SecuritySanitization",
      "Gateway Timeout (504): DB marked 'failed', zero credentials leaked in response",
      async () => {
        mockGateway.reset();
        // Configure timeout simulation
        const origTimeout = process.env.CASHFREE_TIMEOUT_MS;
        process.env.CASHFREE_TIMEOUT_MS = "800"; // 800ms timeout for speedy verification

        mockGateway.simulateTimeout({ delayMs: 2500, endpoint: "/orders" });

        const inv = await createAdditionalInvoice(customer1!.customerId, 450.0);
        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: inv.invoiceId },
          customer1!.authHeaders
        );

        // Restore timeout env and reset mockGateway
        if (origTimeout) process.env.CASHFREE_TIMEOUT_MS = origTimeout;
        else delete process.env.CASHFREE_TIMEOUT_MS;
        mockGateway.reset();

        // 1. Status code must be 504 Gateway Timeout
        assertEqual(res.status, 504, "API must return HTTP 504 on gateway timeout");
        assertEqual(res.data?.code, "GATEWAY_TIMEOUT", "Error code must be GATEWAY_TIMEOUT");

        // 2. Database attempt must be marked 'failed'
        const attempts = await db
          .select()
          .from(paymentAttemptsTable)
          .where(
            and(
              eq(paymentAttemptsTable.customerId, customer1!.customerId),
              eq(paymentAttemptsTable.invoiceId, inv.invoiceId)
            )
          );
        assert(attempts.length > 0, "A payment attempt row must have been created");
        const failedAttempt = attempts[attempts.length - 1];
        assertEqual(failedAttempt.status, "failed", "Timed out payment attempt status in DB must be 'failed'");

        // 3. ZERO CREDENTIAL LEAKAGE ASSERTIONS
        const rawResponse = res.rawText;
        assert(!rawResponse.includes(SECRET_KEY_CANARY), "CRITICAL: Secret key MUST NOT appear in timeout response");
        assert(!rawResponse.includes("x-client-secret"), "Header 'x-client-secret' name must not appear in response");
        assert(!rawResponse.includes("node_modules"), "Internal stack trace paths must not be leaked to client");

        return {
          statusCode: res.status,
          errorCode: res.data?.code,
          dbStatus: failedAttempt.status,
          secretLeaked: false,
        };
      }
    );

    await runTestCase(
      "EMP-SEC-02",
      "SecuritySanitization",
      "Gateway 500 Internal Error: returns 500 without leaking secret credentials",
      async () => {
        mockGateway.reset();
        mockGateway.simulateInternalError(500, { times: 1, endpoint: "/orders" });

        const inv = await createAdditionalInvoice(customer1!.customerId, 620.0);
        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: inv.invoiceId },
          customer1!.authHeaders
        );

        mockGateway.reset();

        assertEqual(res.status, 500, `API must return HTTP 500 on gateway internal error (got ${res.status})`);

        // Verify DB record status is 'failed'
        const attempts = await db
          .select()
          .from(paymentAttemptsTable)
          .where(
            and(
              eq(paymentAttemptsTable.customerId, customer1!.customerId),
              eq(paymentAttemptsTable.invoiceId, inv.invoiceId)
            )
          );
        assert(attempts.length > 0, "Payment attempt row must exist");
        assertEqual(attempts[attempts.length - 1].status, "failed", "DB attempt status must be 'failed'");

        // Zero credential leakage
        assert(!res.rawText.includes(SECRET_KEY_CANARY), "Secret key must not leak on 500 error");
        assert(!res.rawText.includes("x-client-secret"), "x-client-secret must not leak on 500 error");

        return {
          statusCode: res.status,
          dbStatus: attempts[attempts.length - 1].status,
          secretLeaked: false,
        };
      }
    );

    await runTestCase(
      "EMP-SEC-03",
      "SecuritySanitization",
      "getClientSafeConfig strictly omits secretKey and never serializes credentials",
      async () => {
        const clientSafeConfig = getClientSafeConfig();
        assertEqual(clientSafeConfig.appId, APP_ID_CANARY, "Safe config includes appId");
        assertEqual(clientSafeConfig.env, "sandbox", "Safe config includes env");
        assertEqual(clientSafeConfig.apiVersion, "2023-08-01", "Safe config includes apiVersion");

        // Explicit undefined check
        assert(
          (clientSafeConfig as any).secretKey === undefined,
          "clientSafeConfig.secretKey MUST be strictly undefined"
        );

        // Keys check
        const keys = Object.keys(clientSafeConfig);
        assert(!keys.includes("secretKey"), "Object keys must not include 'secretKey'");
        assert(!keys.includes("secret"), "Object keys must not include 'secret'");

        // JSON serialization check
        const serialized = JSON.stringify(clientSafeConfig);
        assert(!serialized.includes(SECRET_KEY_CANARY), "Serialized client safe config must not contain secret key");

        return {
          clientSafeKeys: keys,
          secretKeyUndefined: true,
          leakDetected: false,
        };
      }
    );

    await runTestCase(
      "EMP-SEC-04",
      "SecuritySanitization",
      "Unauthorized Invoice Access: Customer B attempting to pay Customer A's invoice is rejected (403)",
      async () => {
        // Customer 2 tries to initiate payment on Customer 1's invoice
        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: customer1!.invoiceId },
          customer2!.authHeaders
        );

        assertEqual(res.status, 403, "Must return HTTP 403 Forbidden");
        assertEqual(res.data?.code, "FORBIDDEN_INVOICE_ACCESS", "Error code must be FORBIDDEN_INVOICE_ACCESS");
        assert(!res.rawText.includes(SECRET_KEY_CANARY), "Must not leak secret keys on 403");

        return { status: res.status, code: res.data?.code };
      }
    );

    // =========================================================================
    // CATEGORY 4: DATABASE INSERTION & FIELDS IN `payment_attempts`
    // =========================================================================
    console.log("\n>>> CATEGORY 4: DATABASE INSERTION & FIELDS IN `payment_attempts`");

    await runTestCase(
      "EMP-DB-01",
      "DatabaseAssertions",
      "All columns and constraints in payment_attempts strictly validated against schema",
      async () => {
        mockGateway.reset();
        const customKey = `emp_db_key_${Date.now()}`;
        const inv = await createAdditionalInvoice(customer1!.customerId, 1750.5);

        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          { invoiceId: inv.invoiceId },
          { ...customer1!.authHeaders, "x-idempotency-key": customKey }
        );

        assertEqual(res.status, 200, "Order creation must succeed");
        const orderId = res.data?.orderId;
        const sessionId = res.data?.paymentSessionId;

        // Fetch row directly from PostgreSQL
        const [attempt] = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.cfOrderId, orderId))
          .limit(1);

        assert(Boolean(attempt), "Payment attempt row must be found in database");

        // 1. Primary key > 0
        assert(attempt.id > 0, "id must be positive integer");

        // 2. attemptId pattern and length <= 45
        assert(
          /^cwp_att_\d+_[a-f0-9]+$/.test(attempt.attemptId),
          `attemptId '${attempt.attemptId}' must match cwp_att_ pattern`
        );
        assert(attempt.attemptId.length <= 45, `attemptId length (${attempt.attemptId.length}) must be <= 45`);

        // 3. cfOrderId pattern and length <= 45
        assert(
          /^cwp_ord_\d+_[a-f0-9]+$/.test(attempt.cfOrderId),
          `cfOrderId '${attempt.cfOrderId}' must match cwp_ord_ pattern`
        );
        assert(attempt.cfOrderId.length <= 45, `cfOrderId length (${attempt.cfOrderId.length}) must be <= 45`);

        // 4. customerId matches
        assertEqual(attempt.customerId, customer1!.customerId, "customerId matches fixture");

        // 5. invoiceId matches
        assertEqual(attempt.invoiceId, inv.invoiceId, "invoiceId matches target invoice");

        // 6. amount matches formatted amount
        assertEqual(attempt.amount, "1750.50", "amount must be stored as '1750.50'");

        // 7. currency is INR
        assertEqual(attempt.currency, "INR", "currency must be INR");

        // 8. cfPaymentSessionId starts with session_
        assertEqual(attempt.cfPaymentSessionId, sessionId, "cfPaymentSessionId matches API response");
        assert(
          attempt.cfPaymentSessionId?.startsWith("session_") ?? false,
          "cfPaymentSessionId must start with 'session_'"
        );

        // 9. status is 'initiated'
        assertEqual(attempt.status, "initiated", "status must be 'initiated'");

        // 10. idempotencyKey matches custom key
        assertEqual(attempt.idempotencyKey, customKey, "idempotencyKey matches customKey");

        // 11. Initial null fields (populated later in M3)
        assertEqual(attempt.cfPaymentId, null, "cfPaymentId must initially be null");
        assertEqual(attempt.paymentMethod, null, "paymentMethod must initially be null");
        assertEqual(attempt.rawWebhookPayload, null, "rawWebhookPayload must initially be null");
        assertEqual(attempt.rawVerificationPayload, null, "rawVerificationPayload must initially be null");

        // 12. Valid recent timestamps
        const now = Date.now();
        const createdMs = new Date(attempt.createdAt).getTime();
        const updatedMs = new Date(attempt.updatedAt).getTime();
        assert(Math.abs(now - createdMs) < 60_000, "createdAt must be within last 60 seconds");
        assert(Math.abs(now - updatedMs) < 60_000, "updatedAt must be within last 60 seconds");

        return {
          id: attempt.id,
          attemptId: attempt.attemptId,
          cfOrderId: attempt.cfOrderId,
          status: attempt.status,
          amount: attempt.amount,
          currency: attempt.currency,
        };
      }
    );

    await runTestCase(
      "EMP-DB-02",
      "DatabaseAssertions",
      "General dues order creates payment_attempt with null invoiceId and aggregate balance",
      async () => {
        mockGateway.reset();
        // Customer 2 dues order without specifying invoiceId
        const res = await testClient.post(
          "/api/payments/cashfree/create-order",
          {},
          customer2!.authHeaders
        );

        assertEqual(res.status, 200, "General dues order must return 200");
        const orderId = res.data?.orderId;

        const [attempt] = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.cfOrderId, orderId))
          .limit(1);

        assert(Boolean(attempt), "Attempt must exist in database");
        assertEqual(attempt.invoiceId, null, "invoiceId must be NULL for general dues payment");
        assertEqual(attempt.currency, "INR", "currency must be INR");
        assertEqual(attempt.status, "initiated", "status must be 'initiated'");

        return {
          orderId,
          invoiceId: attempt.invoiceId,
          amount: attempt.amount,
        };
      }
    );
  } finally {
    // Teardown test servers & fixtures
    console.log("\n[CLEANUP] Cleaning test customer fixtures and servers...");
    if (customer1) await cleanupCustomerFixture(customer1);
    if (customer2) await cleanupCustomerFixture(customer2);
    await testClient.stop();
    await mockGateway.stop();
    console.log("[CLEANUP] Completed cleanly.\n");
  }

  // =========================================================================
  // SUMMARY REPORT & VERDICT
  // =========================================================================
  console.log("================================================================================");
  console.log("                    EMPIRICAL CHALLENGE EXECUTION SUMMARY");
  console.log("================================================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;

  for (const rep of reports) {
    const mark = rep.passed ? " PASS " : " FAIL ";
    console.log(`[${mark}] ${rep.id} [${rep.category}]: ${rep.name} (${rep.durationMs}ms)`);
    if (rep.error) {
      console.log(`       Error: ${rep.error}`);
    }
  }

  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    console.log("VERDICT: REJECT — Found empirical failures in Milestone 2 implementation.");
    process.exit(1);
  } else {
    console.log("VERDICT: APPROVE — All empirical stress tests passed with 100% compliance.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN HARNESS:", err);
  process.exit(1);
});
