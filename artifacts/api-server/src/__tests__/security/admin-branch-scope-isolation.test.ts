/**
 * Admin Branch Scope Hardening & Data Isolation Test Suite
 * (ADMIN-020: Admin Branch Scope Hardening & Universal Data Refresh Repair)
 *
 * Validates:
 * 1. Branch authorization logic & access checks (isBranchAuthorized, assertBranchAccess).
 * 2. Scoped admin requesting unauthorized branchId is rejected with 403 (BRANCH_UNAUTHORIZED).
 * 3. Scoped admin requesting authorized branchId receives proper effective branch filtering.
 * 4. Superadmin / Central admin can switch to any active authorized branch.
 * 5. Branch-scoped query isolation across operational records (no cross-branch data leakage).
 * 6. Multi-branch manager authorization and isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";
import {
  BranchAccessDeniedError,
  isBranchAuthorized,
  assertBranchAccess,
  resolveEffectiveBranchId,
} from "../../middlewares/tenantScope";

function makeMockRequest(overrides?: {
  role?: string;
  userBranchId?: number | null;
  scopeBranchIds?: number[] | null;
  user?: Record<string, unknown>;
  query?: Record<string, string>;
}): Request {
  const role = overrides?.role ?? "admin";
  const userBranchId = overrides?.userBranchId ?? null;
  const scopeBranchIds = overrides?.scopeBranchIds ?? (userBranchId ? [userBranchId] : null);

  return {
    user: {
      id: 99,
      role,
      branchId: userBranchId,
      ...overrides?.user,
    },
    scope: {
      companyId: 1,
      branchId: userBranchId,
      branchIds: scopeBranchIds,
      cityId: 1,
      franchiseeId: null,
      customerId: null,
      staffId: null,
    },
    query: overrides?.query ?? {},
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  } as unknown as Request;
}

describe("ADMIN-020: Server-side Branch Scope Hardening & Access Control", () => {
  describe("BranchAccessDeniedError", () => {
    it("should instantiate with status 403 and code BRANCH_UNAUTHORIZED", () => {
      const err = new BranchAccessDeniedError("Access to branch 99 is not authorized");
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("BRANCH_UNAUTHORIZED");
      expect(err.message).toBe("Access to branch 99 is not authorized");
      expect(err.name).toBe("BranchAccessDeniedError");
    });
  });

  describe("isBranchAuthorized", () => {
    it("allows superadmin to access any branch", () => {
      const req = makeMockRequest({ role: "superadmin" });
      expect(isBranchAuthorized(req, 1)).toBe(true);
      expect(isBranchAuthorized(req, 99)).toBe(true);
    });

    it("allows central_admin without branchId to access any branch", () => {
      const req = makeMockRequest({ role: "central_admin", userBranchId: null });
      expect(isBranchAuthorized(req, 1)).toBe(true);
      expect(isBranchAuthorized(req, 42)).toBe(true);
    });

    it("allows admin without branchId (central view) to access any branch", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: null, scopeBranchIds: null });
      expect(isBranchAuthorized(req, 1)).toBe(true);
      expect(isBranchAuthorized(req, 2)).toBe(true);
    });

    it("restricts scoped branch admin to their own branch", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 10, scopeBranchIds: [10] });
      expect(isBranchAuthorized(req, 10)).toBe(true);
      expect(isBranchAuthorized(req, 20)).toBe(false);
      expect(isBranchAuthorized(req, 1)).toBe(false);
    });

    it("restricts multi-branch manager to only assigned branchIds", () => {
      const req = makeMockRequest({ role: "manager", userBranchId: 10, scopeBranchIds: [10, 11] });
      expect(isBranchAuthorized(req, 10)).toBe(true);
      expect(isBranchAuthorized(req, 11)).toBe(true);
      expect(isBranchAuthorized(req, 12)).toBe(false);
      expect(isBranchAuthorized(req, 99)).toBe(false);
    });

    it("rejects when request has no user or unauthenticated", () => {
      const unauthReq = {} as Request;
      expect(isBranchAuthorized(unauthReq, 10)).toBe(false);
    });
  });

  describe("assertBranchAccess", () => {
    it("does not throw when branch is authorized", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 5, scopeBranchIds: [5] });
      expect(() => assertBranchAccess(req, 5)).not.toThrow();
    });

    it("throws BranchAccessDeniedError when branch is unauthorized", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 5, scopeBranchIds: [5] });
      expect(() => assertBranchAccess(req, 8)).toThrow(BranchAccessDeniedError);
      try {
        assertBranchAccess(req, 8);
      } catch (e) {
        expect((e as BranchAccessDeniedError).statusCode).toBe(403);
        expect((e as BranchAccessDeniedError).code).toBe("BRANCH_UNAUTHORIZED");
      }
    });
  });

  describe("resolveEffectiveBranchId", () => {
    it("superadmin: resolves explicitly requested valid branchId", () => {
      const req = makeMockRequest({ role: "superadmin" });
      const branchId = resolveEffectiveBranchId(req, "15");
      expect(branchId).toBe(15);
    });

    it("superadmin: returns undefined when no branchId requested (global founder view)", () => {
      const req = makeMockRequest({ role: "superadmin" });
      const branchId = resolveEffectiveBranchId(req, undefined);
      expect(branchId).toBeUndefined();
    });

    it("scoped admin: resolves authorized requested branchId", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 10, scopeBranchIds: [10] });
      const branchId = resolveEffectiveBranchId(req, "10");
      expect(branchId).toBe(10);
    });

    it("scoped admin: defaults to their authorized branch if no branchId requested (no silent global leak)", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 10, scopeBranchIds: [10] });
      const branchId = resolveEffectiveBranchId(req, undefined);
      expect(branchId).toBe(10);
    });

    it("scoped admin: throws 403 BranchAccessDeniedError when requesting unauthorized branchId", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 10, scopeBranchIds: [10] });
      expect(() => resolveEffectiveBranchId(req, "99")).toThrow(BranchAccessDeniedError);
    });

    it("multi-branch admin: allows switching between assigned branches", () => {
      const req = makeMockRequest({ role: "manager", userBranchId: 10, scopeBranchIds: [10, 20] });
      expect(resolveEffectiveBranchId(req, "10")).toBe(10);
      expect(resolveEffectiveBranchId(req, "20")).toBe(20);
    });

    it("multi-branch admin: throws 403 when requesting an unassigned branch", () => {
      const req = makeMockRequest({ role: "manager", userBranchId: 10, scopeBranchIds: [10, 20] });
      expect(() => resolveEffectiveBranchId(req, "30")).toThrow(BranchAccessDeniedError);
    });
  });

  describe("Data Isolation & Cross-Branch Leakage Protection", () => {
    it("guarantees Varanasi admin (branch 1) cannot resolve or query Noida branch (branch 2)", () => {
      const varanasiAdminReq = makeMockRequest({
        role: "admin",
        userBranchId: 1, // Varanasi Hub
        scopeBranchIds: [1],
      });

      // Requesting Varanasi data succeeds
      expect(resolveEffectiveBranchId(varanasiAdminReq, "1")).toBe(1);

      // Attempting to query Noida data fails with 403
      expect(() => resolveEffectiveBranchId(varanasiAdminReq, "2")).toThrow(BranchAccessDeniedError);
    });

    it("guarantees Noida admin (branch 2) cannot resolve or query Varanasi branch (branch 1)", () => {
      const noidaAdminReq = makeMockRequest({
        role: "admin",
        userBranchId: 2, // Noida Hub
        scopeBranchIds: [2],
      });

      // Requesting Noida data succeeds
      expect(resolveEffectiveBranchId(noidaAdminReq, "2")).toBe(2);

      // Attempting to query Varanasi data fails with 403
      expect(() => resolveEffectiveBranchId(noidaAdminReq, "1")).toThrow(BranchAccessDeniedError);
    });

    it("prevents empty string or NaN branchId from bypassing security checks", () => {
      const req = makeMockRequest({ role: "admin", userBranchId: 10, scopeBranchIds: [10] });
      // Invalid/NaN branchId should default safely to user's authorized branch
      expect(resolveEffectiveBranchId(req, "invalid")).toBe(10);
      expect(resolveEffectiveBranchId(req, "")).toBe(10);
    });
  });
});
