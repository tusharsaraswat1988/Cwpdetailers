import "./harness/loadEnv";

import http from "node:http";
import { MockCashfreeGateway } from "./harness/mockCashfreeServer";
import {
  db,
  customersTable,
  usersTable,
  invoicesTable,
  sessionsTable,
  paymentsTable,
  paymentAttemptsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  createTestCustomerFixture,
  createAdminFixture,
  emergencyCleanupOrphanFixtures,
} from "./harness/dbHelpers";

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, id: string, name: string, details?: any) {
  if (!condition) {
    results.push({ id, name, passed: false, error: "Assertion failed", details });
    console.error(`[FAIL] ${id}: ${name}`, details ? JSON.stringify(details) : "");
  } else {
    results.push({ id, name, passed: true });
    console.log(`[PASS] ${id}: ${name}`);
  }
}

async function httpRequest(
  url: string,
  options: {
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; body: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (bodyStr) {
      reqHeaders["content-type"] = "application/json";
      reqHeaders["content-length"] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsedBody: any;
          try {
            parsedBody = JSON.parse(raw);
          } catch {
            parsedBody = raw;
          }
          resolve({ status: res.statusCode || 0, body: parsedBody, rawBody: raw });
        });
      }
    );

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runEmpiricalStressTests() {
  console.log("================================================================================");
  console.log("    CHALLENGER 1 — EMPIRICAL STRESS TEST SUITE (ITERATION 2 REWORK)");
  console.log("================================================================================");

  const mockGateway = new MockCashfreeGateway();
  const { baseUrl } = await mockGateway.start();
  console.log(`[INIT] Mock Gateway listening at ${baseUrl}`);

  try {
    // =========================================================================
    // PART 1: MOCK CASHFREE SERVER AUTH & HEADER ENFORCEMENT
    // =========================================================================
    console.log("\n--- PART 1: Mock Cashfree Server Auth & Header Enforcement ---");

    const sampleOrderBody = {
      order_id: `stress_ord_${Date.now()}`,
      order_amount: 100.0,
      order_currency: "INR",
      customer_details: {
        customer_id: "cust_stress_1",
        customer_phone: "+919999988888",
        customer_name: "Stress Tester",
      },
    };

    // 1.1 POST /orders without any headers -> assert returns 401
    const noHeadersPostOrders = await httpRequest(`${baseUrl}/orders`, {
      method: "POST",
      body: sampleOrderBody,
    });
    assert(
      noHeadersPostOrders.status === 401 && noHeadersPostOrders.body?.code === "authentication_failed",
      "AUTH-01",
      "POST /orders without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersPostOrders.status, body: noHeadersPostOrders.body }
    );

    // 1.2 POST /pg/orders without any headers -> assert returns 401
    const noHeadersPostPgOrders = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      body: sampleOrderBody,
    });
    assert(
      noHeadersPostPgOrders.status === 401 && noHeadersPostPgOrders.body?.code === "authentication_failed",
      "AUTH-02",
      "POST /pg/orders without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersPostPgOrders.status, body: noHeadersPostPgOrders.body }
    );

    // 1.3 GET /orders/:id without headers -> assert returns 401
    const noHeadersGetOrder = await httpRequest(`${baseUrl}/orders/test_ord_1`, {
      method: "GET",
    });
    assert(
      noHeadersGetOrder.status === 401 && noHeadersGetOrder.body?.code === "authentication_failed",
      "AUTH-03",
      "GET /orders/:id without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersGetOrder.status, body: noHeadersGetOrder.body }
    );

    // 1.4 GET /pg/orders/:id without headers -> assert returns 401
    const noHeadersGetPgOrder = await httpRequest(`${baseUrl}/pg/orders/test_ord_1`, {
      method: "GET",
    });
    assert(
      noHeadersGetPgOrder.status === 401 && noHeadersGetPgOrder.body?.code === "authentication_failed",
      "AUTH-04",
      "GET /pg/orders/:id without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersGetPgOrder.status, body: noHeadersGetPgOrder.body }
    );

    // 1.5 GET /orders/:id/payments without headers -> assert returns 401
    const noHeadersGetPayments = await httpRequest(`${baseUrl}/orders/test_ord_1/payments`, {
      method: "GET",
    });
    assert(
      noHeadersGetPayments.status === 401 && noHeadersGetPayments.body?.code === "authentication_failed",
      "AUTH-05",
      "GET /orders/:id/payments without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersGetPayments.status, body: noHeadersGetPayments.body }
    );

    // 1.6 GET /pg/orders/:id/payments without headers -> assert returns 401
    const noHeadersGetPgPayments = await httpRequest(`${baseUrl}/pg/orders/test_ord_1/payments`, {
      method: "GET",
    });
    assert(
      noHeadersGetPgPayments.status === 401 && noHeadersGetPgPayments.body?.code === "authentication_failed",
      "AUTH-06",
      "GET /pg/orders/:id/payments without headers returns HTTP 401 and authentication_failed code",
      { status: noHeadersGetPgPayments.status, body: noHeadersGetPgPayments.body }
    );

    // 1.7 Request with invalid client secret -> assert returns 401
    const invalidSecretReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": "wrong_secret_attack",
        "x-api-version": "2023-08-01",
      },
      body: sampleOrderBody,
    });
    assert(
      invalidSecretReq.status === 401 && invalidSecretReq.body?.code === "authentication_failed",
      "AUTH-07",
      "POST /pg/orders with invalid x-client-secret returns HTTP 401",
      { status: invalidSecretReq.status, body: invalidSecretReq.body }
    );

    // 1.8 Request with invalid client id -> assert returns 401
    const invalidClientIdReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": "wrong_client_id_attack",
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2023-08-01",
      },
      body: sampleOrderBody,
    });
    assert(
      invalidClientIdReq.status === 401 && invalidClientIdReq.body?.code === "authentication_failed",
      "AUTH-08",
      "POST /pg/orders with invalid x-client-id returns HTTP 401",
      { status: invalidClientIdReq.status, body: invalidClientIdReq.body }
    );

    // 1.9 Request with missing x-api-version -> assert returns 400
    const missingVersionReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
      },
      body: sampleOrderBody,
    });
    assert(
      missingVersionReq.status === 400 && missingVersionReq.body?.code === "api_version_missing",
      "AUTH-09",
      "POST /pg/orders with missing x-api-version returns HTTP 400 and api_version_missing code",
      { status: missingVersionReq.status, body: missingVersionReq.body }
    );

    // 1.10 Request with outdated x-api-version (e.g. 2022-09-01) -> assert returns 400
    const wrongVersionReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2022-09-01",
      },
      body: sampleOrderBody,
    });
    assert(
      wrongVersionReq.status === 400 && wrongVersionReq.body?.code === "api_version_missing",
      "AUTH-10",
      "POST /pg/orders with outdated x-api-version returns HTTP 400",
      { status: wrongVersionReq.status, body: wrongVersionReq.body }
    );

    // 1.11 Request with valid credentials -> assert returns 200
    const validReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2023-08-01",
      },
      body: sampleOrderBody,
    });
    assert(
      validReq.status === 200 &&
        validReq.body?.order_id === sampleOrderBody.order_id &&
        typeof validReq.body?.payment_session_id === "string" &&
        validReq.body?.order_status === "ACTIVE",
      "AUTH-11",
      "POST /pg/orders with valid credentials returns HTTP 200 with active session",
      { status: validReq.status, order_id: validReq.body?.order_id }
    );

    // 1.12 GET /pg/orders/:id with valid credentials -> assert returns 200
    const validGetReq = await httpRequest(`${baseUrl}/pg/orders/${sampleOrderBody.order_id}`, {
      method: "GET",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2023-08-01",
      },
    });
    assert(
      validGetReq.status === 200 && validGetReq.body?.order_id === sampleOrderBody.order_id,
      "AUTH-12",
      "GET /pg/orders/:id with valid credentials returns HTTP 200 with order details",
      { status: validGetReq.status }
    );

    // 1.13 Boundary Check: order_amount < 1.00 INR -> assert returns 400
    const lowAmountReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2023-08-01",
      },
      body: {
        ...sampleOrderBody,
        order_id: `low_amt_${Date.now()}`,
        order_amount: 0.5,
      },
    });
    assert(
      lowAmountReq.status === 400 && lowAmountReq.body?.code === "invalid_order_amount",
      "AUTH-13",
      "POST /pg/orders with amount < 1.00 INR returns HTTP 400 invalid_order_amount",
      { status: lowAmountReq.status, body: lowAmountReq.body }
    );

    // 1.14 Boundary Check: invalid currency -> assert returns 400
    const invalidCurrencyReq = await httpRequest(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "x-client-id": mockGateway.clientId,
        "x-client-secret": mockGateway.secretKey,
        "x-api-version": "2023-08-01",
      },
      body: {
        ...sampleOrderBody,
        order_id: `curr_${Date.now()}`,
        order_currency: "USD",
      },
    });
    assert(
      invalidCurrencyReq.status === 400 && invalidCurrencyReq.body?.code === "invalid_order_currency",
      "AUTH-14",
      "POST /pg/orders with non-INR currency returns HTTP 400 invalid_order_currency",
      { status: invalidCurrencyReq.status, body: invalidCurrencyReq.body }
    );

    // =========================================================================
    // PART 2: EMERGENCY CLEANUP ORPHAN FIXTURES EMPIRICAL STRESS TEST
    // =========================================================================
    console.log("\n--- PART 2: Emergency Cleanup Orphan Fixtures Empirical Stress Test ---");

    // 2.1 Seed intentional orphan fixtures:
    // - 2 Cashfree test customers
    // - 2 INV-CF-* invoices
    // - Associated payments and payment attempts
    // - 1 Admin Test user
    const f1 = await createTestCustomerFixture({ name: "Cashfree Orphan Test 1", balanceDue: 1500 });
    const f2 = await createTestCustomerFixture({ name: "Cashfree Orphan Test 2", balanceDue: 2500 });
    const adminFixture = await createAdminFixture();

    // Create payment attempts
    await db.insert(paymentAttemptsTable).values({
      attemptId: `cwp_att_orphan_${Date.now()}_1`,
      cfOrderId: `cf_ord_orphan_${Date.now()}_1`,
      customerId: f1.customerId,
      invoiceId: f1.invoiceId,
      amount: "1500.00",
      currency: "INR",
      status: "initiated",
      idempotencyKey: `idem_orphan_${Date.now()}_1`,
    });

    await db.insert(paymentAttemptsTable).values({
      attemptId: `cwp_att_orphan_${Date.now()}_2`,
      cfOrderId: `cf_ord_orphan_${Date.now()}_2`,
      customerId: f2.customerId,
      invoiceId: f2.invoiceId,
      amount: "2500.00",
      currency: "INR",
      status: "paid",
      idempotencyKey: `idem_orphan_${Date.now()}_2`,
    });

    // Create a payment record
    await db.insert(paymentsTable).values({
      customerId: f2.customerId,
      invoiceId: f2.invoiceId,
      amount: "2500.00",
      method: "cashfree",
      transactionId: `cf_pay_ref_${Date.now()}`,
      notes: "Orphan test payment",
    });

    // Verify fixtures are actually present before cleanup
    const preCusts = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(sql`${customersTable.name} LIKE '%Cashfree Orphan Test%'`);
    const preInvoices = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(sql`${invoicesTable.invoiceNumber} LIKE '%INV-CF-%'`);
    const preAttempts = await db
      .select({ id: paymentAttemptsTable.id })
      .from(paymentAttemptsTable)
      .where(sql`${paymentAttemptsTable.attemptId} LIKE 'cwp_att_orphan_%'`);
    const preAdmin = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, adminFixture.userId));

    assert(
      preCusts.length >= 2 && preInvoices.length >= 2 && preAttempts.length >= 2 && preAdmin.length >= 1,
      "CLEANUP-01",
      "Intentional orphan fixtures successfully created and verified in database",
      { custs: preCusts.length, invs: preInvoices.length, attempts: preAttempts.length, admin: preAdmin.length }
    );

    // Execute emergencyCleanupOrphanFixtures()
    await emergencyCleanupOrphanFixtures();

    // Verify all orphan fixtures are completely eradicated
    const postCusts = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(sql`${customersTable.name} LIKE '%Cashfree Orphan Test%'`);
    const postInvoices = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(sql`${invoicesTable.id} IN (${f1.invoiceId}, ${f2.invoiceId})`);
    const postAttempts = await db
      .select({ id: paymentAttemptsTable.id })
      .from(paymentAttemptsTable)
      .where(sql`${paymentAttemptsTable.attemptId} LIKE 'cwp_att_orphan_%'`);
    const postAdmin = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, adminFixture.userId));
    const postSessions = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(sql`${sessionsTable.userId} IN (${f1.userId}, ${f2.userId}, ${adminFixture.userId})`);

    assert(
      postCusts.length === 0,
      "CLEANUP-02",
      "emergencyCleanupOrphanFixtures() eradicated all orphan Cashfree customers",
      { remaining: postCusts.length }
    );
    assert(
      postInvoices.length === 0,
      "CLEANUP-03",
      "emergencyCleanupOrphanFixtures() eradicated all orphan INV-CF invoices",
      { remaining: postInvoices.length }
    );
    assert(
      postAttempts.length === 0,
      "CLEANUP-04",
      "emergencyCleanupOrphanFixtures() eradicated all orphan payment attempts",
      { remaining: postAttempts.length }
    );
    assert(
      postAdmin.length === 0,
      "CLEANUP-05",
      "emergencyCleanupOrphanFixtures() eradicated all orphan admin test users",
      { remaining: postAdmin.length }
    );
    assert(
      postSessions.length === 0,
      "CLEANUP-06",
      "emergencyCleanupOrphanFixtures() eradicated all associated sessions",
      { remaining: postSessions.length }
    );

    // 2.2 Idempotency test: Run emergencyCleanupOrphanFixtures() again when DB is clean
    let idempotentError: any = null;
    try {
      await emergencyCleanupOrphanFixtures();
    } catch (e) {
      idempotentError = e;
    }
    assert(
      idempotentError === null,
      "CLEANUP-07",
      "emergencyCleanupOrphanFixtures() runs cleanly and idempotently on empty/already clean DB",
      { error: idempotentError?.message }
    );

  } finally {
    await mockGateway.stop();
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n================================================================================");
  console.log("                       STRESS TEST RESULTS SUMMARY");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`TOTAL ASSERTIONS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    console.error(`[FAIL] ${failed} stress tests failed!`);
    process.exit(1);
  } else {
    console.log("[SUCCESS] All 21 empirical stress tests passed with 100% fidelity!");
    process.exit(0);
  }
}

runEmpiricalStressTests().catch((err) => {
  console.error("Top-level empirical runner error:", err);
  process.exit(1);
});
