import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockAddressCapability, mockAddressSnapshotService, mockDbRows } = vi.hoisted(() => {
  return {
    mockAddressCapability: {
      createAddress: vi.fn().mockResolvedValue({ id: 1, customerId: 101, formattedAddress: "123 Main St" }),
      listAddresses: vi.fn().mockResolvedValue([{ id: 1, customerId: 101, formattedAddress: "123 Main St" }]),
      getAddress: vi.fn(),
      updateAddress: vi.fn().mockResolvedValue({ id: 1, customerId: 101, formattedAddress: "Updated St" }),
      deleteAddress: vi.fn().mockResolvedValue(true),
      restoreAddress: vi.fn().mockResolvedValue({ id: 1, customerId: 101, isDeleted: false }),
      setDefaultAddress: vi.fn().mockResolvedValue({ id: 1, customerId: 101, isDefault: true }),
      validateAddress: vi.fn().mockResolvedValue({ valid: true }),
      normalizeAddress: vi.fn().mockReturnValue({ normalized: "123 Main St" }),
      previewParsedAddress: vi.fn().mockReturnValue({ street: "123 Main St" }),
      checkDuplicates: vi.fn().mockResolvedValue({ hasDuplicates: false }),
      mergeAddresses: vi.fn().mockResolvedValue({ merged: true }),
      getAddressHistory: vi.fn().mockResolvedValue([]),
    },
    mockAddressSnapshotService: {
      createFromAddressId: vi.fn().mockResolvedValue({ snapshot: { id: 1 } }),
    },
    mockDbRows: {
      customers: [] as any[],
    },
  };
});

vi.mock("../../lib/address/capability/AddressCapability", () => ({
  addressCapability: mockAddressCapability,
}));

vi.mock("../../lib/address/AddressSnapshotService", () => ({
  addressSnapshotService: mockAddressSnapshotService,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    from: vi.fn(() => queryBuilder),
    where: vi.fn(() => queryBuilder),
    limit: vi.fn(() => Promise.resolve(mockDbRows.customers)),
    then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
      return Promise.resolve(mockDbRows.customers).then(onfulfilled, onrejected);
    },
  };
  return {
    ...actual,
    db: queryBuilder,
  };
});

