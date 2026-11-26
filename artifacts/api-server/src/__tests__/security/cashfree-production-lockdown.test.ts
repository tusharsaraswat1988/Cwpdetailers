import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function createQueryMock(defaultResult: any[] = []) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    for: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(defaultResult)),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    then: (resolve: any, reject?: any) => Promise.resolve(defaultResult).then(resolve, reject),
  };
  return chain;
}

// Mocks for DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTxSelect = vi.fn();
const mockTxInsert = vi.fn();
const mockTxValues = vi.fn();
const mockTxUpdate = vi.fn();

const mockTransaction = vi.fn((cb) => {
  const tx = {
    select: () => mockTxSelect(),
    insert: (table?: any) => {
      mockTxInsert(table);
      return {
        values: (val?: any) => {
          mockTxValues(val);
          return {
            onConflictDoUpdate: () => ({
              returning: vi.fn().mockResolvedValue([{ id: 9901, amount: "150.00" }]),
              then: (res: any) => Promise.resolve([{ id: 9901, amount: "150.00" }]).then(res),
            }),
            returning: vi.fn().mockResolvedValue([{ id: 9901, amount: "150.00" }]),
            then: (res: any) => Promise.resolve([{ id: 9901, amount: "150.00" }]).then(res),
          };
        },
      };
    },
    update: () => mockTxUpdate(),
  };
  return cb(tx);
});

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
      totalDues: "customers.total_dues",
    },
    invoicesTable: {
      id: "invoices.id",
      customerId: "invoices.customer_id",
      balanceDue: "invoices.balance_due",
      status: "invoices.status",
    },
    paymentsTable: {
      id: "payments.id",
      customerId: "payments.customer_id",
      amount: "payments.amount",
      method: "payments.method",
      transactionId: "payments.transaction_id",
      status: "payments.status",
      notes: "payments.notes",
      receivedAt: "payments.received_at",
    },
    paymentAttemptsTable: {
      id: "payment_attempts.id",
      cfOrderId: "payment_attempts.cf_order_id",
      customerId: "payment_attempts.customer_id",
      invoiceId: "payment_attempts.invoice_id",
      amount: "payment_attempts.amount",
      status: "payment_attempts.status",
      cfPaymentId: "payment_attempts.cf_payment_id",
      updatedAt: "payment_attempts.updated_at",
    },
    paymentRefundsTable: {
      id: "payment_refunds.id",
    },
    dcmsSubscriptionsTable: {
      id: "dcms_subscriptions.id",
    },
  };
});

// Mock CashfreeClient to avoid live gateway requests during tests
vi.mock("../../lib/cashfree/cashfreeClient", () => {
  return {
    CashfreeClient: vi.fn().mockImplementation(() => {
      return {
        getOrder: vi.fn().mockRejectedValue({ statusCode: 404, message: "Order not found" }),
        getOrderPayments: vi.fn().mockResolvedValue([]),
      };
    }),
  };
});

import {
  isCashfreeTestFixtureAllowed,
  getCashfreeBaseUrl,
  resolveCashfreeEnvironment,
  CashfreeConfigError,
} from "../../lib/cashfree/cashfreeConfig";
import {
  reconcileCashfreePayment,
  verifyCashfreePaymentOrder,
  handleCashfreeWebhookPayload,
  PaymentServiceError,
} from "../../lib/cashfree/cashfreeService";

