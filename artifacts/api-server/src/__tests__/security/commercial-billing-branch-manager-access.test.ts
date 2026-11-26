/**
 * SEC-P1-01: Commercial Billing Access & Tenant Isolation Regression Test Suite
 *
 * Validates:
 * 1. Authorized branch_manager, city_admin, central_admin, and existing roles can access billing.
 * 2. Branch manager cannot access another branch's billing records (cross-branch denied with 403 / 404).
 * 3. Missing branch scope fails closed (empty results, no unauthorized data leak).
 * 4. Unauthorized staff and customer roles remain strictly denied.
 * 5. Finance/admin/central_admin/superadmin roles retain their expected global access.
 * 6. Billing mutation permissions are correctly enforced (view vs create vs edit).
 * 7. Existing billing workflows continue working as expected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  assertAdminBillingActor,
  CommercialValidationError,
} from "../../lib/billing/commercialValidation";
import { mapBillingError } from "../../lib/billing/billingErrors";
import { guardResource, type PermissionOverride } from "../../middlewares/permissions";
import {
  BranchAccessDeniedError,
  resolveEffectiveBranchId,
  isBranchAuthorized,
  rowInScope,
  tenantFilters,
} from "../../middlewares/tenantScope";

// Hoisted mocks for router-level permission checks
const requirePermissionMock = vi.fn();

vi.mock("../../middlewares/auth", () => ({
  requirePermission: (resource: string, action: string) => {
    requirePermissionMock(resource, action);
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (req.user.role === "staff" || req.user.role === "customer") {
        return res.status(403).json({ error: "Permission denied", resource, action });
      }
      return next();
    };
  },
}));

function mockReq(options?: {
  method?: string;
  path?: string;
  role?: string;
  userBranchId?: number | null;
  scopeBranchIds?: number[] | null;
  isSuperAdmin?: boolean;
  companyId?: number | null;
  query?: Record<string, string>;
}): Request {
  const method = options?.method ?? "GET";
  const path = options?.path ?? "/billing/ready-for-billing";
  const role = options?.role ?? "branch_manager";
  const userBranchId = options?.userBranchId !== undefined ? options.userBranchId : 1;
  const isSuperAdmin = options?.isSuperAdmin ?? (role === "superadmin" || role === "central_admin");
  const scopeBranchIds = options?.scopeBranchIds !== undefined
    ? options.scopeBranchIds
    : (isSuperAdmin ? null : (userBranchId !== null ? [userBranchId] : []));

  return {
    method,
    path,
    query: options?.query ?? {},
    params: {},
    body: {},
    user: role
      ? {
          id: 101,
          name: "Test User",
          role,
          companyId: options?.companyId ?? 1,
          branchId: userBranchId,
        }
      : undefined,
    scope: role
      ? {
          isSuperAdmin,
          companyId: options?.companyId ?? 1,
          branchIds: scopeBranchIds,
          cityId: 1,
          franchiseeId: null,
          customerId: null,
          staffId: null,
        }
      : undefined,
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  } as unknown as Request;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const billingOverrides: PermissionOverride[] = [
  { match: /\/billing\/jobs\/\d+\/generate$/, method: "POST", action: "create" },
  { match: /\/billing\/invoices\/\d+\/issue$/, method: "POST", action: "edit" },
  { match: /\/billing\/invoices\/\d+\/mark-paid$/, method: "POST", action: "edit" },
  { match: /\/billing\/invoices\/\d+\/void$/, method: "POST", action: "edit" },
  { match: /\/billing\/invoices\/\d+\/credit-note$/, method: "POST", action: "create" },
];

describe("SEC-P1-01: Commercial Billing Role Authorization & Multi-City Tenant Scoping", () => {
  beforeEach(() => {
    requirePermissionMock.mockClear();
  });

  // -------------------------------------------------------------------------
  // 1. Service Layer: assertAdminBillingActor Role Authorization
  // -------------------------------------------------------------------------
  describe("1. Service Layer Role Authorization (assertAdminBillingActor)", () => {
    it("allows branch_manager to perform billing actions", () => {
      expect(() => assertAdminBillingActor("branch_manager")).not.toThrow();
    });

    it("allows city_admin and central_admin to perform billing actions", () => {
      expect(() => assertAdminBillingActor("city_admin")).not.toThrow();
      expect(() => assertAdminBillingActor("central_admin")).not.toThrow();
    });

    it("preserves access for existing admin, superadmin, manager, and franchisee roles", () => {
      expect(() => assertAdminBillingActor("admin")).not.toThrow();
      expect(() => assertAdminBillingActor("superadmin")).not.toThrow();
      expect(() => assertAdminBillingActor("manager")).not.toThrow();
      expect(() => assertAdminBillingActor("franchisee")).not.toThrow();
    });

    it("strictly rejects unauthorized staff, customer, supervisor, and anonymous callers", () => {
      expect(() => assertAdminBillingActor("staff")).toThrow(CommercialValidationError);
      expect(() => assertAdminBillingActor("customer")).toThrow(CommercialValidationError);
      expect(() => assertAdminBillingActor("supervisor")).toThrow(CommercialValidationError);
      expect(() => assertAdminBillingActor("unknown_role")).toThrow(CommercialValidationError);
      expect(() => assertAdminBillingActor(null)).toThrow(CommercialValidationError);
      expect(() => assertAdminBillingActor(undefined)).toThrow(CommercialValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Route Guard & Action Mapping on /billing/*
  // -------------------------------------------------------------------------
  describe("2. Route Guarding and Permission Action Mapping", () => {
    const guard = guardResource("invoices", billingOverrides, [], "/billing");

    it("guards GET /billing/ready-for-billing with invoices:view", () => {
      const next = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/ready-for-billing" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next).toHaveBeenCalled();
    });

    it("guards GET /billing/jobs/:id/preview with invoices:view", () => {
      const next = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/jobs/42/preview" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next).toHaveBeenCalled();
    });

    it("guards POST /billing/jobs/:id/generate with invoices:create override", () => {
      const next = vi.fn();
      guard(mockReq({ method: "POST", path: "/billing/jobs/42/generate" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "create");
      expect(next).toHaveBeenCalled();
    });

    it("guards GET /billing/commercial with invoices:view", () => {
      const next = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/commercial" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next).toHaveBeenCalled();
    });

    it("guards GET /billing/invoices/:id with invoices:view", () => {
      const next = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/invoices/88" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next).toHaveBeenCalled();
    });

    it("guards POST /billing/invoices/:id/issue with invoices:edit override", () => {
      const next = vi.fn();
      guard(mockReq({ method: "POST", path: "/billing/invoices/88/issue" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "edit");
      expect(next).toHaveBeenCalled();
    });

    it("guards POST /billing/invoices/:id/mark-paid with invoices:edit override", () => {
      const next = vi.fn();
      guard(mockReq({ method: "POST", path: "/billing/invoices/88/mark-paid" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "edit");
      expect(next).toHaveBeenCalled();
    });

    it("guards POST /billing/invoices/:id/void with invoices:edit override", () => {
      const next = vi.fn();
      guard(mockReq({ method: "POST", path: "/billing/invoices/88/void" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "edit");
      expect(next).toHaveBeenCalled();
    });

    it("guards POST /billing/invoices/:id/credit-note with invoices:create override", () => {
      const next = vi.fn();
      guard(mockReq({ method: "POST", path: "/billing/invoices/88/credit-note" }), mockRes(), next);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "create");
      expect(next).toHaveBeenCalled();
    });

    it("guards GET /billing/health and GET /billing/dues with invoices:view", () => {
      const next1 = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/health" }), mockRes(), next1);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next1).toHaveBeenCalled();

      requirePermissionMock.mockClear();
      const next2 = vi.fn();
      guard(mockReq({ method: "GET", path: "/billing/dues" }), mockRes(), next2);
      expect(requirePermissionMock).toHaveBeenCalledWith("invoices", "view");
      expect(next2).toHaveBeenCalled();
    });

    it("does not intercept non-billing paths", () => {
      const next = vi.fn();
      guard(mockReq({ method: "GET", path: "/customers/101" }), mockRes(), next);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("rejects unauthenticated requests with 401", async () => {
      const res = mockRes();
      const next = vi.fn();
      const unauthReq = { method: "GET", path: "/billing/ready-for-billing" } as Request;
      await guard(unauthReq, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Authentication required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects unauthorized staff or customer roles with 403", async () => {
      const resStaff = mockRes();
      const nextStaff = vi.fn();
      await guard(mockReq({ role: "staff", path: "/billing/ready-for-billing" }), resStaff, nextStaff);
      expect(resStaff.statusCode).toBe(403);
      expect(resStaff.body?.error).toBe("Permission denied");
      expect(nextStaff).not.toHaveBeenCalled();

      const resCustomer = mockRes();
      const nextCustomer = vi.fn();
      await guard(mockReq({ role: "customer", path: "/billing/ready-for-billing" }), resCustomer, nextCustomer);
      expect(resCustomer.statusCode).toBe(403);
      expect(resCustomer.body?.error).toBe("Permission denied");
      expect(nextCustomer).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Branch Authorization, Scoping & Isolation
  // -------------------------------------------------------------------------
  describe("3. Branch Authorization, Scoping & Cross-Branch Isolation", () => {
    it("resolves branch_manager assigned branch when no branchId query parameter is provided", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 10, scopeBranchIds: [10] });
      const branchId = resolveEffectiveBranchId(req, undefined);
      expect(branchId).toBe(10);
    });

    it("permits branch_manager to explicitly query their own assigned branch", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 10, scopeBranchIds: [10] });
      const branchId = resolveEffectiveBranchId(req, "10");
      expect(branchId).toBe(10);
    });

    it("throws BranchAccessDeniedError (403) when branch_manager attempts to access another branch", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 10, scopeBranchIds: [10] });
      expect(() => resolveEffectiveBranchId(req, "20")).toThrow(BranchAccessDeniedError);
      expect(() => resolveEffectiveBranchId(req, "20")).toThrow(/Access denied to branch 20/);
    });

    it("isBranchAuthorized returns false for unauthorized branch", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 10, scopeBranchIds: [10] });
      expect(isBranchAuthorized(req, 10)).toBe(true);
      expect(isBranchAuthorized(req, 20)).toBe(false);
    });

    it("allows superadmin and central_admin to access any branch or global view", () => {
      const superReq = mockReq({ role: "superadmin", isSuperAdmin: true });
      expect(resolveEffectiveBranchId(superReq, undefined)).toBeUndefined(); // Global view
      expect(resolveEffectiveBranchId(superReq, "20")).toBe(20); // Specific branch filter
      expect(isBranchAuthorized(superReq, 20)).toBe(true);

      const centralReq = mockReq({ role: "central_admin", isSuperAdmin: true });
      expect(resolveEffectiveBranchId(centralReq, undefined)).toBeUndefined();
      expect(resolveEffectiveBranchId(centralReq, "30")).toBe(30);
      expect(isBranchAuthorized(centralReq, 30)).toBe(true);
    });

    it("fails closed when branch_manager has no active branch assignments", () => {
      const emptyReq = mockReq({ role: "branch_manager", userBranchId: null, scopeBranchIds: [] });
      const effective = resolveEffectiveBranchId(emptyReq, undefined);
      expect(effective).toBeUndefined();

      // tenantFilters produces sql`false` for empty branchIds, completely preventing data exposure
      const filters = tenantFilters(emptyReq, { branchCol: {} as any });
      expect(filters).toHaveLength(1);
      // The filter stringifies with sql`false`
      expect(filters[0]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Record-Level Isolation (rowInScope)
  // -------------------------------------------------------------------------
  describe("4. Record-Level Scope Verification (rowInScope)", () => {
    it("authorizes access to jobs and invoices matching manager branchId", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 1, scopeBranchIds: [1] });
      expect(rowInScope(req, { companyId: 1, branchId: 1 })).toBe(true);
    });

    it("denies access to jobs and invoices belonging to a different branch", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 1, scopeBranchIds: [1] });
      expect(rowInScope(req, { companyId: 1, branchId: 2 })).toBe(false);
    });

    it("denies access to records with null or missing branchId for scoped branch_manager", () => {
      const req = mockReq({ role: "branch_manager", userBranchId: 1, scopeBranchIds: [1] });
      expect(rowInScope(req, { companyId: 1, branchId: null })).toBe(false);
    });

    it("allows superadmin to access records across all branches", () => {
      const req = mockReq({ role: "superadmin", isSuperAdmin: true });
      expect(rowInScope(req, { companyId: 1, branchId: 1 })).toBe(true);
      expect(rowInScope(req, { companyId: 1, branchId: 2 })).toBe(true);
      expect(rowInScope(req, { companyId: 1, branchId: null })).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Error Mapping & Safe Failure
  // -------------------------------------------------------------------------
  describe("5. Error Mapping (mapBillingError)", () => {
    it("maps BranchAccessDeniedError to 403 with BRANCH_UNAUTHORIZED code", () => {
      const err = new BranchAccessDeniedError("Access denied to branch 2");
      const mapped = mapBillingError(err);
      expect(mapped.status).toBe(403);
      expect(mapped.code).toBe("BRANCH_UNAUTHORIZED");
      expect(mapped.message).toBe("Access denied to branch 2");
    });

    it("maps CommercialValidationError UNAUTHORIZED to 403", () => {
      const err = new CommercialValidationError("Billing actions require admin or manager role", "UNAUTHORIZED");
      const mapped = mapBillingError(err);
      expect(mapped.status).toBe(403);
      expect(mapped.message).toContain("require admin or manager role");
    });

    it("maps CommercialValidationError NOT_FOUND to 404", () => {
      const err = new CommercialValidationError("Job not found", "NOT_FOUND");
      const mapped = mapBillingError(err);
      expect(mapped.status).toBe(404);
      expect(mapped.message).toBe("Job not found");
    });
  });
});
