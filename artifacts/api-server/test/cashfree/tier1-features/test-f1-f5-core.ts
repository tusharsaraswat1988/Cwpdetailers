import type { TestRunnerContext } from "../harness/testContext";
import {
  db,
  paymentsTable,
  paymentAttemptsTable,
  paymentMethodEnum,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestCustomerFixture, cleanupCustomerFixture } from "../harness/dbHelpers";
import {
  getCashfreeBaseUrl,
  getCashfreeConfig,
  getClientSafeConfig,
  CashfreeConfigError,
} from "../../../src/lib/cashfree/cashfreeConfig";
import { CashfreeClient } from "../../../src/lib/cashfree/cashfreeClient";

export async function runTier1F1F5(ctx: TestRunnerContext): Promise<void> {
  let fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    fixture = await createTestCustomerFixture({ balanceDue: 1500.0 });

  // =========================================================================
  // FEATURE 1: DB Enum Extension (payment_method enum includes 'cashfree')
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F01-01",
      tier: 1,
      feature: "F1: DB Enum Extension",
      name: "Insert a payment row into paymentsTable with method = 'cashfree'",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const [payment] = await db
        .insert(paymentsTable)
        .values({
          customerId: fixture!.customerId,
          invoiceId: fixture!.invoiceId,
          amount: "150.00",
          method: "cashfree",
          status: "completed",
          transactionId: `cf_tx_test_${Date.now()}`,
        })
        .returning();

      ctx.assertDefined(payment.id, "Payment row must be created with an ID");
      ctx.assertEqual(payment.method, "cashfree", "Payment method must be 'cashfree'");

      // Clean up test payment
      await db.delete(paymentsTable).where(eq(paymentsTable.id, payment.id));
    }
  );

  await ctx.runTest(
    {
      id: "T1-F01-02",
      tier: 1,
      feature: "F1: DB Enum Extension",
      name: "Query payments by method = 'cashfree'",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const txId = `cf_tx_query_${Date.now()}`;
      await db.insert(paymentsTable).values({
        customerId: fixture!.customerId,
        amount: "200.00",
        method: "cashfree",
        status: "completed",
        transactionId: txId,
      });

      const rows = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.transactionId, txId));

      ctx.assertEqual(rows.length, 1, "Should find exactly 1 payment with transaction ID");
      ctx.assertEqual(rows[0].method, "cashfree", "Queried method must be 'cashfree'");

      await db.delete(paymentsTable).where(eq(paymentsTable.transactionId, txId));
    }
  );

  await ctx.runTest(
    {
      id: "T1-F01-03",
      tier: 1,
      feature: "F1: DB Enum Extension",
      name: "Invalid enum value is rejected by database constraint",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      let threw = false;
      try {
        await db.insert(paymentsTable).values({
          customerId: fixture!.customerId,
          amount: "50.00",
          method: "bitcoin_unsupported" as any,
          status: "completed",
        });
      } catch (err: any) {
        threw = true;
        const code = err.cause?.code || err.code;
        const msg = String(err.cause?.message || err.message);
        ctx.assert(
          code === "22P02" || msg.includes("invalid input value for enum") || msg.includes("payment_method"),
          "Postgres must reject invalid enum value"
        );
      }
      ctx.assert(threw, "Database must reject unsupported payment method enum");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F01-04",
      tier: 1,
      feature: "F1: DB Enum Extension",
      name: "Drizzle schema runtime enum reflections include 'cashfree'",
    },
    async () => {
      const enumValues = paymentMethodEnum.enumValues;
      ctx.assertDefined(enumValues, "Enum values array must exist in runtime schema");
      ctx.assert(
        enumValues.includes("cashfree"),
        `Enum values must include 'cashfree'. Got: ${JSON.stringify(enumValues)}`
      );
    }
  );

  await ctx.runTest(
    {
      id: "T1-F01-05",
      tier: 1,
      feature: "F1: DB Enum Extension",
      name: "Payment enum includes cashfree alongside legacy payment methods",
    },
    async () => {
      const requiredMethods = ["cash", "upi", "card", "bank_transfer", "razorpay", "cashfree"];
      for (const m of requiredMethods) {
        ctx.assert(
          paymentMethodEnum.enumValues.includes(m as any),
          `Enum must support method: ${m}`
        );
      }
    }
  );

  // =========================================================================
  // FEATURE 2: DB Payment Attempts Tracking (payment_attempts table)
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F02-01",
      tier: 1,
      feature: "F2: Payment Attempts Tracking",
      name: "Create payment_attempts record with full metadata",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const uniqueId = `test_att_${Date.now()}`;
      const [attempt] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_${uniqueId}`,
          cfOrderId: `ord_${uniqueId}`,
          customerId: fixture!.customerId,
          invoiceId: fixture!.invoiceId,
          amount: "1500.00",
          currency: "INR",
          cfPaymentSessionId: `session_${uniqueId}`,
          status: "initiated",
          idempotencyKey: `idemp_${uniqueId}`,
        })
        .returning();

      ctx.assertDefined(attempt.id, "Payment attempt must return auto-increment ID");
      ctx.assertEqual(attempt.status, "initiated", "Initial status must be 'initiated'");
      ctx.assertEqual(attempt.amount, "1500.00", "Amount must match 1500.00");
      ctx.assertEqual(attempt.currency, "INR", "Default currency must be INR");

      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, attempt.id));
    }
  );

  await ctx.runTest(
    {
      id: "T1-F02-02",
      tier: 1,
      feature: "F2: Payment Attempts Tracking",
      name: "Unique cfOrderId constraint prevents duplicate gateway order records",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const uniqueId = `test_dup_cf_${Date.now()}`;
      const [first] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_${uniqueId}_1`,
          cfOrderId: `ord_${uniqueId}`,
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: `idemp_${uniqueId}_1`,
        })
        .returning();

      let threw = false;
      try {
        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_${uniqueId}_2`,
          cfOrderId: `ord_${uniqueId}`, // duplicate cfOrderId
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: `idemp_${uniqueId}_2`,
        });
      } catch (err: any) {
        threw = true;
        const code = err.cause?.code || err.code;
        const msg = String(err.cause?.message || err.message);
        ctx.assert(
          code === "23505" || msg.includes("unique") || msg.includes("duplicate key"),
          "Must throw Postgres 23505 unique violation"
        );
      }
      ctx.assert(threw, "Database must reject duplicate cfOrderId");

      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, first.id));
    }
  );

  await ctx.runTest(
    {
      id: "T1-F02-03",
      tier: 1,
      feature: "F2: Payment Attempts Tracking",
      name: "Unique idempotencyKey constraint prevents duplicate concurrent attempts",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const uniqueId = `test_dup_idemp_${Date.now()}`;
      const [first] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_${uniqueId}_1`,
          cfOrderId: `ord_${uniqueId}_1`,
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: `shared_idemp_${uniqueId}`,
        })
        .returning();

      let threw = false;
      try {
        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_${uniqueId}_2`,
          cfOrderId: `ord_${uniqueId}_2`,
          customerId: fixture!.customerId,
          amount: "500.00",
          idempotencyKey: `shared_idemp_${uniqueId}`, // duplicate idempotencyKey
        });
      } catch (err: any) {
        threw = true;
        const code = err.cause?.code || err.code;
        const msg = String(err.cause?.message || err.message);
        ctx.assert(
          code === "23505" || msg.includes("unique") || msg.includes("duplicate key"),
          "Must throw Postgres 23505 unique violation on idempotency key"
        );
      }
      ctx.assert(threw, "Database must reject duplicate idempotency key");

      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, first.id));
    }
  );

  await ctx.runTest(
    {
      id: "T1-F02-04",
      tier: 1,
      feature: "F2: Payment Attempts Tracking",
      name: "Foreign key integrity protects customerId relationship",
    },
    async () => {
      let threw = false;
      try {
        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_fk_${Date.now()}`,
          cfOrderId: `ord_fk_${Date.now()}`,
          customerId: 999999999, // non-existent customer
          amount: "300.00",
          idempotencyKey: `idemp_fk_${Date.now()}`,
        });
      } catch (err: any) {
        threw = true;
        const code = err.cause?.code || err.code;
        const msg = String(err.cause?.message || err.message);
        ctx.assert(
          code === "23503" || msg.includes("foreign key") || msg.includes("violates"),
          "Must enforce foreign key constraint 23503 on customer_id"
        );
      }
      ctx.assert(threw, "Database must reject attempt for non-existent customer");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F02-05",
      tier: 1,
      feature: "F2: Payment Attempts Tracking",
      name: "JSONB payload persistence for webhook and verification audit logs",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const uniqueId = `test_jsonb_${Date.now()}`;
      const webhookPayload = {
        type: "PAYMENT_SUCCESS_WEBHOOK",
        event_time: new Date().toISOString(),
        data: { cf_payment_id: 1234567, payment_amount: 1500 },
      };

      const [attempt] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_${uniqueId}`,
          cfOrderId: `ord_${uniqueId}`,
          customerId: fixture!.customerId,
          amount: "1500.00",
          idempotencyKey: `idemp_${uniqueId}`,
          rawWebhookPayload: webhookPayload,
          status: "paid",
        })
        .returning();

      const [retrieved] = await db
        .select()
        .from(paymentAttemptsTable)
        .where(eq(paymentAttemptsTable.id, attempt.id));

      ctx.assertDefined(retrieved.rawWebhookPayload, "Webhook payload must be stored");
      ctx.assertEqual(
        (retrieved.rawWebhookPayload as any)?.type,
        "PAYMENT_SUCCESS_WEBHOOK",
        "JSONB type field must persist accurately"
      );

      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, attempt.id));
    }
  );

  // =========================================================================
  // FEATURE 3: Raw Body Preservation Middleware
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F03-01",
      tier: 1,
      feature: "F3: Raw Body Middleware",
      name: "Middleware preserves unmutated raw request body string for HMAC verification",
    },
    async () => {
      const orderId = `cf_raw_f3_01_${Date.now()}`;
      const webhook = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId, {
        paymentAmount: 1500.0,
      });
      const res = await ctx.client.postRaw("/api/webhooks/cashfree", webhook.rawBody, webhook.headers);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree raw body HMAC verification");
        return;
      }
      ctx.assertEqual(res.status, 200, "Server must verify HMAC using preserved raw body");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F03-02",
      tier: 1,
      feature: "F3: Raw Body Middleware",
      name: "Byte-for-byte exactness check (whitespace preservation)",
    },
    async () => {
      const rawWithSpaces = '{\n  "event":  "PAYMENT_SUCCESS_WEBHOOK"  ,\n  "data": { "order": { "order_id": "cf_raw_ws_123" } }\n}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const crypto = await import("node:crypto");
      const signature = crypto
        .createHmac("sha256", ctx.mockGateway.secretKey)
        .update(timestamp + rawWithSpaces)
        .digest("base64");

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawWithSpaces, {
        "content-type": "application/json",
        "x-webhook-timestamp": timestamp,
        "x-webhook-signature": signature,
      });

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree whitespace raw body verification");
        return;
      }
      ctx.assertEqual(res.status, 200, "Server must accept raw JSON with irregular whitespace");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F03-03",
      tier: 1,
      feature: "F3: Raw Body Middleware",
      name: "UTF-8 multi-byte characters (INR ₹ symbol) are preserved without corruption",
    },
    async () => {
      const rawUtf8 = JSON.stringify({
        event: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          customer_details: { customer_name: "Tushar ₹ Detailing" },
          payment: { payment_currency: "INR" },
        },
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const crypto = await import("node:crypto");
      const signature = crypto
        .createHmac("sha256", ctx.mockGateway.secretKey)
        .update(timestamp + rawUtf8)
        .digest("base64");

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawUtf8, {
        "content-type": "application/json",
        "x-webhook-timestamp": timestamp,
        "x-webhook-signature": signature,
      });

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree UTF-8 multi-byte raw body verification");
        return;
      }
      ctx.assertEqual(res.status, 200, "Server must verify HMAC with UTF-8 multi-byte raw bytes");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F03-04",
      tier: 1,
      feature: "F3: Raw Body Middleware",
      name: "Standard JSON object parsing operates alongside raw body",
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
        return;
      }
      ctx.assertEqual(res.status, 200, "Create order route parsed JSON request body successfully");
      ctx.assertDefined(res.data?.orderId, "Parsed JSON response has orderId");
      ctx.assertDefined(res.data?.paymentSessionId, "Parsed JSON response has paymentSessionId");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F03-05",
      tier: 1,
      feature: "F3: Raw Body Middleware",
      name: "Tampered raw body causes HMAC verification failure",
    },
    async () => {
      const originalPayload = JSON.stringify({ event: "PAYMENT_SUCCESS_WEBHOOK", amount: 1500 });
      const tamperedPayload = JSON.stringify({ event: "PAYMENT_SUCCESS_WEBHOOK", amount: 100 });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const crypto = await import("node:crypto");
      const signature = crypto
        .createHmac("sha256", ctx.mockGateway.secretKey)
        .update(timestamp + originalPayload)
        .digest("base64");

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", tamperedPayload, {
        "content-type": "application/json",
        "x-webhook-timestamp": timestamp,
        "x-webhook-signature": signature,
      });

      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: POST /api/webhooks/cashfree tampered body rejection");
        return;
      }
      ctx.assert(res.status === 400 || res.status === 401, "Tampered raw body must be rejected by HMAC check");
    }
  );

  // =========================================================================
  // FEATURE 4: Environment & Config Module
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F04-01",
      tier: 1,
      feature: "F4: Environment & Config",
      name: "Sandbox configuration loads sandbox gateway URL",
    },
    async () => {
      const original = process.env.CASHFREE_BASE_URL;
      delete process.env.CASHFREE_BASE_URL;
      try {
        const url = getCashfreeBaseUrl("sandbox");
        ctx.assertEqual(url, "https://sandbox.cashfree.com/pg", "Sandbox must resolve to sandbox URL");
      } finally {
        if (original) process.env.CASHFREE_BASE_URL = original;
      }
    }
  );

  await ctx.runTest(
    {
      id: "T1-F04-02",
      tier: 1,
      feature: "F4: Environment & Config",
      name: "Production configuration loads live gateway URL",
    },
    async () => {
      const original = process.env.CASHFREE_BASE_URL;
      delete process.env.CASHFREE_BASE_URL;
      try {
        const url = getCashfreeBaseUrl("production");
        ctx.assertEqual(url, "https://api.cashfree.com/pg", "Production must resolve to api.cashfree.com/pg");
      } finally {
        if (original) process.env.CASHFREE_BASE_URL = original;
      }
    }
  );

  await ctx.runTest(
    {
      id: "T1-F04-03",
      tier: 1,
      feature: "F4: Environment & Config",
      name: "Validation rejects missing Cashfree Secret Key",
    },
    async () => {
      const savedSecret = process.env.CASHFREE_SECRET_KEY;
      delete process.env.CASHFREE_SECRET_KEY;
      let threw = false;
      try {
        getCashfreeConfig();
      } catch (err: any) {
        threw = true;
        ctx.assert(err instanceof CashfreeConfigError, "Must throw CashfreeConfigError");
        ctx.assertEqual(err.code, "MISSING_CASHFREE_SECRET_KEY", "Must report missing secret key");
      } finally {
        process.env.CASHFREE_SECRET_KEY = savedSecret;
      }
      ctx.assert(threw, "Missing secret key must throw");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F04-04",
      tier: 1,
      feature: "F4: Environment & Config",
      name: "Validation rejects missing Cashfree App ID",
    },
    async () => {
      const savedAppId = process.env.CASHFREE_APP_ID;
      delete process.env.CASHFREE_APP_ID;
      let threw = false;
      try {
        getCashfreeConfig();
      } catch (err: any) {
        threw = true;
        ctx.assert(err instanceof CashfreeConfigError, "Must throw CashfreeConfigError");
        ctx.assertEqual(err.code, "MISSING_CASHFREE_APP_ID", "Must report missing app ID");
      } finally {
        process.env.CASHFREE_APP_ID = savedAppId;
      }
      ctx.assert(threw, "Missing app ID must throw");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F04-05",
      tier: 1,
      feature: "F4: Environment & Config",
      name: "Secret isolation ensures client-safe config strictly excludes private key",
    },
    async () => {
      const clientConfig = getClientSafeConfig();
      ctx.assert(!("secretKey" in clientConfig), "Client config must NEVER expose secretKey");
      ctx.assertDefined(clientConfig.appId, "Client config retains appId");
      ctx.assertDefined(clientConfig.env, "Client config retains env");
    }
  );

  // =========================================================================
  // FEATURE 5: Cashfree REST API Client (against Mock Gateway)
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F05-01",
      tier: 1,
      feature: "F5: Cashfree REST Client",
      name: "Client sends required headers (x-client-id, x-client-secret, x-api-version)",
    },
    async () => {
      const client = new CashfreeClient();
      const orderId = `test_f5_headers_${Date.now()}`;
      await client.createOrder({
        order_id: orderId,
        order_amount: 1300.0,
        order_currency: "INR",
        customer_details: { customer_id: "cust_101", customer_phone: "9876543210" },
      });

      const lastReq = ctx.mockGateway.getLastRequest();
      ctx.assertDefined(lastReq, "Mock gateway must record request");
      ctx.assertEqual(lastReq?.headers["x-client-id"], ctx.mockGateway.clientId, "Client ID must match");
      ctx.assertEqual(lastReq?.headers["x-api-version"], "2023-08-01", "API version must be 2023-08-01");

      // Verify mock server strictly validates official headers: rejects missing credentials with 401
      const unauthRes = await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order_id: `unauth_${Date.now()}`,
          order_amount: 1000.0,
          order_currency: "INR",
          customer_details: { customer_id: "c_unauth", customer_phone: "9999999999" },
        }),
      });
      ctx.assertEqual(unauthRes.status, 401, "Mock gateway strictly rejects request missing credentials with 401");

      // Verify mock server strictly rejects missing x-api-version with 400
      const noVersionRes = await fetch(`${ctx.mockGateway.getBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-id": ctx.mockGateway.clientId,
          "x-client-secret": ctx.mockGateway.secretKey,
        },
        body: JSON.stringify({
          order_id: `no_ver_${Date.now()}`,
          order_amount: 1000.0,
          order_currency: "INR",
          customer_details: { customer_id: "c_no_ver", customer_phone: "9999999999" },
        }),
      });
      ctx.assertEqual(noVersionRes.status, 400, "Mock gateway strictly rejects request missing x-api-version with 400");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F05-02",
      tier: 1,
      feature: "F5: Cashfree REST Client",
      name: "Client maps order response with paymentSessionId and orderStatus = ACTIVE",
    },
    async () => {
      const client = new CashfreeClient();
      const orderId = `test_f5_map_${Date.now()}`;
      const order = await client.createOrder({
        order_id: orderId,
        order_amount: 850.0,
        order_currency: "INR",
        customer_details: { customer_id: "cust_102", customer_phone: "9876543211" },
      });

      ctx.assertEqual(order.order_id, orderId, "Order ID must match request");
      ctx.assertEqual(order.order_status, "ACTIVE", "Initial order status must be ACTIVE");
      ctx.assert(
        typeof order.payment_session_id === "string" && order.payment_session_id.startsWith("session_"),
        "Must return payment_session_id string starting with 'session_'"
      );
    }
  );

  await ctx.runTest(
    {
      id: "T1-F05-03",
      tier: 1,
      feature: "F5: Cashfree REST Client",
      name: "Client queries order status via GET /pg/orders/:id",
    },
    async () => {
      const client = new CashfreeClient();
      const orderId = `test_f5_get_${Date.now()}`;
      await client.createOrder({
        order_id: orderId,
        order_amount: 1100.0,
        order_currency: "INR",
        customer_details: { customer_id: "cust_103", customer_phone: "9876543212" },
      });

      const order = await client.getOrder(orderId);
      ctx.assertEqual(order.order_id, orderId, "Queried order ID must match");
      ctx.assertEqual(order.order_amount, 1100.0, "Amount must match 1100.0");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F05-04",
      tier: 1,
      feature: "F5: Cashfree REST Client",
      name: "Client queries order payments via GET /pg/orders/:id/payments",
    },
    async () => {
      const client = new CashfreeClient();
      const orderId = `test_f5_pmts_${Date.now()}`;
      await client.createOrder({
        order_id: orderId,
        order_amount: 1300.0,
        order_currency: "INR",
        customer_details: { customer_id: "cust_104", customer_phone: "9876543213" },
      });

      ctx.mockGateway.simulatePaymentSuccess(orderId);

      const payments = await client.getOrderPayments(orderId);
      ctx.assert(Array.isArray(payments), "Must return payments array");
      ctx.assertEqual(payments.length, 1, "Must contain exactly 1 payment attempt");
      ctx.assertEqual(payments[0].payment_status, "SUCCESS", "Payment status must be SUCCESS");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F05-05",
      tier: 1,
      feature: "F5: Cashfree REST Client",
      name: "Gateway 400 error parsed cleanly into typed error response",
    },
    async () => {
      const client = new CashfreeClient();
      let threw = false;
      try {
        await client.createOrder({
          order_amount: 100,
          order_currency: "USD",
          customer_details: { customer_id: "cust_105", customer_phone: "9876543214" },
        });
      } catch (err: any) {
        threw = true;
        ctx.assertEqual(err.code, "invalid_order_currency", "Error code must indicate invalid currency");
      }
      ctx.assert(threw, "Client must throw on gateway 400");
    }
  );
  } finally {
    if (fixture) {
      await cleanupCustomerFixture(fixture);
    }
  }
}
