import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database to isolate route and unit tests
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(() => []) })),
  },
  usersTable: {},
  customersTable: {},
  authOtpCodesTable: {},
  sessionsTable: {},
  authPendingGoogleTable: {},
}));

import { authMetrics } from "./authMetrics";
import { logAuthEvent, startAuthSpan, neutralizeOtpSendError } from "./authObservability";
import { authRateLimit, clearRateLimitBuckets } from "./authRateLimit";
import { validateStartupEnvironment } from "./startupEnv";
import { isRoleAllowedForPortal, portalMismatchMessage } from "./authPortals";
import { sessionCookieName, parseAuthPortalHeader } from "./sessionCookie";
import { handleGetAuthMetrics } from "../routes/auth";
import type { Request, Response, NextFunction } from "express";

describe("P2 Auth Resilience & Observability Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMetrics.reset();
    clearRateLimitBuckets();
  });

  describe("Workstream 1 — Operational Metrics & Alert Evaluation", () => {
    it("records attempts, successes, and latencies across auth methods", () => {
      authMetrics.recordAttempt("password");
      authMetrics.recordOutcome("password", "success", { durationMs: 45 });

      authMetrics.recordAttempt("otp_send");
      authMetrics.recordOutcome("otp_send", "success", { durationMs: 120 });

      const snapshot = authMetrics.getSnapshot();
      expect(snapshot.totalAttempts).toBe(2);
      expect(snapshot.totalSuccesses).toBe(2);
      expect(snapshot.totalFailures).toBe(0);
      expect(snapshot.byMethod.password.attempts).toBe(1);
      expect(snapshot.byMethod.password.successes).toBe(1);
      expect(snapshot.byMethod.password.avgLatencyMs).toBe(45);
      expect(snapshot.byMethod.otp_send.avgLatencyMs).toBe(120);
      expect(snapshot.healthStatus).toBe("healthy");
      expect(snapshot.activeAlerts).toHaveLength(0);
    });

    it("triggers critical alert when provider outage threshold is reached", () => {
      for (let i = 0; i < 3; i++) {
        authMetrics.recordAttempt("otp_send");
        authMetrics.recordOutcome("otp_send", "provider_error", {
          durationMs: 500,
          errorCode: "OTP_PROVIDER_UNAVAILABLE",
          isProviderError: true,
        });
      }

      const snapshot = authMetrics.getSnapshot();
      expect(snapshot.totalProviderErrors).toBe(3);
      expect(snapshot.healthStatus).toBe("critical");
      expect(snapshot.activeAlerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "critical",
            code: "SMS_PROVIDER_DOWN",
          }),
        ]),
      );
    });

    it("triggers warning alert when OTP failure rate exceeds threshold", () => {
      // 10 attempts with 5 failures = 50% failure rate (> 40% threshold)
      for (let i = 0; i < 5; i++) {
        authMetrics.recordAttempt("otp_send");
        authMetrics.recordOutcome("otp_send", "success", { durationMs: 30 });
      }
      for (let i = 0; i < 5; i++) {
        authMetrics.recordAttempt("otp_send");
        authMetrics.recordOutcome("otp_send", "failure", {
          durationMs: 30,
          errorCode: "ACCOUNT_NOT_ELIGIBLE",
        });
      }

      const snapshot = authMetrics.getSnapshot();
      expect(snapshot.healthStatus).toBe("degraded");
      expect(snapshot.activeAlerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "warning",
            code: "ELEVATED_OTP_FAILURE_RATE",
          }),
        ]),
      );
    });

    it("tracks rate limiting bursts and flags abuse alerts", () => {
      for (let i = 0; i < 20; i++) {
        authMetrics.recordOutcome("otp_send", "rate_limited", {
          errorCode: "OTP_RATE_LIMITED",
        });
      }

      const snapshot = authMetrics.getSnapshot();
      expect(snapshot.totalRateLimited).toBe(20);
      expect(snapshot.activeAlerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "warning",
            code: "AUTH_RATE_LIMIT_SPIKE",
          }),
        ]),
      );
    });
  });

  describe("Workstream 1 — Structured Logging & Secret Scrubbing", () => {
    it("scrubs passwords, plaintext tokens, and OTP codes while masking phone numbers", () => {
      const mockInfo = vi.fn();
      const mockReq = {
        id: "req-12345",
        headers: { "x-request-id": "req-12345" },
        log: { info: mockInfo, warn: vi.fn(), error: vi.fn() },
      } as unknown as Request;

      logAuthEvent(mockReq, "auth.login.password", {
        phone: "9889960999",
        password: "SuperSecretPassword!",
        code: "123456",
        token: "session-bearer-token-123",
        portal: "customer",
        userId: 42,
      });

      expect(mockInfo).toHaveBeenCalledTimes(1);
      const [payload] = mockInfo.mock.calls[0];

      // Phone is masked
      expect(payload.maskedPhone).toBe("******0999");
      // Request ID is captured
      expect(payload.requestId).toBe("req-12345");
      // Secrets are completely omitted
      expect(payload).not.toHaveProperty("password");
      expect(payload).not.toHaveProperty("code");
      expect(payload).not.toHaveProperty("token");
      expect(payload.userId).toBe(42);
    });

    it("tracks execution span duration accurately", async () => {
      const span = startAuthSpan();
      await new Promise(resolve => setTimeout(resolve, 20));
      const duration = span.getDurationMs();
      expect(duration).toBeGreaterThanOrEqual(15);
    });

    it("neutralizes errors without account enumeration", () => {
      expect(neutralizeOtpSendError("no account found with this number", "ACCOUNT_NOT_ELIGIBLE")).toBe(
        "We couldn't complete this request. Please try again.",
      );
      expect(neutralizeOtpSendError("fast2sms connection timed out", "OTP_PROVIDER_UNAVAILABLE")).toBe(
        "Verification is temporarily unavailable. Please try again later.",
      );
      expect(neutralizeOtpSendError("rate limit exceeded", "OTP_RATE_LIMITED")).toBe(
        "Too many attempts. Please wait and try again.",
      );
    });
  });

  describe("Workstream 1 & 3 — Rate Limiting & Protection", () => {
    it("enforces rate limits and sets Retry-After headers", () => {
      const limiter = authRateLimit("test-scope", 2, 60000);

      const req = {
        ip: "127.0.0.1",
        body: { phone: "9889960999" },
        headers: { "x-request-id": "req-test-rl" },
      } as unknown as Request;

      const setHeaderMock = vi.fn();
      const statusMock = vi.fn().mockReturnThis();
      const jsonMock = vi.fn();
      const nextMock = vi.fn();

      const res = {
        setHeader: setHeaderMock,
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;

      // 1st request: OK
      limiter(req, res, nextMock);
      expect(nextMock).toHaveBeenCalledTimes(1);

      // 2nd request: OK
      limiter(req, res, nextMock);
      expect(nextMock).toHaveBeenCalledTimes(2);

      // 3rd request: Rate limited (429)
      limiter(req, res, nextMock);
      expect(nextMock).toHaveBeenCalledTimes(2);
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(setHeaderMock).toHaveBeenCalledWith("Retry-After", expect.any(String));
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Too many attempts. Please wait and try again.",
          code: "OTP_RATE_LIMITED",
          requestId: "req-test-rl",
        }),
      );
    });
  });

  describe("Workstream 3 — Portal Isolation & Session Boundaries", () => {
    it("enforces strict role-to-portal authorization rules", () => {
      // Customer portal
      expect(isRoleAllowedForPortal("customer", "customer")).toBe(true);
      expect(isRoleAllowedForPortal("staff", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("admin", "customer")).toBe(false);

      // Staff portal
      expect(isRoleAllowedForPortal("staff", "staff")).toBe(true);
      expect(isRoleAllowedForPortal("customer", "staff")).toBe(false);
      expect(isRoleAllowedForPortal("admin", "staff")).toBe(false);

      // Admin portal
      expect(isRoleAllowedForPortal("admin", "admin")).toBe(true);
      expect(isRoleAllowedForPortal("superadmin", "admin")).toBe(true);
      expect(isRoleAllowedForPortal("manager", "admin")).toBe(true);
      expect(isRoleAllowedForPortal("customer", "admin")).toBe(false);
      expect(isRoleAllowedForPortal("staff", "admin")).toBe(false);
    });

    it("generates actionable portal mismatch error messages", () => {
      expect(portalMismatchMessage("customer")).toContain("correct portal");
      expect(portalMismatchMessage("staff")).toContain("field staff only");
      expect(portalMismatchMessage("admin")).toContain("admin portal");
    });

    it("isolates session cookie names across portals", () => {
      expect(sessionCookieName("customer")).toBe("cwp_session_customer");
      expect(sessionCookieName("staff")).toBe("cwp_session_staff");
      expect(sessionCookieName("admin")).toBe("cwp_session_admin");
    });

    it("parses auth portal headers correctly", () => {
      const req = {
        headers: { "x-auth-portal": "staff" },
      } as unknown as Request;
      expect(parseAuthPortalHeader(req)).toBe("staff");

      const invalidReq = {
        headers: { "x-auth-portal": "malicious-portal" },
      } as unknown as Request;
      expect(parseAuthPortalHeader(invalidReq)).toBeNull();
    });
  });

  describe("Workstream 2 — Metrics Endpoint Access Control & RBAC", () => {
    function executeMetricsCall(reqMock: Partial<Request>): { status: number; body: unknown } {
      let statusCode = 200;
      let responseBody: unknown = null;
      const resMock = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: unknown) {
          responseBody = data;
          return this;
        },
      } as unknown as Response;

      handleGetAuthMetrics(reqMock as Request, resMock);
      return { status: statusCode, body: responseBody };
    }

    it("rejects unauthenticated requests with 401", () => {
      const res = executeMetricsCall({ headers: {} });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authentication required" });
    });

    it("rejects customer role caller with 403", () => {
      const res = executeMetricsCall({
        headers: {},
        user: { id: 10, role: "customer", name: "Cust", phone: "9889960999" } as any,
      });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "Access denied. Administrator privileges required." });
    });

    it("rejects staff role caller with 403", () => {
      const res = executeMetricsCall({
        headers: {},
        user: { id: 11, role: "staff", name: "Staff", phone: "9889960998" } as any,
      });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "Access denied. Administrator privileges required." });
    });

    it("allows admin and superadmin callers with 200", () => {
      const adminRes = executeMetricsCall({
        headers: {},
        user: { id: 1, role: "admin", name: "Admin", phone: "9999999999" } as any,
      });
      expect(adminRes.status).toBe(200);
      expect(adminRes.body).toHaveProperty("totalAttempts");
      expect(adminRes.body).toHaveProperty("healthStatus");

      const superRes = executeMetricsCall({
        headers: {},
        user: { id: 2, role: "superadmin", name: "SuperAdmin", phone: "9999999998" } as any,
      });
      expect(superRes.status).toBe(200);
    });

    it("allows caller with valid x-diagnostics-key header with 200", () => {
      const prevKey = process.env.DIAGNOSTICS_KEY;
      process.env.DIAGNOSTICS_KEY = "super-secret-diag-key-length-safe";
      try {
        const res = executeMetricsCall({
          headers: { "x-diagnostics-key": "super-secret-diag-key-length-safe" },
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("totalAttempts");
      } finally {
        process.env.DIAGNOSTICS_KEY = prevKey;
      }
    });

    it("rejects caller with invalid or short x-diagnostics-key header", () => {
      const prevKey = process.env.DIAGNOSTICS_KEY;
      process.env.DIAGNOSTICS_KEY = "super-secret-diag-key-length-safe";
      try {
        // Wrong key
        const wrongRes = executeMetricsCall({
          headers: { "x-diagnostics-key": "incorrect-wrong-key" },
        });
        expect(wrongRes.status).toBe(401);
        expect(wrongRes.body).toEqual({ error: "Authentication required" });

        // Missing header
        const missingRes = executeMetricsCall({ headers: {} });
        expect(missingRes.status).toBe(401);

        // Short / insecure key configured in env (< 16 chars)
        process.env.DIAGNOSTICS_KEY = "short";
        const shortEnvRes = executeMetricsCall({
          headers: { "x-diagnostics-key": "short" },
        });
        expect(shortEnvRes.status).toBe(401);

        // Customer caller with invalid diagnostics key
        const customerBadKeyRes = executeMetricsCall({
          headers: { "x-diagnostics-key": "wrong-key" },
          user: { id: 10, role: "customer", name: "Cust" } as any,
        });
        expect(customerBadKeyRes.status).toBe(403);
      } finally {
        process.env.DIAGNOSTICS_KEY = prevKey;
      }
    });

    it("verifies metrics response schema never discloses secrets or personal data", () => {
      const res = executeMetricsCall({
        headers: {},
        user: { id: 1, role: "admin", name: "Admin", phone: "9999999999" } as any,
      });
      expect(res.status).toBe(200);
      const snapshot = res.body as Record<string, unknown>;

      // Confirm numerical/statistical telemetry only
      expect(typeof snapshot.uptimeSeconds).toBe("number");
      expect(typeof snapshot.totalAttempts).toBe("number");
      expect(typeof snapshot.totalSuccesses).toBe("number");
      expect(typeof snapshot.healthStatus).toBe("string");

      // Verify no sensitive keys exist
      expect(snapshot).not.toHaveProperty("password");
      expect(snapshot).not.toHaveProperty("token");
      expect(snapshot).not.toHaveProperty("code");
      expect(snapshot).not.toHaveProperty("phone");
      expect(snapshot).not.toHaveProperty("email");
    });
  });

  describe("Workstream 5 — Startup Environment Validation", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.PORT = "8080";
      process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cwp_test";
      process.env.FAST2SMS_API_KEY = "test_key_123456789";
      process.env.GOOGLE_CLIENT_ID = "123456789-abcdef.apps.googleusercontent.com";
    });

    it("validates successful environment without leaking secrets", () => {
      const summary = validateStartupEnvironment();
      expect(summary.port).toBe(8080);
      expect(summary.databaseConfigured).toBe(true);
      expect(summary.smsConfigured).toBe(true);
      // Secrets are masked
      expect(summary.smsKeyMasked).toBe("tes***789");
      expect(summary.smsKeyMasked).not.toBe("test_key_123456789");
      expect(summary.googleClientIdMasked).toContain(".apps.googleusercontent.com");
      expect(summary.googleClientIdMasked).not.toBe("123456789-abcdef.apps.googleusercontent.com");
    });

    it("defaults PORT to 8080 when omitted, and rejects invalid non-numeric values", () => {
      delete process.env.PORT;
      const defaultSummary = validateStartupEnvironment();
      expect(defaultSummary.port).toBe(8080);

      process.env.PORT = "invalid-port";
      expect(() => validateStartupEnvironment()).toThrow(/Invalid PORT value/);

      process.env.PORT = "-5";
      expect(() => validateStartupEnvironment()).toThrow(/Invalid PORT value/);
    });

    it("throws a descriptive fatal error when DATABASE_URL is missing or invalid", () => {
      delete process.env.DATABASE_URL;
      expect(() => validateStartupEnvironment()).toThrow(/DATABASE_URL environment variable is required/);

      process.env.DATABASE_URL = "mysql://root:password@localhost/test";
      expect(() => validateStartupEnvironment()).toThrow(/must start with postgres:\/\/ or postgresql:\/\//);
    });
  });
});
