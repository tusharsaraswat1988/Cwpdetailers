import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
} from "./razorpayWebhook";

describe("razorpayWebhook & signature verification", () => {
  const secret = "test_webhook_secret_12345";
  const keySecret = "test_key_secret_67890";

  describe("verifyRazorpayWebhookSignature", () => {
    it("returns true for valid webhook signature", () => {
      const rawBody = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_123", amount: 149900 } } },
      });
      const validSignature = createHmac("sha256", secret).update(rawBody).digest("hex");

      const result = verifyRazorpayWebhookSignature(rawBody, validSignature, { secret });
      expect(result).toBe(true);
    });

    it("returns false for tampered body", () => {
      const rawBody = JSON.stringify({ event: "payment.captured" });
      const validSignature = createHmac("sha256", secret).update(rawBody).digest("hex");

      const tamperedBody = JSON.stringify({ event: "payment.failed" });
      const result = verifyRazorpayWebhookSignature(tamperedBody, validSignature, { secret });
      expect(result).toBe(false);
    });

    it("returns false for invalid signature length or value", () => {
      const rawBody = "test_body";
      expect(verifyRazorpayWebhookSignature(rawBody, "invalid", { secret })).toBe(false);
      expect(verifyRazorpayWebhookSignature(rawBody, "", { secret })).toBe(false);
    });
  });

  describe("verifyRazorpayPaymentSignature", () => {
    it("returns true for matching payment verification tokens", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const expectedPayload = `${orderId}|${paymentId}`;
      const validSignature = createHmac("sha256", keySecret).update(expectedPayload).digest("hex");

      const result = verifyRazorpayPaymentSignature(orderId, paymentId, validSignature, keySecret);
      expect(result).toBe(true);
    });

    it("returns false if orderId or paymentId is mismatched", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const validSignature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

      const result = verifyRazorpayPaymentSignature("order_different", paymentId, validSignature, keySecret);
      expect(result).toBe(false);
    });

    it("returns false if parameters are missing", () => {
      expect(verifyRazorpayPaymentSignature("", "pay_1", "sig", keySecret)).toBe(false);
      expect(verifyRazorpayPaymentSignature("ord_1", "", "sig", keySecret)).toBe(false);
      expect(verifyRazorpayPaymentSignature("ord_1", "pay_1", "", keySecret)).toBe(false);
    });
  });
});
