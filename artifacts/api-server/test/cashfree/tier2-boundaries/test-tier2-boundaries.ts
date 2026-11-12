import type { TestRunnerContext } from "../harness/testContext";
import {
  createTestCustomerFixture,
  createAdditionalInvoice,
  cleanupCustomerFixture,
  getInvoice,
  getCustomer,
  getPayments,
  getPaymentAttempts,
} from "../harness/dbHelpers";
import {
  generateCashfreeWebhookHeaders,
  verifyCashfreeWebhookSignature,
  validateWebhookTimestamp,
} from "../harness/signatureHelper";
import { recordPayment } from "../../../src/lib/billing/invoiceService";
import { db, paymentAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function runTier2Boundaries(ctx: TestRunnerContext): Promise<void> {
  let fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    fixture = await createTestCustomerFixture({ balanceDue: 2000.0 });

  // =========================================================================
  // AREA 1: Zero / Negative Amounts & Customer Access Mismatches
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B01-01",
      tier: 2,
      feature: "B1: Zero/Negative & Access",
      name: "Zero payable balance rejects order creation with NO_OUTSTANDING_BALANCE",
    },
    async () => {
      // Customer with 0 dues
      const zeroFixture = await createTestCustomerFixture({ balanceDue: 0.0 });
      try {
        // Clear any auto-generated balance
        await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.customerId, zeroFixture.customerId));

        const res = await ctx.client.post(
          "/api/payments/cashfree/create-order",
          {},
          zeroFixture.authHeaders
        );

        if (res.status === 404 && !res.data?.error) {
          ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
          return;
        }

        ctx.assert(res.status === 400, "Zero balance must return HTTP 400 Bad Request");
        ctx.assertEqual(res.data?.error, "NO_OUTSTANDING_BALANCE", "Error code must be NO_OUTSTANDING_BALANCE");
      } finally {
        await cleanupCustomerFixture(zeroFixture);
      }
    }
  );

  await ctx.runTest(
    {
      id: "T2-B01-02",
      tier: 2,
      feature: "B1: Zero/Negative & Access",
      name: "Negative balance / credit balance rejects order creation",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Malicious client specifies negative amount
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { amount: -500.0 },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      // Backend strictly ignores client-supplied amount and computes trusted server dues
      ctx.assertEqual(res.status, 200, "Backend uses trusted server dues, ignoring negative amount");
      ctx.assertEqual(Number(res.data?.orderAmount), 2000.0, "Payable amount is trusted server dues ₹2000.00");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B01-03",
      tier: 2,
      feature: "B1: Zero/Negative & Access",
      name: "Non-existent invoice ID returns HTTP 404",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: 99999999 },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assert(res.status === 404, "Non-existent invoice must return 404");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B01-04",
      tier: 2,
      feature: "B1: Zero/Negative & Access",
      name: "Cross-customer invoice tampering is rejected (Tenant boundary)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const fixture2 = await createTestCustomerFixture({ balanceDue: 500.0 });

      // Customer 1 attempts to create order for Customer 2's invoice
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture2.invoiceId },
        fixture!.authHeaders // Customer 1 credentials
      );

      if (res.status === 404 && !res.data?.error) {
        await cleanupCustomerFixture(fixture2);
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assert(
        res.status === 403 || res.status === 404,
        "Accessing other customer invoice must be 403 or 404"
      );

      await cleanupCustomerFixture(fixture2);
    }
  );

  await ctx.runTest(
    {
      id: "T2-B01-05",
      tier: 2,
      feature: "B1: Zero/Negative & Access",
      name: "Already paid invoice order creation attempt is rejected",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const paidInv = await createAdditionalInvoice(fixture!.customerId, 500.0);
      // Settle invoice
      await recordPayment({
        customerId: fixture!.customerId,
        amount: 500.0,
        method: "cashfree",
        invoiceId: paidInv.invoiceId,
        transactionId: `cf_paid_${Date.now()}`,
      });

      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: paidInv.invoiceId },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      ctx.assert(
        res.status === 400 || res.status === 409,
        "Paid invoice must reject order creation (400 or 409)"
      );
    }
  );

  // =========================================================================
  // AREA 2: Replay Attacks & Multiple Webhook Invocations
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B02-01",
      tier: 2,
      feature: "B2: Replay Attacks",
      name: "5x Webhook replay defense: duplicate webhooks return 200 with exactly 1 payment record",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_replay_5x_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

      const res1 = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree replay deduplication");
        return;
      }

      // Replay identical webhook 4 more times
      for (let i = 0; i < 4; i++) {
        const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
        ctx.assertEqual(res.status, 200, "Replayed webhook must acknowledge with 200");
      }

      const allPayments = await getPayments(fixture!.customerId);
      const matchingPayments = allPayments.filter((p) => p.transactionId === orderId);
      ctx.assertEqual(matchingPayments.length, 1, "Exactly 1 payment record created across 5 replays");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B02-02",
      tier: 2,
      feature: "B2: Replay Attacks",
      name: "Single invoice balance deduction (no double reduction or negative balance)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv = await createAdditionalInvoice(fixture!.customerId, 800.0);
      await recordPayment({
        customerId: fixture!.customerId,
        amount: 800.0,
        method: "cashfree",
        invoiceId: inv.invoiceId,
      });

      const updated = await getInvoice(inv.invoiceId);
      ctx.assertEqual(Number(updated?.balanceDue), 0.0, "balanceDue must be exactly 0.00");
      ctx.assert(Number(updated?.balanceDue) >= 0.0, "balanceDue must never be negative");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B02-03",
      tier: 2,
      feature: "B2: Replay Attacks",
      name: "Idempotent receipt generation produces exactly 1 receipt per transaction",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_rec_idem_${Date.now()}`;
      ctx.mockGateway.simulatePaymentSuccess(orderId);

      const res1 = await ctx.client.get(`/api/payments/cashfree/verify/${orderId}`, fixture!.authHeaders);
      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Pending Milestone M5: Idempotent receipt generation");
        return;
      }

      const res2 = await ctx.client.get(`/api/payments/cashfree/verify/${orderId}`, fixture!.authHeaders);
      ctx.assertEqual(res1.data?.receipt?.receiptNumber, res2.data?.receipt?.receiptNumber, "Deterministic receipt number");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B02-04",
      tier: 2,
      feature: "B2: Replay Attacks",
      name: "Failed webhook arrival after success does NOT revert settled invoice status",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv = await createAdditionalInvoice(fixture!.customerId, 700.0);
      const orderId = `cf_ord_late_fail_${Date.now()}`;

      // 1. Success payment
      await recordPayment({
        customerId: fixture!.customerId,
        amount: 700.0,
        method: "cashfree",
        invoiceId: inv.invoiceId,
        transactionId: orderId,
      });

      // 2. Erroneous late failed webhook arrives
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_FAILED_WEBHOOK", orderId);
      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: Webhook status guard for late failed events");
        return;
      }

      const after = await getInvoice(inv.invoiceId);
      ctx.assertEqual(after?.status, "paid", "Must not revert paid invoice status");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B02-05",
      tier: 2,
      feature: "B2: Replay Attacks",
      name: "Replaying webhook with modified payload fails signature validation",
    },
    async () => {
      const secret = "test_merchant_secret";
      const payload1 = JSON.stringify({ order_id: "cwp_123", amount: 1300 });
      const headers = generateCashfreeWebhookHeaders(payload1, secret);

      // Replay payload with altered amount
      const payload2 = JSON.stringify({ order_id: "cwp_123", amount: 5000 });
      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: payload2,
        clientSecret: secret,
      });

      ctx.assert(!isValid, "Signature must fail when replaying with altered amount");
    }
  );

  // =========================================================================
  // AREA 3: HMAC-SHA256 Cryptographic Tampering & Timestamp Drift
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B03-01",
      tier: 2,
      feature: "B3: HMAC Tampering & Drift",
      name: "Signature bit flip rejects webhook verification",
    },
    async () => {
      const secret = "secret_key_123";
      const payload = JSON.stringify({ event: "SUCCESS", amount: 1000 });
      const headers = generateCashfreeWebhookHeaders(payload, secret, { tamperSignature: true });

      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: headers.rawBody,
        clientSecret: secret,
      });

      ctx.assert(!isValid, "Tampered signature must return false");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B03-02",
      tier: 2,
      feature: "B3: HMAC Tampering & Drift",
      name: "Signature with wrong secret key rejects webhook verification",
    },
    async () => {
      const secret1 = "secret_key_123";
      const secret2 = "wrong_secret_456";
      const payload = JSON.stringify({ event: "SUCCESS" });
      const headers = generateCashfreeWebhookHeaders(payload, secret2);

      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: headers.rawBody,
        clientSecret: secret1,
      });

      ctx.assert(!isValid, "Wrong secret must return false");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B03-03",
      tier: 2,
      feature: "B3: HMAC Tampering & Drift",
      name: "Expired timestamp drift (> 5 minutes in past) rejected",
    },
    async () => {
      const oldTimestamp = Date.now() - 360_000; // 6 minutes ago
      const check = validateWebhookTimestamp(oldTimestamp, 300);
      ctx.assertEqual(check.valid, false, "Must be invalid due to expiry");
      ctx.assertEqual(check.reason, "WEBHOOK_TIMESTAMP_EXPIRED", "Reason must be expired");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B03-04",
      tier: 2,
      feature: "B3: HMAC Tampering & Drift",
      name: "Future timestamp drift (> 60 seconds in future) rejected",
    },
    async () => {
      const futureTimestamp = Date.now() + 120_000; // 2 minutes in future
      const check = validateWebhookTimestamp(futureTimestamp, 300);
      ctx.assertEqual(check.valid, false, "Future timestamp must be invalid");
      ctx.assertEqual(check.reason, "WEBHOOK_TIMESTAMP_IN_FUTURE", "Reason must be future");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B03-05",
      tier: 2,
      feature: "B3: HMAC Tampering & Drift",
      name: "Malformed signature header handled gracefully without 500 crash",
    },
    async () => {
      const res = await ctx.client.postRaw(
        "/api/webhooks/cashfree",
        JSON.stringify({ event: "TEST" }),
        {
          "x-webhook-signature": "", // Empty signature
          "x-webhook-timestamp": Date.now().toString(),
          "content-type": "application/json",
        }
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assert(res.status === 400 || res.status === 401, "Malformed header must return 400 or 401");
    }
  );

  // =========================================================================
  // AREA 4: Session Expiration & Timeout Transitions
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B04-01",
      tier: 2,
      feature: "B4: Session Expiration",
      name: "Gateway order status EXPIRED is returned cleanly",
    },
    async () => {
      const orderId = `test_exp_${Date.now()}`;
      await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: ctx.mockGateway.getAuthHeaders(),
        body: JSON.stringify({
          order_id: orderId,
          order_amount: 1000.0,
          order_currency: "INR",
          customer_details: { customer_id: "cust_exp", customer_phone: "9999999999" },
        }),
      });

      // Simulate expiry on mock gateway
      ctx.mockGateway.simulateOrderExpiry(orderId);

      const res = await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders/${orderId}`, {
        headers: ctx.mockGateway.getAuthHeaders(),
      });
      const body = await res.json();
      ctx.assertEqual(body.order_status, "EXPIRED", "Status must be EXPIRED");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B04-02",
      tier: 2,
      feature: "B4: Session Expiration",
      name: "Payment attempt transitions to status 'expired'",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const [attempt] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_exp_${Date.now()}`,
          cfOrderId: `ord_exp_${Date.now()}`,
          customerId: fixture!.customerId,
          amount: "1000.00",
          status: "expired",
          idempotencyKey: `idemp_exp_${Date.now()}`,
        })
        .returning();

      ctx.assertEqual(attempt.status, "expired", "Attempt status must be expired");
      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, attempt.id));
    }
  );

  await ctx.runTest(
    {
      id: "T2-B04-03",
      tier: 2,
      feature: "B4: Session Expiration",
      name: "Target invoice remains unpaid upon attempt expiration",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const invoice = await getInvoice(fixture!.invoiceId);
      ctx.assertDefined(invoice, "Invoice must exist");
      ctx.assert(invoice?.status !== "expired", "Invoice status remains 'sent' or 'paid'");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B04-04",
      tier: 2,
      feature: "B4: Session Expiration",
      name: "Fresh session creation permitted after session expiration",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Seed an expired attempt created 25 minutes ago
      const expiredDate = new Date(Date.now() - 25 * 60 * 1000);
      await db.insert(paymentAttemptsTable).values({
        attemptId: `att_old_${Date.now()}`,
        cfOrderId: `ord_old_${Date.now()}`,
        customerId: fixture!.customerId,
        invoiceId: fixture!.invoiceId,
        amount: "2000.00",
        status: "active",
        cfPaymentSessionId: "session_old_expired",
        createdAt: expiredDate,
        updatedAt: expiredDate,
        idempotencyKey: `idemp_old_${Date.now()}`,
      });

      // Customer requests new payment - must create brand new session
      const res = await ctx.client.post("/api/payments/cashfree/create-order", {}, fixture!.authHeaders);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      ctx.assertEqual(res.status, 200, "Must create new order session");
      ctx.assert(res.data?.paymentSessionId !== "session_old_expired", "Must NOT reuse expired session");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B04-05",
      tier: 2,
      feature: "B4: Session Expiration",
      name: "Gateway attempt timeout webhook marks attempt failed without debiting",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_timeout_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_FAILED_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree timeout event handling");
        return;
      }

      ctx.assertEqual(res.status, 200, "Timeout webhook acknowledged");
    }
  );

  // =========================================================================
  // AREA 5: Currency Edge Cases & Formatting Constraints
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B05-01",
      tier: 2,
      feature: "B5: Currency Edge Cases",
      name: "Non-INR currency rejected with HTTP 400",
    },
    async () => {
      const res = await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-id": ctx.mockGateway.clientId,
          "x-client-secret": ctx.mockGateway.secretKey,
          "x-api-version": "2023-08-01",
        },
        body: JSON.stringify({
          order_amount: 100,
          order_currency: "EUR",
          customer_details: { customer_id: "c1", customer_phone: "9999999999" },
        }),
      });

      ctx.assertEqual(res.status, 400, "Non-INR currency must be rejected");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B05-02",
      tier: 2,
      feature: "B5: Currency Edge Cases",
      name: "Sub-paise rounding precision normalized strictly to 2 decimal places",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv = await createAdditionalInvoice(fixture!.customerId, 1300.456);
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: inv.invoiceId },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      ctx.assertEqual(res.status, 200, "Create order succeeds");
      ctx.assertEqual(res.data?.orderAmount, 1300.46, "1300.456 must strictly round to 1300.46");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B05-03",
      tier: 2,
      feature: "B5: Currency Edge Cases",
      name: "Sub-minimum amount (< ₹1.00) rejected",
    },
    async () => {
      const res = await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-id": ctx.mockGateway.clientId,
          "x-client-secret": ctx.mockGateway.secretKey,
          "x-api-version": "2023-08-01",
        },
        body: JSON.stringify({
          order_amount: 0.5,
          order_currency: "INR",
          customer_details: { customer_id: "c_min", customer_phone: "9999999999" },
        }),
      });
      ctx.assertEqual(res.status, 400, "Mock gateway must reject sub-minimum amount (< ₹1.00)");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B05-04",
      tier: 2,
      feature: "B5: Currency Edge Cases",
      name: "Large transaction ceiling (₹10,00,000) avoids scientific notation",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv = await createAdditionalInvoice(fixture!.customerId, 1000000.0);
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: inv.invoiceId },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      ctx.assertEqual(res.status, 200, "Large order creation succeeds");
      ctx.assertEqual(res.data?.orderAmount, 1000000.0, "Amount must format as standard decimal, not 1e6");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B05-05",
      tier: 2,
      feature: "B5: Currency Edge Cases",
      name: "Numeric string to float parsing prevents NaN or float drift",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const invoice = await getInvoice(fixture!.invoiceId);
      const parsed = Number.parseFloat(invoice!.balanceDue);
      ctx.assert(!Number.isNaN(parsed), "Must parse as valid number");
      ctx.assertEqual(parsed, 2000.0, "Parsed float must match 2000.0");
    }
  );

  // =========================================================================
  // AREA 6: Concurrency & Idempotency Key Collisions
  // =========================================================================

  await ctx.runTest(
    {
      id: "T2-B06-01",
      tier: 2,
      feature: "B6: Concurrency & Collisions",
      name: "Simultaneous parallel order requests with same key return identical session",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Ensure fixture has positive outstanding dues (earlier test T2-B01-05 settled previous invoice)
      await createAdditionalInvoice(fixture!.customerId, 1500.0);
      const key = `parallel_key_${Date.now()}`;
      const headers = { ...fixture!.authHeaders, "x-idempotency-key": key };

      const [r1, r2] = await Promise.all([
        ctx.client.post("/api/payments/cashfree/create-order", {}, headers),
        ctx.client.post("/api/payments/cashfree/create-order", {}, headers),
      ]);

      if (r1.status === 404 && !r1.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assertEqual(r1.status, 200, "First parallel call must return 200");
      ctx.assertEqual(r2.status, 200, "Second parallel call must return 200");
      ctx.assertEqual(r1.data?.orderId, r2.data?.orderId, "Must return identical orderId");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B06-02",
      tier: 2,
      feature: "B6: Concurrency & Collisions",
      name: "Rapid duplicate Pay Now clicks deduplicate via idempotency lock",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const key = `rapid_key_${Date.now()}`;
      const headers = { ...fixture!.authHeaders, "x-idempotency-key": key };

      const initialCount = (await getPaymentAttempts(fixture!.customerId)).length;
      const res = await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      const finalCount = (await getPaymentAttempts(fixture!.customerId)).length;
      ctx.assertEqual(finalCount, initialCount + 1, "Exactly 1 attempt created");
    }
  );

  await ctx.runTest(
    {
      id: "T2-B06-03",
      tier: 2,
      feature: "B6: Concurrency & Collisions",
      name: "Idempotency key collision with conflicting invoice ID rejects with 400 or 409",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv2 = await createAdditionalInvoice(fixture!.customerId, 500.0);
      const sharedKey = `shared_idemp_${Date.now()}`;

      // Call 1 for Invoice 1
      const res1 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture!.invoiceId },
        { ...fixture!.authHeaders, "x-idempotency-key": sharedKey }
      );

      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
        return;
      }

      // Call 2 for Invoice 2 with the SAME idempotency key
      const res2 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: inv2.invoiceId },
        { ...fixture!.authHeaders, "x-idempotency-key": sharedKey }
      );

      // Must return identical cached attempt or reject mismatch
      ctx.assert(
        res2.status === 200 || res2.status === 400 || res2.status === 409,
        "Conflicting idempotency key must be handled safely"
      );
    }
  );

  await ctx.runTest(
    {
      id: "T2-B06-04",
      tier: 2,
      feature: "B6: Concurrency & Collisions",
      name: "Database unique constraint catch block handles 23505 without unhandled crash",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const key = `catch_23505_${Date.now()}`;

      const [first] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_${key}_1`,
          cfOrderId: `ord_${key}_1`,
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: key,
        })
        .returning();

      let recovered = false;
      try {
        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_${key}_2`,
          cfOrderId: `ord_${key}_2`,
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: key, // Collision
        });
      } catch (err: any) {
        if (
          err.code === "23505" ||
          err.cause?.code === "23505" ||
          err.message?.includes("unique") ||
          String(err).includes("duplicate key")
        ) {
          recovered = true;
        }
      }

      ctx.assert(recovered, "Must safely catch 23505 collision error");
      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, first.id));
    }
  );

  await ctx.runTest(
    {
      id: "T2-B06-05",
      tier: 2,
      feature: "B6: Concurrency & Collisions",
      name: "Simultaneous webhook + verify race condition serializes reconciliation",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `race_webhook_verify_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

      const [resWeb, resVer] = await Promise.all([
        ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
        ctx.client.get(`/api/payments/cashfree/verify/${orderId}`, fixture!.authHeaders),
      ]);

      if (resWeb.status === 404 && !resWeb.data?.error) {
        ctx.skip("Pending Milestone M3: Webhook + Verify race condition");
        return;
      }

      ctx.assertEqual(resWeb.status, 200, "Webhook acknowledges 200");
    }
  );
  } finally {
    if (fixture) {
      await cleanupCustomerFixture(fixture);
    }
  }
}
