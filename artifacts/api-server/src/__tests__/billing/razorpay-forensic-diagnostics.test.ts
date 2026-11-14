import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRazorpayPaymentOrder,
  recordRazorpayCheckoutFailure,
  verifyRazorpayPayment,
  handleRazorpayWebhookPayload,
  RazorpayPaymentServiceError,
} from "../../lib/razorpay/razorpayService";
import { RazorpayClient } from "../../lib/razorpay/razorpayClient";
import { RazorpayError } from "../../lib/razorpay/razorpayError";
import { getRazorpayConfig } from "../../lib/razorpay/razorpayConfig";
import { db, paymentAttemptsTable, customersTable, invoicesTable } from "@workspace/db";
import { createHmac } from "node:crypto";

// Mock DB
vi.mock("@workspace/db", () => {
  const mockDb: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    db: mockDb,
    customersTable: {
      id: "id",
      name: "name",
      phone: "phone",
      email: "email",
    },
    invoicesTable: {
      id: "id",
      customerId: "customerId",
      balanceDue: "balanceDue",
      status: "status",
      documentType: "documentType",
      dueAmount: "dueAmount",
    },
    paymentAttemptsTable: {
      id: "id",
      attemptId: "attemptId",
      rzpOrderId: "rzpOrderId",
      gatewayOrderId: "gatewayOrderId",
      status: "status",
      amount: "amount",
      currency: "currency",
      customerId: "customerId",
      invoiceId: "invoiceId",
      idempotencyKey: "idempotencyKey",
      gatewayProvider: "gatewayProvider",
      metadata: "metadata",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    paymentWebhookEventsTable: {
      id: "id",
      eventId: "eventId",
      status: "status",
    },
    paymentsTable: {
      id: "id",
      customerId: "customerId",
      transactionId: "transactionId",
      receivedAt: "receivedAt",
      amount: "amount",
    },
    dcmsSubscriptionsTable: {
      id: "id",
      status: "status",
      version: "version",
      customerId: "customerId",
    },
  };
});

vi.mock("../../lib/billing/invoiceService", () => ({
  getCustomerOutstandingDues: vi.fn(),
  recordPayment: vi.fn(),
}));

import { getCustomerOutstandingDues, recordPayment } from "../../lib/billing/invoiceService";

