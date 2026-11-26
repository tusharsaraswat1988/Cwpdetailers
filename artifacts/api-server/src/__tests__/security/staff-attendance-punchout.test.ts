import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory data store for testing
const memoryStore = {
  staff: [] as any[],
  attendance: [] as any[],
  roles: [] as any[],
  locationLogs: [] as any[],
};

function resetStore() {
  memoryStore.staff = [
    {
      id: 10,
      userId: 101,
      name: "Ramesh Cleaner",
      branchId: 1,
      franchiseeId: null,
      isActive: true,
      verificationStatus: "verified",
      role: "cleaner",
    },
    {
      id: 20,
      userId: 102,
      name: "Suresh Inactive",
      branchId: 1,
      franchiseeId: null,
      isActive: false,
      verificationStatus: "verified",
      role: "cleaner",
    },
    {
      id: 30,
      userId: 103,
      name: "Mahesh Pending",
      branchId: 1,
      franchiseeId: null,
      isActive: true,
      verificationStatus: "pending",
      role: "cleaner",
    },
    {
      id: 40,
      userId: 104,
      name: "Dinesh Branch 2",
      branchId: 2,
      franchiseeId: 10,
      isActive: true,
      verificationStatus: "verified",
      role: "cleaner",
    },
  ];

  memoryStore.attendance = [];
  memoryStore.roles = [
    { id: 1, staffId: 10, roleSlug: "daily_car_cleaner" },
    { id: 2, staffId: 20, roleSlug: "daily_car_cleaner" },
    { id: 3, staffId: 30, roleSlug: "daily_car_cleaner" },
    { id: 4, staffId: 40, roleSlug: "daily_car_cleaner" },
  ];
  memoryStore.locationLogs = [];
}

// Mock @workspace/db
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn(() => {
        let selectedTable: any = null;
        let conditions: any[] = [];
        const builder: any = {
          from: vi.fn((tbl: any) => {
            selectedTable = tbl;
            return builder;
          }),
          innerJoin: vi.fn(() => builder),
          leftJoin: vi.fn(() => builder),
          where: vi.fn((cond: any) => {
            conditions.push(cond);
            return builder;
          }),
          limit: vi.fn(() => builder.execute()),
          execute: () => {
            if (selectedTable === actual.staffTable) {
              const staffIdCond = conditions.find((c: any) => {
                if (c?.left?.name === "id") return true;
                if (Array.isArray(c?.queryChunks)) {
                  return c.queryChunks.some((chunk: any) => chunk?.name === "id");
                }
                return false;
              });
              let targetId: number | null = null;
              if (staffIdCond?.right?.value !== undefined) {
                targetId = Number(staffIdCond.right.value);
              } else if (staffIdCond?.queryChunks) {
                const chunk = staffIdCond.queryChunks.find((ch: any) => ch && typeof ch.value === "number");
                if (chunk) targetId = chunk.value;
              }
              const found = targetId ? memoryStore.staff.filter((s) => s.id === targetId) : memoryStore.staff;
              return Promise.resolve(found);
            }
            if (selectedTable === actual.attendanceTable) {
              let rows = memoryStore.attendance;
              for (const c of conditions) {
                if (Array.isArray(c?.queryChunks)) {
                  const staffChunk = c.queryChunks.find((ch: any) => ch && typeof ch.value === "number");
                  const dateChunk = c.queryChunks.find((ch: any) => ch && typeof ch.value === "string");
                  if (staffChunk) {
                    rows = rows.filter((a) => a.staffId === staffChunk.value);
                  }
                  if (dateChunk) {
                    rows = rows.filter((a) => a.date === dateChunk.value);
                  }
                }
              }
              return Promise.resolve(rows);
            }
            if (selectedTable === actual.staffRoleAssignmentsTable) {
              return Promise.resolve(memoryStore.roles);
            }
            return Promise.resolve([]);
          },
          then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
            return builder.execute().then(onfulfilled, onrejected);
          },
        };
        return builder;
      }),
      insert: vi.fn((tbl: any) => ({
        values: vi.fn((val: any) => {
          const inserted = {
            id: memoryStore.attendance.length + 1,
            ...val,
            createdAt: new Date(),
          };
          if (tbl === actual.attendanceTable) {
            memoryStore.attendance.push(inserted);
          } else if (tbl === actual.staffLocationLogsTable) {
            memoryStore.locationLogs.push(inserted);
          }
          return {
            returning: vi.fn().mockResolvedValue([inserted]),
            then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
              return Promise.resolve([inserted]).then(onfulfilled, onrejected);
            },
          };
        }),
      })),
      update: vi.fn((tbl: any) => ({
        set: vi.fn((values: any) => ({
          where: vi.fn((cond: any) => {
            let updatedRow: any = null;
            if (tbl === actual.attendanceTable) {
              let idToUpdate: number | null = null;
              if (cond?.right?.value !== undefined) {
                idToUpdate = Number(cond.right.value);
              } else if (Array.isArray(cond?.queryChunks)) {
                const chunk = cond.queryChunks.find((ch: any) => ch && typeof ch.value === "number");
                if (chunk) idToUpdate = chunk.value;
              }
              const idx = memoryStore.attendance.findIndex((a) => a.id === idToUpdate);
              if (idx !== -1) {
                memoryStore.attendance[idx] = {
                  ...memoryStore.attendance[idx],
                  ...values,
                };
                updatedRow = memoryStore.attendance[idx];
              }
            }
            return {
              returning: vi.fn().mockResolvedValue(updatedRow ? [updatedRow] : []),
              then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
                return Promise.resolve(updatedRow ? [updatedRow] : []).then(onfulfilled, onrejected);
              },
            };
          }),
        })),
      })),
    },
  };
});

