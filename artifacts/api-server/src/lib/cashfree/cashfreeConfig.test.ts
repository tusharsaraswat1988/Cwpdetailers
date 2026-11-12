import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getCashfreeBaseUrl,
  getCashfreeConfig,
  getClientSafeConfig,
  isCashfreeConfigured,
  CashfreeConfigError,
} from "./cashfreeConfig";

describe("cashfreeConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CASHFREE_APP_ID;
    delete process.env.CASHFREE_SECRET_KEY;
    delete process.env.CASHFREE_ENV;
    delete process.env.CASHFREE_API_VERSION;
    delete process.env.CASHFREE_BASE_URL;
    delete process.env.CASHFREE_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getCashfreeBaseUrl", () => {
    it("returns sandbox URL by default", () => {
      expect(getCashfreeBaseUrl("sandbox")).toBe("https://sandbox.cashfree.com/pg");
    });

    it("returns production URL when env is production", () => {
      expect(getCashfreeBaseUrl("production")).toBe("https://api.cashfree.com/pg");
    });

    it("prioritizes CASHFREE_BASE_URL override over environment parameter", () => {
      process.env.CASHFREE_BASE_URL = "http://127.0.0.1:9999/";
      expect(getCashfreeBaseUrl("sandbox")).toBe("http://127.0.0.1:9999");
      expect(getCashfreeBaseUrl("production")).toBe("http://127.0.0.1:9999");
    });
  });

  describe("getCashfreeConfig", () => {
    it("successfully loads valid configuration", () => {
      process.env.CASHFREE_APP_ID = "test_app_id_123";
      process.env.CASHFREE_SECRET_KEY = "test_secret_key_456";
      process.env.CASHFREE_ENV = "sandbox";

      const cfg = getCashfreeConfig();
      expect(cfg.appId).toBe("test_app_id_123");
      expect(cfg.secretKey).toBe("test_secret_key_456");
      expect(cfg.env).toBe("sandbox");
      expect(cfg.apiVersion).toBe("2023-08-01");
      expect(cfg.baseUrl).toBe("https://sandbox.cashfree.com/pg");
      expect(cfg.timeoutMs).toBe(15000);
    });

    it("throws CashfreeConfigError when CASHFREE_APP_ID is missing", () => {
      process.env.CASHFREE_SECRET_KEY = "test_secret_key_456";

      expect(() => getCashfreeConfig()).toThrow(CashfreeConfigError);
      try {
        getCashfreeConfig();
      } catch (err: any) {
        expect(err.code).toBe("MISSING_CASHFREE_APP_ID");
      }
    });

    it("throws CashfreeConfigError when CASHFREE_SECRET_KEY is missing", () => {
      process.env.CASHFREE_APP_ID = "test_app_id_123";

      expect(() => getCashfreeConfig()).toThrow(CashfreeConfigError);
      try {
        getCashfreeConfig();
      } catch (err: any) {
        expect(err.code).toBe("MISSING_CASHFREE_SECRET_KEY");
      }
    });

    it("parses custom timeout and production environment", () => {
      process.env.CASHFREE_APP_ID = "prod_app";
      process.env.CASHFREE_SECRET_KEY = "prod_secret";
      process.env.CASHFREE_ENV = "production";
      process.env.CASHFREE_API_VERSION = "2024-01-01";
      process.env.CASHFREE_TIMEOUT_MS = "8000";

      const cfg = getCashfreeConfig();
      expect(cfg.env).toBe("production");
      expect(cfg.apiVersion).toBe("2024-01-01");
      expect(cfg.baseUrl).toBe("https://api.cashfree.com/pg");
      expect(cfg.timeoutMs).toBe(8000);
    });
  });

  describe("getClientSafeConfig", () => {
    it("returns client-safe object strictly excluding secretKey", () => {
      process.env.CASHFREE_APP_ID = "public_app_id";
      process.env.CASHFREE_SECRET_KEY = "SUPER_SECRET_KEY_NEVER_LEAK";
      process.env.CASHFREE_ENV = "sandbox";

      const safe = getClientSafeConfig();
      expect(safe.appId).toBe("public_app_id");
      expect(safe.env).toBe("sandbox");
      expect(safe.apiVersion).toBe("2023-08-01");
      expect("secretKey" in safe).toBe(false);
      expect((safe as any).secretKey).toBeUndefined();
    });
  });

  describe("isCashfreeConfigured", () => {
    it("returns true only when both appId and secretKey are present", () => {
      expect(isCashfreeConfigured()).toBe(false);

      process.env.CASHFREE_APP_ID = "app_id";
      expect(isCashfreeConfigured()).toBe(false);

      process.env.CASHFREE_SECRET_KEY = "secret_key";
      expect(isCashfreeConfigured()).toBe(true);
    });
  });
});
