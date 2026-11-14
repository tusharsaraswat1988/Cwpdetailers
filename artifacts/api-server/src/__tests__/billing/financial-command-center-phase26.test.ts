import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => mockSelect(),
      insert: () => mockInsert(),
      update: () => mockUpdate(),
      transaction: (cb: any) => mockTransaction(cb),
    },
    customersTable: {
      id: "customers.id",
      name: "customers.name",
      phone: "customers.phone",
      city: "customers.city",
    },
    invoicesTable: {
      id: "invoices.id",
      customerId: "invoices.customer_id",
      balanceDue: "invoices.balance_due",
      dueAmount: "invoices.due_amount",
      totalAmount: "invoices.total_amount",
      discount: "invoices.discount",
      status: "invoices.status",
      documentType: "invoices.document_type",
      invoiceNumber: "invoices.invoice_number",
      bookingId: "invoices.booking_id",
      branchId: "invoices.branch_id",
    },
    paymentsTable: {
      id: "payments.id",
      customerId: "payments.customer_id",
      amount: "payments.amount",
      method: "payments.method",
      invoiceId: "payments.invoice_id",
      bookingId: "payments.booking_id",
      transactionId: "payments.transaction_id",
      status: "payments.status",
      refundStatus: "payments.refund_status",
      refundedAmount: "payments.refunded_amount",
      reconciliationStatus: "payments.reconciliation_status",
      reconciledAt: "payments.reconciled_at",
      notes: "payments.notes",
      receivedAt: "payments.received_at",
      createdAt: "payments.created_at",
    },
    paymentAttemptsTable: {
      id: "payment_attempts.id",
      attemptId: "payment_attempts.attempt_id",
      gatewayProvider: "payment_attempts.gateway_provider",
      cfOrderId: "payment_attempts.cf_order_id",
      rzpOrderId: "payment_attempts.rzp_order_id",
      gatewayOrderId: "payment_attempts.gateway_order_id",
      customerId: "payment_attempts.customer_id",
      invoiceId: "payment_attempts.invoice_id",
      bookingId: "payment_attempts.booking_id",
      subscriptionId: "payment_attempts.subscription_id",
      amount: "payment_attempts.amount",
      currency: "payment_attempts.currency",
      status: "payment_attempts.status",
      cfPaymentId: "payment_attempts.cf_payment_id",
      rzpPaymentId: "payment_attempts.rzp_payment_id",
      paymentMethod: "payment_attempts.payment_method",
      refundStatus: "payment_attempts.refund_status",
      refundedAmount: "payment_attempts.refunded_amount",
      reconciliationStatus: "payment_attempts.reconciliation_status",
      reconciledAt: "payment_attempts.reconciled_at",
      reconciliationNotes: "payment_attempts.reconciliation_notes",
      idempotencyKey: "payment_attempts.idempotency_key",
      createdAt: "payment_attempts.created_at",
      updatedAt: "payment_attempts.updated_at",
    },
    paymentRefundsTable: {
      id: "payment_refunds.id",
      refundId: "payment_refunds.refund_id",
      paymentId: "payment_refunds.payment_id",
      attemptId: "payment_refunds.attempt_id",
      customerId: "payment_refunds.customer_id",
      bookingId: "payment_refunds.booking_id",
      invoiceId: "payment_refunds.invoice_id",
      cityId: "payment_refunds.city_id",
      branchId: "payment_refunds.branch_id",
      amount: "payment_refunds.amount",
      reason: "payment_refunds.reason",
      status: "payment_refunds.status",
      gatewayProvider: "payment_refunds.gateway_provider",
      cfRefundId: "payment_refunds.cf_refund_id",
      gatewayRefundId: "payment_refunds.gateway_refund_id",
      createdAt: "payment_refunds.created_at",
    },
    bookingsTable: {
      id: "bookings.id",
      serviceType: "bookings.service_type",
      scheduledDate: "bookings.scheduled_date",
    },
    branchesTable: {
      id: "branches.id",
      name: "branches.name",
    },
    citiesTable: {
      id: "cities.id",
      name: "cities.name",
    },
    adminAuditLogsTable: {
      id: "admin_audit_logs.id",
      userId: "admin_audit_logs.user_id",
      action: "admin_audit_logs.action",
      resourceType: "admin_audit_logs.resource_type",
      resourceId: "admin_audit_logs.resource_id",
      previousValues: "admin_audit_logs.previous_values",
      newValues: "admin_audit_logs.new_values",
      reason: "admin_audit_logs.reason",
      createdAt: "admin_audit_logs.created_at",
    },
    dcmsSubscriptionsTable: {
      id: "dcms_subscriptions.id",
    },
  };
});

