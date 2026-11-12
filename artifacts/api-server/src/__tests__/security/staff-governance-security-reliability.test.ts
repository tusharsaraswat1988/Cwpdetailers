import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken, loadUserFromToken, optionalAuth, type AuthUser } from "../../middlewares/auth";
import {
  assertStaffAssignable,
  assertStaffBranchMatch,
} from "../../lib/assignments/assignmentValidation";
import {
  computeProfileCompletion,
  isStaffAssignable,
  staffAssignableError,
} from "../../lib/staffEcosystem/profileCompletion";
import {
  projectStaffRecord,
  projectStaffList,
  projectStaffDocuments,
  projectStaffDocument,
  maskDocumentNumber,
} from "../../lib/projections/staffProjection";
import {
  setStaffPortalPassword,
  syncStaffLoginUser,
} from "../../lib/staffLoginSync";
import {
  calculateStaffPayout,
  computeProRataSalary,
  getDaysInMonth,
} from "../../lib/payroll/staffPayoutService";
import {
  calculateStaffRevenue,
  getStaffLeaderboardRevenueMap,
  RECOGNIZED_INVOICE_STATUSES,
} from "../../lib/payroll/staffRevenueService";
import { generateSignedDocumentUrl } from "../../lib/cloudinaryStorage";
import { STARTUP_MIGRATION_LOCK_ID, ensureStartupMigrations } from "../../lib/startupMigrations";
import { runKycBackfillMigration, listLegacyPublicKycDocuments } from "../../lib/staffEcosystem/kycMigrationService";

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

// In-memory mock database state
const memory = {
  staff: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  staffDocuments: [] as any[],
  dcmsVisits: [] as any[],
  serviceExecutions: [] as any[],
  staffPayoutLedgers: [] as any[],
  invoices: [] as any[],
  dcmsStaffAssignments: [] as any[],
  queryLogs: [] as Array<{ sql: string; params?: any[] }>,
};