vi.mock("../../lib/staffEcosystem/operationalRoles", () => ({
  getStaffOperationalRoles: vi.fn((staffId: number) => {
    return Promise.resolve(
      memoryStore.roles.filter((r) => r.staffId === staffId)
    );
  }),
}));

import staffRouter from "../../routes/staff";

function createMockResponse() {
  const res: any = {
    statusCode: 200,
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

function getRouteHandler(path: string, method: "post" | "patch" | "get") {
  const layer = staffRouter.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe("SEC-P1-04: Staff Attendance Punch-In, Punch-Out & Status Transition Reliability", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  const postAttendanceHandler = getRouteHandler("/staff/:id/attendance", "post");
  const patchAttendanceHandler = getRouteHandler("/staff/:id/attendance", "patch");

  it("allows verified active staff to punch in with present status (201 Created)", async () => {
    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "08:30",
        notes: "Morning shift start",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data).toBeDefined();
    expect(res.data.staffId).toBe(10);
    expect(res.data.date).toBe("2026-11-26");
    expect(res.data.status).toBe("present");
    expect(res.data.checkInTime).toBe("08:30");
    expect(res.data.checkOutTime).toBeUndefined();
    expect(memoryStore.attendance.length).toBe(1);
  });

  it("is idempotent when check-in is repeated without changes (returns 200 OK with existing record)", async () => {
    // Pre-populate check-in
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: null,
      notes: "First check-in",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "08:30",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.id).toBe(1);
    expect(res.data.checkInTime).toBe("08:30");
    expect(memoryStore.attendance.length).toBe(1);
  });

  it("allows verified staff to punch out from 'present' via POST /attendance (200 OK)", async () => {
    // Pre-populate existing morning check-in
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: null,
      notes: "Morning check-in",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkOutTime: "17:30",
        notes: "Shift completed on time",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.id).toBe(1);
    expect(res.data.checkInTime).toBe("08:30");
    expect(res.data.checkOutTime).toBe("17:30");
    expect(res.data.status).toBe("present");
    expect(res.data.notes).toContain("Shift completed on time");
    expect(memoryStore.attendance[0].checkOutTime).toBe("17:30");
  });

  it("allows verified staff to punch out with status transition from 'present' to 'half_day' (200 OK)", async () => {
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: null,
      notes: "Morning check-in",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "half_day",
        checkOutTime: "13:00",
        notes: "Left early for medical appointment",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.id).toBe(1);
    expect(res.data.status).toBe("half_day");
    expect(res.data.checkOutTime).toBe("13:00");
    expect(memoryStore.attendance[0].status).toBe("half_day");
  });

  it("allows verified staff to punch out via PATCH /attendance (200 OK)", async () => {
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: null,
      notes: "Morning check-in",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        checkOutTime: "18:00",
        notes: "Overtime completed",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await patchAttendanceHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.id).toBe(1);
    expect(res.data.checkOutTime).toBe("18:00");
    expect(memoryStore.attendance[0].checkOutTime).toBe("18:00");
  });

  it("rejects punch-out when staff is currently marked absent (400 INVALID_PUNCHOUT_STATUS)", async () => {
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "absent",
      checkInTime: null,
      checkOutTime: null,
      notes: "Did not report",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkOutTime: "17:00",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("INVALID_PUNCHOUT_STATUS");
    expect(res.data.error).toContain("status is absent");
  });

  it("rejects transitioning status to 'absent' during punch-out (400 INVALID_PUNCHOUT_STATUS)", async () => {
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: null,
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "absent",
        checkOutTime: "17:00",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("INVALID_PUNCHOUT_STATUS");
    expect(res.data.error).toContain("Cannot transition status to absent during punch-out");
  });

  it("rejects field staff punch-out without prior check-in for the day (400 PUNCH_OUT_WITHOUT_CHECK_IN)", async () => {
    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkOutTime: "17:00",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("PUNCH_OUT_WITHOUT_CHECK_IN");
  });

  it("is idempotent when punch-out is submitted repeatedly with the same checkOutTime", async () => {
    memoryStore.attendance.push({
      id: 1,
      staffId: 10,
      date: "2026-11-26",
      status: "present",
      checkInTime: "08:30",
      checkOutTime: "17:30",
      notes: "Punched out",
    });

    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkOutTime: "17:30",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.checkOutTime).toBe("17:30");
  });

  it("rejects punch-in/out for inactive staff (403 STAFF_INACTIVE)", async () => {
    const req: any = {
      params: { id: "20" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "08:30",
      },
      user: {
        id: 102,
        role: "staff",
        staffId: 20,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 20,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.data.code).toBe("STAFF_INACTIVE");
  });

  it("rejects punch-in/out for unverified staff (403 STAFF_NOT_VERIFIED)", async () => {
    const req: any = {
      params: { id: "30" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "08:30",
      },
      user: {
        id: 103,
        role: "staff",
        staffId: 30,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 30,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.data.code).toBe("STAFF_NOT_VERIFIED");
  });

  it("rejects cross-staff punch-in/out (tenant isolation returns 404)", async () => {
    // Staff 10 attempts to punch in/out for Staff 40
    const req: any = {
      params: { id: "40" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "08:30",
      },
      user: {
        id: 101,
        role: "staff",
        staffId: 10,
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: 10,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.data.error).toBe("Staff not found");
  });

  it("allows branch manager to mark and update attendance for staff in their branch", async () => {
    const req: any = {
      params: { id: "10" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "09:00",
        notes: "Manager marked attendance",
      },
      user: {
        id: 99,
        role: "branch_manager",
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: null,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.staffId).toBe(10);
  });

  it("blocks branch manager from marking attendance for staff in another branch (404)", async () => {
    // Branch manager of branch 1 attempts to mark attendance for staff in branch 2
    const req: any = {
      params: { id: "40" },
      body: {
        date: "2026-11-26",
        status: "present",
        checkInTime: "09:00",
      },
      user: {
        id: 99,
        role: "branch_manager",
        branchId: 1,
      },
      scope: {
        isSuperAdmin: false,
        staffId: null,
        branchIds: [1],
      },
      log: { error: vi.fn() },
    };
    const res = createMockResponse();

    await postAttendanceHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.data.error).toBe("Staff not found");
  });
});
