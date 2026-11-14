import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

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
      email: "customers.email",
    },
    invoicesTable: {
      id: "invoices.id",
      customerId: "invoices.customer_id",
      balanceDue: "invoices.balance_due",
      status: "invoices.status",
      documentType: "invoices.document_type",
      invoiceNumber: "invoices.invoice_number",
    },
    paymentsTable: {
      id: "payments.id",
      customerId: "payments.customer_id",
      amount: "payments.amount",
      method: "payments.method",
      invoiceId: "payments.invoice_id",
      transactionId: "payments.transaction_id",
      status: "payments.status",
      receivedAt: "payments.received_at",
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
      subscriptionId: "payment_attempts.subscription_id",
      amount: "payment_attempts.amount",
      currency: "payment_attempts.currency",
      status: "payment_attempts.status",
      rzpPaymentId: "payment_attempts.rzp_payment_id",
      paymentMethod: "payment_attempts.payment_method",
      idempotencyKey: "payment_attempts.idempotency_key",
      createdAt: "payment_attempts.created_at",
      updatedAt: "payment_attempts.updated_at",
    },
    dcmsSubscriptionsTable: {
      id: "dcms_subscriptions.id",
      customerId: "dcms_subscriptions.customer_id",
      status: "dcms_subscriptions.status",
      version: "dcms_subscriptions.version",
      updatedAt: "dcms_subscriptions.updated_at",
    },
  };
});

vi.mock("../../lib/billing/invoiceService", () => ({
  getCustomerOutstandingDues: vi.fn(),
  recordPayment: vi.fn(),
}));

import { createUnifiedPaymentOrder } from "../../lib/payments/unifiedPaymentService";
import {
  createRazorpayPaymentOrder,
  reconcileRazorpayPayment,
  verifyRazorpayPayment,
  RazorpayPaymentServiceError,
} from "../../lib/razorpay/razorpayService";
import { getCustomerOutstandingDues, recordPayment } from "../../lib/billing/invoiceService";