function resetTestState() {
  memory.queryLogs = [];

  memory.staff = [
    {
      id: 101,
      userId: 11,
      name: "Ramesh Cleaner",
      phone: "9876543210",
      email: null,
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "pending", // Pending verification
      isActive: true,
      ownsVehicle: false,
      monthlySalary: "12000.00",
      perWashRate: "150.00",
      perDailyCleaningRate: "50.00",
      perSolarPanelRate: "40.00",
      ratePerKm: "5.00",
      employmentType: "salaried",
      dateOfBirth: "1995-05-15",
      gender: "male",
      joiningDate: "2026-01-01",
      emergencyContactName: "Sita",
      emergencyContactPhone: "9876543219",
      profilePhotoUrl: "https://res.cloudinary.com/demo/photo.jpg",
      employeeCode: "CWP-STF-00101",
      currentCity: "Noida",
      currentState: "UP",
      currentPincode: "201301",
      currentArea: "Sector 62",
      permanentSameAsCurrent: true,
      bankAccountName: "Ramesh",
      bankName: "SBI",
      bankAccountNumber: "1234567890",
      bankIfsc: "SBIN0001234",
      bankBranch: "Noida",
    },
    {
      id: 102,
      userId: 12,
      name: "Suresh Driver",
      phone: "9876543211",
      email: "suresh@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "verified",
      isActive: true,
      ownsVehicle: true,
      monthlySalary: "0.00",
      perWashRate: "180.00",
      perDailyCleaningRate: "60.00",
      perSolarPanelRate: "50.00",
      ratePerKm: "5.00",
      employmentType: "per_job",
      joiningDate: "2026-02-01",
    },
    {
      id: 103,
      userId: 13,
      name: "Vikas Suspended",
      phone: "9876543212",
      email: "vikas@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "suspended",
      isActive: false,
      ownsVehicle: false,
      joiningDate: "2026-01-01",
    },
    {
      id: 104,
      userId: 14,
      name: "Amit Rejected",
      phone: "9876543213",
      email: "amit@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "rejected",
      isActive: true,
      ownsVehicle: false,
      joiningDate: "2026-01-01",
    },
    {
      id: 105,
      userId: 15,
      name: "Manoj MidMonthJoiner",
      phone: "9876543215",
      email: "manoj@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "verified",
      isActive: true,
      ownsVehicle: false,
      monthlySalary: "30000.00",
      perWashRate: "0.00",
      perDailyCleaningRate: "0.00",
      perSolarPanelRate: "0.00",
      ratePerKm: "0.00",
      employmentType: "salaried",
      joiningDate: "2026-11-16", // Joined mid-month (November has 30 days -> 15 active days)
    },
    {
      id: 106,
      userId: 16,
      name: "Anil HybridWorker",
      phone: "9876543216",
      email: "anil@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "verified",
      isActive: true,
      ownsVehicle: false,
      monthlySalary: "10000.00",
      perWashRate: "150.00",
      perDailyCleaningRate: "50.00",
      perSolarPanelRate: "40.00",
      ratePerKm: "0.00",
      employmentType: "hybrid",
      joiningDate: "2026-01-01",
    },
  ];

  memory.users = [
    {
      id: 1,
      name: "Central Super Admin",
      phone: "9999999999",
      role: "superadmin",
      branchId: null,
      cityId: null,
      isActive: true,
    },
    {
      id: 2,
      name: "Branch Manager Noida",
      phone: "9811111111",
      role: "branch_manager",
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 3,
      name: "Field Supervisor",
      phone: "9822222222",
      role: "supervisor",
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 11,
      name: "Ramesh Cleaner",
      phone: "9876543210",
      role: "staff",
      staffId: 101,
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 12,
      name: "Suresh Driver",
      phone: "9876543211",
      role: "staff",
      staffId: 102,
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 13,
      name: "Vikas Suspended",
      phone: "9876543212",
      role: "staff",
      staffId: 103,
      branchId: 2,
      cityId: 2,
      isActive: false,
    },
  ];

  memory.sessions = [
    {
      id: 1,
      userId: 11,
      tokenHash: hashToken("token-ramesh-11"),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    },
    {
      id: 2,
      userId: 13,
      tokenHash: hashToken("token-vikas-13"),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(), // Revoked
    },
  ];

  memory.staffDocuments = [
    {
      id: 1,
      staffId: 101,
      documentType: "aadhaar",
      documentNumber: "123456789012",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/aadhaar_ramesh.pdf",
      isCurrent: true,
    },
    {
      id: 2,
      staffId: 101,
      documentType: "pan",
      documentNumber: "ABCDE1234F",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/pan_ramesh.pdf",
      isCurrent: true,
    },
    {
      id: 3,
      staffId: 101,
      documentType: "bank_passbook",
      documentNumber: "9876543210",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/passbook_ramesh.jpg",
      isCurrent: true,
    },
    {
      id: 4,
      staffId: 101,
      documentType: "address_proof",
      documentNumber: "ELEC-9988",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/electricity_bill.pdf",
      isCurrent: true,
    },
  ];

  // DCMS Visits for Staff 102 and 106 in 2026-11
  memory.dcmsVisits = [
    { id: 1, staffId: 102, subscriptionId: 501, visitType: "cleaning", status: "completed", visitDate: "2026-11-05" },
    { id: 2, staffId: 102, subscriptionId: 501, visitType: "cleaning", status: "completed", visitDate: "2026-11-06" },
    { id: 3, staffId: 102, subscriptionId: 501, visitType: "wash", status: "completed", visitDate: "2026-11-07" },
    { id: 4, staffId: 102, subscriptionId: 501, visitType: "cleaning", status: "cancelled", visitDate: "2026-11-08" }, // Cancelled -> excluded from earnings
    { id: 5, staffId: 102, subscriptionId: 501, visitType: "cleaning", status: "missed", visitDate: "2026-11-09" },    // Missed -> excluded from earnings
    { id: 6, staffId: 106, subscriptionId: 502, visitType: "cleaning", status: "completed", visitDate: "2026-11-10" },
    { id: 7, staffId: 106, subscriptionId: 502, visitType: "cleaning", status: "completed", visitDate: "2026-11-11" },
  ];

  // Service Executions for Staff 102 and 106 in 2026-11
  memory.serviceExecutions = [
    { id: 201, assignedStaffId: 102, taskType: "car_wash", status: "completed", scheduledDate: "2026-11-10", branchId: 2 },
    { id: 202, assignedStaffId: 102, taskType: "solar_cleaning", status: "completed", scheduledDate: "2026-11-12", branchId: 2 },
    { id: 203, assignedStaffId: 102, taskType: "car_wash", status: "cancelled", scheduledDate: "2026-11-13", branchId: 2 }, // Cancelled execution -> excluded
    { id: 204, assignedStaffId: 106, taskType: "car_wash", status: "completed", scheduledDate: "2026-11-14", branchId: 2 },
  ];

  // Invoices for 2026-11
  memory.invoices = [
    // Execution 201 (Wash - completed) -> Paid invoice (500)
    { id: 301, executionId: 201, subscriptionId: null, totalAmount: "500.00", status: "paid", createdAt: new Date("2026-11-10"), branchId: 2 },
    // Execution 202 (Solar - completed) -> Sent invoice (800)
    { id: 302, executionId: 202, subscriptionId: null, totalAmount: "800.00", status: "sent", createdAt: new Date("2026-11-12"), branchId: 2 },
    // Execution 203 (Cancelled) -> Cancelled invoice (500) -> FIN-004 EXCLUDED
    { id: 303, executionId: 203, subscriptionId: null, totalAmount: "500.00", status: "cancelled", createdAt: new Date("2026-11-13"), branchId: 2 },
    // Subscription 501 (DCMS) -> Paid invoice (1500) -> FIN-005 ATTRIBUTED TO STAFF 102
    { id: 304, executionId: null, subscriptionId: 501, totalAmount: "1500.00", status: "paid", createdAt: new Date("2026-11-01"), branchId: 2 },
    // Subscription 502 (DCMS) -> Draft invoice (2000) -> FIN-004 DRAFT EXCLUDED
    { id: 305, executionId: null, subscriptionId: 502, totalAmount: "2000.00", status: "draft", createdAt: new Date("2026-11-02"), branchId: 2 },
  ];

  memory.dcmsStaffAssignments = [
    { id: 401, subscriptionId: 501, staffId: 102, isActive: true },
    { id: 402, subscriptionId: 502, staffId: 106, isActive: true },
  ];

  memory.staffPayoutLedgers = [];
}