describe("Razorpay Forensic Diagnostics & Reliability Framework (PAY-011)", () => {
  const dummyConfig = {
    keyId: "rzp_live_testdummy123",
    keySecret: "live_secret_456789",
    webhookSecret: "whsec_test_secret_999",
    env: "production" as const,
    baseUrl: "https://api.razorpay.com/v1",
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.RAZORPAY_KEY_ID = dummyConfig.keyId;
    process.env.RAZORPAY_KEY_SECRET = dummyConfig.keySecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = dummyConfig.webhookSecret;
  });

  it("FINDING 1 & 2: records Stage 11 CHECKOUT_FAILURE_RECEIVED into payment attempts metadata", async () => {
    const existingAttempt = {
      id: 55,
      attemptId: "cwp_att_1794000_abc",
      rzpOrderId: "order_test_fail_111",
      customerId: 20,
      status: "initiated",
      metadata: { keyId: dummyConfig.keyId, correlationId: "cwp_cor_init_001" },
    };

    const mockSelectWhere = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([existingAttempt]),
    });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockSelectWhere,
      }),
    } as any);

    let updatedFields: any = null;
    const mockUpdateWhere = vi.fn().mockImplementation(() => {
      return Promise.resolve();
    });
    const mockUpdateSet = vi.fn().mockImplementation((fields) => {
      updatedFields = fields;
      return { where: mockUpdateWhere };
    });
    vi.mocked(db.update).mockReturnValue({
      set: mockUpdateSet,
    } as any);

    const result = await recordRazorpayCheckoutFailure({
      orderId: "order_test_fail_111",
      customerId: 20,
      correlationId: "cwp_cor_fail_999",
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Payment has failed due to an issue with the merchant",
        source: "business",
        step: "payment_initiation",
        reason: "merchant_account_under_review",
        metadata: {
          order_id: "order_test_fail_111",
          payment_id: "pay_failed_xyz",
        },
      },
    });

    expect(result.recorded).toBe(true);
    expect(result.attemptId).toBe("cwp_att_1794000_abc");
    expect(updatedFields.status).toBe("failed");
    expect(updatedFields.metadata.lastFailure.code).toBe("BAD_REQUEST_ERROR");
    expect(updatedFields.metadata.lastFailure.reason).toBe("merchant_account_under_review");
    expect(updatedFields.metadata.lastFailure.source).toBe("business");
    expect(updatedFields.metadata.lastFailure.correlationId).toBe("cwp_cor_fail_999");
  });

  it("FINDING 3: refuses to reuse active session if created with a different keyId", async () => {
    const customer = {
      id: 20,
      name: "Tushar Customer",
      phone: "7054007733",
      email: "tushar@example.com",
    };

    // Mock customer lookup
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([customer]),
        }),
      }),
    } as any);

    // Mock outstanding dues = 1300
    vi.mocked(getCustomerOutstandingDues).mockResolvedValue(1300);

    // Mock active attempt in DB from an OLD or DIFFERENT key (rzp_live_OLD_KEY)
    const oldAttempt = {
      id: 70,
      attemptId: "cwp_att_old_key",
      rzpOrderId: "order_old_key_123",
      amount: "1300.00",
      currency: "INR",
      status: "initiated",
      customerId: 20,
      metadata: { keyId: "rzp_test_mismatched_key" },
      createdAt: new Date(),
    };

    // Reuse query returns oldAttempt
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([oldAttempt]),
          }),
        }),
      }),
    } as any);

    // Mock Razorpay API call for fresh order creation
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({
        id: "order_fresh_live_999",
        amount: 130000,
        currency: "INR",
        status: "created",
      }),
    }));

    // Mock insert
    vi.mocked(db.insert).mockReturnValue({
      values: () => Promise.resolve(),
    } as any);

    const result = await createRazorpayPaymentOrder({
      customerId: 20,
      correlationId: "cwp_cor_fresh_order",
    });

    // Order ID MUST NOT be order_old_key_123; it MUST create a fresh order on the current key!
    expect(result.orderId).toBe("order_fresh_live_999");
    expect(result.keyId).toBe(dummyConfig.keyId);
  });

  it("FINDING 4: captures full structured error details when Razorpay API order creation fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 400,
      headers: {
        get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "The amount must be an integer paise value",
          field: "amount",
          source: "business",
          step: "order_creation",
          reason: "amount_invalid",
        },
      }),
    }));

    const client = new RazorpayClient(dummyConfig);

    try {
      await client.createOrder({
        amount: 100.5,
        currency: "INR",
        receipt: "rcpt_test",
      });
      expect.fail("Expected createOrder to throw");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RazorpayError);
      expect(err.code).toBe("BAD_REQUEST_ERROR");
      expect(err.description).toBe("The amount must be an integer paise value");
      expect(err.field).toBe("amount");
      expect(err.source).toBe("business");
      expect(err.step).toBe("order_creation");
      expect(err.reason).toBe("amount_invalid");
      expect(err.statusCode).toBe(400);
    }
  });

  it("FINDING 5: returns clean zero balance response when customer has no outstanding dues", async () => {
    const customer = {
      id: 20,
      name: "Tushar Customer",
      phone: "7054007733",
      email: "tushar@example.com",
    };

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([customer]),
        }),
      }),
    } as any);

    vi.mocked(getCustomerOutstandingDues).mockResolvedValue(0);

    try {
      await createRazorpayPaymentOrder({
        customerId: 20,
        correlationId: "cwp_cor_zero_dues",
      });
      expect.fail("Expected zero dues to throw NO_OUTSTANDING_BALANCE");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RazorpayPaymentServiceError);
      expect(err.code).toBe("NO_OUTSTANDING_BALANCE");
      expect(err.statusCode).toBe(200);
      expect(err.correlationId).toBe("cwp_cor_zero_dues");
    }
  });

  it("FINDING 7: preserves strict HMAC webhook signature verification and rejects forged payloads", async () => {
    const rawPayload = Buffer.from(JSON.stringify({
      entity: "event",
      account_id: "acc_live_123",
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test_001", order_id: "order_test_001", status: "captured" } } },
    }));

    const validSig = createHmac("sha256", dummyConfig.webhookSecret)
      .update(rawPayload)
      .digest("hex");

    // Invalid signature must reject with HTTP 400
    await expect(
      handleRazorpayWebhookPayload(rawPayload, "invalid_forged_signature_hex", "evt_bad_01"),
    ).rejects.toThrow("Invalid webhook signature");

    // Valid signature is accepted
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      return cb({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
              for: () => ({
                limit: () => Promise.resolve([{
                  id: 99,
                  amount: "1300.00",
                  customerId: 20,
                  status: "initiated",
                }]),
              }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([{ id: 99, status: "paid" }]),
            }),
          }),
        }),
      });
    });

    vi.mocked(recordPayment).mockResolvedValue({ id: 1001, amount: "1300.00" } as any);

    const result = await handleRazorpayWebhookPayload(rawPayload, validSig, "evt_good_01");
    expect(result.received).toBe(true);
  });
});