// Import services after mocks
import { getRefundableBalance, initiateRefund } from "../../lib/payments/refundService";
import { runReconciliationAnalysis } from "../../lib/payments/reconciliationService";
import { getRevenueIntelligence } from "../../lib/payments/revenueIntelligenceService";
import { handleCashfreeWebhookPayload } from "../../lib/cashfree/cashfreeService";

describe("Phase 26: Financial Command Center & Payment Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. REFUND ENGINE & OVER-REFUND DEFENSE ───
  describe("Refund Management & Balance Validation (PAY-007)", () => {
    it("correctly calculates refundable balance deducting previously approved refunds", async () => {
      // 1. Payment query mock
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 101,
                amount: "1500.00",
                status: "completed",
                customerId: 42,
                transactionId: "cf_ord_test_101",
                refundStatus: "none",
                refundedAmount: "0",
              },
            ]),
          }),
        }),
      });

      // 2. Attempt query mock
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 201,
                cfOrderId: "cf_ord_test_101",
                gatewayProvider: "cashfree",
              },
            ]),
          }),
        }),
      });

      // 3. Prior refunds sum query mock (e.g. ₹500 already refunded)
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ total: "500.00" }]),
        }),
      });

      const balance = await getRefundableBalance("pay_101");
      expect(balance.originalAmount).toBe(1500);
      expect(balance.previouslyRefundedAmount).toBe(500);
      expect(balance.refundableBalance).toBe(1000);
      expect(balance.canRefund).toBe(true);
      expect(balance.gatewayProvider).toBe("cashfree");
    });

    it("prevents over-refunding when requested amount exceeds refundable balance", async () => {
      // Payment mock: original 1000, 800 already refunded
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 102,
                amount: "1000.00",
                status: "completed",
                customerId: 42,
                transactionId: "cf_ord_102",
              },
            ]),
          }),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ total: "800.00" }]),
        }),
      });

      await expect(
        initiateRefund({
          transactionId: "pay_102",
          amount: 300, // Exceeds balance of 200
          reason: "Customer complaint compensation",
        }),
      ).rejects.toThrow(/exceeds available refundable balance/i);
    });

    it("rejects refund requests without a mandatory operational reason", async () => {
      await expect(
        initiateRefund({
          transactionId: "pay_101",
          amount: 100,
          reason: "   ",
        }),
      ).rejects.toThrow(/valid refund reason is required/i);
    });
  });

  // ─── 2. PAYMENT RECONCILIATION ENGINE ───
  describe("Payment Reconciliation Engine (PAY-008)", () => {
    it("categorizes matched, amount mismatch, and gateway without internal transactions", async () => {
      // Mock paymentsTable query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            leftJoin: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockReturnValueOnce({
                orderBy: vi.fn().mockResolvedValueOnce([
                  {
                    payment: {
                      id: 1,
                      amount: "1200.00",
                      transactionId: "order_matched_1",
                      status: "completed",
                      method: "cashfree",
                      customerId: 10,
                      createdAt: new Date(),
                    },
                    customer: { name: "Alice Sharma", phone: "9876543210", city: "Noida" },
                    invoice: { id: 50, invoiceNumber: "INV-50", bookingId: 100 },
                  },
                  {
                    payment: {
                      id: 2,
                      amount: "1000.00",
                      transactionId: "order_mismatch_2",
                      status: "completed",
                      method: "cashfree",
                      customerId: 11,
                      createdAt: new Date(),
                    },
                    customer: { name: "Bob Verma", phone: "9811122233", city: "Varanasi" },
                    invoice: { id: 51, invoiceNumber: "INV-51", bookingId: 101 },
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      // Mock paymentAttemptsTable query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            leftJoin: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockReturnValueOnce({
                orderBy: vi.fn().mockResolvedValueOnce([
                  {
                    attempt: {
                      id: 1,
                      cfOrderId: "order_matched_1",
                      amount: "1200.00",
                      status: "paid",
                      gatewayProvider: "cashfree",
                      customerId: 10,
                      createdAt: new Date(),
                    },
                    customer: { name: "Alice Sharma", city: "Noida" },
                    invoice: { id: 50 },
                  },
                  {
                    attempt: {
                      id: 2,
                      cfOrderId: "order_mismatch_2",
                      amount: "1500.00", // Mismatch: 1500 vs 1000
                      status: "paid",
                      gatewayProvider: "cashfree",
                      customerId: 11,
                      createdAt: new Date(),
                    },
                    customer: { name: "Bob Verma", city: "Varanasi" },
                    invoice: { id: 51 },
                  },
                  {
                    attempt: {
                      id: 3,
                      cfOrderId: "order_missing_internal_3",
                      amount: "2000.00",
                      status: "paid", // Paid at gateway but missing internally!
                      gatewayProvider: "cashfree",
                      customerId: 12,
                      createdAt: new Date(),
                    },
                    customer: { name: "Charlie Singh", city: "Noida" },
                    invoice: { id: 52 },
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const { items, summary } = await runReconciliationAnalysis();

      expect(summary.totalTransactions).toBe(3);
      expect(summary.matchedCount).toBe(1);
      expect(summary.amountMismatchCount).toBe(1);
      expect(summary.missingInternalCount).toBe(1);
      expect(summary.reconciliationHealthScore).toBe(33.3);

      const matchedItem = items.find((it) => it.category === "MATCHED");
      expect(matchedItem).toBeDefined();
      expect(matchedItem?.orderId).toBe("order_matched_1");

      const mismatchItem = items.find((it) => it.category === "AMOUNT_MISMATCH");
      expect(mismatchItem).toBeDefined();
      expect(mismatchItem?.discrepancyAmount).toBe(500);

      const missingInternalItem = items.find((it) => it.category === "GATEWAY_WITHOUT_INTERNAL");
      expect(missingInternalItem).toBeDefined();
      expect(missingInternalItem?.orderId).toBe("order_missing_internal_3");
      expect(missingInternalItem?.canAutoReconcile).toBe(true);
    });
  });

  // ─── 3. REVENUE INTELLIGENCE METRICS ───
  describe("Revenue Intelligence & Financial Definitions (PAY-009)", () => {
    it("computes Gross Volume, Net Collected (Collected - Refunds), and Success Rate", async () => {
      // 1. Mock completed payments query (Total 3000)
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            leftJoin: vi.fn().mockReturnValueOnce({
              leftJoin: vi.fn().mockReturnValueOnce({
                where: vi.fn().mockResolvedValueOnce([
                  {
                    payment: { id: 1, amount: "2000.00", createdAt: new Date() },
                    customer: { city: "Noida" },
                    invoice: { branchId: 1, items: [{ description: "Daily Car Cleaning Monthly" }] },
                    branch: { name: "Noida Branch" },
                  },
                  {
                    payment: { id: 2, amount: "1000.00", createdAt: new Date() },
                    customer: { city: "Varanasi" },
                    invoice: { branchId: 2, items: [{ description: "Full Body Wash" }] },
                    branch: { name: "Varanasi Hub" },
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      // 2. Mock payment attempts query (1 success + 1 failed of 500)
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([
              { attempt: { amount: "2000.00", status: "paid" }, customer: { city: "Noida" } },
              { attempt: { amount: "1000.00", status: "paid" }, customer: { city: "Varanasi" } },
              { attempt: { amount: "500.00", status: "failed" }, customer: { city: "Noida" } },
            ]),
          }),
        }),
      });

      // 3. Mock refunds query (Total 400)
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 1, amount: "400.00", status: "succeeded" },
          ]),
        }),
      });

      // 4. Mock invoice dues query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ total: "1300.00" }]),
        }),
      });

      const metrics = await getRevenueIntelligence();

      expect(metrics.successfulPaymentAmount).toBe(3000);
      expect(metrics.refundAmount).toBe(400);
      expect(metrics.netCollectedAmount).toBe(2600); // 3000 - 400
      expect(metrics.grossPaymentVolume).toBe(3500); // 3000 + 500 failed
      expect(metrics.failedPaymentAmount).toBe(500);
      expect(metrics.averageTransactionValue).toBe(1500); // 3000 / 2
      expect(metrics.cityBreakdown.length).toBe(2);

      // Verify financial definitions are documented
      expect(metrics.financialDefinitions.netCollectedAmount).toBeDefined();
      expect(metrics.financialDefinitions.bookingValue).toBeDefined();
    });
  });

  // ─── 4. CASHFREE WEBHOOK RELIABILITY & REFUNDS ───
  describe("Webhook Reliability & Refund Status Processing (PAY-010)", () => {
    it("handles REFUND_STATUS_WEBHOOK and updates payment_refunds table status", async () => {
      // 1. Mock attempt lookup
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: 10, cfOrderId: "order_ref_test", status: "paid" },
            ]),
          }),
        }),
      });

      // 2. Mock paymentRefunds lookup
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: 5, refundId: "ref_12345", status: "pending" },
            ]),
          }),
        }),
      });

      const updateSet = vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ id: 5 }]),
      });
      mockUpdate.mockReturnValueOnce({ set: updateSet });

      const webhookPayload = {
        type: "REFUND_STATUS_WEBHOOK",
        data: {
          order: { order_id: "order_ref_test" },
          refund: {
            refund_id: "ref_12345",
            cf_refund_id: "cf_ref_999",
            refund_status: "SUCCESS",
            refund_amount: 500,
          },
        },
      };

      const result = await handleCashfreeWebhookPayload(webhookPayload);
      expect(result.received).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
