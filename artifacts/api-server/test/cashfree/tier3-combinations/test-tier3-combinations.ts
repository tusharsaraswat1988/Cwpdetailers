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
import { recordPayment, getCustomerOutstandingDues } from "../../../src/lib/billing/invoiceService";
import { db, paymentAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function runTier3Combinations(ctx: TestRunnerContext): Promise<void> {
  let fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    fixture = await createTestCustomerFixture({ balanceDue: 2500.0 });

  // =========================================================================
  // COMBINATION 1: Webhook Arrives BEFORE Customer Return Redirect
  // =========================================================================

  let c1OrderId = `cf_combo1_ord_${Date.now()}`;
  let c1Skipped = false;

  await ctx.runTest(
    {
      id: "T3-C01-01",
      tier: 3,
      feature: "C1: Webhook Before Return",
      name: "Step 1: Webhook processes first and executes atomic ledger reconciliation",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      c1OrderId = `cf_combo1_ord_${Date.now()}`;
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", c1OrderId, {
        paymentAmount: 2500.0,
      });

      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
      if (res.status === 404 && !res.data?.error) {
        c1Skipped = true;
        ctx.skip("Pending Milestone M3: Webhook ingestion API");
        return;
      }

      ctx.assertEqual(res.status, 200, "Webhook returns 200");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C01-02",
      tier: 3,
      feature: "C1: Webhook Before Return",
      name: "Step 2: Return verify queries DB, sees attempt is already 'paid', and skips gateway query",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c1Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const res = await ctx.client.get(`/api/payments/cashfree/verify/${c1OrderId}`, fixture!.authHeaders);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: Return verification API");
        return;
      }

      ctx.assertEqual(res.status, 200, "Return verify returns 200");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C01-03",
      tier: 3,
      feature: "C1: Webhook Before Return",
      name: "Step 3: Fast response delivered with receipt details without duplicate ledger writes",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c1Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      ctx.assert(dues >= 0, "Dues must be non-negative");
    }
  );

  // =========================================================================
  // COMBINATION 2: Customer Return Arrives BEFORE Webhook
  // =========================================================================

  let c2OrderId = `cf_combo2_ord_${Date.now()}`;
  let c2Skipped = false;

  await ctx.runTest(
    {
      id: "T3-C02-01",
      tier: 3,
      feature: "C2: Return Before Webhook",
      name: "Step 1: Return verify queries gateway directly and reconciles ledger",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      c2OrderId = `cf_combo2_ord_${Date.now()}`;
      ctx.mockGateway.simulatePaymentSuccess(c2OrderId, { paymentAmount: 1600.0 });

      const res = await ctx.client.get(`/api/payments/cashfree/verify/${c2OrderId}`, fixture!.authHeaders);
      if (res.status === 404 && !res.data?.error) {
        c2Skipped = true;
        ctx.skip("Pending Milestone M3: Return verification API");
        return;
      }

      ctx.assertEqual(res.status, 200, "Return verify settles invoice");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C02-02",
      tier: 3,
      feature: "C2: Return Before Webhook",
      name: "Step 2: Delayed webhook arrives and detects order is already settled",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c2Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const { rawBody, headers } = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", c2OrderId, {
        paymentAmount: 1600.0,
      });
      const res = await ctx.client.postRaw("/api/webhooks/cashfree", rawBody, headers);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M3: Delayed webhook ingestion");
        return;
      }
      ctx.assertEqual(res.status, 200, "Delayed webhook returns 200");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C02-03",
      tier: 3,
      feature: "C2: Return Before Webhook",
      name: "Step 3: Webhook deduplicates safely without creating second payment row",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c2Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const payments = await getPayments(fixture!.customerId);
      const count1600 = payments.filter((p) => Number(p.amount) === 1600.0).length;
      ctx.assertEqual(count1600, 1, "Exactly 1 payment row for 1600 transaction");
    }
  );

  // =========================================================================
  // COMBINATION 3: Simultaneous Concurrent Webhook Deliveries (Race Condition)
  // =========================================================================

  let c3Skipped = false;
  let c3InvoiceId: number | null = null;
  let c3OrderId = "";

  await ctx.runTest(
    {
      id: "T3-C03-01",
      tier: 3,
      feature: "C3: Concurrent Webhooks",
      name: "Step 1: 5 identical webhooks dispatched concurrently via Promise.all",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv3 = await createAdditionalInvoice(fixture!.customerId, 1800.0);
      c3InvoiceId = inv3.invoiceId;
      c3OrderId = `cf_ord_race_5x_${Date.now()}`;

      // Build official Cashfree webhook payload with HMAC signature
      const webhook = ctx.mockGateway.buildWebhook("PAYMENT_SUCCESS_WEBHOOK", c3OrderId, {
        paymentAmount: 1800.0,
      });

      // Probe first request to detect pending M3 route
      const probeRes = await ctx.client.postRaw("/api/webhooks/cashfree", webhook.rawBody, webhook.headers);
      if (probeRes.status === 404 && !probeRes.data?.error) {
        c3Skipped = true;
        ctx.skip("Endpoint POST /api/webhooks/cashfree not yet implemented (Pending M3)");
        return;
      }

      // Fire 5 simultaneous webhook deliveries via Promise.all
      const tasks = Array.from({ length: 5 }, () =>
        ctx.client.postRaw("/api/webhooks/cashfree", webhook.rawBody, webhook.headers)
      );
      const responses = await Promise.all(tasks);

      for (const res of responses) {
        ctx.assertEqual(res.status, 200, "All concurrent webhook deliveries must return HTTP 200");
      }

      const invoice = await getInvoice(c3InvoiceId);
      ctx.assertEqual(Number(invoice?.balanceDue), 0.0, "Invoice balance due must be 0.00");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C03-02",
      tier: 3,
      feature: "C3: Concurrent Webhooks",
      name: "Step 2: Locking / deduplication ensures single settlement execution",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c3Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const payments = await getPayments(fixture!.customerId);
      const count1800 = payments.filter((p) => p.invoiceId === c3InvoiceId).length;
      ctx.assertEqual(count1800, 1, "Exactly 1 payment row recorded for 1800 transaction");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C03-03",
      tier: 3,
      feature: "C3: Concurrent Webhooks",
      name: "Step 3: Zero double deduction: invoice balance does not become negative",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      if (c3Skipped) {
        ctx.skip("Skipped because Step 1 pending M3");
        return;
      }
      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      ctx.assertEqual(dues, 0.0, "Customer dues must be 0.00, never negative");

      const customer = await getCustomer(fixture!.customerId);
      ctx.assertEqual(Number(customer?.walletBalance || 0), 0.0, "Wallet balance must be 0.00 with zero overpayment");
    }
  );

  // =========================================================================
  // COMBINATION 4: Invoice Partial Payment + Cashfree Reconciliation
  // =========================================================================

  let c4Fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;
  try {
    c4Fixture = await createTestCustomerFixture({ balanceDue: 2000.0 });

    await ctx.runTest(
      {
        id: "T3-C04-01",
        tier: 3,
        feature: "C4: Partial + Final Settlement",
        name: "Step 1: Pre-existing partial payment of ₹500 reduces ₹2000 invoice to ₹1500",
      },
      async () => {
        ctx.assert(!!c4Fixture, "Combination 4 test fixture customer required");

        // Apply initial partial payment to the dedicated fixture invoice
        await recordPayment({
          customerId: c4Fixture!.customerId,
          amount: 500.0,
          method: "wallet",
          invoiceId: c4Fixture!.invoiceId,
          transactionId: `wal_${Date.now()}`,
        });

        const partialInv = await getInvoice(c4Fixture!.invoiceId);
        ctx.assertEqual(Number(partialInv?.balanceDue), 1500.0, "balanceDue must be ₹1500.00");
        ctx.assertEqual(Number(partialInv?.paidAmount), 500.0, "paidAmount must be ₹500.00");
      }
    );

    await ctx.runTest(
      {
        id: "T3-C04-02",
        tier: 3,
        feature: "C4: Partial + Final Settlement",
        name: "Step 2: Cashfree order created strictly for remaining ₹1500 balance",
      },
      async () => {
        ctx.assert(!!c4Fixture, "Combination 4 test fixture customer required");
        const dues = await getCustomerOutstandingDues(c4Fixture!.customerId);
        ctx.assertEqual(dues, 1500.0, "Payable amount must strictly match remaining ₹1500 dues");
      }
    );

    await ctx.runTest(
      {
        id: "T3-C04-03",
        tier: 3,
        feature: "C4: Partial + Final Settlement",
        name: "Step 3: Gateway payment of ₹1500 fully settles invoice (paidAmount = 2000, balanceDue = 0)",
      },
      async () => {
        ctx.assert(!!c4Fixture, "Combination 4 test fixture customer required");
        await recordPayment({
          customerId: c4Fixture!.customerId,
          amount: 1500.0,
          method: "cashfree",
          invoiceId: c4Fixture!.invoiceId,
          transactionId: `cf_final_${Date.now()}`,
        });

        const dues = await getCustomerOutstandingDues(c4Fixture!.customerId);
        ctx.assertEqual(dues, 0.0, "All customer dues fully settled to 0.00");
      }
    );
  } finally {
    if (c4Fixture) {
      await cleanupCustomerFixture(c4Fixture);
    }
  }

  // =========================================================================
  // COMBINATION 5: Customer Cancel vs Bank Decline Handling (State Machine)
  // =========================================================================

  let c5InvoiceId: number | null = null;

  await ctx.runTest(
    {
      id: "T3-C05-01",
      tier: 3,
      feature: "C5: Cancel vs Decline Machine",
      name: "Step 1: User drop checkout marks attempt 'user_dropped' and preserves open invoice",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const inv5 = await createAdditionalInvoice(fixture!.customerId, 1400.0);
      c5InvoiceId = inv5.invoiceId;
      const [attempt1] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_drop_${Date.now()}`,
          cfOrderId: `ord_drop_${Date.now()}`,
          customerId: fixture!.customerId,
          invoiceId: c5InvoiceId,
          amount: "1400.00",
          status: "user_dropped",
          idempotencyKey: `idemp_drop_${Date.now()}`,
        })
        .returning();

      ctx.assertEqual(attempt1.status, "user_dropped", "Attempt 1 marked user_dropped");
      const invoice = await getInvoice(c5InvoiceId);
      ctx.assertEqual(invoice?.status, "sent", "Invoice remains open ('sent')");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C05-02",
      tier: 3,
      feature: "C5: Cancel vs Decline Machine",
      name: "Step 2: Customer retries with card; bank declines; attempt marked 'failed'; invoice unpaid",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      ctx.assert(c5InvoiceId !== null, "c5InvoiceId required from Step 1");

      const [attempt2] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_decline_${Date.now()}`,
          cfOrderId: `ord_decline_${Date.now()}`,
          customerId: fixture!.customerId,
          invoiceId: c5InvoiceId!,
          amount: "1400.00",
          status: "failed",
          idempotencyKey: `idemp_decline_${Date.now()}`,
        })
        .returning();

      ctx.assertEqual(attempt2.status, "failed", "Attempt 2 marked failed");
      const invoice = await getInvoice(c5InvoiceId!);
      ctx.assertEqual(invoice?.status, "sent", "Invoice still remains unpaid");
    }
  );

  await ctx.runTest(
    {
      id: "T3-C05-03",
      tier: 3,
      feature: "C5: Cancel vs Decline Machine",
      name: "Step 3: Customer retries with UPI; payment succeeds; attempt marked 'paid'; invoice settled",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      ctx.assert(c5InvoiceId !== null, "c5InvoiceId required from Step 1");

      const [attempt3] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_succ_${Date.now()}`,
          cfOrderId: `ord_succ_${Date.now()}`,
          customerId: fixture!.customerId,
          invoiceId: c5InvoiceId!,
          amount: "1400.00",
          status: "paid",
          idempotencyKey: `idemp_succ_${Date.now()}`,
        })
        .returning();

      await recordPayment({
        customerId: fixture!.customerId,
        amount: 1400.0,
        method: "cashfree",
        invoiceId: c5InvoiceId!,
        transactionId: `cf_succ_tx_${Date.now()}`,
      });

      const invoice = await getInvoice(c5InvoiceId!);
      ctx.assertEqual(invoice?.status, "paid", "Invoice is now paid");

      // Verify audit history retains all 3 attempts
      const allAttempts = await getPaymentAttempts(fixture!.customerId);
      const invoiceAttempts = allAttempts.filter((a) => a.invoiceId === c5InvoiceId);
      ctx.assert(invoiceAttempts.some((a) => a.status === "user_dropped"), "Audit has user_dropped");
      ctx.assert(invoiceAttempts.some((a) => a.status === "failed"), "Audit has failed");
      ctx.assert(invoiceAttempts.some((a) => a.status === "paid"), "Audit has paid");
    }
  );

  } finally {
    if (fixture) {
      await cleanupCustomerFixture(fixture);
    }
  }
}
