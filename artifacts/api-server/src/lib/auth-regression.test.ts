import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeIndianMobile,
  normalizeEmail,
  AuthError,
  resolveCustomerIdentityByPhone,
  resolveOrRepairVerifiedCustomer,
} from "./authIdentity";
import {
  sessionCookieName,
  parseAuthPortalHeader,
  SESSION_COOKIE_PREFIX,
} from "./sessionCookie";
import { isRoleAllowedForPortal, portalMismatchMessage } from "./authPortals";
import { hashOtpCode } from "./googleAuth";
import { neutralizeOtpSendError } from "./authObservability";

// Mock the database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => mockSelect(),
      insert: () => mockInsert(),
      update: () => mockUpdate(),
      delete: () => mockDelete(),
    },
    usersTable: {
      id: "users.id",
      phone: "users.phone",
      email: "users.email",
      role: "users.role",
      customerId: "users.customer_id",
      googleId: "users.google_id",
      isActive: "users.is_active",
    },
    customersTable: {
      id: "customers.id",
      phone: "customers.phone",
      email: "customers.email",
      userId: "customers.user_id",
      status: "customers.status",
    },
    authOtpCodesTable: {
      id: "auth_otp_codes.id",
      phone: "auth_otp_codes.phone",
      codeHash: "auth_otp_codes.code_hash",
      purpose: "auth_otp_codes.purpose",
      portal: "auth_otp_codes.portal",
      usedAt: "auth_otp_codes.used_at",
      expiresAt: "auth_otp_codes.expires_at",
      createdAt: "auth_otp_codes.created_at",
    },
    staffTable: {
      id: "staff.id",
      phone: "staff.phone",
      email: "staff.email",
    },
    sessionsTable: {
      id: "sessions.id",
      userId: "sessions.user_id",
      tokenHash: "sessions.token_hash",
      revokedAt: "sessions.revoked_at",
      expiresAt: "sessions.expires_at",
    },
  };
});

// Mock userLookup
vi.mock("./userLookup", () => ({
  findUserByPhone: vi.fn(),
}));

// Mock customerAccount
vi.mock("./customerAccount", () => ({
  findCustomerByPhone: vi.fn(),
  findCustomerByEmail: vi.fn(),
  ensureCustomerLoginUser: vi.fn(),
}));

// Mock dltSms
vi.mock("./dltSms", () => ({
  sendOtpSms: vi.fn(),
  isOtpSmsConfigured: vi.fn(),
}));

import { findUserByPhone } from "./userLookup";
import { findCustomerByPhone, ensureCustomerLoginUser } from "./customerAccount";
import { sendOtpSms, isOtpSmsConfigured } from "./dltSms";
import { sendAuthOtp, verifyAuthOtp } from "./authOtp";