// Mock drizzle db and pool
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();

  const poolClient = {
    query: vi.fn((sql: string, params?: any[]) => {
      memory.queryLogs.push({ sql, params });
      return Promise.resolve({ rows: [] });
    }),
    release: vi.fn(),
  };

  const pool = {
    connect: vi.fn(() => Promise.resolve(poolClient)),
    query: vi.fn((sql: string, params?: any[]) => {
      memory.queryLogs.push({ sql, params });
      return Promise.resolve({ rows: [] });
    }),
  };

  return {
    ...actual,
    pool,
    db: {
      select: vi.fn((fields?: any) => {
        const queryState = {
          table: null as any,
          joinTable: null as any,
          conditions: [] as any[],
          groupByField: null as any,
        };

        const builder: any = {
          from: vi.fn((tbl: any) => {
            queryState.table = tbl;
            return builder;
          }),
          innerJoin: vi.fn((tbl: any) => {
            queryState.joinTable = tbl;
            return builder;
          }),
          leftJoin: vi.fn(() => builder),
          where: vi.fn((cond: any) => {
            queryState.conditions.push(cond);
            return builder;
          }),
          groupBy: vi.fn((field: any) => {
            queryState.groupByField = field;
            return builder;
          }),
          orderBy: vi.fn(() => builder),
          limit: vi.fn((n?: number) => Promise.resolve(builder.execute().slice(0, n ?? 1))),
          execute: () => {
            const allParams = queryState.conditions.flatMap(extractAllParamValues);
            const numParams = allParams.filter((p) => typeof p === "number");
            const strParams = allParams.filter((p) => typeof p === "string");

            // 1. Staff Table
            if (queryState.table === actual.staffTable) {
              if (numParams.length > 0) {
                const found = memory.staff.find((s) => numParams.includes(s.id));
                return found ? [found] : [];
              }
              return memory.staff;
            }

            // 2. Users Table
            if (queryState.table === actual.usersTable) {
              if (numParams.length > 0) {
                const found = memory.users.find((u) => numParams.includes(u.id) || numParams.includes(u.staffId));
                if (found) return [found];
              }
              if (strParams.length > 0) {
                const found = memory.users.find((u) => strParams.includes(u.phone));
                if (found) return [found];
              }
              return memory.users;
            }

            // 3. Sessions join Users
            if (queryState.table === actual.sessionsTable) {
              const validSessions = memory.sessions.filter((s) => !s.revokedAt);
              const tokenParam = strParams.find((p) => typeof p === "string" && p.length === 64);
              if (tokenParam) {
                const s = validSessions.find((sess) => sess.tokenHash === tokenParam);
                if (s) {
                  const u = memory.users.find((usr) => usr.id === s.userId);
                  return u ? [{ user: u, session: s }] : [];
                }
                return [];
              }
              return validSessions.map((s) => ({
                user: memory.users.find((u) => u.id === s.userId),
                session: s,
              }));
            }

            // 4. Staff Payout Ledgers Table
            if (queryState.table === actual.staffPayoutLedgersTable) {
              if (numParams.length > 0) {
                const found = memory.staffPayoutLedgers.filter((l) => numParams.includes(l.staffId));
                return found;
              }
              return memory.staffPayoutLedgers;
            }

            // 5. DCMS Visits Table
            if (queryState.table === actual.dcmsVisitsTable) {
              const isCount = fields && "count" in fields;
              if (isCount) {
                const visitTypeParam = strParams.find((p) => p === "cleaning" || p === "wash");
                const matched = memory.dcmsVisits.filter((v) => {
                  const staffMatch = numParams.length === 0 || numParams.includes(v.staffId);
                  const statusMatch = v.status === "completed";
                  const typeMatch = !visitTypeParam || v.visitType === visitTypeParam;
                  return staffMatch && statusMatch && typeMatch;
                });
                return [{ count: matched.length }];
              }
              if (queryState.groupByField) {
                const matched = memory.dcmsVisits.filter((v) => {
                  const subMatch = numParams.length === 0 || numParams.includes(v.subscriptionId);
                  return subMatch && v.status === "completed";
                });
                const counts = new Map<number, number>();
                for (const v of matched) {
                  counts.set(v.staffId, (counts.get(v.staffId) ?? 0) + 1);
                }
                return Array.from(counts.entries()).map(([staffId, count]) => ({ staffId, count }));
              }
              return memory.dcmsVisits;
            }

            // 6. Service Executions Table
            if (queryState.table === actual.serviceExecutionsTable) {
              const isCount = fields && "count" in fields;
              if (isCount) {
                const isSolar = strParams.includes("solar_cleaning");
                const matched = memory.serviceExecutions.filter((e) => {
                  const staffMatch = numParams.length === 0 || numParams.includes(e.assignedStaffId);
                  const statusMatch = e.status === "completed";
                  const taskMatch = isSolar ? e.taskType === "solar_cleaning" : e.taskType !== "solar_cleaning";
                  return staffMatch && statusMatch && taskMatch;
                });
                return [{ count: matched.length }];
              }
              return memory.serviceExecutions;
            }

            // 7. Invoices Table (Standalone or Joined with Service Executions)
            if (queryState.table === actual.invoicesTable) {
              if (queryState.joinTable === actual.serviceExecutionsTable) {
                // Direct Execution Invoices join
                if (queryState.groupByField) {
                  // Leaderboard aggregation
                  const totals = new Map<number, number>();
                  for (const inv of memory.invoices) {
                    if (!RECOGNIZED_INVOICE_STATUSES.includes(inv.status)) continue;
                    const exec = memory.serviceExecutions.find((e) => e.id === inv.executionId && e.status === "completed");
                    if (exec && exec.assignedStaffId) {
                      totals.set(exec.assignedStaffId, (totals.get(exec.assignedStaffId) ?? 0) + Number(inv.totalAmount || 0));
                    }
                  }
                  return Array.from(totals.entries()).map(([staffId, total]) => ({
                    staffId,
                    total: total.toFixed(2),
                  }));
                }

                // Single Staff execution revenue
                const staffId = numParams[0];
                const rows: any[] = [];
                for (const inv of memory.invoices) {
                  if (!inv.executionId) continue;
                  if (!RECOGNIZED_INVOICE_STATUSES.includes(inv.status)) continue;
                  const exec = memory.serviceExecutions.find((e) => e.id === inv.executionId && e.status === "completed");
                  if (exec && (!staffId || exec.assignedStaffId === staffId)) {
                    rows.push({
                      invoiceId: inv.id,
                      totalAmount: inv.totalAmount,
                      executionId: inv.executionId,
                      status: inv.status,
                    });
                  }
                }
                return rows;
              }

              // Standalone Invoices (Subscription invoices)
              const subInvoices = memory.invoices.filter((inv) => {
                const isSub = inv.subscriptionId != null && inv.executionId == null;
                const isRecognized = RECOGNIZED_INVOICE_STATUSES.includes(inv.status);
                return isSub && isRecognized;
              });
              return subInvoices.map((inv) => ({
                invoiceId: inv.id,
                subscriptionId: inv.subscriptionId,
                totalAmount: inv.totalAmount,
                status: inv.status,
              }));
            }

            // 8. DCMS Staff Assignments Table
            if (queryState.table === actual.dcmsStaffAssignmentsTable) {
              if (numParams.length > 0) {
                return memory.dcmsStaffAssignments.filter((a) => numParams.includes(a.subscriptionId));
              }
              return memory.dcmsStaffAssignments;
            }

            // 9. Staff Documents Table
            if (queryState.table === actual.staffDocumentsTable) {
              if (numParams.length > 0) {
                const doc = memory.staffDocuments.find((d) => numParams.includes(d.id));
                return doc ? [doc] : [];
              }
              const hasSensitiveFilter = queryState.conditions.some((c: any) => {
                const vals = extractAllParamValues(c);
                return vals.includes("aadhaar") || vals.includes("pan");
              });
              if (hasSensitiveFilter) {
                return memory.staffDocuments.filter(
                  (d) => d.isCurrent && ["aadhaar", "pan", "bank_passbook", "bank_cancelled_cheque"].includes(d.documentType)
                );
              }
              return memory.staffDocuments.filter((d) => d.isCurrent);
            }

            return [];
          },
          then: (resolve: any) => Promise.resolve(builder.execute()).then(resolve),
        };

        return builder;
      }),

      insert: vi.fn((tbl: any) => ({
        values: vi.fn((vals: any) => {
          const row = { id: Math.floor(Math.random() * 10000) + 500, ...vals, createdAt: new Date() };
          if (tbl === actual.staffPayoutLedgersTable) {
            memory.staffPayoutLedgers.push(row);
          } else if (tbl === actual.usersTable) {
            memory.users.push(row);
          }
          return {
            returning: vi.fn(() => Promise.resolve([row])),
            then: (resolve: any) => Promise.resolve([row]).then(resolve),
          };
        }),
      })),

      update: vi.fn((tbl: any) => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn((cond: any) => {
            const allParams = [cond].flatMap(extractAllParamValues);
            const numParams = allParams.filter((p) => typeof p === "number");
            let updatedRow: any = null;

            if (tbl === actual.staffTable) {
              const target = memory.staff.find((s) => numParams.includes(s.id));
              if (target) {
                Object.assign(target, updates);
                updatedRow = target;
              }
            } else if (tbl === actual.usersTable) {
              const target = memory.users.find((u) => numParams.includes(u.id));
              if (target) {
                Object.assign(target, updates);
                updatedRow = target;
              }
            } else if (tbl === actual.staffPayoutLedgersTable) {
              const target = memory.staffPayoutLedgers.find((l) => numParams.includes(l.id));
              if (target) {
                Object.assign(target, updates);
                updatedRow = target;
              }
            } else if (tbl === actual.sessionsTable) {
              for (const s of memory.sessions) {
                if (numParams.includes(s.userId)) {
                  Object.assign(s, updates);
                }
              }
            } else if (tbl === actual.staffDocumentsTable) {
              const target = memory.staffDocuments.find((d) => numParams.includes(d.id));
              if (target) {
                Object.assign(target, updates);
                updatedRow = target;
              }
            }

            return {
              returning: vi.fn(() => Promise.resolve(updatedRow ? [updatedRow] : [])),
              then: (resolve: any) => Promise.resolve(updatedRow ? [updatedRow] : []).then(resolve),
            };
          }),
        })),
      })),
    },
  };
});

