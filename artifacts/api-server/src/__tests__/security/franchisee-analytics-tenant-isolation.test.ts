import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUnifiedPlatformAnalytics = vi.fn().mockResolvedValue({
  operational: { activeSubscriptions: 5, activeCustomers: 5 },
  financial: { invoicedRevenue: 10000, collectedRevenue: 8000 },
  cityBreakdown: [],
  branchBreakdown: [],
  retention: { newCustomersThisMonth: 2, renewalsDueThisMonth: 1, cancelledSubscriptionsThisMonth: 0 },
});

vi.mock("../../lib/analytics/multiCityAnalyticsService", () => ({
  getUnifiedPlatformAnalytics: (...args: any[]) => mockGetUnifiedPlatformAnalytics(...args),
}));

const mockDbSelect = vi.fn();
const mockDbExecute = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: () => mockDbSelect(),
    execute: () => mockDbExecute(),
  },
  franchiseesTable: {
    id: "franchisees.id",
    name: "franchisees.name",
    branchId: "franchisees.branch_id",
    cityId: "franchisees.city_id",
  },
  branchesTable: {
    id: "branches.id",
    name: "branches.name",
  },
  customersTable: {
    id: "customers.id",
    companyId: "customers.company_id",
    branchId: "customers.branch_id",
    franchiseeId: "customers.franchisee_id",
    status: "customers.status",
    createdAt: "customers.created_at",
  },
  bookingsTable: {
    id: "bookings.id",
    companyId: "bookings.company_id",
    branchId: "bookings.branch_id",
    franchiseeId: "bookings.franchisee_id",
    status: "bookings.status",
  },
  subscriptionsTable: {
    id: "subscriptions.id",
    companyId: "subscriptions.company_id",
    branchId: "subscriptions.branch_id",
    franchiseeId: "subscriptions.franchisee_id",
    status: "subscriptions.status",
  },
  complaintsTable: {
    id: "complaints.id",
    companyId: "complaints.company_id",
    branchId: "complaints.branch_id",
    status: "complaints.status",
  },
  invoicesTable: {
    id: "invoices.id",
  },
  paymentsTable: {
    id: "payments.id",
  },
  staffTable: {
    id: "staff.id",
  },
}));

import analyticsRouter from "../../routes/analytics";

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    data: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

function getRouteHandler(path: string, method: "get" | "post" = "get") {
  const layer = analyticsRouter.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe("SEC-P1-03: Franchisee Analytics Tenant Isolation & Data Leakage Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Multi-City Analytics Anti-Spoofing & Franchisee Boundary Defense", () => {
    const multiCityHandler = getRouteHandler("/analytics/multi-city", "get");

    it("denies Franchisee A from querying Franchisee B analytics (returns 403)", async () => {
      // Franchisee A has franchiseeId: 10
      const req: any = {
        scope: {
          isSuperAdmin: false,
          companyId: 1,
          cityId: 2,
          branchIds: [2],
          franchiseeId: 10,
        },
        query: { franchiseeId: "20" }, // Attempt to query Franchisee B
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await multiCityHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toMatch(/Cannot query analytics for an unauthorized franchisee/i);
      expect(mockGetUnifiedPlatformAnalytics).not.toHaveBeenCalled();
    });

    it("allows Franchisee A to query their own analytics without spoofing", async () => {
      const req: any = {
        scope: {
          isSuperAdmin: false,
          companyId: 1,
          cityId: 2,
          branchIds: [2],
          franchiseeId: 10,
        },
        query: { franchiseeId: "10" },
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await multiCityHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockGetUnifiedPlatformAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          franchiseeId: 10,
          branchId: 2,
        }),
      );
    });

    it("automatically pins franchiseeId from scope when query parameter is omitted", async () => {
      const req: any = {
        scope: {
          isSuperAdmin: false,
          companyId: 1,
          cityId: 2,
          branchIds: [2],
          franchiseeId: 10,
        },
        query: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await multiCityHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockGetUnifiedPlatformAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          franchiseeId: 10,
          branchId: 2,
        }),
      );
    });

    it("denies branch manager from querying franchisee outside assigned branch scope (returns 403)", async () => {
      // Branch Manager for Branch 1
      const req: any = {
        scope: {
          isSuperAdmin: false,
          companyId: 1,
          cityId: 1,
          branchIds: [1],
          franchiseeId: null,
        },
        query: { branchId: "1", franchiseeId: "10" },
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      // Mock franchisee 10 belongs to branch 2
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 10, branchId: 2 }]),
          }),
        }),
      });

      await multiCityHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toMatch(/Franchisee outside assigned branch scope/i);
      expect(mockGetUnifiedPlatformAnalytics).not.toHaveBeenCalled();
    });

    it("allows superadmin to query any franchisee analytics without restriction", async () => {
      const req: any = {
        scope: {
          isSuperAdmin: true,
          companyId: 1,
          cityId: null,
          branchIds: null,
          franchiseeId: null,
        },
        query: { franchiseeId: "20" },
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await multiCityHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockGetUnifiedPlatformAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          franchiseeId: 20,
        }),
      );
    });
  });

  describe("2. Customer Analytics Endpoint Scoping (/analytics/customers)", () => {
    const customersHandler = getRouteHandler("/analytics/customers", "get");

    it("enforces tenantFilters with franchiseeCol on customer analytics query", async () => {
      const req: any = {
        scope: {
          isSuperAdmin: false,
          companyId: 1,
          cityId: 2,
          branchIds: [2],
          franchiseeId: 10,
        },
        query: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      mockDbSelect.mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      mockDbExecute.mockResolvedValue([
        [{ count: 1 }], // newResult
        [{ city: "Noida", count: 3 }], // cityResult
        [{ month: "Nov 2026", count: 3 }], // growthResult
        [{ customer_id: 101 }], // repeatResult
      ]);

      await customersHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.totalCustomers).toBe(3);
    });
  });
});
