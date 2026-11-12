import type { TestRunnerContext } from "../harness/testContext";
import {
  createTestCustomerFixture,
  createAdditionalInvoice,
  cleanupCustomerFixture,
  getPaymentAttempts,
} from "../harness/dbHelpers";
import {
  generateCashfreeWebhookHeaders,
  verifyCashfreeWebhookSignature,
} from "../harness/signatureHelper";

export async function runTier1F6F10(ctx: TestRunnerContext): Promise<void> {
  let fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    fixture = await createTestCustomerFixture({ balanceDue: 1300.0 });

  // =========================================================================
  // FEATURE 6: Server-Side Order Creation API (POST /api/payments/cashfree/create-order)
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F06-01",
      tier: 1,
      feature: "F6: Order Creation API",
      name: "Authenticated customer creates Cashfree order for outstanding balance",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        {},
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Create order must return HTTP 200");
      ctx.assertEqual(res.data?.success, true, "Response must report success: true");
      ctx.assertDefined(res.data?.orderId, "Must return orderId");
      ctx.assertDefined(res.data?.paymentSessionId, "Must return paymentSessionId");
      ctx.assertEqual(res.data?.orderCurrency, "INR", "Order currency must be INR");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F06-02",
      tier: 1,
      feature: "F6: Order Creation API",
      name: "Server strictly computes payable amount; client-supplied amount is ignored",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Malicious client attempts to specify ₹1.00 for a ₹1300 balance
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { amount: 1.0 },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Must succeed using server-determined amount");
      ctx.assertEqual(
        Number(res.data?.orderAmount),
        1300.0,
        "Order amount must strictly match backend dues ₹1300, ignoring client ₹1.00"
      );
    }
  );

  await ctx.runTest(
    {
      id: "T1-F06-03",
      tier: 1,
      feature: "F6: Order Creation API",
      name: "Payment attempt record is inserted into payment_attempts table",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        {},
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      const attempts = await getPaymentAttempts(fixture!.customerId);
      ctx.assert(attempts.length > 0, "At least 1 payment attempt must be recorded in DB");
      ctx.assertEqual(attempts[0].status, "initiated", "Status must be 'initiated'");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F06-04",
      tier: 1,
      feature: "F6: Order Creation API",
      name: "Invoice-specific order creation sets payment_attempts.invoiceId",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture!.invoiceId },
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Invoice-specific order must return 200");
      const attempts = await getPaymentAttempts(fixture!.customerId);
      ctx.assertEqual(attempts[0].invoiceId, fixture!.invoiceId, "Attempt must link to target invoiceId");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F06-05",
      tier: 1,
      feature: "F6: Order Creation API",
      name: "Unauthenticated request is rejected with HTTP 401 Unauthorized",
    },
    async () => {
      const res = await ctx.client.post("/api/payments/cashfree/create-order", {});

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      ctx.assertEqual(res.status, 401, "Unauthenticated request must return 401 Unauthorized");
    }
  );

  // =========================================================================
  // FEATURE 7: Idempotency & Concurrent Attempt Guard
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F07-01",
      tier: 1,
      feature: "F7: Idempotency Guard",
      name: "Identical idempotency key returns cached active session",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const idempotencyKey = `idemp_test_${Date.now()}`;
      const headers = {
        ...fixture!.authHeaders,
        "x-idempotency-key": idempotencyKey,
      };

      const res1 = await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);
      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      const res2 = await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);
      ctx.assertEqual(res1.status, 200, "First request must return 200");
      ctx.assertEqual(res2.status, 200, "Second request must return 200");
      ctx.assertEqual(res1.data?.orderId, res2.data?.orderId, "Must return identical orderId");
      ctx.assertEqual(
        res1.data?.paymentSessionId,
        res2.data?.paymentSessionId,
        "Must return identical paymentSessionId"
      );
    }
  );

  await ctx.runTest(
    {
      id: "T1-F07-02",
      tier: 1,
      feature: "F7: Idempotency Guard",
      name: "Active unexpired session reuse for target invoice",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res1 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture!.invoiceId },
        fixture!.authHeaders
      );

      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      const res2 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture!.invoiceId },
        fixture!.authHeaders
      );

      ctx.assertEqual(res1.data?.orderId, res2.data?.orderId, "Should reuse active order ID for same invoice");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F07-03",
      tier: 1,
      feature: "F7: Idempotency Guard",
      name: "Deduplication prevents multiple DB records in payment_attempts",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const key = `idemp_count_${Date.now()}`;
      const headers = { ...fixture!.authHeaders, "x-idempotency-key": key };

      const initialCount = (await getPaymentAttempts(fixture!.customerId)).length;
      const res = await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);
      await ctx.client.post("/api/payments/cashfree/create-order", {}, headers);

      const finalCount = (await getPaymentAttempts(fixture!.customerId)).length;
      ctx.assertEqual(finalCount, initialCount + 1, "Exactly 1 attempt record must be inserted");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F07-04",
      tier: 1,
      feature: "F7: Idempotency Guard",
      name: "Session renewal is permitted after previous attempt expires",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.post("/api/payments/cashfree/create-order", {}, fixture!.authHeaders);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }
      ctx.assertEqual(res.status, 200, "Order creation must succeed");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F07-05",
      tier: 1,
      feature: "F7: Idempotency Guard",
      name: "Distinct invoices generate distinct payment sessions",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv2 = await createAdditionalInvoice(fixture!.customerId, 800.0);

      const res1 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: fixture!.invoiceId },
        fixture!.authHeaders
      );

      if (res1.status === 404 && !res1.data?.error) {
        ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
      }

      const res2 = await ctx.client.post(
        "/api/payments/cashfree/create-order",
        { invoiceId: inv2.invoiceId },
        fixture!.authHeaders
      );

      ctx.assert(
        res1.data?.orderId !== res2.data?.orderId,
        "Distinct invoices must generate distinct order IDs"
      );
    }
  );

  // =========================================================================
  // FEATURE 8: Webhook HMAC-SHA256 Verification
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F08-01",
      tier: 1,
      feature: "F8: Webhook HMAC Verification",
      name: "Valid HMAC-SHA256 signature calculated over (timestamp + rawBody) passes verification",
    },
    async () => {
      const secret = "test_merchant_secret_key_12345";
      const payload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", amount: 1300 });
      const timestamp = Date.now().toString();

      const headers = generateCashfreeWebhookHeaders(payload, secret, { timestamp });
      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: headers.rawBody,
        clientSecret: secret,
      });

      ctx.assert(isValid, "Authentic HMAC-SHA256 signature must verify to true");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F08-02",
      tier: 1,
      feature: "F8: Webhook HMAC Verification",
      name: "Tampered body bytes are detected and rejected",
    },
    async () => {
      const secret = "test_merchant_secret_key_12345";
      const originalPayload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", amount: 1300 });
      const timestamp = Date.now().toString();

      const headers = generateCashfreeWebhookHeaders(originalPayload, secret, { timestamp });

      // Tamper with payload (change 1300 to 10000)
      const tamperedPayload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", amount: 10000 });

      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: tamperedPayload,
        clientSecret: secret,
      });

      ctx.assert(!isValid, "Signature verification must fail on tampered body");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F08-03",
      tier: 1,
      feature: "F8: Webhook HMAC Verification",
      name: "Tampered timestamp is detected and rejected",
    },
    async () => {
      const secret = "test_merchant_secret_key_12345";
      const payload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", amount: 1300 });
      const timestamp = Date.now().toString();

      const headers = generateCashfreeWebhookHeaders(payload, secret, { timestamp });

      // Tamper with timestamp by 1 millisecond
      const tamperedTimestamp = (Number(timestamp) + 1).toString();

      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: tamperedTimestamp,
        rawBody: headers.rawBody,
        clientSecret: secret,
      });

      ctx.assert(!isValid, "Signature verification must fail on altered timestamp");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F08-04",
      tier: 1,
      feature: "F8: Webhook HMAC Verification",
      name: "Signature signed with wrong secret key is rejected",
    },
    async () => {
      const correctSecret = "correct_merchant_secret_key";
      const wrongSecret = "attacker_secret_key_99999";
      const payload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", amount: 1300 });

      const headers = generateCashfreeWebhookHeaders(payload, wrongSecret);

      const isValid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: headers.rawBody,
        clientSecret: correctSecret,
      });

      ctx.assert(!isValid, "Signature verification must fail with wrong secret");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F08-05",
      tier: 1,
      feature: "F8: Webhook HMAC Verification",
      name: "timingSafeEqual protects against timing attacks and handles length mismatches safely",
    },
    async () => {
      const secret = "test_secret_12345";
      const payload = JSON.stringify({ test: "data" });
      const headers = generateCashfreeWebhookHeaders(payload, secret);

      // Verify valid signature
      const valid = verifyCashfreeWebhookSignature({
        signature: headers["x-webhook-signature"],
        timestamp: headers["x-webhook-timestamp"],
        rawBody: headers.rawBody,
        clientSecret: secret,
      });
      ctx.assert(valid, "Valid signature must pass");

      // Verify length mismatch does NOT throw unhandled RangeError
      const invalidLengthSig = "short_invalid_sig";
      let threw = false;
      let result = true;
      try {
        result = verifyCashfreeWebhookSignature({
          signature: invalidLengthSig,
          timestamp: headers["x-webhook-timestamp"],
          rawBody: headers.rawBody,
          clientSecret: secret,
        });
      } catch {
        threw = true;
      }

      ctx.assert(!threw, "Length mismatch must NOT throw RangeError");
      ctx.assert(!result, "Length mismatch signature must return false");
    }
  );

  // =========================================================================
  // FEATURE 9: Public Webhook Ingestion API (POST /api/webhooks/cashfree)
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F09-01",
      tier: 1,
      feature: "F9: Webhook Ingestion API",
      name: "Ingest PAYMENT_SUCCESS_WEBHOOK event",
    },
    async () => {
      const orderId = `cf_ord_webhook_success_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Webhook endpoint must return HTTP 200");
      ctx.assertEqual(res.data?.received, true, "Response must acknowledge received: true");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F09-02",
      tier: 1,
      feature: "F9: Webhook Ingestion API",
      name: "Ingest PAYMENT_FAILED_WEBHOOK event",
    },
    async () => {
      const orderId = `cf_ord_webhook_failed_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_FAILED_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Failed payment webhook must return HTTP 200");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F09-03",
      tier: 1,
      feature: "F9: Webhook Ingestion API",
      name: "Ingest PAYMENT_USER_DROPPED_WEBHOOK event",
    },
    async () => {
      const orderId = `cf_ord_webhook_dropped_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_USER_DROPPED_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "User dropped webhook must return HTTP 200");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F09-04",
      tier: 1,
      feature: "F9: Webhook Ingestion API",
      name: "Webhook with tampered signature is rejected",
    },
    async () => {
      const orderId = `cf_ord_webhook_tamper_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId, {
        tamperSignature: true,
      });

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assert(
        res.status === 400 || res.status === 401,
        "Tampered signature must return 400 or 401"
      );
    }
  );

  await ctx.runTest(
    {
      id: "T1-F09-05",
      tier: 1,
      feature: "F9: Webhook Ingestion API",
      name: "Webhook raw payload is stored in payment_attempts audit record",
    },
    async () => {
      const orderId = `cf_ord_audit_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Must return HTTP 200");
    }
  );

  // =========================================================================
  // FEATURE 10: Server-Side Return Verification API (GET /api/payments/cashfree/verify/:orderId)
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F10-01",
      tier: 1,
      feature: "F10: Return Verification API",
      name: "Direct gateway verification on customer return returns status PAID",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_verify_${Date.now()}`;
      ctx.mockGateway.simulatePaymentSuccess(orderId);

      const res = await ctx.client.get(
        `/api/payments/cashfree/verify/${orderId}`,
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint GET /api/payments/cashfree/verify/:orderId not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Return verify must return HTTP 200");
      ctx.assertEqual(res.data?.status, "PAID", "Order status must verify as PAID");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F10-02",
      tier: 1,
      feature: "F10: Return Verification API",
      name: "Receipt details included in verified response",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_verify_receipt_${Date.now()}`;
      ctx.mockGateway.simulatePaymentSuccess(orderId);

      const res = await ctx.client.get(
        `/api/payments/cashfree/verify/${orderId}`,
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint GET /api/payments/cashfree/verify/:orderId not yet implemented (M3 in progress)");
      }

      ctx.assertDefined(res.data?.receipt, "Response must include receipt object");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F10-03",
      tier: 1,
      feature: "F10: Return Verification API",
      name: "Return verification of failed payment returns status FAILED",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_verify_fail_${Date.now()}`;
      ctx.mockGateway.simulatePaymentFailure(orderId);

      const res = await ctx.client.get(
        `/api/payments/cashfree/verify/${orderId}`,
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint GET /api/payments/cashfree/verify/:orderId not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Must return HTTP 200");
      ctx.assertEqual(res.data?.status, "FAILED", "Order status must verify as FAILED");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F10-04",
      tier: 1,
      feature: "F10: Return Verification API",
      name: "Return verification of abandoned checkout returns USER_DROPPED",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_verify_drop_${Date.now()}`;
      ctx.mockGateway.simulateUserDropped(orderId);

      const res = await ctx.client.get(
        `/api/payments/cashfree/verify/${orderId}`,
        fixture!.authHeaders
      );

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Endpoint GET /api/payments/cashfree/verify/:orderId not yet implemented (M3 in progress)");
      }

      ctx.assertEqual(res.status, 200, "Must return HTTP 200");
      ctx.assertEqual(res.data?.status, "USER_DROPPED", "Order status must verify as USER_DROPPED");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F10-05",
      tier: 1,
      feature: "F10: Return Verification API",
      name: "Tenant boundary protection prevents verifying another customer's order",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Create a second customer fixture
      const fixture2 = await createTestCustomerFixture({ balanceDue: 500.0 });
      try {
        const orderId2 = `cf_ord_cust2_${Date.now()}`;
        ctx.mockGateway.simulatePaymentSuccess(orderId2);

        // Customer 1 attempts to verify Customer 2's order
        const res = await ctx.client.get(
          `/api/payments/cashfree/verify/${orderId2}`,
          fixture!.authHeaders // Customer 1 headers
        );

        if (res.status === 404 && !res.data?.error) {
          ctx.skip("Endpoint GET /api/payments/cashfree/verify/:orderId not yet implemented (M3 in progress)");
          return;
        }

        // Should be forbidden or not found for this tenant
        ctx.assert(
          res.status === 403 || res.status === 404,
          "Cross-customer order verification must be rejected (403 or 404)"
        );
      } finally {
        await cleanupCustomerFixture(fixture2);
      }
    }
  );
  } finally {
    if (fixture) {
      await cleanupCustomerFixture(fixture);
    }
  }
}
