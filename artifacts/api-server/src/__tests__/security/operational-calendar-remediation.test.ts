import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCalendarService, mockDbRows } = vi.hoisted(() => {
  return {
    mockCalendarService: {
      listOperatingHours: vi.fn().mockResolvedValue([{ id: 1, scopeType: "global", dayOfWeek: 1, isWorkingDay: true }]),
      upsertOperatingHours: vi.fn().mockResolvedValue({ id: 1, scopeType: "branch", branchId: 1, dayOfWeek: 1, isWorkingDay: true }),
      listClosures: vi.fn().mockResolvedValue([{ id: 10, title: "Test Closure", scopeType: "branch", branchId: 1 }]),
      createClosure: vi.fn().mockResolvedValue({ id: 11, title: "New Closure", scopeType: "branch", branchId: 1 }),
      updateClosure: vi.fn().mockResolvedValue({ id: 10, title: "Updated Closure", scopeType: "branch", branchId: 1 }),
      deleteClosure: vi.fn().mockResolvedValue(true),
      evaluateDate: vi.fn().mockResolvedValue({ isClosed: false }),
    },
    mockDbRows: {
      closures: [] as any[],
    },
  };
});

vi.mock("../../lib/booking/scheduling/operationalCalendarService", () => ({
  operationalCalendarService: mockCalendarService,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    from: vi.fn(() => queryBuilder),
    where: vi.fn(() => queryBuilder),
    limit: vi.fn(() => Promise.resolve(mockDbRows.closures)),
    then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
      return Promise.resolve(mockDbRows.closures).then(onfulfilled, onrejected);
    },
  };
  return {
    ...actual,
    db: queryBuilder,
  };
});

import calendarRouter from "../../routes/operational-calendar";

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

