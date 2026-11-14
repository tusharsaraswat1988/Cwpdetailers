import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cleanEnvVar,
  getActivePaymentGateway,
  resolveRazorpayEnvironment,
  getRazorpayConfig,
  getRazorpayBaseUrl,
  RazorpayConfigError,
} from "./razorpayConfig";

describe("razorpayConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ACTIVE_PAYMENT_GATEWAY;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_BASE_URL;
    delete process.env.RAZORPAY_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("cleanEnvVar", () => {
    it("handles undefined and empty string", () => {
      expect(cleanEnvVar(undefined)).toBe("");
      expect(cleanEnvVar("")).toBe("");
    });

    it("strips whitespace", () => {
      expect(cleanEnvVar("  rzp_test_123  ")).toBe("rzp_test_123");
    });

    it("strips double and single quotes", () => {
      expect(cleanEnvVar('"rzp_test_123"')).toBe("rzp_test_123");
      expect(cleanEnvVar("'rzp_test_123'")).toBe("rzp_test_123");
    });
  });

  describe("getActivePaymentGateway", () => {
    it("returns explicit ACTIVE_PAYMENT_GATEWAY when set to razorpay", () => {
      process.env.ACTIVE_PAYMENT_GATEWAY = "razorpay";
      expect(getActivePaymentGateway()).toBe("razorpay");
    });

    it("returns explicit ACTIVE_PAYMENT_GATEWAY when set to cashfree", () => {
      process.env.ACTIVE_PAYMENT_GATEWAY = "cashfree";
      expect(getActivePaymentGateway()).toBe("cashfree");
    });

    it("defaults to razorpay if RAZORPAY_KEY_ID is present and ACTIVE_PAYMENT_GATEWAY is unset", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc123";
      expect(getActivePaymentGateway()).toBe("razorpay");
    });

    it("defaults to cashfree if no Razorpay key is present", () => {
      expect(getActivePaymentGateway()).toBe("cashfree");
    });
  });

  describe("resolveRazorpayEnvironment", () => {
    it("identifies rzp_test_ as sandbox", () => {
      expect(resolveRazorpayEnvironment("rzp_test_123456")).toBe("sandbox");
      expect(resolveRazorpayEnvironment("TEST_123456")).toBe("sandbox");
    });

    it("identifies rzp_live_ as production", () => {
      expect(resolveRazorpayEnvironment("rzp_live_123456")).toBe("production");
    });
  });

  describe("getRazorpayBaseUrl", () => {
    it("returns default production URL when no override is set", () => {
      expect(getRazorpayBaseUrl()).toBe("https://api.razorpay.com/v1");
    });

    it("returns override URL when RAZORPAY_BASE_URL is configured", () => {
      process.env.RAZORPAY_BASE_URL = "http://127.0.0.1:55788/";
      expect(getRazorpayBaseUrl()).toBe("http://127.0.0.1:55788");
    });
  });

  describe("getRazorpayConfig", () => {
    it("throws MISSING_RAZORPAY_KEY_ID if key ID is missing", () => {
      expect(() => getRazorpayConfig()).toThrow(RazorpayConfigError);
      try {
        getRazorpayConfig();
      } catch (err: any) {
        expect(err.code).toBe("MISSING_RAZORPAY_KEY_ID");
      }
    });

    it("throws MISSING_RAZORPAY_KEY_SECRET if secret is missing", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      expect(() => getRazorpayConfig()).toThrow(RazorpayConfigError);
      try {
        getRazorpayConfig();
      } catch (err: any) {
        expect(err.code).toBe("MISSING_RAZORPAY_KEY_SECRET");
      }
    });

    it("returns clean config when credentials are provided", () => {
      process.env.RAZORPAY_KEY_ID = "  rzp_test_abc123  ";
      process.env.RAZORPAY_KEY_SECRET = "  secret_xyz789  ";
      process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_sec_123";

      const cfg = getRazorpayConfig();
      expect(cfg.keyId).toBe("rzp_test_abc123");
      expect(cfg.keySecret).toBe("secret_xyz789");
      expect(cfg.webhookSecret).toBe("webhook_sec_123");
      expect(cfg.env).toBe("sandbox");
      expect(cfg.baseUrl).toBe("https://api.razorpay.com/v1");
    });
  });
});
