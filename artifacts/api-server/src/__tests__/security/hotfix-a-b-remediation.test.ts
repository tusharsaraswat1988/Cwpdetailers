import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { Server } from "http";

const { mockDbState } = vi.hoisted(() => {
  return {
    mockDbState: {
      result: [] as any[],
    },
  };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    from: vi.fn(() => queryBuilder),
    where: vi.fn(() => queryBuilder),
    limit: vi.fn(() => Promise.resolve(mockDbState.result)),
    innerJoin: vi.fn(() => queryBuilder),
    leftJoin: vi.fn(() => queryBuilder),
    orderBy: vi.fn(() => queryBuilder),
    groupBy: vi.fn(() => queryBuilder),
    then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
      return Promise.resolve(mockDbState.result).then(onfulfilled, onrejected);
    },
    execute: () => Promise.resolve(mockDbState.result),
  };
  return {
    ...actual,
    db: queryBuilder,
  };
});

import app from "../../app";
import locationPricingRouter from "../../routes/location-pricing";
import societiesRouter from "../../routes/societies";
import zonesRouter from "../../routes/zones";
import paymentGatewayRouter from "../../routes/payment-gateway";

describe("HOTFIX A & B: Security Remediation Test Suite", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // Helper to create mock response object
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

  // ───────────────────────────────────────────────────────────────────────────
  // HOTFIX A.3 & A.4: Payment Gateway Security
  // ───────────────────────────────────────────────────────────────────────────
  describe("HOTFIX A.3 & A.4: Payment Gateway Route Hardening", () => {
    it("A.3: GET /api/payments/schema-repair is completely removed and returns 404", async () => {
      const res = await fetch(`${baseUrl}/api/payments/schema-repair`);
      expect(res.status).toBe(404);
    });

    it("A.4: GET /api/payments/gateway-diagnostics rejects unauthenticated callers with 401", async () => {
      const res = await fetch(`${baseUrl}/api/payments/gateway-diagnostics`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain("Authentication required");
    });

    it("A.4: GET /api/payments/gateway-diagnostics rejects customer role with 403", async () => {
      const layer = paymentGatewayRouter.stack.find(
        (l: any) => l.route?.path === "/payments/gateway-diagnostics" && l.route?.methods?.get,
      );
      expect(layer).toBeDefined();

      const req: any = {
        user: { id: 101, role: "customer", phone: "9000000001" },
        scope: { isSuperAdmin: false, customerId: 101, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      // Execute requirePermission middleware
      const requirePerm = layer.route.stack[1].handle;
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("A.4: GET /api/payments/gateway-diagnostics allows superadmin and minimizes server fingerprinting", async () => {
      const layer = paymentGatewayRouter.stack.find(
        (l: any) => l.route?.path === "/payments/gateway-diagnostics" && l.route?.methods?.get,
      );
      expect(layer).toBeDefined();

      const req: any = {
        user: { id: 1, role: "superadmin", phone: "9999999999" },
        scope: { isSuperAdmin: true, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      // Final handler execution
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe("ok");
      expect(res.data.activeGateway).toBeDefined();
      expect(res.data.razorpay).toBeDefined();
      expect(res.data.cashfree).toBeDefined();
      // Internal server nodeVersion must NOT be leaked
      expect(res.data.server?.nodeVersion).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // HOTFIX B.1: Location Pricing Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe("HOTFIX B.1: Location Pricing Route Authorization", () => {
    it("rejects unauthenticated requests to location pricing mutation routes with 401", async () => {
      const postRes = await fetch(`${baseUrl}/api/location-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: 1, cityId: 1, basePrice: 100 }),
      });
      expect(postRes.status).toBe(401);

      const patchRes = await fetch(`${baseUrl}/api/location-pricing/1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePrice: 150 }),
      });
      expect(patchRes.status).toBe(401);

      const deleteRes = await fetch(`${baseUrl}/api/location-pricing/1`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(401);
    });

    it("rejects customer role on location pricing mutations with 403 Forbidden", async () => {
      const postLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === "/location-pricing" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      const req: any = {
        user: { id: 201, role: "customer", phone: "9000000002" },
        scope: { isSuperAdmin: false, customerId: 201, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const requirePerm = postLayer.route.stack[1].handle;
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("rejects non-central admin with null branch assignment from creating location pricing (fail closed)", async () => {
      const postLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === "/location-pricing" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      const req: any = {
        user: { id: 301, role: "manager", branchId: null },
        scope: { isSuperAdmin: false, branchIds: [] },
        body: { serviceId: 1, cityId: 1, basePrice: 500, branchId: 2 },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = postLayer.route.stack[postLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("branch assignment required");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // HOTFIX B.1 & OBSERV-02: Location Pricing Audit Log Authorization & Scoping
  // ───────────────────────────────────────────────────────────────────────────
  describe("HOTFIX B.1 & OBSERV-02: Location Pricing Audit Log Scoping", () => {
    const auditRoutePath = "/location-pricing/:id/audit";

    it("1. rejects unauthenticated requests to pricing audit endpoint with 401", async () => {
      const res = await fetch(`${baseUrl}/api/location-pricing/1/audit`);
      expect(res.status).toBe(401);
    });

    it("2. rejects customer role on pricing audit endpoint with 403 Forbidden", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      const req: any = {
        user: { id: 201, role: "customer", phone: "9000000002" },
        params: { id: "1" },
        scope: { isSuperAdmin: false, customerId: 201, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const requirePerm = auditLayer.route.stack[1].handle;
      mockDbState.result = [];
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("3. rejects unauthorized field staff role on pricing audit endpoint with 403", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      const req: any = {
        user: { id: 202, role: "cleaner", phone: "9000000003" },
        params: { id: "1" },
        scope: { isSuperAdmin: false, staffId: 10, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const requirePerm = auditLayer.route.stack[1].handle;
      mockDbState.result = [];
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("4. returns 404 for nonexistent pricing rule", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      mockDbState.result = []; // No rule found
      const req: any = {
        user: { id: 1, role: "super_admin", branchId: null },
        params: { id: "999" },
        scope: { isSuperAdmin: true, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toContain("Pricing rule not found");
    });

    it("5. rejects non-central admin with unassigned branch with 403 (fail closed)", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      // Rule exists for branch 2
      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 301, role: "manager", branchId: null },
        params: { id: "1" },
        scope: { isSuperAdmin: false, branchIds: [] },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("branch assignment required to view pricing audit logs");
    });

    it("6. rejects scoped admin accessing wrong branch rule with 404 (preventing leakage)", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      // Target rule belongs to branch 2
      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 302, role: "manager", branchId: 1, cityId: 1 },
        params: { id: "1" },
        scope: { isSuperAdmin: false, branchIds: [1] },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      // Must be 404 to avoid leaking whether another branch's pricing ID exists
      expect(res.statusCode).toBe(404);
      expect(res.data.error).toContain("Pricing rule not found");
    });

    it("7. rejects scoped admin accessing wrong city rule with 404", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      // Rule belongs to branch 2, city 1
      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 303, role: "manager", branchId: 2, cityId: 2 }, // Caller is in city 2
        params: { id: "1" },
        scope: { isSuperAdmin: false, branchIds: [2] },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toContain("Pricing rule not found");
    });

    it("8. allows scoped admin accessing their own branch rule with 200", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      // Rule belongs to branch 2, city 1
      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 304, role: "manager", branchId: 2, cityId: 1 },
        params: { id: "1" },
        scope: { isSuperAdmin: false, branchIds: [2] },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("9. allows central administrator to view audit logs for any branch rule with 200", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 10, role: "central_admin", branchId: null },
        params: { id: "1" },
        scope: { isSuperAdmin: false, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("10. allows Super Admin to view audit logs for any branch rule with 200", async () => {
      const auditLayer = locationPricingRouter.stack.find(
        (l: any) => l.route?.path === auditRoutePath && l.route?.methods?.get,
      );
      expect(auditLayer).toBeDefined();

      mockDbState.result = [{ id: 1, branchId: 2, cityId: 1 }];
      const req: any = {
        user: { id: 1, role: "super_admin", branchId: null },
        params: { id: "1" },
        scope: { isSuperAdmin: true, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = auditLayer.route.stack[auditLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // HOTFIX B.2: Societies Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe("HOTFIX B.2: Societies Route Authorization", () => {
    it("rejects unauthenticated requests to society mutation routes with 401", async () => {
      const postRes = await fetch(`${baseUrl}/api/societies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthorized Society", cityId: 1, address: "Test Road" }),
      });
      expect(postRes.status).toBe(401);

      const patchRes = await fetch(`${baseUrl}/api/societies/1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      expect(patchRes.status).toBe(401);

      const towerRes = await fetch(`${baseUrl}/api/societies/1/towers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tower X" }),
      });
      expect(towerRes.status).toBe(401);
    });

    it("rejects customer role on society mutations with 403 Forbidden", async () => {
      const postLayer = societiesRouter.stack.find(
        (l: any) => l.route?.path === "/societies" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      const req: any = {
        user: { id: 202, role: "customer", phone: "9000000003" },
        scope: { isSuperAdmin: false, customerId: 202, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const requirePerm = postLayer.route.stack[1].handle;
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("rejects non-central admin with null branch/city assignment from registering societies", async () => {
      const postLayer = societiesRouter.stack.find(
        (l: any) => l.route?.path === "/societies" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      const req: any = {
        user: { id: 302, role: "manager", branchId: null, cityId: null },
        scope: { isSuperAdmin: false, branchIds: [] },
        body: { name: "Rogue Society", cityId: 1, address: "Sector 62, Noida" },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = postLayer.route.stack[postLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("branch or city assignment required");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // HOTFIX B.3: Operational Zones Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe("HOTFIX B.3: Operational Zones Route Authorization", () => {
    it("rejects unauthenticated requests to zone mutation routes with 401", async () => {
      const postRes = await fetch(`${baseUrl}/api/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: 1, name: "Test Zone", code: "Z-TEST" }),
      });
      expect(postRes.status).toBe(401);

      const patchRes = await fetch(`${baseUrl}/api/zones/1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Zone Name" }),
      });
      expect(patchRes.status).toBe(401);

      const coverageRes = await fetch(`${baseUrl}/api/zones/1/coverage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverageType: "all" }),
      });
      expect(coverageRes.status).toBe(401);

      const deleteCoverageRes = await fetch(`${baseUrl}/api/zones/coverage/1`, {
        method: "DELETE",
      });
      expect(deleteCoverageRes.status).toBe(401);

      const mappingRes = await fetch(`${baseUrl}/api/zones/branch-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: 1, zoneId: 1 }),
      });
      expect(mappingRes.status).toBe(401);
    });

    it("rejects customer role on zone mutations with 403 Forbidden", async () => {
      const postLayer = zonesRouter.stack.find(
        (l: any) => l.route?.path === "/zones" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      const req: any = {
        user: { id: 203, role: "customer", phone: "9000000004" },
        scope: { isSuperAdmin: false, customerId: 203, branchIds: null },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const requirePerm = postLayer.route.stack[1].handle;
      await requirePerm(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });

    it("enforces that missing branch assignment NEVER grants unrestricted zone access", async () => {
      const postLayer = zonesRouter.stack.find(
        (l: any) => l.route?.path === "/zones" && l.route?.methods?.post,
      );
      expect(postLayer).toBeDefined();

      // Manager with null branch assignment
      const req: any = {
        user: { id: 303, role: "manager", branchId: null },
        scope: { isSuperAdmin: false, branchIds: [] },
        body: { cityId: 1, name: "Disallowed Zone", code: "DIS-01", branchId: 1 },
        log: { error: () => {}, warn: () => {}, info: () => {} },
      };
      const res = createMockResponse();

      const handler = postLayer.route.stack[postLayer.route.stack.length - 1].handle;
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("branch assignment required to configure operational zones");
    });
  });
});
