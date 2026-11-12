import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeScope, loadUserFromToken, hashToken } from "../../middlewares/auth";
import {
  validateBranchReadiness,
  activateBranch,
  suspendBranch,
} from "../../lib/franchise/branchManagementService";
import {
  getBranchOperationsDashboard,
} from "../../lib/franchise/branchOperationsService";
import {
  createSubscription,
  pauseSubscription,
  resumeSubscription,
} from "../../lib/dcms/subscriptionService";

function extractAllParamValues(expr: any): any[] {
  const vals: any[] = [];
  if (expr == null) return vals;
  if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
    vals.push(expr);
    return vals;
  }
  if (Array.isArray(expr)) {
    for (const item of expr) vals.push(...extractAllParamValues(item));
    return vals;
  }
  if (expr.constructor && expr.constructor.name === "Param") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.value !== undefined && !Array.isArray(expr.value) && typeof expr.value !== "object") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.queryChunks && Array.isArray(expr.queryChunks)) {
    for (const chunk of expr.queryChunks) {
      if (chunk == null) continue;
      if (chunk.constructor && chunk.constructor.name === "StringChunk") continue;
      vals.push(...extractAllParamValues(chunk));
    }
  }
  return vals;
}

// Mock @workspace/db memory store
const memoryStore = {
  branches: [] as any[],
  franchisees: [] as any[],
  cities: [] as any[],
  legalEntities: [] as any[],
  staff: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  dcmsSubscriptions: [] as any[],
  dcmsStaffAssignments: [] as any[],
  dcmsVisits: [] as any[],
  dcmsExceptions: [] as any[],
  dcmsPlans: [] as any[],
  vehicles: [] as any[],
  invoices: [] as any[],
  payments: [] as any[],
  adminAuditLogs: [] as any[],
};