describe("SEC-P1-02: Cashfree Test Fixture & Mock Lookup Production Lockdown", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    mockSelect.mockImplementation(() => createQueryMock([]));
    mockTxSelect.mockImplementation(() => createQueryMock([]));

    mockTxInsert.mockReturnValue({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: vi.fn().mockResolvedValue([{ id: 9901, amount: "1000.00" }]),
          then: (res: any) => Promise.resolve([{ id: 9901, amount: "1000.00" }]).then(res),
        }),
        returning: vi.fn().mockResolvedValue([{ id: 9901, amount: "1000.00" }]),
        then: (res: any) => Promise.resolve([{ id: 9901, amount: "1000.00" }]).then(res),
      }),
    });

    mockTxUpdate.mockReturnValue({
      set: () => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
          then: (res: any) => Promise.resolve([]).then(res),
        })),
        then: (res: any) => Promise.resolve([]).then(res),
      }),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Environment Isolation & Protection", () => {
    it("strictly disallows fixtures when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES;
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      // Even if someone tries to enable the dev flag in production
      process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES = "true";
      expect(isCashfreeTestFixtureAllowed()).toBe(false);
    });

    it("fails closed when NODE_ENV is missing, empty, or unknown (staging, qa)", () => {
      delete process.env.NODE_ENV;
      delete process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES;
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      process.env.NODE_ENV = "";
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      process.env.NODE_ENV = "staging";
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      process.env.NODE_ENV = "qa";
      expect(isCashfreeTestFixtureAllowed()).toBe(false);
    });

    it("allows fixtures in development ONLY when CWP_ALLOW_TEST_PAYMENT_FIXTURES is explicitly 'true'", () => {
      process.env.NODE_ENV = "development";
      delete process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES;
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES = "false";
      expect(isCashfreeTestFixtureAllowed()).toBe(false);

      process.env.CWP_ALLOW_TEST_PAYMENT_FIXTURES = "true";
      expect(isCashfreeTestFixtureAllowed()).toBe(true);
    });

    it("allows fixtures in test runner (NODE_ENV === 'test')", () => {
      process.env.NODE_ENV = "test";
      expect(isCashfreeTestFixtureAllowed()).toBe(true);
    });

    it("strictly ignores CASHFREE_BASE_URL override in production", () => {
      process.env.NODE_ENV = "production";
      process.env.CASHFREE_BASE_URL = "http://malicious-gateway-or-mock.local/pg";

      // Must ignore override in production and point strictly to canonical Cashfree endpoint
      expect(getCashfreeBaseUrl("production")).toBe("https://api.cashfree.com/pg");
      expect(getCashfreeBaseUrl("sandbox")).toBe("https://sandbox.cashfree.com/pg");
    });

    it("allows CASHFREE_BASE_URL override in non-production test environments", () => {
      process.env.NODE_ENV = "test";
      process.env.CASHFREE_BASE_URL = "http://127.0.0.1:9999/pg";
      expect(getCashfreeBaseUrl("sandbox")).toBe("http://127.0.0.1:9999/pg");
    });

    it("throws CashfreeConfigError if test/sandbox credentials are configured in production", () => {
      process.env.NODE_ENV = "production";

      expect(() => {
        resolveCashfreeEnvironment("TEST_12345", "prod_secret");
      }).toThrow(CashfreeConfigError);

      expect(() => {
        resolveCashfreeEnvironment("app_prod", "cfsk_ma_test_abc123");
      }).toThrow(CashfreeConfigError);

      try {
        resolveCashfreeEnvironment("TEST_12345", "prod_secret");
      } catch (err: any) {
        expect(err.code).toBe("INVALID_PRODUCTION_CREDENTIALS");
      }
    });
  });

  describe("2. Payment Integrity & Mock Lockdown in Production", () => {
    it("does not trigger fixture mock insertion when orderId contains 'rec_idem' in production", async () => {
      process.env.NODE_ENV = "production";
      const orderId = `cf_ord_rec_idem_attack_${Date.now()}`;

      // In production, 'rec_idem' must not be intercepted as a fixture shortcut.
      // With empty attempt and no customer, it must reject with UNRESOLVED_CUSTOMER.
      await expect(
        reconcileCashfreePayment({
          orderId,
          paymentAmount: 1000.0,
          customerId: undefined,
          source: "webhook",
        }),
      ).rejects.toThrow(/customer could not be resolved/);

      // mockTxValues should NOT have been called with mock fixture record
      expect(mockTxValues).not.toHaveBeenCalled();
    });

    it("does not trigger fixture mock insertion when orderId contains 'replay_5x' in production", async () => {
      process.env.NODE_ENV = "production";
      const orderId = `cf_ord_replay_5x_attack_${Date.now()}`;

      await expect(
        reconcileCashfreePayment({
          orderId,
          paymentAmount: 2000.0,
          customerId: undefined,
          source: "webhook",
        }),
      ).rejects.toThrow(/customer could not be resolved/);

      expect(mockTxValues).not.toHaveBeenCalled();
    });

    it("does not override amount with s5_highload in production", async () => {
      process.env.NODE_ENV = "production";
      const orderId = `cf_s5_highload_attack_${Date.now()}`;

      const res = await reconcileCashfreePayment({
        orderId,
        paymentAmount: 150.0,
        customerId: 42,
        source: "webhook",
      });

      // Effective amount should remain 150.0 and NOT be overridden to 5000.0
      expect(res.settled).toBe(true);
      expect(mockTxValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "150.00",
        }),
      );
    });

    it("does not return early settled=true for 'cf_raw_' or 'cf_ord_webhook_' in production", async () => {
      process.env.NODE_ENV = "production";
      const rawOrderId = `cf_raw_spoof_${Date.now()}`;

      // In production, !attempt and cf_raw_ must NOT return settled: true shortcut
      await expect(
        reconcileCashfreePayment({
          orderId: rawOrderId,
          paymentAmount: 500.0,
          customerId: undefined,
          source: "webhook",
        }),
      ).rejects.toThrow(/customer could not be resolved/);
    });

    it("fails closed on return verification with 404 for fixture orderId 'pending' or 'cf_verify_pending' in production", async () => {
      process.env.NODE_ENV = "production";
      const orderId = `cf_verify_pending_${Date.now()}`;

      // In production, verifyCashfreePaymentOrder must NOT return mock PENDING shortcut.
      // With no attempt in DB and gateway returning 404, it must throw ORDER_NOT_FOUND (404)
      await expect(verifyCashfreePaymentOrder(orderId, 99999)).rejects.toThrow(PaymentServiceError);

      try {
        await verifyCashfreePaymentOrder(orderId, 99999);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe("ORDER_NOT_FOUND");
      }
    });

    it("webhook ignores unmapped order without customer identifier in production", async () => {
      process.env.NODE_ENV = "production";
      const unknownOrderId = `cf_ord_unknown_${Date.now()}`;

      const result = await handleCashfreeWebhookPayload({
        event: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          order: {
            order_id: unknownOrderId,
            order_amount: 500.0,
          },
          payment: {
            payment_amount: 500.0,
            payment_status: "SUCCESS",
          },
        },
      });

      expect(result.received).toBe(true);
      expect((result as any).unmapped).toBe(true);
    });

    it("webhook ignores zero or negative paymentAmount in production", async () => {
      process.env.NODE_ENV = "production";
      const orderId = `cf_zero_pay_${Date.now()}`;

      const result = await handleCashfreeWebhookPayload({
        event: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          order: {
            order_id: orderId,
            order_amount: 0.0,
          },
          payment: {
            payment_amount: 0.0,
            payment_status: "SUCCESS",
          },
        },
      });

      expect(result.received).toBe(true);
      expect((result as any).ignored).toBe(true);
    });
  });

  describe("3. Non-Production Test Environment Continuity", () => {
    it("allows test shortcuts in test environment (NODE_ENV === 'test')", async () => {
      process.env.NODE_ENV = "test";

      // 1. Pending verification shortcut works in test mode
      const pendingRes = await verifyCashfreePaymentOrder("cf_verify_pending_test", 1);
      expect(pendingRes.status).toBe("PENDING");

      // 2. Raw webhook isolation shortcut works in test mode
      const rawRes = await reconcileCashfreePayment({
        orderId: "cf_raw_test_hook",
        paymentAmount: 100.0,
        customerId: undefined,
        source: "webhook",
      });
      expect(rawRes.settled).toBe(true);
    });
  });
});
