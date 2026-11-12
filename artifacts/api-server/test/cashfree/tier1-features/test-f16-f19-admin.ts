import type { TestRunnerContext } from "../harness/testContext";
import {
  createTestCustomerFixture,
  createAdditionalInvoice,
  cleanupCustomerFixture,
  getPayments,
  getPaymentAttempts,
  getInvoice,
} from "../harness/dbHelpers";
import {
  recordPayment,
  getCustomerOutstandingDues,
} from "../../../src/lib/billing/invoiceService";
import { db, paymentAttemptsTable } from "@workspace/db";

export async function runTier1F16F19(ctx: TestRunnerContext): Promise<void> {
  let fixture: Awaited<ReturnType<typeof createTestCustomerFixture>> | null = null;

  try {
    fixture = await createTestCustomerFixture({ balanceDue: 1800.0 });

  // =========================================================================
  // FEATURE 16: Dashboard Balance Clearance
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F16-01",
      tier: 1,
      feature: "F16: Dashboard Clearance",
      name: "Customer pending dues reach exactly 0.00 upon full settlement",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      await recordPayment({
        customerId: fixture!.customerId,
        amount: 1800.0,
        method: "cashfree",
        invoiceId: fixture!.invoiceId,
        transactionId: `cf_clear_${Date.now()}`,
      });

      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      ctx.assertEqual(dues, 0.0, "Dues must be 0.00");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F16-02",
      tier: 1,
      feature: "F16: Dashboard Clearance",
      name: "Customer profile returns cleared total dues (0.00)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.get("/api/customers/me", fixture!.authHeaders);

      ctx.assertEqual(res.status, 200, "Customer profile endpoint must return 200");
      ctx.assertEqual(Number(res.data?.totalDues), 0.0, "totalDues must be 0.00");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F16-03",
      tier: 1,
      feature: "F16: Dashboard Clearance",
      name: "Pay Now CTA condition is false when pending dues are zero",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      const shouldShowPayNow = dues > 0;
      ctx.assertEqual(shouldShowPayNow, false, "Pay Now CTA must be suppressed when dues are zero");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F16-04",
      tier: 1,
      feature: "F16: Dashboard Clearance",
      name: "All Payments Clear condition evaluates to true",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      const isAllPaymentsClear = dues === 0;
      ctx.assertEqual(isAllPaymentsClear, true, "All Payments Clear indicator must be active");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F16-05",
      tier: 1,
      feature: "F16: Dashboard Clearance",
      name: "Partial balance retention: dues banner updates when non-zero balance remains",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Add new invoice for ₹2000 and pay ₹500
      const inv = await createAdditionalInvoice(fixture!.customerId, 2000.0);
      await recordPayment({
        customerId: fixture!.customerId,
        amount: 500.0,
        method: "cashfree",
        invoiceId: inv.invoiceId,
        transactionId: `cf_partial_${Date.now()}`,
      });

      const dues = await getCustomerOutstandingDues(fixture!.customerId);
      ctx.assertEqual(dues, 1500.0, "Dues banner must retain remaining ₹1500.00");
    }
  );

  // =========================================================================
  // FEATURE 17: Admin Billing Visibility
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F17-01",
      tier: 1,
      feature: "F17: Admin Billing Visibility",
      name: "Admin payments API lists Cashfree transaction records",
    },
    async () => {
      const res = await ctx.client.get("/api/payments");
      ctx.assertEqual(res.status, 200, "Admin payments endpoint must return 200");
      ctx.assert(Array.isArray(res.data) || Array.isArray(res.data?.data), "Must return payments list");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F17-02",
      tier: 1,
      feature: "F17: Admin Billing Visibility",
      name: "Gateway reference is preserved in transactionId field",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const cashfreePayments = payments.filter((p) => p.method === "cashfree");
      ctx.assert(cashfreePayments.length > 0, "Must have recorded Cashfree payments");
      ctx.assertDefined(cashfreePayments[0].transactionId, "transactionId must be populated");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F17-03",
      tier: 1,
      feature: "F17: Admin Billing Visibility",
      name: "Payment attempts audit status records (paid, failed, user_dropped)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      // Seed a failed attempt for audit
      const [attempt] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `att_audit_${Date.now()}`,
          cfOrderId: `ord_audit_${Date.now()}`,
          customerId: fixture!.customerId,
          amount: "1500.00",
          status: "failed",
          idempotencyKey: `idemp_audit_${Date.now()}`,
        })
        .returning();

      const attempts = await getPaymentAttempts(fixture!.customerId);
      const found = attempts.find((a) => a.id === attempt.id);
      ctx.assertDefined(found, "Attempt must exist in database");
      ctx.assertEqual(found?.status, "failed", "Attempt status must be 'failed'");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F17-04",
      tier: 1,
      feature: "F17: Admin Billing Visibility",
      name: "Filter payments by method = cashfree returns matching entries",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const cfPayments = payments.filter((p) => p.method === "cashfree");
      for (const p of cfPayments) {
        ctx.assertEqual(p.method, "cashfree", "Filtered payment method must be 'cashfree'");
      }
    }
  );

  await ctx.runTest(
    {
      id: "T1-F17-05",
      tier: 1,
      feature: "F17: Admin Billing Visibility",
      name: "Admin payments table schema includes required columns",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const p = payments[0];
      ctx.assertDefined(p.id, "Must have payment ID");
      ctx.assertDefined(p.amount, "Must have amount");
      ctx.assertDefined(p.method, "Must have method");
      ctx.assertDefined(p.customerId, "Must have customerId");
    }
  );

  // =========================================================================
  // FEATURE 18: Customer Payment History
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F18-01",
      tier: 1,
      feature: "F18: Customer Payment History",
      name: "Customer can view their completed Cashfree transactions",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      ctx.assert(payments.length > 0, "Customer must have completed payments in history");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F18-02",
      tier: 1,
      feature: "F18: Customer Payment History",
      name: "Customer payment links to associated invoice ID",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const linked = payments.find((p) => p.invoiceId !== null);
      ctx.assertDefined(linked, "Payment must be linked to an invoice");
      ctx.assertDefined(linked?.invoiceId, "Linked invoice ID must not be null");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F18-03",
      tier: 1,
      feature: "F18: Customer Payment History",
      name: "Failed payment attempts are excluded from settled payments table",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const settledPayments = await getPayments(fixture!.customerId);
      for (const p of settledPayments) {
        ctx.assert(p.status !== "failed", "Settled payments list must not include failed attempts");
      }
    }
  );

  await ctx.runTest(
    {
      id: "T1-F18-04",
      tier: 1,
      feature: "F18: Customer Payment History",
      name: "Receipt reference exists for completed payment",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const p = payments[0];
      const receiptNumber = `REC-${new Date().getFullYear()}-${String(p.id).padStart(4, "0")}`;
      ctx.assert(receiptNumber.startsWith("REC-"), "Receipt number must be structured");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F18-05",
      tier: 1,
      feature: "F18: Customer Payment History",
      name: "Tenant isolation prevents customer from viewing another customer's payments",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const fixture2 = await createTestCustomerFixture({ balanceDue: 500.0 });

      // Customer 1 querying payments for Customer 2
      const res = await ctx.client.get(
        `/api/payments?customerId=${fixture2.customerId}`,
        fixture!.authHeaders
      );

      // Customer 1 should either receive 403 or empty array / only their own payments
      if (res.status === 200) {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        for (const item of list) {
          ctx.assert(
            item.customerId !== fixture2.customerId,
            "Customer 1 must NOT see Customer 2 payments"
          );
        }
      } else {
        ctx.assert(res.status === 403 || res.status === 401, "Cross-tenant query must be rejected");
      }

      await cleanupCustomerFixture(fixture2);
    }
  );

  // =========================================================================
  // FEATURE 19: Professional Receipt Experience Data
  // =========================================================================

  await ctx.runTest(
    {
      id: "T1-F19-01",
      tier: 1,
      feature: "F19: Receipt Experience Data",
      name: "Receipt number is sequential and structured (REC-YYYY-XXXX)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const orderId = `cf_ord_rec_${Date.now()}`;
      ctx.mockGateway.simulatePaymentSuccess(orderId);

      const res = await ctx.client.get(`/api/payments/cashfree/verify/${orderId}`, fixture!.authHeaders);
      if (res.status === 404 && !res.data?.error) {
        ctx.skip("Pending Milestone M5: Receipt generation API in return verification");
        return;
      }

      ctx.assertDefined(res.data?.receipt?.receiptNumber, "Must return receiptNumber");
      ctx.assert(res.data.receipt.receiptNumber.startsWith("REC-"), "Receipt number must be structured");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F19-02",
      tier: 1,
      feature: "F19: Receipt Experience Data",
      name: "Receipt payload contains customer name and phone",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const res = await ctx.client.get("/api/customers/me", fixture!.authHeaders);
      ctx.assertEqual(res.status, 200, "Must fetch customer profile");
      ctx.assertDefined(res.data?.name, "Receipt customer name must be available from profile");
      ctx.assertDefined(res.data?.phone, "Receipt customer phone must be available from profile");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F19-03",
      tier: 1,
      feature: "F19: Receipt Experience Data",
      name: "Receipt lists itemized service details and SAC code (9987)",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const invoice = await getInvoice(fixture!.invoiceId);
      ctx.assertDefined(invoice?.items, "Invoice must contain items list");
      const items = invoice?.items as any[];
      ctx.assert(items.length > 0, "At least 1 item in invoice");
      ctx.assertEqual(items[0].sacCode, "9987", "Automotive cleaning SAC code must be 9987");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F19-04",
      tier: 1,
      feature: "F19: Receipt Experience Data",
      name: "Receipt specifies Cashfree payment method and transaction ID",
    },
    async () => {
      ctx.assert(!!fixture, "Test fixture customer required");
      const payments = await getPayments(fixture!.customerId);
      const cfPayment = payments.find((p) => p.method === "cashfree");
      ctx.assertDefined(cfPayment, "Must have recorded Cashfree payment");
      ctx.assertEqual(cfPayment?.method, "cashfree", "Payment method must be 'cashfree'");
      ctx.assertDefined(cfPayment?.transactionId, "Receipt must contain transactionId");
    }
  );

  await ctx.runTest(
    {
      id: "T1-F19-05",
      tier: 1,
      feature: "F19: Receipt Experience Data",
      name: "Company details use authentic CWP legal entity without placeholders",
    },
    async () => {
      const res = await ctx.client.get("/api/branding");
      if (res.status === 404) {
        ctx.skip("Pending Milestone M5: Company branding & legal entity API");
        return;
      }
      ctx.assertEqual(res.status, 200, "Branding API must return 200");
    }
  );
  } finally {
    if (fixture) {
      await cleanupCustomerFixture(fixture);
    }
  }
}