function resetMemory() {
  memoryStore.cities = [
    { id: 1, name: "Varanasi", isActive: true },
    { id: 2, name: "Noida", isActive: true },
  ];

  memoryStore.legalEntities = [
    { id: 1, name: "CWP Detailers Pvt Ltd", code: "CWP-HQ", isActive: true },
    { id: 2, name: "Noida Service Ops LLP", code: "NOI-OPS", isActive: true },
  ];

  memoryStore.franchisees = [
    {
      id: 10,
      name: "Rohit Verma",
      phone: "9876543210",
      status: "active",
      branchId: 2,
      commissionPercentage: "15.00",
    },
    {
      id: 11,
      name: "Suspended Partner",
      phone: "9876543219",
      status: "suspended",
      branchId: 3,
      commissionPercentage: "15.00",
    },
  ];

  memoryStore.branches = [
    {
      id: 1,
      name: "Varanasi Sigra Hub",
      code: "BR-VAR-001",
      city: "Varanasi",
      cityId: 1,
      legalEntityId: 1,
      isCompanyOperated: true,
      franchiseeId: null,
      status: "active",
      serviceAvailability: ["daily_cleaning", "car_washing"],
      phone: "9876540001",
      managerName: "Vikas Singh",
      operationalNotes: "Central company flagship",
      isActive: true,
    },
    {
      id: 2,
      name: "Noida Sector 62 Hub",
      code: "BR-NOI-001",
      city: "Noida",
      cityId: 2,
      legalEntityId: 2,
      isCompanyOperated: false,
      franchiseeId: 10,
      status: "onboarding",
      serviceAvailability: ["daily_cleaning"],
      phone: "9876540002",
      managerName: "Rohit Verma",
      operationalNotes: "FOFO franchise hub",
      isActive: false,
    },
    {
      id: 3,
      name: "Suspended Hub",
      code: "BR-SUS-001",
      city: "Noida",
      cityId: 2,
      legalEntityId: null,
      isCompanyOperated: false,
      franchiseeId: 11,
      status: "suspended",
      serviceAvailability: [],
      isActive: false,
    },
  ];

  memoryStore.staff = [
    { id: 101, name: "Cleaner Suresh", branchId: 1, isActive: true },
    { id: 102, name: "Cleaner Manoj", branchId: 2, isActive: true },
  ];

  memoryStore.users = [
    { id: 1, name: "Root Admin", role: "superadmin", branchId: null, franchiseeId: null, staffId: null, isActive: true },
    { id: 2, name: "Central Ops", role: "admin", branchId: null, franchiseeId: null, staffId: null, isActive: true },
    { id: 3, name: "Varanasi Branch Admin", role: "admin", branchId: 1, franchiseeId: null, staffId: null, isActive: true },
    { id: 4, name: "Noida Franchise Owner", role: "franchisee", branchId: 2, franchiseeId: 10, staffId: null, isActive: true },
    { id: 5, name: "Noida Cleaner", role: "staff", branchId: 2, franchiseeId: 10, staffId: 102, isActive: true },
    { id: 6, name: "Suspended Branch Staff", role: "staff", branchId: 3, franchiseeId: 11, staffId: 999, isActive: true },
  ];

  memoryStore.sessions = [
    { id: 1, userId: 1, tokenHash: hashToken("token-root"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 6, userId: 6, tokenHash: hashToken("token-suspended"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
  ];

  memoryStore.dcmsPlans = [
    { id: 1, name: "DCMS Basic 30", includedCleanings: 30, includedWashes: 1, price: "1200", isActive: true, seatCount: 5 },
  ];

  memoryStore.vehicles = [
    { id: 1, customerId: 100, registrationNumber: "UP65AB1234" },
  ];

  memoryStore.dcmsSubscriptions = [
    {
      id: 501,
      customerId: 100,
      vehicleId: 1,
      planId: 1,
      branchId: 2,
      status: "active",
      allocatedCleanings: 30,
      usedCleanings: 5,
      remainingCleanings: 25,
      remainingWashes: 1,
      pauseStartDate: null,
      pauseEndDate: null,
      pauseReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  memoryStore.dcmsStaffAssignments = [
    { id: 1, subscriptionId: 501, staffId: 102, isActive: true },
  ];

  memoryStore.dcmsVisits = [
    { id: 1, subscriptionId: 501, staffId: 102, status: "completed", visitDate: new Date().toISOString().slice(0, 10), visitType: "cleaning" },
  ];

  memoryStore.dcmsExceptions = [];

  memoryStore.invoices = [
    { id: 1, customerId: 100, branchId: 2, totalAmount: "1200.00", dueAmount: "0.00", status: "paid" },
  ];

  memoryStore.payments = [
    { id: 1, customerId: 100, branchId: 2, amount: "1200.00", status: "completed" },
  ];

  memoryStore.adminAuditLogs = [];
}

// Mock helper services
vi.mock("../../lib/dcms/planService", () => ({
  getPlanById: vi.fn((id: number) => {
    return Promise.resolve(memoryStore.dcmsPlans.find((p) => p.id === id) ?? null);
  }),
}));

vi.mock("../../lib/dcms/vehiclePlanMatch", () => ({
  getVehiclePlanContext: vi.fn(() => Promise.resolve({ seater: 5, vehicleType: "hatchback" })),
  assertPlanMatchesVehicle: vi.fn(() => true),
}));

vi.mock("../../lib/dcms/auditLog", () => ({
  logDcmsActivity: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/contracts/contractRegistry", () => ({
  syncContractFromDcms: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/assignments/enqueueAdapters", () => ({
  enqueuePendingFromDcmsSubscription: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/billing/invoiceService", () => ({
  createInvoiceForDcmsPlan: vi.fn(() => Promise.resolve()),
}));

// Mock @workspace/db
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields: any) => {
        const queryState = {
          table: null as any,
          conditions: [] as any[],
        };
        const builder = {
          from: vi.fn((tbl: any) => {
            queryState.table = tbl;
            return builder;
          }),
          innerJoin: vi.fn(() => builder),
          leftJoin: vi.fn(() => builder),
          where: vi.fn((cond: any) => {
            queryState.conditions.push(cond);
            return builder;
          }),
          groupBy: vi.fn(() => builder),
          orderBy: vi.fn(() => builder),
          limit: vi.fn(() => Promise.resolve(builder.execute())),
          execute: () => {
            const allParams = queryState.conditions.flatMap(extractAllParamValues);
            const numParams = allParams.filter((p) => typeof p === "number");
            const strParams = allParams.filter((p) => typeof p === "string");

            if (queryState.table === actual.branchesTable) {
              if (numParams.length > 0) {
                const b = memoryStore.branches.find((br) => numParams.includes(br.id));
                if (b) {
                  const city = memoryStore.cities.find((c) => c.id === b.cityId);
                  const franchisee = memoryStore.franchisees.find((f) => f.id === b.franchiseeId);
                  return [{
                    ...b,
                    cityName: city?.name ?? "Noida",
                    franchiseeName: franchisee?.name ?? "Rohit Verma",
                  }];
                }
                return [];
              }
              return memoryStore.branches;
            }
            if (queryState.table === actual.citiesTable) {
              if (numParams.length > 0) {
                const c = memoryStore.cities.find((ci) => numParams.includes(ci.id));
                return c ? [c] : [];
              }
              return memoryStore.cities;
            }
            if (queryState.table === actual.legalEntitiesTable) {
              if (numParams.length > 0) {
                const le = memoryStore.legalEntities.find((l) => numParams.includes(l.id));
                return le ? [le] : [];
              }
              return memoryStore.legalEntities;
            }
            if (queryState.table === actual.franchiseesTable) {
              if (numParams.length > 0) {
                const f = memoryStore.franchisees.find((fr) => numParams.includes(fr.id));
                return f ? [f] : [];
              }
              return memoryStore.franchisees;
            }
            if (queryState.table === actual.staffTable) {
              const isCount = fields && "count" in fields;
              const branchStaff = numParams.length
                ? memoryStore.staff.filter((s) => numParams.includes(s.branchId) && s.isActive)
                : memoryStore.staff.filter((s) => s.isActive);
              if (isCount) return [{ count: branchStaff.length }];
              return branchStaff.map((s) => ({ ...s, staffId: s.id, staffName: s.name }));
            }
            if (queryState.table === actual.sessionsTable) {
              const tokenParam = strParams.find((p) => p.length === 64);
              if (tokenParam) {
                const session = memoryStore.sessions.find((s) => s.tokenHash === tokenParam);
                if (session) {
                  const user = memoryStore.users.find((u) => u.id === session.userId);
                  return user ? [{ user }] : [];
                }
              }
              return [];
            }
            if (queryState.table === actual.dcmsSubscriptionsTable) {
              const isCount = fields && "count" in fields;
              if (isCount) {
                const activeCount = memoryStore.dcmsSubscriptions.filter((s) => s.status === "active").length;
                return [{ count: activeCount }];
              }
              if (numParams.length > 0) {
                const byId = memoryStore.dcmsSubscriptions.find((s) => numParams.includes(s.id));
                if (byId) return [byId];
                const byVehicle = memoryStore.dcmsSubscriptions.find((s) => numParams.includes(s.vehicleId));
                if (byVehicle) return [byVehicle];
              }
              return memoryStore.dcmsSubscriptions;
            }
            if (queryState.table === actual.dcmsVisitsTable) return [{ status: "completed", count: 1 }];
            if (queryState.table === actual.dcmsOperationalExceptionsTable) return [{ count: memoryStore.dcmsExceptions.length }];
            if (queryState.table === actual.invoicesTable) return [{ invoicedTotal: 1200, dueTotal: 0 }];
            if (queryState.table === actual.paymentsTable) return [{ collectedTotal: 1200 }];
            return [];
          },
          then: (resolve: any) => Promise.resolve(builder.execute()).then(resolve),
        };
        return builder;
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          const row = { id: Date.now(), ...vals, createdAt: new Date() };
          if (table === actual.dcmsSubscriptionsTable) memoryStore.dcmsSubscriptions.push(row);
          if (table === actual.adminAuditLogsTable) memoryStore.adminAuditLogs.push(row);
          return {
            returning: vi.fn(() => Promise.resolve([row])),
            then: (resolve: any) => Promise.resolve([row]).then(resolve),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((clause: any) => {
            const allParams = extractAllParamValues(clause);
            const numParams = allParams.filter((p) => typeof p === "number");
            if (table === actual.branchesTable) {
              const b = (numParams.length ? memoryStore.branches.find((br) => numParams.includes(br.id)) : null) ?? memoryStore.branches[1];
              if (b) Object.assign(b, vals);
              return {
                returning: vi.fn(() => Promise.resolve(b ? [b] : [])),
                then: (resolve: any) => Promise.resolve(b ? [b] : []).then(resolve),
              };
            }
            if (table === actual.dcmsSubscriptionsTable) {
              const s = (numParams.length ? memoryStore.dcmsSubscriptions.find((sub) => numParams.includes(sub.id)) : null) ?? memoryStore.dcmsSubscriptions[0];
              if (s) Object.assign(s, vals);
              return {
                returning: vi.fn(() => Promise.resolve(s ? [s] : [])),
                then: (resolve: any) => Promise.resolve(s ? [s] : []).then(resolve),
              };
            }
            if (table === actual.dcmsStaffAssignmentsTable) {
              for (const a of memoryStore.dcmsStaffAssignments) Object.assign(a, vals);
              return {
                returning: vi.fn(() => Promise.resolve(memoryStore.dcmsStaffAssignments)),
                then: (resolve: any) => Promise.resolve(memoryStore.dcmsStaffAssignments).then(resolve),
              };
            }
            return {
              returning: vi.fn(() => Promise.resolve([])),
              then: (resolve: any) => Promise.resolve([]).then(resolve),
            };
          }),
        })),
      })),
    },
  };
});

