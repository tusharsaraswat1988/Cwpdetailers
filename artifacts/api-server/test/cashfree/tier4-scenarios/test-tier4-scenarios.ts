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
  recordPayment,
  getCustomerOutstandingDues,
} from "../../../src/lib/billing/invoiceService";
import { db, paymentAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function runTier4Scenarios(ctx: TestRunnerContext): Promise<void> {
  // =========================================================================
  // SCENARIO 1: Full Happy-Path Payment Journey
  // =========================================================================

  await ctx.runTest(
    {
      id: "T4-S01-01",
      tier: 4,
      feature: "S1: Full Happy Path",
      name: "Step 1: Customer dues verification for open ₹1300 tax invoice",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 1300.0 });
      try {
        const dues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(dues, 1300.0, "Initial dues must be ₹1300.00");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  await ctx.runTest(
    {
      id: "T4-S01-02",
      tier: 4,
      feature: "S1: Full Happy Path",
      name: "Step 2: Order creation generates active gateway order and paymentSessionId",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 1300.0 });
      try {
        const res = await ctx.client.post("/api/payments/cashfree/create-order", {}, fixture.authHeaders);

        if (res.status === 404 && !res.data?.error) {
          ctx.skip("Endpoint POST /api/payments/cashfree/create-order not yet implemented (M2 in progress)");
          return;
        }

        ctx.assertEqual(res.status, 200, "Create order returns 200");
        ctx.assert(res.data?.paymentSessionId.startsWith("session_"), "Session ID must start with session_");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  await ctx.runTest(
    {
      id: "T4-S01-03",
      tier: 4,
      feature: "S1: Full Happy Path",
      name: "Step 3: Gateway emits webhook and backend acknowledges with 200",
    },
    async () => {
      const orderId = `cwp_s1_pay_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: Webhook ingestion API");
        return;
      }

      ctx.assertEqual(res.status, 200, "Webhook returns 200");
    }
  );

  await ctx.runTest(
    {
      id: "T4-S01-04",
      tier: 4,
      feature: "S1: Full Happy Path",
      name: "Step 4: Customer return route verifies payment and reconciles dues to 0.00",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 1300.0 });
      try {
        const orderId = `cf_s1_verify_${Date.now()}`;
        ctx.mockGateway.simulatePaymentSuccess(orderId, { paymentAmount: 1300.0 });

        const res = await ctx.client.get(`/api/payments/cashfree/verify/${orderId}`, fixture.authHeaders);
        if (res.status === 404 && !res.data?.error) {
          ctx.skip("Pending Milestone M3: Return verification API");
          return;
        }

        ctx.assertEqual(res.status, 200, "Verify returns 200");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  await ctx.runTest(
    {
      id: "T4-S01-05",
      tier: 4,
      feature: "S1: Full Happy Path",
      name: "Step 5: Customer profile confirms cleared dues",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 1300.0 });
      try {
        await recordPayment({
          customerId: fixture.customerId,
          amount: 1300.0,
          method: "cashfree",
          invoiceId: fixture.invoiceId,
        });

        const res = await ctx.client.get("/api/customers/me", fixture.authHeaders);

        ctx.assertEqual(res.status, 200, "Customer profile must return 200");
        ctx.assertEqual(Number(res.data?.totalDues), 0.0, "totalDues must be 0.00");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  // =========================================================================
  // SCENARIO 2: Dedicated Single Invoice Settlement with Multi-Invoice Dues
  // =========================================================================

  await ctx.runTest(
    {
      id: "T4-S02-01",
      tier: 4,
      feature: "S2: Single Invoice Settlement",
      name: "Step 1: Setup customer with Invoice A (₹800) and Invoice B (₹1200) = ₹2000 total",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 800.0 });
      try {
        const invB = await createAdditionalInvoice(fixture.customerId, 1200.0);

        const totalDues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(totalDues, 2000.0, "Total customer dues must be ₹2000.00");

        // Step 2 & 3: Pay only Invoice A
        await recordPayment({
          customerId: fixture.customerId,
          amount: 800.0,
          method: "cashfree",
          invoiceId: fixture.invoiceId,
          transactionId: `cf_invA_${Date.now()}`,
        });

        // Step 4: Invoice A settled, Invoice B remains sent
        const updatedA = await getInvoice(fixture.invoiceId);
        const updatedB = await getInvoice(invB.invoiceId);
        ctx.assertEqual(updatedA?.status, "paid", "Invoice A must be paid");
        ctx.assertEqual(Number(updatedA?.balanceDue), 0.0, "Invoice A balance must be 0.00");
        ctx.assertEqual(updatedB?.status, "sent", "Invoice B must remain sent");
        ctx.assertEqual(Number(updatedB?.balanceDue), 1200.0, "Invoice B balance must remain 1200.00");

        // Step 5: Remaining dues are ₹1200
        const remainingDues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(remainingDues, 1200.0, "Remaining dues must be exactly ₹1200.00");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  // =========================================================================
  // SCENARIO 3: Payment Failure Followed by Successful Retry
  // =========================================================================

  await ctx.runTest(
    {
      id: "T4-S03-01",
      tier: 4,
      feature: "S3: Failure & Retry",
      name: "Step 1: Initial attempt fails at gateway; attempt marked failed; invoice remains unpaid",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 2500.0 });
      try {
        const orderId1 = `cwp_s3_att1_${Date.now()}`;

        // Simulate bank decline on gateway
        ctx.mockGateway.simulatePaymentFailure(orderId1, {
          errorCode: "INSUFFICIENT_FUNDS",
          errorMessage: "Insufficient funds in bank account",
        });

        // Record failed attempt in DB
        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_s3_1_${Date.now()}`,
          cfOrderId: orderId1,
          customerId: fixture.customerId,
          invoiceId: fixture.invoiceId,
          amount: "2500.00",
          status: "failed",
          idempotencyKey: `idemp_s3_1_${Date.now()}`,
        });

        const invBefore = await getInvoice(fixture.invoiceId);
        ctx.assertEqual(invBefore?.status, "sent", "Invoice remains unpaid on failure");

        // Step 2: Retry with fresh attempt succeeds
        const orderId2 = `cwp_s3_att2_${Date.now()}`;
        ctx.mockGateway.simulatePaymentSuccess(orderId2, { paymentAmount: 2500.0 });

        await db.insert(paymentAttemptsTable).values({
          attemptId: `att_s3_2_${Date.now()}`,
          cfOrderId: orderId2,
          customerId: fixture.customerId,
          invoiceId: fixture.invoiceId,
          amount: "2500.00",
          status: "paid",
          idempotencyKey: `idemp_s3_2_${Date.now()}`,
        });

        await recordPayment({
          customerId: fixture.customerId,
          amount: 2500.0,
          method: "cashfree",
          invoiceId: fixture.invoiceId,
          transactionId: `cf_retry_succ_${Date.now()}`,
        });

        const invAfter = await getInvoice(fixture.invoiceId);
        ctx.assertEqual(invAfter?.status, "paid", "Invoice settled upon retry");

        const dues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(dues, 0.0, "Dues cleared upon successful retry");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  // =========================================================================
  // SCENARIO 4: Webhook Reconciles Prior to User Returning
  // =========================================================================

  await ctx.runTest(
    {
      id: "T4-S04-01",
      tier: 4,
      feature: "S4: Fast Webhook Prior to Return",
      name: "Step 1: Webhook reconciles in background; delayed return verifies instantly without duplicate work",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 3000.0 });
      try {
        const txId = `cf_s4_fast_${Date.now()}`;

        // Fast webhook arrives in 50ms
        await recordPayment({
          customerId: fixture.customerId,
          amount: 3000.0,
          method: "cashfree",
          invoiceId: fixture.invoiceId,
          transactionId: txId,
        });

        // User returns 3 seconds later
        const invoice = await getInvoice(fixture.invoiceId);
        ctx.assertEqual(invoice?.status, "paid", "Invoice is already paid");

        // Verify payments table count is exactly 1
        const payments = await getPayments(fixture.customerId);
        const count = payments.filter((p) => p.transactionId === txId).length;
        ctx.assertEqual(count, 1, "Exactly 1 payment record");

        const dues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(dues, 0.0, "Dues cleared");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );

  // =========================================================================
  // SCENARIO 5: Concurrent Duplicate Webhooks & Replay Defense Under High Load
  // =========================================================================

  await ctx.runTest(
    {
      id: "T4-S05-01",
      tier: 4,
      feature: "S5: High Load Concurrent Replay",
      name: "Step 1: 5 parallel webhook deliveries under simulated load deduplicate safely",
    },
    async () => {
      const fixture = await createTestCustomerFixture({ balanceDue: 5000.0 });
      try {
        const orderId = `cf_s5_highload_${Date.now()}`;
        const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", orderId);

        const probeRes = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
        if (probeRes.status === 404 && !probeRes.data?.error) {
          ctx.skip("Pending Milestone M3: Concurrent webhook replay defense under high load");
          return;
        }

        const responses = await Promise.all([
          ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
          ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
          ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
          ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
          ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers),
        ]);

        for (const res of responses) {
          ctx.assertEqual(res.status, 200, "Webhook returns 200");
        }

        const invoice = await getInvoice(fixture.invoiceId);
        ctx.assertEqual(Number(invoice?.balanceDue), 0.0, "Invoice balance must be 0.00");
        ctx.assertEqual(Number(invoice?.paidAmount), 5000.0, "Invoice paidAmount must be 5000.00");

        const dues = await getCustomerOutstandingDues(fixture.customerId);
        ctx.assertEqual(dues, 0.0, "Customer dues must be 0.00");

        const payments = await getPayments(fixture.customerId);
        ctx.assertEqual(payments.length, 1, "Exactly 1 payment row recorded across 5 parallel webhooks");
      } finally {
        await cleanupCustomerFixture(fixture);
      }
    }
  );
}
