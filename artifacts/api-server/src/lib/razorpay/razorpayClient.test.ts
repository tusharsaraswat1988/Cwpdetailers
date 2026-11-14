import { describe, it, expect, vi, beforeEach } from "vitest";
import { RazorpayClient } from "./razorpayClient";
import { RazorpayError } from "./razorpayError";
import type { RazorpayServerConfig } from "./razorpayConfig";

describe("RazorpayClient", () => {
  const dummyConfig: RazorpayServerConfig = {
    keyId: "rzp_test_123456",
    keySecret: "secret_abcdef",
    env: "sandbox",
    baseUrl: "https://api.razorpay.com/v1",
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct Basic Auth and headers on createOrder", async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
        },
        json: async () => ({
          id: "order_mock123",
          entity: "order",
          amount: 149900,
          currency: "INR",
          status: "created",
        }),
      } as any;
    });

    const client = new RazorpayClient(dummyConfig);
    const order = await client.createOrder({
      amount: 149900,
      currency: "INR",
      receipt: "receipt_001",
      notes: { customer_id: "10" },
    });

    expect(order.id).toBe("order_mock123");
    expect(order.amount).toBe(149900);
    expect(capturedBody.amount).toBe(149900);
    expect(capturedBody.currency).toBe("INR");

    const expectedAuth = `Basic ${Buffer.from("rzp_test_123456:secret_abcdef").toString("base64")}`;
    expect(capturedHeaders.Authorization).toBe(expectedAuth);
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("handles gateway error responses cleanly", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 400,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "Amount exceeds permissible limit",
          },
        }),
      } as any;
    });

    const client = new RazorpayClient(dummyConfig);
    await expect(
      client.createOrder({ amount: 999999999, currency: "INR" }),
    ).rejects.toThrow(RazorpayError);
  });
});