function getRouteHandler(path: string, method: "get" | "post" | "put" | "patch" | "delete") {
  const layer = calendarRouter.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe("SEC-P0-02: Operational Calendar Authentication & Scope Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows.closures = [];
  });

  describe("1. Top-Level Authentication & Role Middleware", () => {
    it("rejects unauthenticated requests to /admin/calendar with 401", () => {
      // Find the router-level middleware for /admin/calendar
      const authLayer = calendarRouter.stack.find(
        (l: any) => l.handle.name === "requireAuth"
      );
      expect(authLayer).toBeDefined();

      const req: any = { user: undefined };
      const res = createMockResponse();
      let nextCalled = false;

      authLayer.handle(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.data).toEqual({ error: "Authentication required" });
    });

    it("rejects non-administrative customer role with 403 Forbidden", () => {
      const roleLayer = calendarRouter.stack.find(
        (l: any) => l.handle.name === "requireCalendarRole"
      );
      expect(roleLayer).toBeDefined();

      const req: any = { user: { id: 1, role: "customer" } };
      const res = createMockResponse();
      let nextCalled = false;

      roleLayer.handle(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Forbidden");
    });

    it("rejects non-administrative field staff role with 403 Forbidden", () => {
      const roleLayer = calendarRouter.stack.find(
        (l: any) => l.handle.name === "requireCalendarRole"
      );
      expect(roleLayer).toBeDefined();

      const req: any = { user: { id: 2, role: "cleaner" } };
      const res = createMockResponse();
      let nextCalled = false;

      roleLayer.handle(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it("allows administrative roles to proceed", () => {
      const roleLayer = calendarRouter.stack.find(
        (l: any) => l.handle.name === "requireCalendarRole"
      );

      for (const role of ["superadmin", "super_admin", "admin", "city_admin", "branch_manager"]) {
        const req: any = { user: { id: 10, role } };
        const res = createMockResponse();
        let nextCalled = false;

        roleLayer.handle(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(res.statusCode).toBe(200);
      }
    });
  });

  describe("2. Operating Hours Scope Enforcement (PUT /admin/calendar/hours)", () => {
    const putHoursHandler = getRouteHandler("/admin/calendar/hours", "put");

    it("blocks branch_manager from declaring global operating hours with 403 Forbidden", async () => {
      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        body: {
          scopeType: "global",
          dayOfWeek: 1,
          isWorkingDay: true,
          openTime: "08:00",
          closeTime: "20:00",
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await putHoursHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Forbidden");
      expect(mockCalendarService.upsertOperatingHours).not.toHaveBeenCalled();
    });

    it("blocks branch_manager from modifying operating hours for another branch with 403", async () => {
      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        body: {
          scopeType: "branch",
          branchId: 2,
          dayOfWeek: 1,
          isWorkingDay: true,
          openTime: "08:00",
          closeTime: "20:00",
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await putHoursHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockCalendarService.upsertOperatingHours).not.toHaveBeenCalled();
    });

    it("allows branch_manager to update operating hours for their own assigned branch", async () => {
      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        body: {
          scopeType: "branch",
          branchId: 1,
          dayOfWeek: 1,
          isWorkingDay: true,
          openTime: "08:00",
          closeTime: "20:00",
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await putHoursHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(mockCalendarService.upsertOperatingHours).toHaveBeenCalled();
    });

    it("allows Central SuperAdmin to update global operating hours", async () => {
      const req: any = {
        user: { id: 1, role: "super_admin", branchId: null },
        scope: { isSuperAdmin: true },
        body: {
          scopeType: "global",
          dayOfWeek: 0,
          isWorkingDay: false,
          openTime: "08:00",
          closeTime: "20:00",
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await putHoursHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockCalendarService.upsertOperatingHours).toHaveBeenCalled();
    });
  });

  describe("3. Operational Closures Scope Enforcement (POST /admin/calendar/closures)", () => {
    const postClosureHandler = getRouteHandler("/admin/calendar/closures", "post");

    it("blocks branch_manager from declaring global closure with 403 Forbidden", async () => {
      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        body: {
          title: "Diwali Closure",
          category: "holiday",
          customerReason: "Holiday",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
          isFullDay: true,
          scopeType: "global",
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await postClosureHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockCalendarService.createClosure).not.toHaveBeenCalled();
    });

    it("blocks city_admin from declaring closure for a different city", async () => {
      const req: any = {
        user: { id: 14, role: "city_admin", cityId: 1 },
        scope: { cityId: 1 },
        body: {
          title: "Varanasi Local Holiday",
          category: "holiday",
          customerReason: "Local event",
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          isFullDay: true,
          scopeType: "city",
          cityId: 2, // Different city
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await postClosureHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockCalendarService.createClosure).not.toHaveBeenCalled();
    });

    it("allows city_admin to declare closure for their own city", async () => {
      const req: any = {
        user: { id: 14, role: "city_admin", cityId: 1 },
        scope: { cityId: 1 },
        body: {
          title: "Varanasi Festival",
          category: "holiday",
          customerReason: "Festival",
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          isFullDay: true,
          scopeType: "city",
          cityId: 1,
        },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await postClosureHandler(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.data.success).toBe(true);
      expect(mockCalendarService.createClosure).toHaveBeenCalled();
    });
  });

  describe("4. Closure Mutation Protection (PATCH & DELETE /admin/calendar/closures/:id)", () => {
    const patchClosureHandler = getRouteHandler("/admin/calendar/closures/:id", "patch");
    const deleteClosureHandler = getRouteHandler("/admin/calendar/closures/:id", "delete");

    it("rejects DELETE of closure outside caller's branch scope with 403", async () => {
      // Closure belongs to Branch 2, caller is assigned to Branch 1
      mockDbRows.closures = [{
        id: 99,
        title: "Branch 2 Maintenance",
        scopeType: "branch",
        branchId: 2,
        cityId: 1,
      }];

      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        params: { id: "99" },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await deleteClosureHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockCalendarService.deleteClosure).not.toHaveBeenCalled();
    });

    it("allows DELETE of closure within caller's branch scope with 200", async () => {
      // Closure belongs to Branch 1, caller is assigned to Branch 1
      mockDbRows.closures = [{
        id: 99,
        title: "Branch 1 Maintenance",
        scopeType: "branch",
        branchId: 1,
        cityId: 1,
      }];

      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        params: { id: "99" },
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await deleteClosureHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(mockCalendarService.deleteClosure).toHaveBeenCalledWith(99);
    });

    it("rejects PATCH reassigning closure to a different branch with 403", async () => {
      mockDbRows.closures = [{
        id: 99,
        title: "Branch 1 Maintenance",
        scopeType: "branch",
        branchId: 1,
        cityId: 1,
      }];

      const req: any = {
        user: { id: 12, role: "branch_manager", branchId: 1 },
        scope: { branchIds: [1] },
        params: { id: "99" },
        body: { branchId: 2 }, // Attempting to reassign to Branch 2
        log: { error: vi.fn() },
      };
      const res = createMockResponse();

      await patchClosureHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockCalendarService.updateClosure).not.toHaveBeenCalled();
    });
  });
});