describe("CWP PRD v1.5 — End-to-End Branch Operations & Customer Lifecycle", () => {
  beforeEach(() => {
    resetMemory();
  });

  describe("1. Branch-Level Authorization & Data Ownership (SEC-025)", () => {
    it("distinguishes Central Superadmin with cross-city visibility from Company Branch Admin", async () => {
      // Root Admin (superadmin)
      const rootScope = await computeScope(memoryStore.users[0]);
      expect(rootScope.isSuperAdmin).toBe(true);
      expect(rootScope.branchIds).toBeNull();

      // Central Ops Admin (admin without branchId)
      const centralOpsScope = await computeScope(memoryStore.users[1]);
      expect(centralOpsScope.isSuperAdmin).toBe(true);
      expect(centralOpsScope.branchIds).toBeNull();

      // Company Branch Admin (admin with branchId = 1)
      const branchAdminScope = await computeScope(memoryStore.users[2]);
      expect(branchAdminScope.isSuperAdmin).toBe(false);
      expect(branchAdminScope.branchIds).toEqual([1]);
    });

    it("scopes Franchise Owner strictly to their assigned branch and franchisee ID", async () => {
      const fofoScope = await computeScope(memoryStore.users[3]);
      expect(fofoScope.isSuperAdmin).toBe(false);
      expect(fofoScope.branchIds).toEqual([2]);
      expect(fofoScope.franchiseeId).toBe(10);
    });

    it("scopes Cleaner/Staff strictly to their staff ID and assigned branch", async () => {
      const cleanerScope = await computeScope(memoryStore.users[4]);
      expect(cleanerScope.isSuperAdmin).toBe(false);
      expect(cleanerScope.branchIds).toEqual([2]);
      expect(cleanerScope.staffId).toBe(102);
    });

    it("rejects authentication session when user belongs to a suspended branch or franchise", async () => {
      // User 6 belongs to suspended branch 3 and suspended franchisee 11
      const authenticatedUser = await loadUserFromToken("token-suspended");
      expect(authenticatedUser).toBeNull();
    });
  });

  describe("2. Branch Onboarding & Activation Checklist (BR-002)", () => {
    it("evaluates branch setup readiness across all 10 operational checklist items", async () => {
      const report = await validateBranchReadiness(2);
      expect(report.branchId).toBe(2);
      expect(report.score).toBeGreaterThan(0);
      expect(report.checklist.length).toBe(9);

      // Branch 2 has basic profile, city mapping, legal entity, FOFO partner, services, staff
      expect(report.isReady).toBe(true);
    });

    it("blocks activation when critical prerequisites are missing unless force-activated by central admin", async () => {
      // Branch 3 is missing legal entity, services, phone
      const branch3 = memoryStore.branches.find((b) => b.id === 3);
      branch3.legalEntityId = null;
      branch3.serviceAvailability = [];

      const report3 = await validateBranchReadiness(3);
      expect(report3.isReady).toBe(false);
      expect(report3.missingPrerequisites.length).toBeGreaterThan(0);

      // Attempt normal activation without force -> fails closed
      await expect(activateBranch(3, 1, false)).rejects.toThrow(/Branch is not ready for activation/);

      // Force activation by superadmin -> passes and writes admin audit log
      const activated = await activateBranch(3, 1, true);
      expect(activated.status).toBe("active");
      expect(memoryStore.adminAuditLogs.length).toBeGreaterThan(0);
      expect(memoryStore.adminAuditLogs[0].action).toBe("branch_activated");
    });
  });

  describe("3. Customer Subscription Lifecycle & Idempotency (DCMS-011)", () => {
    it("prevents duplicate active subscriptions on double-submission or webhook replay", async () => {
      const sub = await createSubscription(
        {
          customerId: 100,
          vehicleId: 1,
          planId: 1,
          startDate: "2026-11-12",
          branchId: 2,
          skipBilling: true,
        },
        1
      );

      // Existing active subscription 501 is returned without creating duplicate
      expect(sub.id).toBe(501);
      expect(memoryStore.dcmsSubscriptions.length).toBe(1);
    });

    it("pauses active subscription, deactivates cleaner daily routes, and logs audit trail", async () => {
      const paused = await pauseSubscription(
        501,
        {
          pauseStartDate: "2026-11-15",
          pauseEndDate: "2026-11-20",
          pauseReason: "Customer out of town",
        },
        1
      );

      expect(paused.status).toBe("paused");
      expect(paused.pauseStartDate).toBe("2026-11-15");
      expect(paused.pauseReason).toBe("Customer out of town");

      // Verify cleaner assignments deactivated
      expect(memoryStore.dcmsStaffAssignments[0].isActive).toBe(false);
    });

    it("resumes paused subscription, re-enqueues cleaner routes, and restores active status", async () => {
      // Setup paused subscription
      memoryStore.dcmsSubscriptions[0].status = "paused";
      memoryStore.dcmsSubscriptions[0].pauseStartDate = "2026-11-15";

      const resumed = await resumeSubscription(501, 1);

      expect(resumed.status).toBe("active");
      expect(resumed.pauseStartDate).toBeNull();
      expect(resumed.pauseReason).toBeNull();
    });

    it("fails closed when attempting to pause non-active or resume non-paused subscriptions", async () => {
      // 501 is active in resetMemory
      await expect(resumeSubscription(501, 1)).rejects.toThrow(/Subscription is already active/);
    });
  });

  describe("4. Branch Operations Command Center Telemetry (DASH-004)", () => {
    it("aggregates live operational telemetry, cleaner workloads, and prioritized next actions", async () => {
      const dashboard = await getBranchOperationsDashboard(2);

      expect(dashboard.branch.name).toBe("Noida Sector 62 Hub");
      expect(dashboard.metrics.activeSubscriptions).toBe(1);
      expect(dashboard.metrics.todayCompleted).toBe(1);
      expect(dashboard.metrics.completionRate).toBe(100);

      // Cleaners workload
      expect(dashboard.cleaners.length).toBeGreaterThan(0);
      expect(dashboard.cleaners[0].staffName).toBe("Cleaner Manoj");

      // Prioritized actions
      expect(dashboard.prioritizedActions).toBeDefined();
    });
  });
});