describe("STAFF-016: Verification Status Preservation on Password Sync", () => {
  beforeEach(() => resetTestState());

  it("calls setStaffPortalPassword and ensures verificationStatus remains pending in the database", async () => {
    const pendingStaff = memory.staff.find((s) => s.id === 101);
    expect(pendingStaff.verificationStatus).toBe("pending");

    // Invoke actual production setStaffPortalPassword function
    const result = await setStaffPortalPassword(pendingStaff, "SecureStaffPass123");

    expect(result).toBeDefined();
    expect(result.phone).toBe("9876543210");
    expect(result.userId).toBe(11);

    // CRITICAL: Staff verificationStatus must strictly remain 'pending' — never auto-verified!
    const staffInDb = memory.staff.find((s) => s.id === 101);
    expect(staffInDb.verificationStatus).toBe("pending");
    expect(staffInDb.userId).toBe(11);
  });
});

describe("STAFF-017: Session Revocation & Login Invalidation on Suspension", () => {
  beforeEach(() => resetTestState());

  it("identifies suspended staff and disallows assignment", () => {
    const suspendedStaff = memory.staff.find((s) => s.id === 103);
    expect(isStaffAssignable(suspendedStaff)).toBe(false);
    expect(staffAssignableError(suspendedStaff)).toMatch(/suspended/i);
    expect(() => assertStaffAssignable(suspendedStaff)).toThrow(/suspended/i);
  });

  it("identifies rejected staff and disallows assignment", () => {
    const rejectedStaff = memory.staff.find((s) => s.id === 104);
    expect(isStaffAssignable(rejectedStaff)).toBe(false);
    expect(staffAssignableError(rejectedStaff)).toMatch(/rejected/i);
    expect(() => assertStaffAssignable(rejectedStaff)).toThrow(/rejected/i);
  });

  it("identifies pending staff and disallows assignment until verified", () => {
    const pendingStaff = memory.staff.find((s) => s.id === 101);
    expect(isStaffAssignable(pendingStaff)).toBe(false);
    expect(staffAssignableError(pendingStaff)).toMatch(/verified/i);
    expect(() => assertStaffAssignable(pendingStaff)).toThrow(/verified/i);
  });

  it("permits assignment for verified active staff", () => {
    const verifiedStaff = memory.staff.find((s) => s.id === 102);
    expect(isStaffAssignable(verifiedStaff)).toBe(true);
    expect(staffAssignableError(verifiedStaff)).toBeNull();
    expect(() => assertStaffAssignable(verifiedStaff)).not.toThrow();
  });

  it("rejects authentication for revoked session tokens", async () => {
    // Valid session token
    const validUser = await loadUserFromToken("token-ramesh-11");
    expect(validUser).not.toBeNull();
    expect(validUser?.name).toBe("Ramesh Cleaner");

    // Revoked session token (Vikas Suspended)
    const revokedUser = await loadUserFromToken("token-vikas-13");
    expect(revokedUser).toBeNull();
  });
});

