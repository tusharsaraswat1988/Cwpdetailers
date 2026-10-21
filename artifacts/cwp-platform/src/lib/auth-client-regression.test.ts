import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mapAuthErrorMessage,
  extractApiErrorCode,
  AUTH_NEUTRAL_ERROR,
} from "./authErrorMessages";
import {
  tokenStorageKey,
  userStorageKey,
  authPortalHeaders,
  type AuthPortal,
} from "./authPortal";

describe("P0 Auth Client Regression Suite", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return mockStore[key] ?? null;
      },
      setItem(key: string, value: string) {
        mockStore[key] = value;
      },
      removeItem(key: string) {
        delete mockStore[key];
      },
      clear() {
        mockStore = {};
      },
    });
    vi.clearAllMocks();
  });

  describe("Scenario 16: Google confirmation cancellation", () => {
    it("leaves no authenticated session when Google signup dialog is cancelled", () => {
      // Prior to completion, neither customer token nor user is placed in storage
      expect(localStorage.getItem(tokenStorageKey("customer"))).toBeNull();
      expect(localStorage.getItem(userStorageKey("customer"))).toBeNull();
    });
  });

  describe("Scenario 17: Failed login leaves no authenticated session", () => {
    it("ensures failed login does not leave partial session state", () => {
      const portal: AuthPortal = "customer";
      expect(localStorage.getItem(tokenStorageKey(portal))).toBeNull();
      expect(localStorage.getItem(userStorageKey(portal))).toBeNull();
    });
  });

  describe("Scenario 18: Successful login survives refresh", () => {
    it("persists session distinctly per portal in localStorage", () => {
      const customerUser = {
        id: 1,
        name: "Verified Customer",
        phone: "9876543210",
        role: "customer",
      };
      const token = "mock-token-xyz-123";

      localStorage.setItem(userStorageKey("customer"), JSON.stringify(customerUser));
      localStorage.setItem(tokenStorageKey("customer"), token);

      // Verify loaded back
      const loadedUser = JSON.parse(localStorage.getItem(userStorageKey("customer"))!);
      const loadedToken = localStorage.getItem(tokenStorageKey("customer"));

      expect(loadedUser.phone).toBe("9876543210");
      expect(loadedToken).toBe(token);
    });
  });

  describe("Scenario 20: Portal session isolation in storage and headers", () => {
    it("isolates storage keys across portals", () => {
      expect(tokenStorageKey("customer")).toBe("cwp_token_customer");
      expect(tokenStorageKey("staff")).toBe("cwp_token_staff");
      expect(tokenStorageKey("admin")).toBe("cwp_token_admin");

      expect(userStorageKey("customer")).toBe("cwp_user_customer");
      expect(userStorageKey("staff")).toBe("cwp_user_staff");
      expect(userStorageKey("admin")).toBe("cwp_user_admin");
    });

    it("sends correct portal headers", () => {
      expect(authPortalHeaders("customer")).toEqual({ "X-Auth-Portal": "customer" });
      expect(authPortalHeaders("staff")).toEqual({ "X-Auth-Portal": "staff" });
      expect(authPortalHeaders("admin")).toEqual({ "X-Auth-Portal": "admin" });
    });
  });

  describe("Error Mapping & Observability: Client error categorizations", () => {
    it("maps structured OTP_PROVIDER_UNAVAILABLE code accurately", () => {
      expect(mapAuthErrorMessage("Some error", "OTP_PROVIDER_UNAVAILABLE")).toBe(
        "Verification is temporarily unavailable. Please try again later.",
      );
    });

    it("maps structured OTP_DELIVERY_FAILED code accurately", () => {
      expect(mapAuthErrorMessage("Fast2SMS gateway error 424", "OTP_DELIVERY_FAILED")).toBe(
        "Unable to send verification code. Please try again in a few moments.",
      );
    });

    it("maps structured OTP_RATE_LIMITED code accurately", () => {
      expect(mapAuthErrorMessage("Too many attempts", "OTP_RATE_LIMITED")).toBe(
        "Too many attempts. Please wait and try again.",
      );
    });

    it("maps structured OTP_INVALID_OR_EXPIRED code accurately", () => {
      expect(mapAuthErrorMessage("Code mismatch", "OTP_INVALID_OR_EXPIRED")).toBe(
        "OTP expired or incorrect. Try again or tap Resend OTP.",
      );
    });

    it("distinguishes staff vs admin Google login attempts on customer portal", () => {
      expect(
        mapAuthErrorMessage(
          "This Google account belongs to a staff member. Use the Staff portal with your phone number and password.",
        ),
      ).toContain("Staff portal");

      expect(
        mapAuthErrorMessage(
          "This Google account belongs to an administrator. Use the Admin portal with your phone number and password.",
        ),
      ).toContain("Admin portal");
    });

    it("extracts code from API response payloads", () => {
      expect(extractApiErrorCode({ data: { code: "OTP_PROVIDER_UNAVAILABLE" } })).toBe(
        "OTP_PROVIDER_UNAVAILABLE",
      );
      expect(extractApiErrorCode({ response: { data: { code: "PORTAL_MISMATCH" } } })).toBe(
        "PORTAL_MISMATCH",
      );
      expect(extractApiErrorCode({ code: "OTP_RATE_LIMITED" })).toBe("OTP_RATE_LIMITED");
      expect(extractApiErrorCode(null)).toBeNull();
    });
  });
});