import addressesRouter from "../../routes/addresses";

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
    setHeader(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    send(payload?: any) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

function getRouteHandler(path: string, method: "get" | "post" | "patch" | "delete") {
  const layer = addressesRouter.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe("SEC-P0-01: Address Ownership IDOR & Authorization Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows.customers = [];
  });

  describe("1. Top-Level Authentication Enforcement", () => {
    it("router has requireAuth mounted at the stack level", () => {
      const authMiddleware = addressesRouter.stack[0]?.handle;
      expect(authMiddleware).toBeDefined();

      const req: any = { user: undefined, headers: {} };
      const res = createMockResponse();
      let nextCalled = false;

      authMiddleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.data).toEqual({ error: "Authentication required" });
    });
  });

  describe("2. Customer IDOR Prevention on Address Listing & Creation", () => {
    const listHandler = getRouteHandler("/addresses", "get");
    const createHandler = getRouteHandler("/addresses", "post");

    it("rejects Customer 101 attempting to list Customer 102 addresses with 403 Forbidden", async () => {
      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        query: { customerId: "102" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await listHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
      expect(mockAddressCapability.listAddresses).not.toHaveBeenCalled();
    });

    it("allows Customer 101 to list their own addresses with 200 OK", async () => {
      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        query: { customerId: "101" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await listHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockAddressCapability.listAddresses).toHaveBeenCalledWith(101, expect.any(Object));
    });

    it("rejects Customer 101 attempting to create an address for Customer 102 with 403 Forbidden", async () => {
      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        body: { customerId: 102, formattedAddress: "Malicious Address" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await createHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
      expect(mockAddressCapability.createAddress).not.toHaveBeenCalled();
    });
  });

  describe("3. Item-Level IDOR Prevention (GET, PATCH, DELETE, DEFAULT, RESTORE)", () => {
    const getByIdHandler = getRouteHandler("/addresses/:id", "get");
    const patchByIdHandler = getRouteHandler("/addresses/:id", "patch");
    const deleteByIdHandler = getRouteHandler("/addresses/:id", "delete");
    const defaultHandler = getRouteHandler("/addresses/:id/default", "post");
    const restoreHandler = getRouteHandler("/addresses/:id/restore", "post");

    it("rejects GET /addresses/:id if the address belongs to another customer", async () => {
      mockAddressCapability.getAddress.mockResolvedValueOnce({ id: 55, customerId: 999 });

      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        params: { id: "55" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await getByIdHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
    });

    it("rejects PATCH /addresses/:id if the address belongs to another customer", async () => {
      mockAddressCapability.getAddress.mockResolvedValueOnce({ id: 55, customerId: 999 });

      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        params: { id: "55" },
        body: { formattedAddress: "Tampered Address" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await patchByIdHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
      expect(mockAddressCapability.updateAddress).not.toHaveBeenCalled();
    });

    it("rejects DELETE /addresses/:id if the address belongs to another customer", async () => {
      mockAddressCapability.getAddress.mockResolvedValueOnce({ id: 55, customerId: 999 });

      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        params: { id: "55" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await deleteByIdHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
      expect(mockAddressCapability.deleteAddress).not.toHaveBeenCalled();
    });

    it("rejects POST /addresses/:id/default if the address belongs to another customer", async () => {
      mockAddressCapability.getAddress.mockResolvedValueOnce({ id: 55, customerId: 999 });

      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        params: { id: "55" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await defaultHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockAddressCapability.setDefaultAddress).not.toHaveBeenCalled();
    });

    it("rejects POST /addresses/:id/restore if the address belongs to another customer", async () => {
      mockAddressCapability.getAddress.mockResolvedValueOnce({ id: 55, customerId: 999 });

      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        params: { id: "55" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await restoreHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockAddressCapability.restoreAddress).not.toHaveBeenCalled();
    });
  });

  describe("4. Administrative Tenant-Scope Enforcement", () => {
    const listHandler = getRouteHandler("/addresses", "get");

    it("allows Central SuperAdmin to list addresses for any customer", async () => {
      const req: any = {
        user: { id: 99, role: "super_admin", companyId: null },
        scope: { isSuperAdmin: true, companyId: null, branchIds: null, customerId: null },
        query: { customerId: "500" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await listHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockAddressCapability.listAddresses).toHaveBeenCalledWith(500, expect.any(Object));
    });

    it("rejects Branch Manager attempting to view customer outside their branch scope", async () => {
      // Customer belongs to branch 2, manager is assigned only to branch 1
      mockDbRows.customers = [{ id: 500, branchId: 2, companyId: 1, franchiseeId: null, cityId: 1 }];

      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [1], customerId: null },
        query: { customerId: "500" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await listHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: "Forbidden" });
      expect(mockAddressCapability.listAddresses).not.toHaveBeenCalled();
    });

    it("permits Branch Manager attempting to view customer within their branch scope", async () => {
      // Customer belongs to branch 1, manager is assigned to branch 1
      mockDbRows.customers = [{ id: 500, branchId: 1, companyId: 1, franchiseeId: null, cityId: 1 }];

      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [1], customerId: null },
        query: { customerId: "500" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await listHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockAddressCapability.listAddresses).toHaveBeenCalledWith(500, expect.any(Object));
    });
  });

  describe("5. Validation, Duplicates & Utility Route Protection", () => {
    const checkDupHandler = getRouteHandler("/addresses/check-duplicates", "post");
    const mergeDupHandler = getRouteHandler("/addresses/merge-duplicates", "post");

    it("rejects check-duplicates if customerId belongs to another customer", async () => {
      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        body: { customerId: 999, formattedAddress: "Test" },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await checkDupHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockAddressCapability.checkDuplicates).not.toHaveBeenCalled();
    });

    it("rejects merge-duplicates if customerId belongs to another customer", async () => {
      const req: any = {
        user: { id: 1, role: "customer", customerId: 101 },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        body: { customerId: 999, keepIdentityId: 1, mergeIdentityIds: [2] },
        headers: {},
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      };
      const res = createMockResponse();

      await mergeDupHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockAddressCapability.mergeAddresses).not.toHaveBeenCalled();
    });
  });
});