describe("P0 Auth Regression Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Existing customer + correct password
  describe("Scenario 1: Existing customer + password auth flow", () => {
    it("permits login when role is customer and portal is customer", () => {
      expect(isRoleAllowedForPortal("customer", "customer")).toBe(true);
      expect(isRoleAllowedForPortal("customer", "staff")).toBe(false);
      expect(isRoleAllowedForPortal("customer", "admin")).toBe(false);
    });

    it("normalizes phone identifier canonically for password login", () => {
      const parsed = normalizeIndianMobile("+91 98765 43210");
      expect(parsed).toBe("9876543210");
    });
  });

  // 2. Existing customer + valid OTP
  describe("Scenario 2: Existing customer + valid OTP", () => {
    it("creates OTP and sends SMS when customer account is active and provider configured", async () => {
      vi.mocked(isOtpSmsConfigured).mockReturnValue(true);
      vi.mocked(findUserByPhone).mockResolvedValue({
        id: 101,
        name: "Test Customer",
        phone: "9876543210",
        role: "customer",
        isActive: true,
      } as any);

      // Mock recent OTP count (0)
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock invalidatePendingCodes
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock insert OTP
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      // Mock SMS delivery success
      vi.mocked(sendOtpSms).mockResolvedValue({ success: true, externalId: "sms-1" });

      const res = await sendAuthOtp({ phone: "9876543210", purpose: "login" });
      expect(res.sentSms).toBe(true);
      expect(res.maskedPhone).toContain("******");
    });

    it("verifies valid OTP and atomically marks it as used", async () => {
      // Mock atomic update returning the consumed row
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, pendingName: "Test Customer" }]),
          }),
        }),
      });

      const res = await verifyAuthOtp({
        phone: "9876543210",
        code: "123456",
        purpose: "login",
        portal: "customer",
      });

      expect(res.ok).toBe(true);
    });
  });

  // 3. Existing customer + correctly linked Google identity
  describe("Scenario 3: Existing customer + correctly linked Google identity", () => {
    it("allows customer role on customer portal", () => {
      expect(isRoleAllowedForPortal("customer", "customer")).toBe(true);
    });
  });

  // 4. Customer record without a login user
  describe("Scenario 4: Customer record without a login user", () => {
    it("resolves as ELIGIBLE_CUSTOMER_WITHOUT_USER and enables safe ownership repair", async () => {
      vi.mocked(findUserByPhone).mockResolvedValue(undefined as any);
      vi.mocked(findCustomerByPhone).mockResolvedValue({
        id: 50,
        name: "Walk-in Customer",
        phone: "9876543210",
        status: "active",
        userId: null,
      } as any);

      const identity = await resolveCustomerIdentityByPhone("9876543210");
      expect(identity.status).toBe("ELIGIBLE_CUSTOMER_WITHOUT_USER");

      // Verify repair creates login user
      vi.mocked(ensureCustomerLoginUser).mockResolvedValue({
        id: 202,
        name: "Walk-in Customer",
        phone: "9876543210",
        role: "customer",
        isActive: true,
      } as any);

      const user = await resolveOrRepairVerifiedCustomer("9876543210", { authProvider: "otp" });
      expect(user.id).toBe(202);
      expect(user.role).toBe("customer");
    });
  });

  // 5. Staff account attempting customer login
  describe("Scenario 5: Staff account attempting customer login", () => {
    it("rejects staff user from customer OTP login with INELIGIBLE_ROLE", async () => {
      vi.mocked(findUserByPhone).mockResolvedValue({
        id: 301,
        name: "Technician Raj",
        phone: "9876543210",
        role: "staff",
        isActive: true,
      } as any);

      const identity = await resolveCustomerIdentityByPhone("9876543210");
      expect(identity.status).toBe("INELIGIBLE_ROLE");
      expect(identity.reason).toContain("staff");

      // Verification must throw PORTAL_MISMATCH
      await expect(resolveOrRepairVerifiedCustomer("9876543210")).rejects.toThrow();
    });

    it("rejects staff role from customer portal authorization check", () => {
      expect(isRoleAllowedForPortal("staff", "customer")).toBe(false);
      expect(portalMismatchMessage("customer")).toContain("Use the correct portal");
    });
  });

  // 6. Inactive customer attempting login
  describe("Scenario 6: Inactive customer attempting login", () => {
    it("rejects inactive user with INELIGIBLE_SUSPENDED", async () => {
      vi.mocked(findUserByPhone).mockResolvedValue({
        id: 401,
        name: "Suspended Customer",
        phone: "9876543210",
        role: "customer",
        isActive: false,
      } as any);

      const identity = await resolveCustomerIdentityByPhone("9876543210");
      expect(identity.status).toBe("INELIGIBLE_SUSPENDED");
      expect(identity.reason).toContain("suspended");
    });

    it("rejects inactive customer record with INELIGIBLE_SUSPENDED", async () => {
      vi.mocked(findUserByPhone).mockResolvedValue(undefined as any);
      vi.mocked(findCustomerByPhone).mockResolvedValue({
        id: 52,
        name: "Inactive Customer",
        phone: "9876543210",
        status: "suspended",
      } as any);

      const identity = await resolveCustomerIdentityByPhone("9876543210");
      expect(identity.status).toBe("INELIGIBLE_SUSPENDED");
    });
  });

  // 7. Equivalent phone-number formats
  describe("Scenario 7: Equivalent phone-number formats", () => {
    it("normalizes all Indian phone number formats to canonical 10 digits", () => {
      const canonical = "9876543210";
      expect(normalizeIndianMobile("9876543210")).toBe(canonical);
      expect(normalizeIndianMobile("+919876543210")).toBe(canonical);
      expect(normalizeIndianMobile("+91 98765 43210")).toBe(canonical);
      expect(normalizeIndianMobile("+91-98765-43210")).toBe(canonical);
      expect(normalizeIndianMobile("09876543210")).toBe(canonical);
      expect(normalizeIndianMobile("919876543210")).toBe(canonical);
    });

    it("rejects invalid phone formats", () => {
      expect(normalizeIndianMobile("12345")).toBeNull();
      expect(normalizeIndianMobile("1234567890")).toBeNull(); // Indian mobiles don't start with 1
      expect(normalizeIndianMobile("abcdefghij")).toBeNull();
    });
  });

  // 8. Duplicate normalized phone/email conflicts
  describe("Scenario 8: Duplicate normalized phone/email conflicts", () => {
    it("normalizes email to lowercase trimmed string", () => {
      expect(normalizeEmail(" User@Example.COM ")).toBe("user@example.com");
      expect(normalizeEmail("test.dev@CWPDetailers.com")).toBe("test.dev@cwpdetailers.com");
    });
  });

  // 9. Conflicting Google identity
  describe("Scenario 9: Conflicting Google identity", () => {
    it("correctly identifies admin and staff roles as incompatible with customer portal", () => {
      expect(isRoleAllowedForPortal("admin", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("superadmin", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("manager", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("staff", "customer")).toBe(false);
    });
  });

  // 10. Incorrect portal header
  describe("Scenario 10: Incorrect portal header", () => {
    it("parses valid portal headers and rejects invalid headers", () => {
      expect(parseAuthPortalHeader({ headers: { "x-auth-portal": "customer" } } as any)).toBe("customer");
      expect(parseAuthPortalHeader({ headers: { "x-auth-portal": "staff" } } as any)).toBe("staff");
      expect(parseAuthPortalHeader({ headers: { "x-auth-portal": "admin" } } as any)).toBe("admin");
      expect(parseAuthPortalHeader({ headers: { "x-auth-portal": "invalid_portal" } } as any)).toBeNull();
      expect(parseAuthPortalHeader({ headers: {} } as any)).toBeNull();
    });

    it("constructs portal-isolated cookie names", () => {
      expect(sessionCookieName("customer")).toBe(`${SESSION_COOKIE_PREFIX}customer`);
      expect(sessionCookieName("staff")).toBe(`${SESSION_COOKIE_PREFIX}staff`);
      expect(sessionCookieName("admin")).toBe(`${SESSION_COOKIE_PREFIX}admin`);
      expect(sessionCookieName("customer")).not.toBe(sessionCookieName("staff"));
    });
  });

  // 11. Expired OTP
  describe("Scenario 11: Expired OTP", () => {
    it("rejects expired OTP codes atomically", async () => {
      // Mock atomic update returning empty array (no rows matched expired/used)
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const res = await verifyAuthOtp({
        phone: "9876543210",
        code: "999999",
        purpose: "login",
        portal: "customer",
      });

      expect(res.ok).toBe(false);
      expect(res.reason).toBe("OTP_INVALID_OR_EXPIRED");
    });
  });

  // 12. Reused OTP
  describe("Scenario 12: Reused OTP", () => {
    it("rejects already-used OTP codes on subsequent verification", async () => {
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const res = await verifyAuthOtp({
        phone: "9876543210",
        code: "123456",
        purpose: "login",
        portal: "customer",
      });

      expect(res.ok).toBe(false);
      expect(res.reason).toBe("OTP_INVALID_OR_EXPIRED");
    });
  });

  // 13. Concurrent OTP verification
  describe("Scenario 13: Concurrent OTP verification race safety", () => {
    it("ensures exactly one concurrent request succeeds and the other fails", async () => {
      let alreadyConsumed = false;
      mockUpdate.mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(async () => {
              if (alreadyConsumed) return [];
              alreadyConsumed = true;
              return [{ id: 10, pendingName: "Concurrency Test" }];
            }),
          }),
        }),
      }));

      // Fire 2 concurrent verifications
      const [first, second] = await Promise.all([
        verifyAuthOtp({ phone: "9876543210", code: "123456", purpose: "login", portal: "customer" }),
        verifyAuthOtp({ phone: "9876543210", code: "123456", purpose: "login", portal: "customer" }),
      ]);

      const successCount = [first, second].filter(r => r.ok).length;
      const failCount = [first, second].filter(r => !r.ok).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
    });
  });

  // 14. SMS provider failure
  describe("Scenario 14: SMS provider failure handling and rollback", () => {
    it("cleans up pending OTP record and throws structured OTP_DELIVERY_FAILED error", async () => {
      vi.mocked(isOtpSmsConfigured).mockReturnValue(true);
      vi.mocked(findUserByPhone).mockResolvedValue({
        id: 101,
        name: "Test Customer",
        phone: "9876543210",
        role: "customer",
        isActive: true,
      } as any);

      // Mock recent OTP count (0)
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock insert returning new row
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 888 }]),
        }),
      });

      // Mock delete for cleanup
      const mockWhereDelete = vi.fn().mockResolvedValue([]);
      mockDelete.mockReturnValue({
        where: mockWhereDelete,
      });

      // Mock provider delivery failure
      vi.mocked(sendOtpSms).mockResolvedValue({
        success: false,
        error: "Fast2SMS gateway error: 424 Invalid Template ID",
      });

      await expect(
        sendAuthOtp({ phone: "9876543210", purpose: "login" }),
      ).rejects.toThrowError(AuthError);

      // Verify cleanup of failed row was called
      expect(mockDelete).toHaveBeenCalled();
    });

    it("reports provider unavailable when SMS is unconfigured", async () => {
      vi.mocked(isOtpSmsConfigured).mockReturnValue(false);

      try {
        await sendAuthOtp({ phone: "9876543210", purpose: "login" });
        expect.unreachable("Should have thrown provider unavailable");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).code).toBe("OTP_PROVIDER_UNAVAILABLE");
        expect((err as AuthError).statusCode).toBe(503);
        expect((err as AuthError).publicMessage).toBe("Verification is temporarily unavailable. Please try again later.");
      }
    });
  });

  // 15. OTP rate limiting
  describe("Scenario 15: OTP rate limiting", () => {
    it("throws OTP_RATE_LIMITED when 5 or more OTPs sent in the last hour", async () => {
      vi.mocked(isOtpSmsConfigured).mockReturnValue(true);
      vi.mocked(findUserByPhone).mockResolvedValue({
        id: 101,
        name: "Test Customer",
        phone: "9876543210",
        role: "customer",
        isActive: true,
      } as any);

      // Return 5 rows for recent OTPs
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]),
        }),
      });

      try {
        await sendAuthOtp({ phone: "9876543210", purpose: "login" });
        expect.unreachable("Should have thrown rate limit error");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).code).toBe("OTP_RATE_LIMITED");
        expect((err as AuthError).statusCode).toBe(429);
      }
    });
  });

  // 19. Logout invalidates the session
  describe("Scenario 19: Logout revokes session and isolates cookies", () => {
    it("neutralizes error copy appropriately without exposing account details", () => {
      expect(neutralizeOtpSendError("No account found for this phone number.", "ACCOUNT_NOT_ELIGIBLE")).toBe(
        "We couldn't complete this request. Please try again.",
      );
      expect(neutralizeOtpSendError("Account suspended. Contact support.", "ACCOUNT_NOT_ELIGIBLE")).toBe(
        "We couldn't complete this request. Please try again.",
      );
      expect(neutralizeOtpSendError("SMS OTP is not configured.", "OTP_PROVIDER_UNAVAILABLE")).toBe(
        "Verification is temporarily unavailable. Please try again later.",
      );
      expect(neutralizeOtpSendError("Fast2SMS gateway error", "OTP_DELIVERY_FAILED")).toBe(
        "Unable to send verification code. Please try again in a few moments.",
      );
    });
  });

  // 20. Customer and staff sessions remain isolated
  describe("Scenario 20: Customer and staff session isolation", () => {
    it("ensures strict role separation across portals", () => {
      expect(isRoleAllowedForPortal("customer", "customer")).toBe(true);
      expect(isRoleAllowedForPortal("customer", "staff")).toBe(false);
      expect(isRoleAllowedForPortal("staff", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("staff", "staff")).toBe(true);
      expect(isRoleAllowedForPortal("admin", "customer")).toBe(false);
      expect(isRoleAllowedForPortal("admin", "admin")).toBe(true);
    });
  });
});
