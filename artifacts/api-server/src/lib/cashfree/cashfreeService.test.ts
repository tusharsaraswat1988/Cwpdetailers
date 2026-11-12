import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => mockSelect(),
      insert: () => mockInsert(),
      update: () => mockUpdate(),
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
    },
    paymentAttemptsTable: {
      id: "payment_attempts.id",
      attemptId: "payment_attempts.attempt_id",
      cfOrderId: "payment_attempts.cf_order_id",
      customerId: "payment_attempts.customer_id",
      invoiceId: "payment_attempts.invoice_id",
      amount: "payment_attempts.amount",
      currency: "payment_attempts.currency",
      cfPaymentSessionId: "payment_attempts.cf_payment_session_id",
      status: "payment_attempts.status",
      idempotencyKey: "payment_attempts.idempotency_key",
      createdAt: "payment_attempts.created_at",
      updatedAt: "payment_attempts.updated_at",
    },
  };
});

vi.mock("../billing/invoiceService", () => ({
  getCustomerOutstandingDues: vi.fn(),
}));

import { createCashfreePaymentOrder, PaymentServiceError } from "./cashfreeService";
import { getCustomerOutstandingDues } from "../billing/invoiceService";

describe("cashfreeService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CASHFREE_APP_ID = "mock_app_id";
    process.env.CASHFREE_SECRET_KEY = "mock_secret_key";
    process.env.CASHFREE_ENV = "sandbox";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws 404 CUSTOMER_NOT_FOUND if customer record does not exist", async () => {
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      createCashfreePaymentOrder({ customerId: 999 }),
    ).rejects.toThrow(PaymentServiceError);

    try {
      await createCashfreePaymentOrder({ customerId: 999 });
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("CUSTOMER_NOT_FOUND");
    }
  });

  it("throws 404 INVOICE_NOT_FOUND if target invoice does not exist", async () => {
    // 1st call for customer, 2nd call for invoice
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 101, name: "Test Customer", phone: "+919876543210" }];
            }
            return []; // Invoice not found
          }),
        }),
      }),
    }));

    try {
      await createCashfreePaymentOrder({ customerId: 101, invoiceId: 9999 });
    } catch (err: any) {
      expect(err).toBeInstanceOf(PaymentServiceError);
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("INVOICE_NOT_FOUND");
    }
  });

  it("throws 403 FORBIDDEN_INVOICE_ACCESS if invoice belongs to another customer", async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 101, name: "Customer 101", phone: "9876543210" }];
            }
            // Invoice belongs to customer 202
            return [{
              id: 501,
              customerId: 202,
              balanceDue: "1200.00",
              status: "sent",
              documentType: "tax_invoice",
            }];
          }),
        }),
      }),
    }));

    try {
      await createCashfreePaymentOrder({ customerId: 101, invoiceId: 501 });
    } catch (err: any) {
      expect(err).toBeInstanceOf(PaymentServiceError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN_INVOICE_ACCESS");
    }
  });

  it("throws 400 NO_OUTSTANDING_BALANCE if invoice is already paid or has 0 balance", async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 101, name: "Customer 101", phone: "9876543210" }];
            }
            return [{
              id: 502,
              customerId: 101,
              balanceDue: "0.00",
              status: "paid",
              documentType: "tax_invoice",
            }];
          }),
        }),
      }),
    }));

    try {
      await createCashfreePaymentOrder({ customerId: 101, invoiceId: 502 });
    } catch (err: any) {
      expect(err).toBeInstanceOf(PaymentServiceError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("NO_OUTSTANDING_BALANCE");
    }
  });

  it("throws 400 NO_OUTSTANDING_BALANCE if total customer dues is 0", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: 101, name: "Customer 101", phone: "9876543210" },
          ]),
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }));

    vi.mocked(getCustomerOutstandingDues).mockResolvedValue(0);

    try {
      await createCashfreePaymentOrder({ customerId: 101 });
    } catch (err: any) {
      expect(err).toBeInstanceOf(PaymentServiceError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("NO_OUTSTANDING_BALANCE");
    }
  });
});
