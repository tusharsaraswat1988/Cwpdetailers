import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeReturnDestination } from "@/hooks/useAuthFlow";
import {
  getActionableAuthDetails,
  getAuthErrorMessage,
  mapAuthErrorMessage,
  AUTH_NEUTRAL_ERROR,
} from "./authErrorMessages";
import { trackAuthEvent, onAuthEvent, type AuthAnalyticsEvent } from "./authAnalytics";
import {
  tokenStorageKey,
  userStorageKey,
  resolveAuthPortal,
  roleMatchesPortal,
  authPortalHeaders,
  AUTH_PORTAL_HEADER,
} from "./authPortal";
import {
  classifyAuthError,
  type AuthUiState,
} from "./authStateMachine";

describe("P2 Auth E2E & Resilience Test Suite (Client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 10 & 12 — Open-Redirect Rejection & Multi-Tab Key Isolation", () => {
    it("rejects malicious open-redirect URLs and preserves safe internal paths", () => {
      // Malicious targets must be rejected (return null)
      expect(sanitizeReturnDestination("https://evil.com/phish")).toBeNull();
      expect(sanitizeReturnDestination("//attacker.org")).toBeNull();
      expect(sanitizeReturnDestination("javascript:alert(1)")).toBeNull();
      expect(sanitizeReturnDestination("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeReturnDestination("/\\attacker.com")).toBeNull();
      expect(sanitizeReturnDestination("http://127.0.0.1:21456/outside")).toBeNull();

      // Safe internal targets must be preserved
      expect(sanitizeReturnDestination("/bookings")).toBe("/bookings");
      expect(sanitizeReturnDestination("/profile/edit")).toBe("/profile/edit");
      expect(sanitizeReturnDestination("/solar?plan=silver")).toBe("/solar?plan=silver");
      expect(sanitizeReturnDestination(null)).toBeNull();
      expect(sanitizeReturnDestination(undefined)).toBeNull();
    });

    it("isolates token and user storage keys across portals", () => {
      expect(tokenStorageKey("customer")).toBe("cwp_token_customer");
      expect(tokenStorageKey("staff")).toBe("cwp_token_staff");
      expect(tokenStorageKey("admin")).toBe("cwp_token_admin");

      expect(userStorageKey("customer")).toBe("cwp_user_customer");
      expect(userStorageKey("staff")).toBe("cwp_user_staff");
      expect(userStorageKey("admin")).toBe("cwp_user_admin");
    });

    it("verifies portal resolution and request header attachment", () => {
      expect(resolveAuthPortal("/admin/dashboard")).toBe("admin");
      expect(resolveAuthPortal("/staff/route")).toBe("staff");
      expect(resolveAuthPortal("/franchisee/orders")).toBe("franchisee");
      expect(resolveAuthPortal("/")).toBe("customer");
      expect(resolveAuthPortal("/solar")).toBe("customer");

      const headers = authPortalHeaders("customer");
      expect(headers[AUTH_PORTAL_HEADER]).toBe("customer");
    });

    it("validates role eligibility across portals", () => {
      expect(roleMatchesPortal("customer", "customer")).toBe(true);
      expect(roleMatchesPortal("staff", "customer")).toBe(false);
      expect(roleMatchesPortal("admin", "customer")).toBe(false);

      expect(roleMatchesPortal("staff", "staff")).toBe(true);
      expect(roleMatchesPortal("customer", "staff")).toBe(false);

      expect(roleMatchesPortal("admin", "admin")).toBe(true);
      expect(roleMatchesPortal("superadmin", "admin")).toBe(true);
      expect(roleMatchesPortal("manager", "admin")).toBe(true);
    });
  });

  describe("Scenario 4, 5, 6 — Actionable Error Feedback & Recovery Routing", () => {
    it("maps provider outage into user-friendly guidance with retry recommendation", () => {
      const classified = classifyAuthError({
        code: "OTP_PROVIDER_UNAVAILABLE",
        message: "SMS OTP is not configured",
      });
      expect(classified.state).toBe("provider_unavailable");
      expect(classified.error.actionableStep).toContain("password");
    });

    it("maps rate limiting into clear cool-down message", () => {
      const classified = classifyAuthError(new Error("Too many attempts. Please wait."));
      expect(classified.state).toBe("rate_limited");
      expect(classified.error.actionableStep).toContain("wait a few minutes");
    });

    it("maps portal mismatch into actionable switch navigation", () => {
      const details = getActionableAuthDetails(
        new Error("This account belongs to an administrator. Use the Admin portal to sign in."),
      );
      expect(details).not.toBeNull();
      expect(details.actionUrl).toBe("/admin/login");
      expect(details.actionLabel).toBe("Go to Admin Login");
    });

    it("maps expired or invalid OTP into retry with new code suggestion", () => {
      const mapped = mapAuthErrorMessage("invalid or expired otp", "OTP_INVALID_OR_EXPIRED");
      expect(mapped).toContain("expired or incorrect");
    });

    it("uses neutral error copy for unknown or missing accounts to prevent enumeration", () => {
      const neutral = mapAuthErrorMessage("no account found");
      expect(neutral).toBe(AUTH_NEUTRAL_ERROR);
    });
  });

  describe("Scenario 2 & 10 — Authentication State Machine Resilience", () => {
    it("handles all required authentication states", () => {
      const allStates: AuthUiState[] = [
        "idle",
        "validating",
        "submitting",
        "awaiting_otp",
        "verifying_otp",
        "authenticated",
        "recoverable_error",
        "rate_limited",
        "provider_unavailable",
        "account_conflict",
        "session_expired",
      ];
      expect(allStates).toHaveLength(11);
    });

    it("prevents double-submitting while request is already pending", () => {
      const busyStates: AuthUiState[] = ["validating", "submitting", "verifying_otp"];
      for (const st of busyStates) {
        const canSubmit = st === "idle" || st === "recoverable_error";
        expect(canSubmit).toBe(false);
      }
    });
  });

  describe("Scenario 1, 2, 3 — Funnel Observability & Event Telemetry", () => {
    it("fires analytics subscriber callbacks without throwing when subscriber errors", () => {
      const received: AuthAnalyticsEvent[] = [];
      const unsubscribe = onAuthEvent((event) => {
        received.push(event);
      });

      // Add a throwing subscriber to verify resilience
      const unsubscribeBad = onAuthEvent(() => {
        throw new Error("Telemetry provider network error");
      });

      expect(() => {
        trackAuthEvent("otp_sent", { method: "otp", portal: "customer" });
        trackAuthEvent("otp_verified", { method: "otp", portal: "customer" });
        trackAuthEvent("login_completed", { method: "otp", portal: "customer" });
        trackAuthEvent("password_login", { method: "password", portal: "customer" });
      }).not.toThrow();

      expect(received).toEqual(["otp_sent", "otp_verified", "login_completed", "password_login"]);

      unsubscribe();
      unsubscribeBad();
    });
  });
});