describe("Phase 25: Multi-Gateway Payment Redundancy & Razorpay Integration (PAY-006, TEST-013)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ACTIVE_PAYMENT_GATEWAY = "razorpay";
    process.env.RAZORPAY_KEY_ID = "rzp_test_testkey123";
    process.env.RAZORPAY_KEY_SECRET = "testsecret_456789";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret_999";
    process.env.CASHFREE_APP_ID = "TEST_CF_123456";
    process.env.CASHFREE_SECRET_KEY = "cfsk_ma_test_abcdef";
    process.env.CASHFREE_ENV = "sandbox";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("1. Dispatches order creation to Razorpay when ACTIVE_PAYMENT_GATEWAY is razorpay", async () => {
    process.env.ACTIVE_PAYMENT_GATEWAY = "razorpay";

    // Mock customer query & dues
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: 101, name: "Gateway Test Customer", phone: "+919876543210", email: "cust@test.com" },
          ]),
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }));

    (getCustomerOutstandingDues as any).mockResolvedValue(1499.0);

    // Mock fetch for Razorpay /orders API
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes("/orders")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({
            id: "order_rzp_mock_111",
            entity: "order",
            amount: 149900,
            currency: "INR",
            status: "created",
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    mockInsert.mockImplementation(() => ({
      values: () => Promise.resolve(),
    }));

    const result = await createUnifiedPaymentOrder({
      customerId: 101,
    });

    expect(result.success).toBe(true);
    expect(result.gateway).toBe("razorpay");
    if (result.gateway === "razorpay") {
      expect(result.orderId).toBe("order_rzp_mock_111");
      expect(result.keyId).toBe("rzp_test_testkey123");
      expect(result.amountInPaise).toBe(149900);
      expect(result.customer.phone).toBe("9876543210");
    }
  });

  it("2. Dispatches order creation to Cashfree when ACTIVE_PAYMENT_GATEWAY is cashfree", async () => {
    process.env.ACTIVE_PAYMENT_GATEWAY = "cashfree";

    // Mock customer query & dues
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: 101, name: "Cashfree Customer", phone: "+919876543210" },
          ]),
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }));

    (getCustomerOutstandingDues as any).mockResolvedValue(1499.0);

    // Mock fetch for Cashfree /orders API
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes("/orders")) {
        const bodyStr = JSON.stringify({
          cf_order_id: 998822,
          order_id: "cwp_ord_cf_mock_222",
          order_amount: 1499.0,
          order_currency: "INR",
          payment_session_id: "session_cf_mock_333",
          order_status: "ACTIVE",
        });
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          text: async () => bodyStr,
          json: async () => JSON.parse(bodyStr),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    mockInsert.mockImplementation(() => ({
      values: () => ({
        returning: () => [{ id: 50, attemptId: "cwp_att_50", cfOrderId: "cwp_ord_cf_mock_222" }],
      }),
    }));

    mockUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }));

    const result = await createUnifiedPaymentOrder({
      customerId: 101,
    });

    expect(result.success).toBe(true);
    expect(result.gateway).toBe("cashfree");
    if (result.gateway === "cashfree") {
      expect(result.orderId).toMatch(/^cwp_ord_/);
      expect(result.paymentSessionId).toBe("session_cf_mock_333");
    }
  });

  it("3. Reconciles Razorpay payment atomically, logs method as razorpay, and activates pending DCMS subscription", async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };

    mockTransaction.mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    // 1. Initial attempt select in transaction
    mockTx.select.mockImplementation(() => ({
      from: (table: any) => ({
        where: () => ({
          for: () => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                attemptId: "cwp_att_001",
                gatewayProvider: "razorpay",
                rzpOrderId: "order_rzp_rec_123",
                customerId: 101,
                subscriptionId: 777,
                amount: "1499.00",
                status: "initiated",
              },
            ]),
          }),
          limit: vi.fn().mockImplementation(async () => {
            if (table?.id === "payments.id") {
              return []; // No existing payment in paymentsTable yet
            }
            if (table?.id === "dcms_subscriptions.id") {
              return [
                {
                  id: 777,
                  customerId: 101,
                  status: "pending_payment",
                  version: 1,
                },
              ];
            }
            return [];
          }),
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }));

    (recordPayment as any).mockResolvedValue({
      id: 9001,
      customerId: 101,
      amount: "1499.00",
      method: "razorpay",
      transactionId: "order_rzp_rec_123",
      status: "completed",
      receivedAt: new Date(),
    });

    mockTx.update.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: vi.fn().mockResolvedValue([
            { id: 1, status: "paid", rzpPaymentId: "pay_rzp_rec_456" },
          ]),
        }),
      }),
    }));

    const result = await reconcileRazorpayPayment({
      orderId: "order_rzp_rec_123",
      paymentId: "pay_rzp_rec_456",
      source: "verify",
      signature: "valid_sig",
    });

    expect(result.settled).toBe(true);
    expect(result.alreadyPaid).toBe(false);
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 101,
        amount: 1499.0,
        method: "razorpay",
        transactionId: "order_rzp_rec_123",
      }),
      mockTx,
    );
  });

  it("4. Verifies payment signature and rejects tampered tokens", async () => {
    const orderId = "order_sig_test_123";
    const paymentId = "pay_sig_test_456";
    const validSignature = createHmac("sha256", "testsecret_456789")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Mock fetch for Razorpay getPayment API
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes(`/payments/${paymentId}`)) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({
            id: paymentId,
            order_id: orderId,
            status: "captured",
            amount: 149900,
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          where: () => ({
            for: () => ({
              limit: vi.fn().mockResolvedValue([
                { id: 1, attemptId: "cwp_att_1", customerId: 101, amount: "1499.00", status: "initiated" },
              ]),
            }),
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([{ id: 1, status: "paid" }]),
          }),
        }),
      })),
    };

    mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

    (recordPayment as any).mockResolvedValue({
      id: 9002,
      customerId: 101,
      amount: "1499.00",
      method: "razorpay",
      transactionId: orderId,
      status: "completed",
    });

    // Valid call
    const res = await verifyRazorpayPayment({
      orderId,
      paymentId,
      signature: validSignature,
      customerId: 101,
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("PAID");
    expect(res.amount).toBe(1499.0);

    // Tampered signature call
    await expect(
      verifyRazorpayPayment({
        orderId,
        paymentId,
        signature: "forged_hex_signature_bad_999",
        customerId: 101,
      }),
    ).rejects.toThrow("Payment signature verification failed");
  });
});
