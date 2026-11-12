import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory state for mock DB
const mockState = {
  subscriptions: [] as any[],
  staff: [] as any[],
  cleanerAssignments: [] as any[],
  serviceAssignments: [] as any[],
  serviceExecutions: [] as any[],
  contracts: [] as any[],
  activityLogs: [] as any[],
  visits: [] as any[],
  plans: [] as any[],
  customers: [] as any[],
  vehicles: [] as any[],
};

vi.mock("../../lib/notifications/dispatcher", () => ({
  notifyStaffAssigned: vi.fn().mockResolvedValue({ success: true }),
  dispatchNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../lib/brandIdentityService", () => ({
  getBrandName: vi.fn().mockResolvedValue("CWP Detailers"),
}));

vi.mock("../../lib/contracts/contractRegistry", () => ({
  syncContractFromDcmsSubscription: vi.fn().mockResolvedValue(101),
}));

vi.mock("../../lib/staffEcosystem/operationalRoles", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    staffOperationalRoleError: vi.fn(async (staff: any, roleSlug: string) => {
      const s = mockState.staff.find((st) => st.id === staff.id);
      const allowed = Array.isArray(s?.operationalRoles) ? s.operationalRoles : [];
      if (!allowed.includes(roleSlug)) {
        return `Staff member does not have the "${roleSlug}" operational role required for this assignment`;
      }
      return null;
    }),
    staffHasOperationalRole: vi.fn(async (staffId: number, roleSlug: string) => {
      const staff = mockState.staff.find((s) => s.id === staffId);
      return staff?.operationalRoles?.includes(roleSlug) ?? false;
    }),
  };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => {
          const resolveData = () => {
            if (fields?.sub) {
              return mockState.subscriptions.map(s => {
                const activeAssign = mockState.cleanerAssignments.find((a: any) => a.isActive && a.subscriptionId === s.id);
                const cleaner = activeAssign ? mockState.staff.find((st: any) => st.id === activeAssign.staffId) : null;
                return {
                  sub: s,
                  planName: "Gold Monthly Clean & Wash",
                  customerName: "Vikram Sharma",
                  customerPhone: "9811122233",
                  vehicleNumber: "UP16AB1234",
                  vehicleMake: "Hyundai",
                  vehicleModel: "Creta",
                  vehicleColor: "White",
                  societyName: "Ace Parkway",
                  towerName: "Tower 2",
                  parkingLevel: "B1",
                  parkingBay: "104",
                  assignment: activeAssign ?? null,
                  cleanerName: cleaner?.name ?? null,
                  cleanerPhone: cleaner?.phone ?? null,
                };
              });
            }
            if (table === actual.dcmsSubscriptionsTable) return mockState.subscriptions;
            if (table === actual.staffTable) return mockState.staff;
            if (table === actual.dcmsStaffAssignmentsTable) return mockState.cleanerAssignments.filter((a: any) => a.isActive);
            if (table === actual.serviceAssignmentsTable) return mockState.serviceAssignments;
            if (table === actual.serviceExecutionsTable) {
              return mockState.serviceExecutions.map(e => {
                const s = mockState.staff.find((st: any) => st.id === e.assignedStaffId);
                return {
                  execution: e,
                  staffName: s?.name ?? null,
                  staffPhone: s?.phone ?? null,
                };
              });
            }
            if (table === actual.customerContractsTable) return mockState.contracts;
            if (table === actual.vehiclesTable) return mockState.vehicles;
            if (table === actual.customersTable) return mockState.customers;
            if (table === actual.dcmsPlansTable) return mockState.plans;
            if (table === actual.dcmsVisitsTable) return mockState.visits;
            return [];
          };

          const builder: any = {
            innerJoin: vi.fn(() => builder),
            leftJoin: vi.fn(() => builder),
            where: vi.fn((clause: any) => builder),
            orderBy: vi.fn(() => builder),
            limit: vi.fn((lim: number) => Promise.resolve(resolveData().slice(0, lim))),
            then: (resolve: any) => resolve(resolveData()),
          };
          return builder;
        }),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          const inserted = { id: Math.floor(Math.random() * 10000) + 1, ...vals, createdAt: new Date(), updatedAt: new Date() };
          if (table._?.name === "dcms_staff_assignments" || table === actual.dcmsStaffAssignmentsTable) {
            mockState.cleanerAssignments.push(inserted);
          } else if (table === actual.serviceAssignmentsTable) {
            mockState.serviceAssignments.push(inserted);
          } else if (table === actual.serviceExecutionsTable) {
            mockState.serviceExecutions.push(inserted);
          } else if (table === actual.dcmsActivityLogsTable) {
            mockState.activityLogs.push(inserted);
          } else if (table === actual.dcmsVisitsTable) {
            mockState.visits.push(inserted);
          }
          return {
            returning: vi.fn(() => Promise.resolve([inserted])),
            then: (resolve: any) => resolve([inserted]),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn(() => {
            if (table === actual.dcmsStaffAssignmentsTable) {
              if (updates.isActive === false) {
                mockState.cleanerAssignments.forEach((a: any) => { a.isActive = false; });
              }
            } else if (table === actual.serviceAssignmentsTable) {
              mockState.serviceAssignments.forEach((a: any) => Object.assign(a, updates));
            } else if (table === actual.serviceExecutionsTable) {
              mockState.serviceExecutions.forEach((e: any) => Object.assign(e, updates));
            }
            return {
              returning: vi.fn(() => Promise.resolve([{ id: 1, ...updates }])),
              then: (resolve: any) => resolve([{ id: 1, ...updates }]),
            };
          }),
        })),
      })),
    },
  };
});

