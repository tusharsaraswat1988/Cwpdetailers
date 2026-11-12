import "./harness/loadEnv";

import { MockCashfreeGateway } from "./harness/mockCashfreeServer";
import { TestClient } from "./harness/testClient";
import {
  createTestCustomerFixture,
  createAdditionalInvoice,
  cleanupCustomerFixture,
  createAdminFixture,
  cleanupAdminFixture,
  getPaymentAttempts,
} from "./harness/dbHelpers";
import { db, invoicesTable, paymentAttemptsTable, customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { recordPayment, syncCustomerTotalDues } from "../../src/lib/billing/invoiceService";

interface TestOutcome {
  id: string;
  name: string;
  passed: boolean;
  bugReported?: string;
  details?: string;
}

const outcomes: TestOutcome[] = [];

function recordResult(test: TestOutcome) {
  outcomes.push(test);
  const statusStr = test.passed ? "[PASS]" : "[FAIL - BUG DETECTED]";
  console.log(`${statusStr} ${test.id}: ${test.name}`);
  if (!test.passed && test.bugReported) {
    console.log(`       >>> BUG: ${test.bugReported}`);
  }
  if (test.details) {
    console.log(`       >>> Details: ${test.details}`);
  }
}

async function runChallengerStressTests() {
  console.log("================================================================================");
  console.log("    M2 EMPIRICAL CHALLENGER: ADVERSARIAL STRESS HARNESS");
  console.log("================================================================================\n");

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

  let customerA: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;
  let customerB: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;
  let admin: Awaited<ReturnType<typeof createAdminFixture>> | null = null;

  try {
    customerA = await createTestCustomerFixture({ balanceDue: 2500.0 });
    customerB = await createTestCustomerFixture({ balanceDue: 1800.0 });
    admin = await createAdminFixture();

    // =========================================================================
    // 1. AMOUNT TAMPERING ATTACKS
    // =========================================================================
    console.log("\n--- Category 1: Amount Tampering Attacks ---");

    // 1.1: Tampered ₹1.00 amount
    {
      mockGateway.reset();
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { amount: 1.0, payableAmount: 1.0, order_amount: 1.0 },
        customerA.authHeaders
      );
      const lastReq = mockGateway.getLastRequest();
      const gatewayAmount = lastReq?.body?.order_amount;
      const respAmount = Number(res.data?.orderAmount);

      const isSecure =
        res.status === 200 &&
        respAmount === 2500.0 &&
        gatewayAmount === 2500.0;

      recordResult({
        id: "CHALLENGE-AMT-01",
        name: "Tampered low amount (₹1) is ignored; server enforces trusted balance (₹2500)",
        passed: isSecure,
        bugReported: isSecure ? undefined : `Server or gateway accepted tampered amount: response=${respAmount}, gateway=${gatewayAmount}`,
        details: `HTTP ${res.status}, Response Amount: ${respAmount}, Gateway Received: ${gatewayAmount}`,
      });
    }

    // 1.2: Tampered negative amount and huge amount in invoice payment
    {
      mockGateway.reset();
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: customerA.invoiceId, amount: -9999.0 },
        customerA.authHeaders
      );
      const lastReq = mockGateway.getLastRequest();
      const gatewayAmount = lastReq?.body?.order_amount;

      const isSecure = res.status === 200 && Number(res.data?.orderAmount) === 2500.0 && gatewayAmount === 2500.0;
      recordResult({
        id: "CHALLENGE-AMT-02",
        name: "Negative tampered amount ignored when paying specific invoice",
        passed: isSecure,
        details: `HTTP ${res.status}, Order Amount: ${res.data?.orderAmount}`,
      });
    }

    // =========================================================================
    // 2. AUTHENTICATION & AUTHORIZATION ENFORCEMENT
    // =========================================================================
    console.log("\n--- Category 2: Authentication & Authorization Enforcement ---");

    // 2.1: Missing token
    {
      const res = await testClient.post("/api/payments/cashfree/create-order", {});
      recordResult({
        id: "CHALLENGE-AUTH-01",
        name: "Unauthenticated request without token rejected with 401",
        passed: res.status === 401,
        details: `HTTP ${res.status}`,
      });
    }

    // 2.2: Bogus/invalid Bearer token
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        {},
        { Authorization: "Bearer bogus_invalid_token_999999" }
      );
      recordResult({
        id: "CHALLENGE-AUTH-02",
        name: "Malformed / invalid token rejected with 401",
        passed: res.status === 401,
        details: `HTTP ${res.status}`,
      });
    }

    // 2.3: Admin token attempting to initiate customer payment
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        {},
        admin.authHeaders
      );
      recordResult({
        id: "CHALLENGE-AUTH-03",
        name: "Non-customer (admin/staff) role rejected with 403 Forbidden",
        passed: res.status === 403,
        details: `HTTP ${res.status}, Error: ${res.data?.error || res.data?.message}`,
      });
    }

    // =========================================================================
    // 3. INVOICE OWNERSHIP & STATE VALIDATION
    // =========================================================================
    console.log("\n--- Category 3: Invoice Ownership & State Validation ---");

    // 3.1: Cross-customer invoice access (Customer A attempts to pay Customer B's invoice)
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: customerB.invoiceId },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-OWN-01",
        name: "Customer A cannot initiate payment for Customer B's invoice (403)",
        passed: res.status === 403 && res.data?.code === "FORBIDDEN_INVOICE_ACCESS",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // 3.2: Non-existent invoice ID
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: 88888888 },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-OWN-02",
        name: "Non-existent invoice ID rejected with 404",
        passed: res.status === 404 && res.data?.code === "INVOICE_NOT_FOUND",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // 3.3: Attempting to pay already-paid invoice
    {
      const paidInv = await createAdditionalInvoice(customerA.customerId, 500.0);
      await recordPayment({
        customerId: customerA.customerId,
        amount: 500.0,
        method: "cashfree",
        invoiceId: paidInv.invoiceId,
        transactionId: `cf_paid_challenger_${Date.now()}`,
      });

      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: paidInv.invoiceId },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-OWN-03",
        name: "Settled invoice (status: paid) rejected with 400 NO_OUTSTANDING_BALANCE",
        passed: res.status === 400 && res.data?.code === "NO_OUTSTANDING_BALANCE",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // 3.4: Attempting to pay cancelled invoice
    {
      const cancelledInv = await createAdditionalInvoice(customerA.customerId, 600.0);
      await db
        .update(invoicesTable)
        .set({ status: "cancelled" })
        .where(eq(invoicesTable.id, cancelledInv.invoiceId));
      await syncCustomerTotalDues(customerA.customerId);

      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: cancelledInv.invoiceId },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-OWN-04",
        name: "Cancelled invoice rejected with 400 NO_OUTSTANDING_BALANCE",
        passed: res.status === 400 && res.data?.code === "NO_OUTSTANDING_BALANCE",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // 3.5: Non-tax document type (credit_note)
    {
      const creditNoteInv = await createAdditionalInvoice(customerA.customerId, 750.0);
      await db
        .update(invoicesTable)
        .set({ documentType: "credit_note" })
        .where(eq(invoicesTable.id, creditNoteInv.invoiceId));

      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: creditNoteInv.invoiceId },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-OWN-05",
        name: "Non-tax invoice (credit_note) rejected with 400 NO_OUTSTANDING_BALANCE",
        passed: res.status === 400 && res.data?.code === "NO_OUTSTANDING_BALANCE",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // =========================================================================
    // 4. ZERO / NEGATIVE BALANCE & BYPASS TESTING
    // =========================================================================
    console.log("\n--- Category 4: Zero / Negative Balance & Dues Bypass ---");

    // 4.1: Customer with 0 dues and no idempotencyKey
    const zeroCust = await createTestCustomerFixture({ balanceDue: 0.0 });
    // Ensure 0 dues
    await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.customerId, zeroCust.customerId));
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        {},
        zeroCust.authHeaders
      );
      recordResult({
        id: "CHALLENGE-ZERO-01",
        name: "Customer with 0 balance rejected with 400 NO_OUTSTANDING_BALANCE",
        passed: res.status === 400 && res.data?.code === "NO_OUTSTANDING_BALANCE",
        details: `HTTP ${res.status}, Code: ${res.data?.code}`,
      });
    }

    // 4.2: ADVERSARIAL STRESS TEST: Customer with 0 dues providing an idempotencyKey
    // Did worker's "fallback to latest invoice totalAmount" create an order when customer owes ₹0?!
    {
      // Settle zeroCust's invoice or create a customer with a paid invoice and 0 balance
      const paidCust = await createTestCustomerFixture({ balanceDue: 1500.0 });
      await recordPayment({
        customerId: paidCust.customerId,
        amount: 1500.0,
        method: "cashfree",
        invoiceId: paidCust.invoiceId,
        transactionId: `cf_paid_zero_test_${Date.now()}`,
      });
      await syncCustomerTotalDues(paidCust.customerId);

      // Verify customer actually has 0 outstanding dues in DB
      const [custRow] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, paidCust.customerId));
      const currentDues = Number(custRow?.totalDues ?? 0);

      // Now customer attempts to create order passing an arbitrary new idempotency key
      const maliciousIdemKey = `exploit_idem_${Date.now()}`;
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { idempotencyKey: maliciousIdemKey },
        paidCust.authHeaders
      );

      // If res.status === 200, the system created an order for 1500 even though the customer owes 0!
      const leakedOrderCreated = res.status === 200;
      recordResult({
        id: "CHALLENGE-ZERO-02",
        name: "Zero dues customer supplying new idempotencyKey must NOT create order for old settled invoice",
        passed: !leakedOrderCreated && res.status === 400,
        bugReported: leakedOrderCreated
          ? `CRITICAL BUG: Zero dues customer successfully created order ${res.data?.orderId} for ₹${res.data?.orderAmount} using idempotencyKey bypass!`
          : undefined,
        details: `Dues in DB: ${currentDues}, HTTP: ${res.status}, OrderAmount: ${res.data?.orderAmount || "none"}`,
      });

      await cleanupCustomerFixture(paidCust);
    }

    await cleanupCustomerFixture(zeroCust);

    // =========================================================================
    // 5. CROSS-TENANT IDEMPOTENCY KEY HIJACKING
    // =========================================================================
    console.log("\n--- Category 5: Cross-Tenant Idempotency Key Hijacking ---");

    // 5.1: Customer B supplies Customer A's idempotency key
    {
      const sharedKey = `shared_key_${Date.now()}`;
      // Customer A initiates order
      const resA = await testClient.post(
        "/api/payments/cashfree/create-order",
        { idempotencyKey: sharedKey },
        customerA.authHeaders
      );

      // Now Customer B attempts to create order using Customer A's key
      const resB = await testClient.post(
        "/api/payments/cashfree/create-order",
        { idempotencyKey: sharedKey },
        customerB.authHeaders
      );

      // If Customer B got Customer A's session, that is a cross-tenant leak!
      const hijacked =
        resB.status === 200 &&
        resB.data?.orderId === resA.data?.orderId;

      recordResult({
        id: "CHALLENGE-IDEM-01",
        name: "Customer B supplying Customer A's idempotency key must NOT hijack Customer A's order/session",
        passed: !hijacked,
        bugReported: hijacked
          ? `SECURITY VULNERABILITY: Customer B hijacked Customer A's orderId (${resA.data?.orderId}) and payment session via shared idempotency key!`
          : undefined,
        details: `Customer A OrderId: ${resA.data?.orderId}, Customer B OrderId: ${resB.data?.orderId}, Customer B Status: ${resB.status}`,
      });
    }

    // =========================================================================
    // 6. MALFORMED INPUT FUZZING & INJECTION
    // =========================================================================
    console.log("\n--- Category 6: Input Fuzzing & Injection ---");

    // 6.1: Non-numeric invoiceId string
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: "not-a-number" },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-FUZZ-01",
        name: "Non-numeric invoiceId string gracefully rejected without 500 crash",
        passed: res.status !== 500,
        details: `HTTP ${res.status}, Body: ${JSON.stringify(res.data)}`,
      });
    }

    // 6.2: Negative invoiceId
    {
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: -999 },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-FUZZ-02",
        name: "Negative invoiceId rejected with 404",
        passed: res.status === 404,
        details: `HTTP ${res.status}`,
      });
    }

    // 6.3: SQL Injection string in returnUrl & idempotencyKey
    {
      const sqlInj = "'; DROP TABLE payment_attempts; --";
      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        {
          idempotencyKey: `safe_${Date.now()}_${sqlInj.replace(/[\s;'-]/g, "_")}`,
          returnUrl: `http://127.0.0.1/customer/payment/return?q=${encodeURIComponent(sqlInj)}`,
        },
        customerA.authHeaders
      );
      recordResult({
        id: "CHALLENGE-FUZZ-03",
        name: "SQL injection payload handled safely via parameterized queries",
        passed: res.status === 200 || res.status === 400,
        details: `HTTP ${res.status}`,
      });
    }

    // =========================================================================
    // 7. HIGH-CONCURRENCY RACE CONDITIONS
    // =========================================================================
    console.log("\n--- Category 7: High-Concurrency Stress ---");

    // 7.1: 8 simultaneous parallel requests with identical idempotencyKey
    {
      const parallelKey = `burst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const promises = Array.from({ length: 8 }).map(() =>
        testClient.post(
          "/api/payments/cashfree/create-order",
          { idempotencyKey: parallelKey },
          customerA.authHeaders
        )
      );

      const responses = await Promise.all(promises);
      const all200 = responses.every((r) => r.status === 200);
      const orderIds = new Set(responses.map((r) => r.data?.orderId));
      const sessionIds = new Set(responses.map((r) => r.data?.paymentSessionId));

      const exactlyOneOrder = orderIds.size === 1 && sessionIds.size === 1;

      recordResult({
        id: "CHALLENGE-CONCUR-01",
        name: "8 concurrent requests with identical idempotencyKey resolve to identical order/session",
        passed: all200 && exactlyOneOrder,
        details: `All 200: ${all200}, Distinct OrderIds: ${orderIds.size}, Distinct Sessions: ${sessionIds.size}`,
      });
    }

    // =========================================================================
    // 8. GATEWAY OUTAGE & TIMEOUT RESILIENCE
    // =========================================================================
    console.log("\n--- Category 8: Gateway Error Handling ---");

    // 8.1: Gateway responds with 500 Internal Server Error
    {
      mockGateway.addSimulationRule({
        method: "POST",
        endpoint: "/orders",
        status: 500,
        responseBody: {
          message: "Cashfree PG Service Temporarily Unavailable",
          code: "service_unavailable",
          type: "api_error",
        },
        times: 1,
      });

      const res = await testClient.post(
        "/api/payments/cashfree/create-order",
        { idempotencyKey: `gw_err_${Date.now()}` },
        customerA.authHeaders
      );

      // Verify that backend marks the attempt status 'failed'
      const [failedAttempt] = await db
        .select()
        .from(paymentAttemptsTable)
        .where(eq(paymentAttemptsTable.customerId, customerA.customerId))
        .orderBy(desc(paymentAttemptsTable.createdAt))
        .limit(1);

      const statusRecorded = failedAttempt?.status === "failed";

      recordResult({
        id: "CHALLENGE-GW-01",
        name: "Gateway 500 error gracefully caught and attempt marked 'failed'",
        passed: res.status >= 500 && statusRecorded,
        details: `HTTP ${res.status}, Attempt Status in DB: ${failedAttempt?.status}`,
      });
    }

  } finally {
    // Teardown
    if (customerA) await cleanupCustomerFixture(customerA);
    if (customerB) await cleanupCustomerFixture(customerB);
    if (admin) await cleanupAdminFixture(admin);
    await testClient.stop();
    await mockGateway.stop();
  }

  // Summary
  console.log("\n================================================================================");
  console.log("                       CHALLENGER RESULTS SUMMARY");
  console.log("================================================================================");
  const total = outcomes.length;
  const passed = outcomes.filter((o) => o.passed).length;
  const failed = outcomes.filter((o) => !o.passed).length;

  console.log(`Total Adversarial Tests: ${total}`);
  console.log(`Passed:                  ${passed}`);
  console.log(`Failed / Bugs Found:     ${failed}`);

  if (failed > 0) {
    console.log("\nCRITICAL FINDINGS:");
    for (const f of outcomes.filter((o) => !o.passed)) {
      console.log(`- [${f.id}] ${f.name}`);
      if (f.bugReported) console.log(`  Reason: ${f.bugReported}`);
    }
  }
  console.log("================================================================================\n");

  return failed;
}

runChallengerStressTests()
  .then((failedCount) => {
    process.exit(failedCount > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Test execution aborted with fatal error:", err);
    process.exit(2);
  });
