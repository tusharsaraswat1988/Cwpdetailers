import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CashfreeClient } from "./cashfreeClient";
import { CashfreeError } from "./cashfreeError";
import type { CashfreeServerConfig } from "./cashfreeConfig";

describe("CashfreeClient", () => {
  const mockConfig: CashfreeServerConfig = {
    appId: "cf_mock_app_123",
    secretKey: "cf_mock_secret_456",
    env: "sandbox",
    apiVersion: "2023-08-01",
    baseUrl: "https://sandbox.cashfree.com/pg",
    timeoutMs: 5000,
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends required Cashfree headers on createOrder", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);

      return new Response(
        JSON.stringify({
          cf_order_id: 12345,
          order_id: "test_order_001",
          entity: "order",
          order_currency: "INR",
          order_amount: 1500,
          order_status: "ACTIVE",
          payment_session_id: "session_mock_12345",
          customer_details: {
            customer_id: "cwp_cust_101",
            customer_phone: "9876543210",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new CashfreeClient(mockConfig);
    const order = await client.createOrder(
      {
        order_id: "test_order_001",
        order_amount: 1500,
        order_currency: "INR",
        customer_details: {
          customer_id: "cwp_cust_101",
          customer_phone: "9876543210",
        },
      },
      { idempotencyKey: "idemp_custom_key_777" },
    );

    expect(capturedUrl).toBe("https://sandbox.cashfree.com/pg/orders");
    expect(capturedHeaders["x-client-id"]).toBe("cf_mock_app_123");
    expect(capturedHeaders["x-client-secret"]).toBe("cf_mock_secret_456");
    expect(capturedHeaders["x-api-version"]).toBe("2023-08-01");
    expect(capturedHeaders["x-idempotency-key"]).toBe("idemp_custom_key_777");
    expect(capturedBody.order_id).toBe("test_order_001");
    expect(order.order_status).toBe("ACTIVE");
    expect(order.payment_session_id).toBe("session_mock_12345");
  });

  it("fetches order details via getOrder", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          cf_order_id: 12345,
          order_id: "order_xyz",
          order_status: "PAID",
          order_amount: 1200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new CashfreeClient(mockConfig);
    const order = await client.getOrder("order_xyz");

    expect(capturedUrl).toBe("https://sandbox.cashfree.com/pg/orders/order_xyz");
    expect(order.order_status).toBe("PAID");
    expect(order.order_amount).toBe(1200);
  });

  it("fetches order payment attempts via getOrderPayments", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify([
          {
            cf_payment_id: 999111,
            order_id: "order_abc",
            payment_status: "SUCCESS",
            payment_amount: 800,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new CashfreeClient(mockConfig);
    const payments = await client.getOrderPayments("order_abc");

    expect(capturedUrl).toBe("https://sandbox.cashfree.com/pg/orders/order_abc/payments");
    expect(Array.isArray(payments)).toBe(true);
    expect(payments[0].payment_status).toBe("SUCCESS");
  });

  it("wraps non-2xx gateway error response into CashfreeError", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          message: "order_amount is invalid",
          code: "invalid_order_amount",
          type: "invalid_request_error",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new CashfreeClient(mockConfig);

    await expect(
      client.createOrder({
        order_id: "fail_order",
        order_amount: -50,
        order_currency: "INR",
        customer_details: {
          customer_id: "cust_1",
          customer_phone: "9876543210",
        },
      }),
    ).rejects.toThrow(CashfreeError);

    try {
      await client.createOrder({
        order_id: "fail_order",
        order_amount: -50,
        order_currency: "INR",
        customer_details: {
          customer_id: "cust_1",
          customer_phone: "9876543210",
        },
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(CashfreeError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("invalid_order_amount");
      expect(err.isGatewayError).toBe(false);
      expect(err.message).toContain("order_amount is invalid");
    }
  });

  it("wraps gateway 500 error into CashfreeError with isGatewayError = true", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          message: "Internal gateway processing failure",
          code: "internal_server_error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new CashfreeClient(mockConfig);

    try {
      await client.getOrder("server_err_order");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CashfreeError);
      expect(err.statusCode).toBe(500);
      expect(err.isGatewayError).toBe(true);
    }
  });

  it("handles request timeout cleanly with statusCode 504 and isTimeout = true", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const timeoutErr = new Error("The operation was aborted due to timeout");
      timeoutErr.name = "TimeoutError";
      throw timeoutErr;
    });

    const client = new CashfreeClient(mockConfig);

    try {
      await client.getOrder("timeout_order");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CashfreeError);
      expect(err.statusCode).toBe(504);
      expect(err.code).toBe("GATEWAY_TIMEOUT");
      expect(err.isTimeout).toBe(true);
    }
  });
});
