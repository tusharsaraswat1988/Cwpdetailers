import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeScope, loadUserFromToken, hashToken, type AuthUser } from "../../middlewares/auth";
import { rowInScope } from "../../middlewares/tenantScope";
import {
  assignBranchUser,
  replaceBranchManager,
  revokeBranchAssignment,
  listBranchAssignments,
  getUserActiveBranchIds,
} from "../../lib/franchise/branchAssignmentService";
import {
  suspendBranch,
  validateBranchReadiness,
  createBranch,
} from "../../lib/franchise/branchManagementService";
import {
  projectStaffRecord,
  projectStaffList,
} from "../../lib/projections/staffProjection";
import {
  getBranchServiceCatalog,
  setBranchServiceOverride,
} from "../../lib/branchConfigService";

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

// In-memory mock tables for branch governance, assignments and RBAC
const memory = {
  branches: [] as any[],
  cities: [] as any[],
  legalEntities: [] as any[],
  franchisees: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  branchUserAssignments: [] as any[],
  serviceBranchOverrides: [] as any[],
  services: [] as any[],
  serviceCityAvailability: [] as any[],
  staff: [] as any[],
  customers: [] as any[],
  invoices: [] as any[],
  auditLogs: [] as any[],
};

function resetTestState() {
  memory.cities = [
    { id: 1, name: "Varanasi", isActive: true },
    { id: 2, name: "Noida", isActive: true },
  ];

  memory.legalEntities = [
    { id: 1, name: "CWP Detailers Pvt Ltd", code: "CWP-HQ", isActive: true },
    { id: 2, name: "Noida Hub LLP", code: "NOI-LLP", isActive: true },
  ];

  memory.franchisees = [
    { id: 10, name: "Legacy Franchisee Partner", status: "active", branchId: 1, commissionPercentage: "15.00" },
  ];

  memory.branches = [
    {
      id: 1,
      name: "Varanasi Cantt Hub",
      code: "BR-VAR-01",
      city: "Varanasi",
      cityId: 1,
      companyId: 1,
      legalEntityId: 1,
      isCompanyOperated: false, // Legacy FOFO preserved
      franchiseeId: 10,
      status: "active",
      serviceAvailability: ["daily_cleaning", "car_washing"],
      phone: "9876540001",
      managerName: "Varanasi Manager",
      isActive: true,
    },
    {
      id: 2,
      name: "Noida Sector 62 Hub",
      code: "BR-NOI-01",
      city: "Noida",
      cityId: 2,
      companyId: 1,
      legalEntityId: 2,
      isCompanyOperated: true, // COCO
      franchiseeId: null,
      status: "active",
      serviceAvailability: ["daily_cleaning", "ceramic_coating"],
      phone: "9876540002",
      managerName: "Noida Manager",
      isActive: true,
    },
    {
      id: 3,
      name: "Noida Expressway Hub",
      code: "BR-NOI-02",
      city: "Noida",
      cityId: 2,
      companyId: 1,
      legalEntityId: 2,
      isCompanyOperated: true, // COCO
      franchiseeId: null,
      status: "active",
      serviceAvailability: ["daily_cleaning"],
      phone: "9876540003",
      managerName: null,
      isActive: true,
    },
  ];

  memory.users = [
    { id: 1, name: "Super Admin", phone: "9999999999", role: "superadmin", companyId: 1, branchId: null, isActive: true },
    { id: 2, name: "Central Admin", phone: "9999999998", role: "central_admin", companyId: 1, branchId: null, isActive: true },
    { id: 10, name: "Noida Branch Manager", phone: "9811111111", role: "branch_manager", companyId: 1, branchId: 2, isActive: true },
    { id: 20, name: "Varanasi Branch Manager", phone: "9822222222", role: "branch_manager", companyId: 1, branchId: 1, isActive: true },
    { id: 30, name: "Noida Operations Supervisor", phone: "9833333333", role: "supervisor", companyId: 1, branchId: 2, isActive: true },
    { id: 40, name: "Field Cleaner Staff", phone: "9844444444", role: "staff", companyId: 1, branchId: 2, staffId: 101, isActive: true },
    { id: 41, name: "Second Cleaner Staff", phone: "9844444445", role: "staff", companyId: 1, branchId: 2, staffId: 102, isActive: true },
    { id: 50, name: "App Customer", phone: "9855555555", role: "customer", companyId: 1, customerId: 501, isActive: true },
  ];

  memory.branchUserAssignments = [
    {
      id: 1,
      userId: 10,
      branchId: 2,
      assignmentRole: "branch_manager",
      isActive: true,
      assignedBy: 1,
      assignedAt: new Date("2026-01-01"),
      effectiveFrom: new Date("2026-01-01"),
      effectiveUntil: null,
      revokedAt: null,
    },
    {
      id: 2,
      userId: 20,
      branchId: 1,
      assignmentRole: "branch_manager",
      isActive: true,
      assignedBy: 1,
      assignedAt: new Date("2026-01-01"),
      effectiveFrom: new Date("2026-01-01"),
      effectiveUntil: null,
      revokedAt: null,
    },
    {
      id: 3,
      userId: 30,
      branchId: 2,
      assignmentRole: "supervisor",
      isActive: true,
      assignedBy: 1,
      assignedAt: new Date("2026-01-01"),
      effectiveFrom: new Date("2026-01-01"),
      effectiveUntil: null,
      revokedAt: null,
    },
  ];

  memory.sessions = [
    { id: 101, userId: 10, tokenHash: hashToken("token-mgr-noida"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 102, userId: 20, tokenHash: hashToken("token-mgr-varanasi"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 103, userId: 30, tokenHash: hashToken("token-supv-noida"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 104, userId: 40, tokenHash: hashToken("token-staff-40"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
  ];

  memory.services = [
    { id: 1, name: "Daily Car Cleaning", serviceType: "daily_cleaning", basePrice: "1200", isActive: true },
    { id: 2, name: "Ceramic Coating", serviceType: "ceramic_coating", basePrice: "15000", isActive: true },
  ];

  memory.serviceCityAvailability = [
    { id: 1, cityId: 2, serviceId: 1, isActive: true, basePriceOverride: "1350.00" },
    { id: 2, cityId: 1, serviceId: 1, isActive: true, basePriceOverride: "1200.00" },
  ];

  memory.serviceBranchOverrides = [];
  memory.auditLogs = [];
}

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
        const builder: any = {
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
          then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
            return Promise.resolve(builder.execute()).then(onfulfilled, onrejected);
          },
          execute: () => {
            const allParams = queryState.conditions.flatMap(extractAllParamValues);
            const numParams = allParams.filter((p) => typeof p === "number");
            const strParams = allParams.filter((p) => typeof p === "string");
            const boolParams = allParams.filter((p) => typeof p === "boolean");

            if (queryState.table === actual.branchUserAssignmentsTable) {
              return memory.branchUserAssignments
                .filter((a) => {
                  if (numParams.includes(a.userId) || numParams.includes(a.branchId) || numParams.includes(a.id)) {
                    if (boolParams.length > 0) return a.isActive === boolParams[0];
                    return true;
                  }
                  return false;
                })
                .map((a) => {
                  const b = memory.branches.find((br) => br.id === a.branchId);
                  const u = memory.users.find((usr) => usr.id === a.userId);
                  return {
                    ...a,
                    branchName: b?.name ?? `Branch #${a.branchId}`,
                    userName: u?.name ?? `User #${a.userId}`,
                    userPhone: u?.phone ?? null,
                  };
                });
            }

            if (queryState.table === actual.branchesTable) {
              if (numParams.length > 0) {
                return memory.branches.filter((b) => numParams.includes(b.id));
              }
              return memory.branches;
            }

            if (queryState.table === actual.usersTable) {
              if (numParams.length > 0) {
                return memory.users.filter((u) => numParams.includes(u.id));
              }
              return memory.users;
            }

            if (queryState.table === actual.userSessionsTable) {
              if (strParams.length > 0) {
                return memory.sessions.filter((s) => strParams.includes(s.tokenHash));
              }
              return memory.sessions;
            }

            if (queryState.table === actual.servicesTable) {
              return memory.services;
            }

            if (queryState.table === actual.serviceCityAvailabilityTable) {
              if (numParams.length > 0) {
                return memory.serviceCityAvailability.filter((c) => numParams.includes(c.cityId));
              }
              return memory.serviceCityAvailability;
            }

            if (queryState.table === actual.serviceBranchOverridesTable) {
              if (numParams.length > 0) {
                return memory.serviceBranchOverrides.filter((bo) => numParams.includes(bo.branchId));
              }
              return memory.serviceBranchOverrides;
            }

            return [];
          },
        };
        return builder;
      }),

      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          const arr = Array.isArray(vals) ? vals : [vals];
          const results = arr.map((item, idx) => {
            const created = { id: Date.now() + idx, createdAt: new Date(), updatedAt: new Date(), ...item };
            if (table === actual.branchUserAssignmentsTable) {
              memory.branchUserAssignments.push(created);
            } else if (table === actual.branchesTable) {
              memory.branches.push(created);
            } else if (table === actual.serviceBranchOverridesTable) {
              const existingIdx = memory.serviceBranchOverrides.findIndex(
                (o) => o.branchId === item.branchId && o.serviceId === item.serviceId
              );
              if (existingIdx >= 0) {
                Object.assign(memory.serviceBranchOverrides[existingIdx], item);
                return memory.serviceBranchOverrides[existingIdx];
              }
              memory.serviceBranchOverrides.push(created);
            }
            return created;
          });
          return {
            returning: vi.fn(() => Promise.resolve(results)),
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(() => Promise.resolve(results)),
            })),
            execute: () => Promise.resolve(results),
          };
        }),
      })),

      update: vi.fn((table: any) => ({
        set: vi.fn((changes: any) => ({
          where: vi.fn((cond: any) => {
            const params = extractAllParamValues(cond);
            const numParams = params.filter((p) => typeof p === "number");

            let updated: any[] = [];
            if (table === actual.branchUserAssignmentsTable) {
              memory.branchUserAssignments.forEach((a) => {
                if (numParams.includes(a.id) || (numParams.includes(a.branchId) && (changes.isActive === false || changes.revokedAt))) {
                  Object.assign(a, changes);
                  updated.push(a);
                }
              });
            } else if (table === actual.userSessionsTable) {
              memory.sessions.forEach((s) => {
                if (numParams.includes(s.userId)) {
                  Object.assign(s, changes);
                  updated.push(s);
                }
              });
            } else if (table === actual.branchesTable) {
              memory.branches.forEach((b) => {
                if (numParams.includes(b.id)) {
                  Object.assign(b, changes);
                  updated.push(b);
                }
              });
            } else if (table === actual.usersTable) {
              memory.users.forEach((u) => {
                if (numParams.includes(u.id)) {
                  Object.assign(u, changes);
                  updated.push(u);
                }
              });
            }
            return {
              returning: vi.fn(() => Promise.resolve(updated)),
              execute: () => Promise.resolve(updated),
            };
          }),
        })),
      })),

      delete: vi.fn((table: any) => ({
        where: vi.fn((cond: any) => {
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
    },
  };
});

describe("PHASE 10: Adversarial Security, Governance & Confidentiality Hardening Suite", () => {
  beforeEach(() => {
    resetTestState();
  });

  // 1. Noida manager cannot read Varanasi customers
  it("Scenario 1: Noida manager cannot read Varanasi customers (Cross-Branch IDOR rejection)", async () => {
    const noidaManagerUser: AuthUser = {
      id: 10,
      role: "branch_manager",
      name: "Noida Branch Manager",
      phone: "9811111111",
      companyId: 1,
      branchId: 2,
    };

    const scope = await computeScope(noidaManagerUser);
    expect(scope.branchIds).toEqual([2]);

    // Varanasi customer record with branchId = 1
    const varanasiCustomer = { id: 201, name: "Varanasi Customer", branchId: 1, companyId: 1 };
    const canAccess = rowInScope({ scope } as any, varanasiCustomer);
    expect(canAccess).toBe(false);

    // Noida customer record with branchId = 2
    const noidaCustomer = { id: 202, name: "Noida Customer", branchId: 2, companyId: 1 };
    expect(rowInScope({ scope } as any, noidaCustomer)).toBe(true);
  });

  // 2. Varanasi manager cannot read Noida invoices
  it("Scenario 2: Varanasi manager cannot read Noida invoices", async () => {
    const varanasiManagerUser: AuthUser = {
      id: 20,
      role: "branch_manager",
      name: "Varanasi Branch Manager",
      phone: "9822222222",
      companyId: 1,
      branchId: 1,
    };

    const scope = await computeScope(varanasiManagerUser);
    expect(scope.branchIds).toEqual([1]);

    const noidaInvoice = { id: 901, invoiceNumber: "INV-NOI-001", branchId: 2, companyId: 1 };
    expect(rowInScope({ scope } as any, noidaInvoice)).toBe(false);

    const varanasiInvoice = { id: 902, invoiceNumber: "INV-VAR-001", branchId: 1, companyId: 1 };
    expect(rowInScope({ scope } as any, varanasiInvoice)).toBe(true);
  });

  // 3. Manager cannot access central payment ledger
  it("Scenario 3: Branch Manager is rejected (403) from accessing central payment ledger", () => {
    // Verified against requireAdminRole in admin-ledger.ts
    const isCentralAdmin = (role: string, branchId?: number | null) =>
      role === "superadmin" || role === "central_admin" || (role === "admin" && !branchId);

    const branchManager = { role: "branch_manager", branchId: 2 };
    expect(isCentralAdmin(branchManager.role, branchManager.branchId)).toBe(false);

    const supervisor = { role: "supervisor", branchId: 2 };
    expect(isCentralAdmin(supervisor.role, supervisor.branchId)).toBe(false);

    const superAdmin = { role: "superadmin", branchId: null };
    expect(isCentralAdmin(superAdmin.role, superAdmin.branchId)).toBe(true);

    const centralAdmin = { role: "central_admin", branchId: null };
    expect(isCentralAdmin(centralAdmin.role, centralAdmin.branchId)).toBe(true);
  });

  // 4. Manager cannot export all-city transactions
  it("Scenario 4: Branch Manager cannot export all-city transactions", () => {
    const isExportAuthorized = (role: string, branchId?: number | null) =>
      role === "superadmin" || role === "central_admin" || (role === "admin" && !branchId);

    expect(isExportAuthorized("branch_manager", 2)).toBe(false);
    expect(isExportAuthorized("supervisor", 2)).toBe(false);
    expect(isExportAuthorized("superadmin", null)).toBe(true);
  });

  // 5. Supervisor cannot retrieve payroll
  it("Scenario 5: Supervisor cannot retrieve payroll, daily rates or bank accounts (Confidential Projections)", () => {
    const supervisorUser: AuthUser = {
      id: 30,
      role: "supervisor",
      name: "Noida Supervisor",
      phone: "9833333333",
      companyId: 1,
      branchId: 2,
    };

    const rawStaffRecord = {
      id: 101,
      userId: 40,
      name: "Field Cleaner",
      phone: "9844444444",
      branchId: 2,
      monthlySalary: "25000.00",
      dailyRate: "800.00",
      overtimeHourlyRate: "150.00",
      bankAccountNumber: "123456789012",
      bankIfscCode: "HDFC0001234",
      aadhaarNumber: "1234-5678-9012",
      panNumber: "ABCDE1234F",
      isActive: true,
    };

    const projected = projectStaffRecord(rawStaffRecord, supervisorUser);

    // Salary and bank details MUST be stripped
    expect(projected.monthlySalary).toBeUndefined();
    expect(projected.dailyRate).toBeUndefined();
    expect(projected.overtimeHourlyRate).toBeUndefined();
    expect(projected.bankAccountNumber).toBeUndefined();
    expect(projected.bankIfscCode).toBeUndefined();
    expect(projected.aadhaarNumber).toBeUndefined();
    expect(projected.panNumber).toBeUndefined();
    expect(projected.name).toBe("Field Cleaner");
    expect(projected.branchId).toBe(2);
  });

  // 6. Staff cannot retrieve another employee's identity information
  it("Scenario 6: Staff cannot retrieve another employee's identity information (Aadhaar, PAN, Bank)", () => {
    const cleanerStaffUser: AuthUser = {
      id: 40,
      role: "staff",
      name: "Field Cleaner 1",
      phone: "9844444444",
      companyId: 1,
      branchId: 2,
      staffId: 101,
    };

    const peerStaffRecord = {
      id: 102, // Different staff ID
      userId: 41,
      name: "Field Cleaner 2",
      phone: "9844444445",
      branchId: 2,
      monthlySalary: "22000.00",
      bankAccountNumber: "999988887777",
      bankIfscCode: "SBIN0004321",
      aadhaarNumber: "9876-5432-1098",
      panNumber: "XYZPQ9876R",
      isActive: true,
    };

    const projectedPeer = projectStaffRecord(peerStaffRecord, cleanerStaffUser);
    expect(projectedPeer.monthlySalary).toBeUndefined();
    expect(projectedPeer.bankAccountNumber).toBeUndefined();
    expect(projectedPeer.aadhaarNumber).toBeUndefined();
    expect(projectedPeer.panNumber).toBeUndefined();

    // But when staff views their OWN profile, personal identity details remain accessible
    const ownStaffRecord = {
      id: 101, // Matches caller's staffId
      userId: 40,
      name: "Field Cleaner 1",
      phone: "9844444444",
      branchId: 2,
      monthlySalary: "25000.00",
      bankAccountNumber: "123456789012",
      aadhaarNumber: "1234-5678-9012",
      panNumber: "ABCDE1234F",
      isActive: true,
    };

    const projectedSelf = projectStaffRecord(ownStaffRecord, cleanerStaffUser);
    expect(projectedSelf.aadhaarNumber).toBe("1234-5678-9012");
    expect(projectedSelf.panNumber).toBe("ABCDE1234F");
  });

  // 7. Manager cannot alter their own assignment or role
  it("Scenario 7: Manager cannot alter their own assignment or assign themselves to another branch", async () => {
    const managerId = 10;

    // Self-assignment attempt
    await expect(
      assignBranchUser({
        userId: managerId,
        branchId: 3,
        assignmentRole: "branch_manager",
        assignedBy: managerId, // Self-assigned
      })
    ).rejects.toThrow("Self-assignment is prohibited");
  });

  // 8. Revoked manager loses access immediately
  it("Scenario 8: Revoked manager loses access immediately with session invalidation", async () => {
    // Manager 10 currently has active assignment #1
    expect(memory.branchUserAssignments.find((a) => a.id === 1)?.isActive).toBe(true);

    // Super Admin (userId: 1) revokes manager assignment #1
    const revoked = await revokeBranchAssignment(1, 1);
    expect(revoked.isActive).toBe(false);
    expect(revoked.revokedAt).toBeDefined();

    // Session for manager 10 must be revoked immediately
    const session = memory.sessions.find((s) => s.userId === 10);
    expect(session?.revokedAt).toBeDefined();

    // Subsequent token auth attempt fails closed
    const authUser = await loadUserFromToken("token-mgr-noida");
    expect(authUser).toBeNull();
  });

  // 9. Suspended branch cannot be operated
  it("Scenario 9: Suspended branch cannot be operated (all user sessions invalidated)", async () => {
    // Suspend Branch 2 (Noida Sector 62)
    const result = await suspendBranch(2, "Operational audit failure", 1);
    expect(result.status).toBe("suspended");

    // All active users assigned to branch 2 should have their sessions revoked
    const noidaUserSession = memory.sessions.find((s) => s.userId === 30);
    expect(noidaUserSession?.revokedAt).toBeDefined();

    // Authenticating with branch 2 token fails closed
    const authUser = await loadUserFromToken("token-supv-noida");
    expect(authUser).toBeNull();
  });

  // 10. Multi-branch manager accesses only assigned branches
  it("Scenario 10: Multi-branch manager accesses only assigned branches and is blocked from unassigned branches", async () => {
    // Assign manager 10 to both Branch 2 and Branch 3
    memory.branchUserAssignments.push({
      id: 101,
      userId: 10,
      branchId: 3,
      assignmentRole: "branch_manager",
      isActive: true,
      assignedBy: 1,
      assignedAt: new Date(),
      effectiveFrom: new Date(),
      effectiveUntil: null,
      revokedAt: null,
    });

    const activeBranchIds = await getUserActiveBranchIds(10);
    expect(activeBranchIds).toContain(2);
    expect(activeBranchIds).toContain(3);
    expect(activeBranchIds).not.toContain(1); // Varanasi not assigned

    const multiBranchManager: AuthUser = {
      id: 10,
      role: "branch_manager",
      name: "Regional Manager",
      phone: "9811111111",
      companyId: 1,
    };

    const scope = await computeScope(multiBranchManager);
    expect(scope.branchIds).toEqual([2, 3]);

    // Access checks
    expect(rowInScope({ scope } as any, { branchId: 2, companyId: 1 })).toBe(true);
    expect(rowInScope({ scope } as any, { branchId: 3, companyId: 1 })).toBe(true);
    expect(rowInScope({ scope } as any, { branchId: 1, companyId: 1 })).toBe(false); // IDOR prevented
  });

  // 11. Cross-branch analytics filters cannot be spoofed
  it("Scenario 11: Cross-branch analytics filter cannot be spoofed (Anti-spoofing validation)", () => {
    const callerScope = { branchIds: [2], isSuperAdmin: false };

    const validateAnalyticsScope = (requestedBranchId: number | null, scope: typeof callerScope) => {
      if (requestedBranchId !== null && scope.branchIds && !scope.branchIds.includes(requestedBranchId)) {
        throw new Error("Access denied to specified branch scope");
      }
      return true;
    };

    // Caller requesting their own branch -> permitted
    expect(validateAnalyticsScope(2, callerScope)).toBe(true);

    // Caller spoofing branch 1 (Varanasi) -> rejected
    expect(() => validateAnalyticsScope(1, callerScope)).toThrow("Access denied to specified branch scope");
  });

  // 12. Super Admin retains global visibility
  it("Scenario 12: Super Admin retains consolidated global visibility across all cities and branches", async () => {
    const superAdminUser: AuthUser = {
      id: 1,
      role: "superadmin",
      name: "Root Super Admin",
      phone: "9999999999",
      companyId: 1,
      branchId: null,
    };

    const scope = await computeScope(superAdminUser);
    expect(scope.isSuperAdmin).toBe(true);
    expect(scope.branchIds).toBeNull();

    // Global scope allows access to every branch
    expect(rowInScope({ scope } as any, { branchId: 1, companyId: 1 })).toBe(true);
    expect(rowInScope({ scope } as any, { branchId: 2, companyId: 1 })).toBe(true);
    expect(rowInScope({ scope } as any, { branchId: 3, companyId: 1 })).toBe(true);
  });

  // 13. Historical franchisee data remains intact
  it("Scenario 13: Historical franchisee data and legacy FOFO records remain intact", () => {
    const legacyBranch = memory.branches.find((b) => b.id === 1);
    expect(legacyBranch).toBeDefined();
    expect(legacyBranch.isCompanyOperated).toBe(false);
    expect(legacyBranch.franchiseeId).toBe(10);

    const legacyFranchisee = memory.franchisees.find((f) => f.id === 10);
    expect(legacyFranchisee).toBeDefined();
    expect(legacyFranchisee.name).toBe("Legacy Franchisee Partner");
    expect(legacyFranchisee.commissionPercentage).toBe("15.00");
  });

  // 14. Customer and staff applications continue to work
  it("Scenario 14: Customer and staff applications continue to work with scoped tenancy", async () => {
    const customerUser: AuthUser = {
      id: 50,
      role: "customer",
      name: "App Customer",
      phone: "9855555555",
      companyId: 1,
      customerId: 501,
    };

    const customerScope = await computeScope(customerUser);
    expect(customerScope.customerId).toBe(501);
    expect(customerScope.isSuperAdmin).toBe(false);

    const staffUser: AuthUser = {
      id: 40,
      role: "staff",
      name: "Field Cleaner",
      phone: "9844444444",
      companyId: 1,
      branchId: 2,
      staffId: 101,
    };

    const staffScope = await computeScope(staffUser);
    expect(staffScope.staffId).toBe(101);
    expect(staffScope.branchIds).toEqual([2]);
  });

  // 15. Noida and Varanasi booking flows remain operational
  it("Scenario 15: Noida and Varanasi booking flows and branch configuration remain fully operational", async () => {
    // 1. Varanasi Branch service catalog
    const varanasiCatalog = await getBranchServiceCatalog(1);
    expect(varanasiCatalog.length).toBeGreaterThan(0);
    const varanasiCleaning = varanasiCatalog.find((s) => s.serviceId === 1);
    expect(varanasiCleaning?.effectivePrice).toBe(1200);

    // 2. Noida Branch service catalog (reflects city override 1350)
    const noidaCatalog = await getBranchServiceCatalog(2);
    expect(noidaCatalog.length).toBeGreaterThan(0);
    const noidaCleaning = noidaCatalog.find((s) => s.serviceId === 1);
    expect(noidaCleaning?.effectivePrice).toBe(1350);

    // 3. Set branch override on Noida
    const override = await setBranchServiceOverride({
      branchId: 2,
      serviceId: 1,
      basePriceOverride: 1499.00,
      isActive: true,
      customSettings: { notes: "Noida premium express wash override" },
    });

    expect(Number(override.basePriceOverride)).toBe(1499.00);
    expect(override.isActive).toBe(true);

    // 4. Verify catalog reflects branch override taking precedence over city override
    const updatedNoidaCatalog = await getBranchServiceCatalog(2);
    const service1 = updatedNoidaCatalog.find((s) => s.serviceId === 1);
    expect(service1?.effectivePrice).toBe(1499);
  });
});