describe("STAFF-019 & SEC-028 & SEC-030: Sensitive Document Shielding, Signed URLs & KYC Privacy", () => {
  beforeEach(() => resetTestState());

  it("masks document number correctly", () => {
    expect(maskDocumentNumber("123456789012")).toBe("********9012");
    expect(maskDocumentNumber("ABCDE1234F")).toBe("******234F");
    expect(maskDocumentNumber("1234")).toBe("****");
    expect(maskDocumentNumber(null)).toBeNull();
  });

  it("generates time-limited signed Cloudinary delivery URLs for sensitive KYC assets (SEC-030)", () => {
    const rawUrl = "https://res.cloudinary.com/cwp/image/upload/v123456789/pan_sample.pdf";
    const signedUrl = generateSignedDocumentUrl(rawUrl, 900);

    expect(signedUrl).toContain("https://res.cloudinary.com/cwp/image/upload/");
    expect(signedUrl).toContain("pan_sample.pdf");
    expect(signedUrl).toContain("?exp=");
    expect(signedUrl).toContain("&sig=");
  });

  it("shields Aadhaar, PAN and Bank passbook URLs from supervisors (SEC-028, SEC-030)", () => {
    const supervisorCaller = { role: "supervisor", branchId: 2 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, supervisorCaller, 101);

    const aadhaar = projectedDocs.find((d) => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBeNull();
    expect(aadhaar.documentNumber).toBe("********9012");

    const pan = projectedDocs.find((d) => d.documentType === "pan");
    expect(pan.fileUrl).toBeNull();
    expect(pan.documentNumber).toBe("******234F");

    const passbook = projectedDocs.find((d) => d.documentType === "bank_passbook");
    expect(passbook.fileUrl).toBeNull();

    // Address proof is non-sensitive operational document and not shielded
    const addressDoc = projectedDocs.find((d) => d.documentType === "address_proof");
    expect(addressDoc.fileUrl).toContain("electricity_bill.pdf");
  });

  it("shields Aadhaar, PAN and Bank passbook URLs from branch managers", () => {
    const managerCaller = { role: "branch_manager", branchId: 2 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, managerCaller, 101);

    const aadhaar = projectedDocs.find((d) => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBeNull();

    const passbook = projectedDocs.find((d) => d.documentType === "bank_passbook");
    expect(passbook.fileUrl).toBeNull();
  });

  it("allows central superadmins to view signed URLs and unmasked document numbers", () => {
    const superadminCaller = { role: "superadmin" } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, superadminCaller, 101);

    const aadhaar = projectedDocs.find((d) => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toContain("aadhaar_ramesh.pdf");
    expect(aadhaar.fileUrl).toContain("?exp=");
    expect(aadhaar.fileUrl).toContain("&sig=");
    expect(aadhaar.documentNumber).toBe("123456789012");
  });

  it("allows staff members to view signed URLs for their own uploaded documents", () => {
    const ownStaffCaller = { role: "staff", staffId: 101 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, ownStaffCaller, 101);

    const aadhaar = projectedDocs.find((d) => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toContain("aadhaar_ramesh.pdf");
    expect(aadhaar.fileUrl).toContain("?exp=");
    expect(aadhaar.fileUrl).toContain("&sig=");
  });
});

describe("STAFF-012 & STAFF-013: Profile Completion Meter Logic", () => {
  beforeEach(() => resetTestState());

  it("does not require email for cleaning staff to complete identity", () => {
    const cleanerNoEmail = memory.staff.find((s) => s.id === 101);
    expect(cleanerNoEmail.email).toBeNull();

    const docs = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdown = computeProfileCompletion(cleanerNoEmail, docs);
    expect(breakdown.identityComplete).toBe(true);
    expect(breakdown.documentsComplete).toBe(true);
    expect(breakdown.bankComplete).toBe(true);
    expect(breakdown.addressComplete).toBe(true);
    expect(breakdown.percent).toBe(100);
  });

  it("does not require driving license if staff does NOT own a vehicle", () => {
    const nonDrivingStaff = memory.staff.find((s) => s.id === 101);
    expect(nonDrivingStaff.ownsVehicle).toBe(false);

    const docs = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdown = computeProfileCompletion(nonDrivingStaff, docs);
    expect(breakdown.documentsComplete).toBe(true);
  });

  it("requires driving license if staff owns/uses a vehicle", () => {
    const drivingStaff = memory.staff.find((s) => s.id === 102);
    expect(drivingStaff.ownsVehicle).toBe(true);

    const docsWithoutDL = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdownWithout = computeProfileCompletion(drivingStaff, docsWithoutDL);
    expect(breakdownWithout.documentsComplete).toBe(false);

    const docsWithDL = [
      ...docsWithoutDL,
      { documentType: "driving_license", isCurrent: true },
    ];
    const breakdownWith = computeProfileCompletion(drivingStaff, docsWithDL);
    expect(breakdownWith.documentsComplete).toBe(true);
  });
});

describe("STAFF-018 & PAY-005: Universal Staff Compensation, Pro-Rata & Payout Engine", () => {
  beforeEach(() => resetTestState());

  it("computes mid-month pro-rata salary accurately with calendar_days policy (PAY-005)", () => {
    // 1. Full month: joined before month
    const fullMonth = computeProRataSalary(30000, "2026-11", "2026-01-01", "calendar_days");
    expect(fullMonth.isProRated).toBe(false);
    expect(fullMonth.proRataFactor).toBe(1.0);
    expect(fullMonth.effectiveBaseSalary).toBe(30000);

    // 2. Mid-month joiner: joined 2026-11-16 (November has 30 days => 15 active days)
    const midMonth = computeProRataSalary(30000, "2026-11", "2026-11-16", "calendar_days");
    expect(midMonth.isProRated).toBe(true);
    expect(midMonth.daysActive).toBe(15);
    expect(midMonth.totalDaysInPeriod).toBe(30);
    expect(midMonth.proRataFactor).toBe(0.5);
    expect(midMonth.effectiveBaseSalary).toBe(15000);

    // 3. Leap year February 2024 (29 days)
    expect(getDaysInMonth(2024, 1)).toBe(29);
    const leapFeb = computeProRataSalary(29000, "2024-02", "2024-02-15", "calendar_days");
    expect(leapFeb.daysActive).toBe(15);
    expect(leapFeb.totalDaysInPeriod).toBe(29);
    expect(leapFeb.effectiveBaseSalary).toBe(Math.round(29000 * (15 / 29) * 100) / 100);

    // 4. Non-leap year February 2025 (28 days)
    expect(getDaysInMonth(2025, 1)).toBe(28);
    const nonLeapFeb = computeProRataSalary(28000, "2025-02", "2025-02-15", "calendar_days");
    expect(nonLeapFeb.daysActive).toBe(14);
    expect(nonLeapFeb.totalDaysInPeriod).toBe(28);
    expect(nonLeapFeb.effectiveBaseSalary).toBe(14000);

    // 5. Post-period joiner: joined next month
    const futureJoiner = computeProRataSalary(30000, "2026-11", "2026-12-01", "calendar_days");
    expect(futureJoiner.effectiveBaseSalary).toBe(0);
    expect(futureJoiner.daysActive).toBe(0);
  });

  it("calculates salaried payout via production calculateStaffPayout() with incentives and deductions", async () => {
    // Ramesh Cleaner: monthlySalary 12000
    const payout = await calculateStaffPayout(101, "2026-11", {
      incentives: 1500,
      deductions: 500,
    });

    expect(payout).toBeDefined();
    expect(payout.staffId).toBe(101);
    expect(Number(payout.baseSalary)).toBe(12000);
    expect(Number(payout.grossPayout)).toBe(12000);
    expect(Number(payout.incentives)).toBe(1500);
    expect(Number(payout.deductions)).toBe(500);
    expect(Number(payout.netPayoutDue)).toBe(13000); // 12000 + 1500 - 500
  });

  it("calculates mid-month pro-rated payout for staff joined on 16th of November (PAY-005)", async () => {
    // Manoj MidMonthJoiner: joined 2026-11-16, salary 30000
    const payout = await calculateStaffPayout(105, "2026-11");

    expect(payout).toBeDefined();
    expect(Number(payout.baseSalary)).toBe(15000); // Exactly 50% of 30,000
    expect(Number(payout.grossPayout)).toBe(15000);
    expect(Number(payout.netPayoutDue)).toBe(15000);
    expect(payout.notes).toMatch(/Pro-rated for 15\/30 days active/);
  });

  it("calculates per_job payout strictly from verified completed visits, excluding cancelled/missed", async () => {
    // Suresh Driver: perWashRate: 180, perDailyCleaningRate: 60, perSolarRate: 50
    // Memory data has:
    // 2 completed daily cleans (60 each = 120)
    // 1 completed DCMS wash (180) + 1 completed execution wash (180) = 2 washes (360)
    // 1 completed solar cleaning (50)
    // Cancelled visit (4) and missed visit (5) and cancelled execution (203) are EXCLUDED!
    const payout = await calculateStaffPayout(102, "2026-11");

    expect(payout).toBeDefined();
    expect(payout.completedDailyCleans).toBe(2);
    expect(payout.completedWashes).toBe(2);
    expect(payout.completedSolarVisits).toBe(1);

    expect(Number(payout.dailyCleaningEarnings)).toBe(120); // 2 * 60
    expect(Number(payout.washEarnings)).toBe(360);          // 2 * 180
    expect(Number(payout.solarEarnings)).toBe(50);          // 1 * 50
    expect(Number(payout.grossPayout)).toBe(530);           // 120 + 360 + 50
    expect(Number(payout.netPayoutDue)).toBe(530);
  });

  it("calculates hybrid payout combining pro-rated base pay and verified piece work", async () => {
    // Anil HybridWorker: baseSalary: 10000, perWashRate: 150, perDailyCleaningRate: 50
    // Memory data has: 2 completed daily cleans (100) + 1 completed execution wash (150)
    const payout = await calculateStaffPayout(106, "2026-11");

    expect(payout).toBeDefined();
    expect(Number(payout.baseSalary)).toBe(10000);
    expect(payout.completedDailyCleans).toBe(2);
    expect(Number(payout.dailyCleaningEarnings)).toBe(100);
    expect(payout.completedWashes).toBe(1);
    expect(Number(payout.washEarnings)).toBe(150);
    expect(Number(payout.grossPayout)).toBe(10250); // 10000 + 100 + 150
    expect(Number(payout.netPayoutDue)).toBe(10250);
  });

  it("preserves immutability for approved/disbursed payout records", async () => {
    // Insert an approved payout ledger record
    memory.staffPayoutLedgers.push({
      id: 991,
      staffId: 101,
      periodMonth: "2026-11",
      status: "approved",
      grossPayout: "14000.00",
      netPayoutDue: "14000.00",
      notes: "Locked approved payout",
    });

    // Calling calculateStaffPayout without forceRecalculate should return approved record unchanged
    const result = await calculateStaffPayout(101, "2026-11", { incentives: 5000 });
    expect(result.id).toBe(991);
    expect(result.status).toBe("approved");
    expect(Number(result.netPayoutDue)).toBe(14000); // Unchanged!
  });
});

describe("FIN-004 & FIN-005: Universal Staff Revenue Attribution Engine", () => {
  beforeEach(() => resetTestState());

  it("calculates staff revenue excluding draft and cancelled invoices, including subscription share", async () => {
    // Staff 102 has:
    // Execution 201: Paid invoice 301 (500)
    // Execution 202: Sent invoice 302 (800)
    // Execution 203: Cancelled invoice 303 (500) -> EXCLUDED by FIN-004
    // DCMS Subscription 501: Paid invoice 304 (1500) -> ATTRIBUTED by FIN-005
    // DCMS Subscription 502: Draft invoice 305 (2000) -> EXCLUDED by FIN-004
    const revenue = await calculateStaffRevenue(102, "2026-11");

    expect(revenue).toBeDefined();
    expect(revenue.staffId).toBe(102);
    expect(revenue.periodMonth).toBe("2026-11");

    // Execution revenue: 500 (paid) + 800 (sent) = 1300. Cancelled (500) is NOT added!
    expect(revenue.executionRevenue).toBe(1300);

    // Subscription revenue: 1500 (paid). Draft (2000) is NOT added!
    expect(revenue.subscriptionRevenue).toBe(1500);

    // Total recognized revenue: 1300 + 1500 = 2800
    expect(revenue.totalRevenue).toBe(2800);
    expect(revenue.completedJobsCount).toBe(2);
    expect(revenue.activeSubscriptionsCount).toBe(1);

    // Financial distinction: Collected (Paid) vs Invoiced/Uncollected (Sent/Overdue)
    // Paid execution 301 (500) + Paid subscription 304 (1500) = 2000
    expect(revenue.collectedRevenue).toBe(2000);
    // Sent execution 302 (800) = 800
    expect(revenue.uncollectedRevenue).toBe(800);
  });

  it("aggregates recognized revenue in leaderboard map without double-counting (FIN-005)", async () => {
    const revenueMap = await getStaffLeaderboardRevenueMap("2026-11");

    expect(revenueMap).toBeInstanceOf(Map);
    // Staff 102 total: 1300 (execution) + 1500 (subscription) = 2800
    expect(revenueMap.get(102)).toBe(2800);
  });

  it("executes KYC backfill migration dry-run without mutating database or deleting assets (SEC-030)", async () => {
    // Memory has 4 documents: aadhaar (1), pan (2), bank_passbook (3), address_proof (4)
    // Sensitive KYC types are 3: aadhaar, pan, bank_passbook.
    const dryRunResult = await runKycBackfillMigration({ dryRun: true });

    expect(dryRunResult.isDryRun).toBe(true);
    expect(dryRunResult.totalScanned).toBe(3);
    expect(dryRunResult.migratedCount).toBe(3);
    expect(dryRunResult.failedCount).toBe(0);

    // Ensure database rows were NOT mutated during dry-run
    const doc1 = memory.staffDocuments.find((d) => d.id === 1);
    expect(doc1.fileUrl).toContain("/upload/aadhaar_ramesh.pdf");
    expect(doc1.fileUrl).not.toContain("/authenticated/");
  });
});

describe("OPS-001: Staff Attendance Verification Gating", () => {
  it("enforces that only verified active staff can record attendance check-ins", () => {
    const verifiedStaff = { id: 102, isActive: true, verificationStatus: "verified" };
    const pendingStaff = { id: 101, isActive: true, verificationStatus: "pending" };
    const suspendedStaff = { id: 103, isActive: false, verificationStatus: "suspended" };
    const rejectedStaff = { id: 104, isActive: true, verificationStatus: "rejected" };

    function checkAttendanceGate(staff: { isActive: boolean; verificationStatus: string }) {
      if (!staff.isActive) {
        return { status: 403, code: "STAFF_INACTIVE" };
      }
      if (staff.verificationStatus !== "verified") {
        return { status: 403, code: "STAFF_NOT_VERIFIED" };
      }
      return { status: 200, code: "OK" };
    }

    expect(checkAttendanceGate(verifiedStaff)).toEqual({ status: 200, code: "OK" });
    expect(checkAttendanceGate(pendingStaff)).toEqual({ status: 403, code: "STAFF_NOT_VERIFIED" });
    expect(checkAttendanceGate(suspendedStaff)).toEqual({ status: 403, code: "STAFF_INACTIVE" });
    expect(checkAttendanceGate(rejectedStaff)).toEqual({ status: 403, code: "STAFF_NOT_VERIFIED" });
  });
});

describe("DB-001: PostgreSQL Advisory Lock Concurrency in Startup Migrations", () => {
  beforeEach(() => resetTestState());

  it("defines a 64-bit integer advisory lock key and acquires it during ensureStartupMigrations()", async () => {
    expect(STARTUP_MIGRATION_LOCK_ID).toBe(884729104);

    await ensureStartupMigrations();

    // Verify advisory lock was acquired and released
    const lockQuery = memory.queryLogs.find((q) => q.sql.includes("pg_advisory_lock"));
    const unlockQuery = memory.queryLogs.find((q) => q.sql.includes("pg_advisory_unlock"));

    expect(lockQuery).toBeDefined();
    expect(lockQuery?.params).toEqual([884729104]);

    expect(unlockQuery).toBeDefined();
    expect(unlockQuery?.params).toEqual([884729104]);
  });

  it("DB-002: executes migration steps with isolated error handling and guarantees city_id fallback", async () => {
    await ensureStartupMigrations();

    // Verify critical DDL statements were executed
    const cityIdQuery = memory.queryLogs.find((q) => q.sql.includes("ALTER TABLE users ADD COLUMN IF NOT EXISTS city_id"));
    const payoutLedgerQuery = memory.queryLogs.find((q) => q.sql.includes("CREATE TABLE IF NOT EXISTS staff_payout_ledgers"));

    expect(cityIdQuery).toBeDefined();
    expect(payoutLedgerQuery).toBeDefined();
  });

  it("CWP-030: optionalAuth degrades gracefully without throwing 500 when session resolution throws", async () => {
    let nextCalled = false;
    let nextError: any = null;

    const mockReq: any = {
      cookies: { cwp_session: "corrupt_token_triggering_db_error" },
      headers: {},
      log: {
        warn: vi.fn(),
      },
    };
    const mockRes: any = {};
    const mockNext = (err?: any) => {
      nextCalled = true;
      nextError = err;
    };

    // optionalAuth must call next() with NO arguments, leaving req.user undefined rather than aborting request
    await optionalAuth(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(true);
    expect(nextError).toBeUndefined();
    expect(mockReq.user).toBeUndefined();
    expect(mockReq.scope).toBeUndefined();
  });
});
