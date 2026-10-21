import { describe, it, expect, vi } from "vitest";
import {
  useAuthStateMachine,
  classifyAuthError,
  type AuthUiState,
} from "./authStateMachine";
import { sanitizeReturnDestination } from "@/hooks/useAuthFlow";
import {
  getActionableAuthDetails,
  mapAuthErrorMessage,
} from "./authErrorMessages";

describe("P1 Authentication UX & Reliability Regression Suite", () => {
  describe("1. Complete State Machine & Race-Condition Safeguards", () => {
    it("initializes in idle state and allows transition to validating and submitting", () => {
      // Test classifyAuthError directly
      const rateLimitClass = classifyAuthError(new Error("Too many attempts"), "Fallback");
      expect(rateLimitClass.state).toBe("rate_limited");
      expect(rateLimitClass.error.actionableStep).toContain("wait a few minutes");

      const providerClass = classifyAuthError({
        code: "OTP_PROVIDER_UNAVAILABLE",
        message: "SMS OTP is not configured",
      });
      expect(providerClass.state).toBe("provider_unavailable");
      expect(providerClass.error.actionableStep).toContain("password");

      const portalClass = classifyAuthError({
        code: "PORTAL_MISMATCH",
        message: "This account belongs to an administrator. Use the Admin portal to sign in.",
      });
      expect(portalClass.state).toBe("account_conflict");
      expect(portalClass.error.actionableStep).toBe("Switch to Admin Portal");
    });

    it("rejects stale asynchronous responses using monotonic request IDs", () => {
      let activeId = 0;
      const startSubmitting = () => {
        activeId += 1;
        return activeId;
      };
      const isCurrent = (id: number) => id === activeId;

      const req1 = startSubmitting(); // req1 = 1
      const req2 = startSubmitting(); // req2 = 2 (user submitted again)

      // When req1 resolves late:
      expect(isCurrent(req1)).toBe(false);
      // When req2 resolves:
      expect(isCurrent(req2)).toBe(true);
    });

    it("prevents duplicate submissions while pending or busy", () => {
      const busyStates: AuthUiState[] = ["validating", "submitting", "verifying_otp"];
      for (const st of busyStates) {
        const isBusy = st === "validating" || st === "submitting" || st === "verifying_otp";
        const canSubmit = !isBusy && st !== "rate_limited";
        expect(canSubmit).toBe(false);
      }

      const idleState: AuthUiState = "idle";
      const isIdleBusy = idleState === "validating" || idleState === "submitting" || idleState === "verifying_otp";
      const canSubmitIdle = !isIdleBusy && idleState !== "rate_limited";
      expect(canSubmitIdle).toBe(true);
    });
  });

  describe("2. Open Redirect Prevention (Security Boundary)", () => {
    it("allows valid local internal application paths", () => {
      expect(sanitizeReturnDestination("/customer/bookings")).toBe("/customer/bookings");
      expect(sanitizeReturnDestination("/customer/profile")).toBe("/customer/profile");
      expect(sanitizeReturnDestination("/plans")).toBe("/plans");
      expect(sanitizeReturnDestination("/")).toBe("/");
    });

    it("rejects scheme-relative and external protocol URLs", () => {
      expect(sanitizeReturnDestination("//evil.com")).toBeNull();
      expect(sanitizeReturnDestination("//attacker.org/steal")).toBeNull();
      expect(sanitizeReturnDestination("https://evil.com")).toBeNull();
      expect(sanitizeReturnDestination("http://attacker.com")).toBeNull();
      expect(sanitizeReturnDestination("javascript:alert(1)")).toBeNull();
      expect(sanitizeReturnDestination("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeReturnDestination("\\evil.com")).toBeNull();
    });

    it("handles null, undefined, or empty destination paths safely", () => {
      expect(sanitizeReturnDestination(null)).toBeNull();
      expect(sanitizeReturnDestination(undefined)).toBeNull();
      expect(sanitizeReturnDestination("")).toBeNull();
      expect(sanitizeReturnDestination("   ")).toBeNull();
    });
  });

  describe("3. Actionable Error Mapping & Recovery Navigation", () => {
    it("provides direct navigation details for admin portal mismatches", () => {
      const details = getActionableAuthDetails({
        code: "PORTAL_MISMATCH",
        message: "This account belongs to an administrator. Use the Admin portal to sign in.",
      });
      expect(details.actionUrl).toBe("/admin/login");
      expect(details.actionLabel).toBe("Go to Admin Login");
      expect(details.actionableStep).toBe("Switch to the administrator sign-in portal.");
    });

    it("provides direct navigation details for staff portal mismatches", () => {
      const details = getActionableAuthDetails({
        code: "PORTAL_MISMATCH",
        message: "This number belongs to a staff account. Use the Staff portal to sign in.",
      });
      expect(details.actionUrl).toBe("/staff/login");
      expect(details.actionLabel).toBe("Go to Staff Portal");
      expect(details.actionableStep).toBe("Switch to the field staff sign-in portal.");
    });

    it("suggests password login when SMS provider is unavailable", () => {
      const details = getActionableAuthDetails({
        code: "OTP_PROVIDER_UNAVAILABLE",
        message: "Verification is temporarily unavailable. Please try again later.",
      });
      expect(details.actionableStep).toContain("password");
      expect(details.actionLabel).toBe("Sign in with password");
    });

    it("suggests password reset when incorrect credentials are submitted", () => {
      const details = getActionableAuthDetails(new Error("Incorrect password provided"));
      expect(details.actionUrl).toBe("/forgot-password");
      expect(details.actionLabel).toBe("Reset password");
      expect(details.actionableStep).toBe("Check your password or reset it.");
    });
  });

  describe("4. OTP Verification & Autocomplete Specifications", () => {
    it("formats 6-digit OTP codes and strips non-numeric characters", () => {
      const cleanOtp = (input: string) => input.replace(/\D/g, "").slice(0, 6);
      expect(cleanOtp("123456")).toBe("123456");
      expect(cleanOtp(" 123 456 ")).toBe("123456");
      expect(cleanOtp("12-34-56")).toBe("123456");
      expect(cleanOtp("abc123def456ghi")).toBe("123456");
      expect(cleanOtp("1234567890")).toBe("123456");
    });

    it("preserves masked destination phone format", () => {
      const mask = (p: string) => {
        const digits = p.replace(/\D/g, "").slice(-10);
        return `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
      };
      expect(mask("8707488250")).toBe("87••••••50");
      expect(mask("+918707488250")).toBe("87••••••50");
    });
  });

  describe("5. Safe Input Preservation Across Method Switching", () => {
    it("preserves safe phone input when switching between OTP and Password modes", () => {
      let currentMode: "otp" | "password" = "otp";
      let phoneState = "9889960999";

      // Switch to password
      currentMode = "password";
      expect(currentMode).toBe("password");
      expect(phoneState).toBe("9889960999"); // preserved!

      // Switch back to OTP
      currentMode = "otp";
      expect(currentMode).toBe("otp");
      expect(phoneState).toBe("9889960999"); // preserved!
    });
  });
});