describe("JOB-013, JOB-014, JOB-015: Daily Cleaning Assignment Lifecycle", () => {
  beforeEach(() => {
    mockState.subscriptions = [
      {
        id: 1,
        customerId: 10,
        vehicleId: 20,
        planId: 1,
        status: "active",
        subscriptionType: "daily_cleaning",
        startDate: "2026-11-01",
        allocatedCleanings: 26,
        remainingCleanings: 20,
        usedCleanings: 6,
        allocatedWashes: 2,
        remainingWashes: 2,
        usedWashes: 0,
        branchId: 1,
        companyId: 1,
        societyId: 5,
        parkingBay: "B2-104",
        version: 1,
      },
    ];

    mockState.staff = [
      {
        id: 101,
        name: "Ramesh Cleaner",
        phone: "9876543210",
        isActive: true,
        verificationStatus: "verified",
        branchId: 1,
        operationalRoles: ["daily_car_cleaner"],
      },
      {
        id: 102,
        name: "Suresh Washer",
        phone: "9876543211",
        isActive: true,
        verificationStatus: "verified",
        branchId: 1,
        operationalRoles: ["car_washer"],
      },
      {
        id: 103,
        name: "Mahesh Substitute",
        phone: "9876543212",
        isActive: true,
        verificationStatus: "verified",
        branchId: 1,
        operationalRoles: ["daily_car_cleaner"],
      },
    ];

    mockState.cleanerAssignments = [];
    mockState.serviceAssignments = [];
    mockState.serviceExecutions = [];
    mockState.contracts = [
      {
        id: 101,
        customerId: 10,
        sourceSystem: "dcms",
        sourceId: 1,
        productLine: "daily_cleaning",
        status: "active",
        summaryJson: { allocatedWashes: 2, remainingWashes: 2 },
      },
    ];
    mockState.activityLogs = [];
    mockState.visits = [];
    mockState.plans = [
      { id: 1, name: "Gold Monthly Clean & Wash", includedCleanings: 26, includedWashes: 2 },
    ];
    mockState.customers = [
      { id: 10, name: "Vikram Sharma", phone: "9811122233" },
    ];
    mockState.vehicles = [
      { id: 20, registrationNumber: "UP16AB1234", make: "Hyundai", model: "Creta", color: "White" },
    ];
  });

  it("JOB-013: Assigns a monthly cleaner for the full service month (not daily dispatch)", async () => {
    const { assignStaff } = await import("../../lib/dcms/subscriptionService");
    const assignment = await assignStaff(1, 101, 1);

    expect(assignment).toBeDefined();
    expect(assignment.subscriptionId).toBe(1);
    expect(assignment.staffId).toBe(101);
    expect(assignment.isActive).toBe(true);

    // Verify it recorded in cleaner assignments
    expect(mockState.cleanerAssignments.some((a) => a.staffId === 101 && a.isActive)).toBe(true);
  });

  it("JOB-015: Reassigns cleaner on staff replacement or leave with audit reason and notes", async () => {
    const { assignStaff, reassignMonthlyCleaner } = await import("../../lib/dcms/subscriptionService");
    
    // Initial assignment
    await assignStaff(1, 101, 1);

    // Reassignment to Mahesh (staff_leave)
    const reassigned = await reassignMonthlyCleaner({
      subscriptionId: 1,
      newStaffId: 103,
      assignedBy: 1,
      reason: "staff_leave",
      notes: "Ramesh is on leave for 1 week; Mahesh taking over route.",
    });

    expect(reassigned).toBeDefined();
    expect(reassigned.staffId).toBe(103);
    expect(reassigned.isActive).toBe(true);

    // Verify prior cleaner Ramesh was deactivated
    const prior = mockState.cleanerAssignments.filter((a) => a.staffId === 101);
    expect(prior.every((a) => a.isActive === false)).toBe(true);

    // Verify activity audit log recorded reassignment reason
    const log = mockState.activityLogs.find((l) => l.action === "cleaner_reassigned");
    expect(log).toBeDefined();
    const meta = log.metadataJson || log.metadata;
    expect(meta.previousStaffId).toBe(101);
    expect(meta.newStaffId).toBe(103);
    expect(meta.reason).toBe("staff_leave");
    expect(meta.notes).toContain("Ramesh is on leave");
  });

  it("JOB-014: Assigns bundled package wash on a daily/date-specific basis without altering the monthly cleaner", async () => {
    const { assignStaff } = await import("../../lib/dcms/subscriptionService");
    const { assignDcmsPackageWash } = await import("../../lib/dcms/washAssignmentService");

    // Monthly cleaner is Ramesh (101)
    await assignStaff(1, 101, 1);

    // Assign package wash to Suresh Washer (102) for 2026-11-15
    const washResult = await assignDcmsPackageWash({
      subscriptionId: 1,
      staffId: 102,
      scheduledDate: "2026-11-15",
      assignedBy: 1,
      notes: "Monthly deep exterior shampoo wash",
    });

    expect(washResult).toBeDefined();
    expect(washResult.executionId).toBeGreaterThan(0);

    // CRITICAL: Ramesh Cleaner (101) must STILL remain active in cleanerAssignments!
    const activeCleaner = mockState.cleanerAssignments.find((a) => a.isActive);
    expect(activeCleaner).toBeDefined();
    expect(activeCleaner.staffId).toBe(101);

    // Suresh Washer (102) was assigned for the wash in executions/assignments
    const washExec = mockState.serviceExecutions.find((e) => e.taskType === "car_wash");
    expect(washExec).toBeDefined();
    expect(washExec.assignedStaffId).toBe(102);
    expect(washExec.scheduledDate).toBe("2026-11-15");
  });

  it("JOB-014: Rejects wash assignment when subscription has 0 remaining washes", async () => {
    const { assignDcmsPackageWash } = await import("../../lib/dcms/washAssignmentService");

    // Exhaust remaining washes
    mockState.subscriptions[0].remainingWashes = 0;

    await expect(
      assignDcmsPackageWash({
        subscriptionId: 1,
        staffId: 102,
        scheduledDate: "2026-11-15",
        assignedBy: 1,
      })
    ).rejects.toThrow("No remaining washes available for this subscription package");
  });

  it("ADMIN-018: listMonthlyCleanerSubscriptions queries subscriptions with monthly cleaner details", async () => {
    const { assignStaff, listMonthlyCleanerSubscriptions } = await import("../../lib/dcms/subscriptionService");
    await assignStaff(1, 101, 1);

    const list = await listMonthlyCleanerSubscriptions();
    expect(list).toBeDefined();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    const sub = list.find((s) => s.subscriptionId === 1);
    expect(sub).toBeDefined();
    expect(sub?.vehicleNumber).toBe("UP16AB1234");
    expect(sub?.allocatedCleanings).toBe(26);
    expect(sub?.remainingCleanings).toBe(20);
    expect(sub?.assignedCleaner?.staffName).toBe("Ramesh Cleaner");
  });

  it("ADMIN-018: listDcmsPackageWashes queries subscriptions with package wash status and scheduled wash executions", async () => {
    const { listDcmsPackageWashes, assignDcmsPackageWash } = await import("../../lib/dcms/washAssignmentService");

    await assignDcmsPackageWash({
      subscriptionId: 1,
      staffId: 102,
      scheduledDate: "2026-11-15",
      assignedBy: 1,
    });

    const washes = await listDcmsPackageWashes();
    expect(washes).toBeDefined();
    expect(Array.isArray(washes)).toBe(true);

    const washRow = washes.find((w) => w.subscriptionId === 1);
    expect(washRow).toBeDefined();
    expect(washRow?.allocatedWashes).toBe(2);
    expect(washRow?.remainingWashes).toBe(2);
    expect(washRow?.scheduledWash).toBeDefined();
    expect(washRow?.scheduledWash?.scheduledDate).toBe("2026-11-15");
    expect(washRow?.scheduledWash?.staffName).toBe("Suresh Washer");
  });
});
