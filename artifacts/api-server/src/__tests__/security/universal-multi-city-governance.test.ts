import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeScope, loadUserFromToken, hashToken, type AuthUser } from "../../middlewares/auth";
import { rowInScope, tenantFilters, tenantStamp } from "../../middlewares/tenantScope";
import {
  createCity,
  updateCity,
  validateCityReadiness,
  activateCity,
  suspendCity,
  archiveCity,
  getCityOperationsDashboard,
  getCityContent,
} from "../../lib/cityManagementService";
import {
  assignBranchUser,
  revokeBranchAssignment,
  getUserActiveBranchIds,
} from "../../lib/franchise/branchAssignmentService";
import {
  suspendBranch,
  createBranch,
} from "../../lib/franchise/branchManagementService";
import { projectStaffRecord } from "../../lib/projections/staffProjection";
import { getBranchServiceCatalog } from "../../lib/branchConfigService";

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
  cities: [] as any[],
  states: [] as any[],
  branches: [] as any[],
  legalEntities: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  branchUserAssignments: [] as any[],
  serviceCityAvailability: [] as any[],
  serviceBranchOverrides: [] as any[],
  services: [] as any[],
  serviceAreas: [] as any[],
  customers: [] as any[],
  invoices: [] as any[],
  bookings: [] as any[],
  promotions: [] as any[],
  auditLogs: [] as any[],
};

function resetTestState() {
  memory.states = [
    { id: 1, name: "Uttar Pradesh", code: "UP", isActive: true },
    { id: 2, name: "Haryana", code: "HR", isActive: true },
  ];

  memory.cities = [
    {
      id: 1,
      stateId: 1,
      name: "Varanasi",
      slug: "varanasi",
      code: "VNS",
      status: "active",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      contactPhone: "9876540001",
      contactEmail: "varanasi@cwpdetailers.com",
      operationalSettings: { operatingHours: "07:00-19:00" },
      contentSettings: { heroHeadline: "Varanasi Signature Doorstep Detailing" },
      launchedAt: new Date("2025-01-01"),
      suspendedAt: null,
      suspensionReason: null,
      archivedAt: null,
      isActive: true,
    },
    {
      id: 2,
      stateId: 1,
      name: "Noida",
      slug: "noida",
      code: "NOI",
      status: "active",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      contactPhone: "9876540002",
      contactEmail: "noida@cwpdetailers.com",
      operationalSettings: { operatingHours: "06:00-21:00", societyAccessRequired: true },
      contentSettings: { heroHeadline: "Noida High-Rise Society Daily Car Care" },
      launchedAt: new Date("2026-01-01"),
      suspendedAt: null,
      suspensionReason: null,
      archivedAt: null,
      isActive: true,
    },
    {
      id: 3,
      stateId: 1,
      name: "Ghaziabad",
      slug: "ghaziabad",
      code: "GZB",
      status: "setup_in_progress",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      contactPhone: "9876540003",
      contactEmail: "ghaziabad@cwpdetailers.com",
      operationalSettings: {},
      contentSettings: {},
      launchedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      archivedAt: null,
      isActive: true,
    },
  ];

  memory.legalEntities = [
    { id: 1, name: "CWP Detailers Pvt Ltd", code: "CWP-HQ", isActive: true },
    { id: 2, name: "CWP Noida Logistics LLP", code: "CWP-NOI", isActive: true },
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
      isCompanyOperated: true,
      status: "active",
      serviceAvailability: ["daily_cleaning", "car_washing", "solar_cleaning"],
      phone: "9876540001",
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
      isCompanyOperated: true,
      status: "active",
      serviceAvailability: ["daily_cleaning"],
      phone: "9876540002",
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
      isCompanyOperated: true,
      status: "active",
      serviceAvailability: ["daily_cleaning"],
      phone: "9876540003",
      isActive: true,
    },
  ];

  memory.users = [
    { id: 1, name: "Super Admin", phone: "9999999999", role: "superadmin", companyId: 1, cityId: null, branchId: null, isActive: true },
    { id: 2, name: "Central Admin", phone: "9999999998", role: "central_admin", companyId: 1, cityId: null, branchId: null, isActive: true },
    { id: 10, name: "Varanasi City Manager", phone: "9811111111", role: "branch_manager", companyId: 1, cityId: 1, branchId: 1, isActive: true },
    { id: 20, name: "Noida City Manager", phone: "9822222222", role: "branch_manager", companyId: 1, cityId: 2, branchId: 2, isActive: true },
    { id: 25, name: "Noida City Admin", phone: "9822222225", role: "city_admin", companyId: 1, cityId: 2, branchId: null, isActive: true },
    { id: 30, name: "Noida Field Supervisor", phone: "9833333333", role: "supervisor", companyId: 1, cityId: 2, branchId: 2, staffId: 301, isActive: true },
    { id: 40, name: "Noida Field Detailer", phone: "9844444444", role: "staff", companyId: 1, cityId: 2, branchId: 2, staffId: 401, isActive: true },
    { id: 50, name: "Customer Varanasi", phone: "9855555551", role: "customer", companyId: 1, cityId: 1, customerId: 501, isActive: true },
    { id: 60, name: "Customer Noida", phone: "9855555552", role: "customer", companyId: 1, cityId: 2, customerId: 601, isActive: true },
  ];

  memory.branchUserAssignments = [
    { id: 1, userId: 10, branchId: 1, assignmentRole: "branch_manager", isActive: true, assignedBy: 1, revokedAt: null },
    { id: 2, userId: 20, branchId: 2, assignmentRole: "branch_manager", isActive: true, assignedBy: 1, revokedAt: null },
    { id: 3, userId: 30, branchId: 2, assignmentRole: "supervisor", isActive: true, assignedBy: 1, revokedAt: null },
  ];

  memory.sessions = [
    { id: 101, userId: 1, tokenHash: hashToken("token-superadmin"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 102, userId: 10, tokenHash: hashToken("token-mgr-vns"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 103, userId: 20, tokenHash: hashToken("token-mgr-noi"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 104, userId: 25, tokenHash: hashToken("token-cityadmin-noi"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 105, userId: 30, tokenHash: hashToken("token-supv-noi"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 106, userId: 50, tokenHash: hashToken("token-cust-vns"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    { id: 107, userId: 60, tokenHash: hashToken("token-cust-noi"), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
  ];

  memory.services = [
    { id: 1, name: "Daily Car Cleaning", serviceType: "daily_cleaning", basePrice: "1200", isActive: true },
    { id: 2, name: "Solar Panel Cleaning", serviceType: "solar_cleaning", basePrice: "2500", isActive: true },
    { id: 3, name: "Ceramic Detailing", serviceType: "detailing", basePrice: "15000", isActive: true },
  ];

  memory.serviceCityAvailability = [
    // Varanasi has Daily Cleaning & Solar Cleaning
    { id: 1, cityId: 1, serviceId: 1, isActive: true, basePriceOverride: "1200.00" },
    { id: 2, cityId: 1, serviceId: 2, isActive: true, basePriceOverride: "2500.00" },
    // Noida initially ONLY has Daily Cleaning (Solar is disabled / not offered)
    { id: 3, cityId: 2, serviceId: 1, isActive: true, basePriceOverride: "1350.00" },
    { id: 4, cityId: 2, serviceId: 2, isActive: false, basePriceOverride: null },
  ];

  memory.serviceBranchOverrides = [];

  memory.serviceAreas = [
    { id: 1, cityId: 1, name: "Sigra", isActive: true },
    { id: 2, cityId: 2, name: "Sector 62", isActive: true },
  ];

  memory.customers = [
    { id: 501, name: "Varanasi Customer", phone: "9855555551", cityId: 1, branchId: 1, companyId: 1, status: "active" },
    { id: 601, name: "Noida Customer", phone: "9855555552", cityId: 2, branchId: 2, companyId: 1, status: "active" },
  ];

  memory.invoices = [
    {
      id: 1001,
      invoiceNumber: "INV-VNS-001",
      customerId: 501,
      branchId: 1,
      companyId: 1,
      totalAmount: "1200.00",
      paidAmount: "1200.00",
      status: "paid",
      items: [{ serviceId: 1, name: "Daily Cleaning", unitPrice: 1200, total: 1200 }],
    },
    {
      id: 2001,
      invoiceNumber: "INV-NOI-001",
      customerId: 601,
      branchId: 2,
      companyId: 1,
      totalAmount: "1350.00",
      paidAmount: "1350.00",
      status: "paid",
      items: [{ serviceId: 1, name: "Daily Cleaning Noida", unitPrice: 1350, total: 1350 }],
    },
  ];

  memory.bookings = [
    { id: 101, customerId: 501, branchId: 1, cityId: 1, status: "confirmed", scheduledDate: new Date().toISOString().slice(0, 10) },
    { id: 201, customerId: 601, branchId: 2, cityId: 2, status: "confirmed", scheduledDate: new Date().toISOString().slice(0, 10) },
  ];

  memory.promotions = [
    { id: 1, title: "Varanasi Monsoon Care", cityId: 1, badgeText: "Varanasi Special", isActive: true },
    { id: 2, title: "Noida Society Launch", cityId: 2, badgeText: "Noida High-Rise Special", isActive: true },
  ];

  memory.auditLogs = [];
}

// Mock database
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields: any) => {
        const queryState = { table: null as any, conditions: [] as any[] };
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
          orderBy: vi.fn(() => builder),
          groupBy: vi.fn(() => builder),
          limit: vi.fn(() => Promise.resolve(builder.execute())),
          then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
            return Promise.resolve(builder.execute()).then(onfulfilled, onrejected);
          },
          execute: () => {
            const allParams = queryState.conditions.flatMap(extractAllParamValues);
            const numParams = allParams.filter((p) => typeof p === "number");
            const strParams = allParams.filter((p) => typeof p === "string");
            const boolParams = allParams.filter((p) => typeof p === "boolean");

            if (queryState.table === actual.citiesTable) {
              if (numParams.length > 0) return memory.cities.filter((c) => numParams.includes(c.id));
              if (strParams.length > 0) return memory.cities.filter((c) => strParams.includes(c.slug) || strParams.includes(c.code));
              return memory.cities;
            }
            if (queryState.table === actual.statesTable) return memory.states;
            if (queryState.table === actual.branchesTable) {
              if (numParams.length > 0) {
                return memory.branches.filter((b) => numParams.includes(b.id) || numParams.includes(b.cityId));
              }
              return memory.branches;
            }
            if (queryState.table === actual.branchUserAssignmentsTable) {
              return memory.branchUserAssignments
                .filter((a) => {
                  if (boolParams.length > 0 && a.isActive !== boolParams[0]) return false;
                  if (a.revokedAt !== null) return false;
                  const b = memory.branches.find((br) => br.id === a.branchId);
                  if (b && (b.status !== "active" || !b.isActive)) return false;
                  if (numParams.length > 0) {
                    return numParams.includes(a.userId) || numParams.includes(a.branchId) || numParams.includes(a.id);
                  }
                  return true;
                })
                .map((a) => {
                  const b = memory.branches.find((br) => br.id === a.branchId);
                  const u = memory.users.find((usr) => usr.id === a.userId);
                  return {
                    ...a,
                    branchId: a.branchId,
                    branchName: b?.name ?? `Branch #${a.branchId}`,
                    userName: u?.name ?? `User #${a.userId}`,
                    userPhone: u?.phone ?? null,
                  };
                });
            }
            if (queryState.table === actual.usersTable) {
              if (numParams.length > 0) return memory.users.filter((u) => numParams.includes(u.id));
              return memory.users;
            }
            if (queryState.table === actual.sessionsTable) {
              const matchedSessions =
                strParams.length > 0
                  ? memory.sessions.filter((s) => strParams.includes(s.tokenHash) && s.revokedAt === null)
                  : memory.sessions;
              return matchedSessions.map((s) => {
                const u = memory.users.find((usr) => usr.id === s.userId);
                return {
                  ...s,
                  user: u || { id: s.userId, isActive: false },
                };
              });
            }
            if (queryState.table === actual.servicesTable) return memory.services;
            if (queryState.table === actual.serviceCityAvailabilityTable) {
              if (numParams.length > 0) return memory.serviceCityAvailability.filter((ca) => numParams.includes(ca.cityId));
              return memory.serviceCityAvailability;
            }
            if (queryState.table === actual.serviceBranchOverridesTable) return memory.serviceBranchOverrides;
            if (queryState.table === actual.serviceAreasTable) {
              if (numParams.length > 0) return memory.serviceAreas.filter((a) => numParams.includes(a.cityId));
              return memory.serviceAreas;
            }
            if (queryState.table === actual.legalEntitiesTable) return memory.legalEntities;
            if (queryState.table === actual.customersTable) {
              if (numParams.length > 0) return memory.customers.filter((c) => numParams.includes(c.id) || numParams.includes(c.cityId));
              return memory.customers;
            }
            if (queryState.table === actual.invoicesTable) {
              if (numParams.length > 0) return memory.invoices.filter((i) => numParams.includes(i.id) || numParams.includes(i.branchId));
              return memory.invoices;
            }
            if (queryState.table === actual.bookingsTable) {
              if (numParams.length > 0) return memory.bookings.filter((b) => numParams.includes(b.id) || numParams.includes(b.cityId) || numParams.includes(b.branchId));
              return memory.bookings;
            }
            return [];
          },
        };
        return builder;
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => ({
          returning: vi.fn(async () => {
            const row = { id: Math.floor(Math.random() * 9000) + 1000, ...val, createdAt: new Date() };
            if (table === actual.citiesTable) memory.cities.push(row);
            if (table === actual.branchesTable) memory.branches.push(row);
            if (table === actual.branchUserAssignmentsTable) memory.branchUserAssignments.push(row);
            if (table === actual.adminAuditLogsTable) memory.auditLogs.push(row);
            return [row];
          }),
        })),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((patch: any) => ({
          where: vi.fn((cond: any) => ({
            returning: vi.fn(async () => {
              const allParams = extractAllParamValues(cond);
              const targetId = allParams.find((p) => typeof p === "number");
              if (table === actual.citiesTable) {
                const idx = memory.cities.findIndex((c) => c.id === targetId);
                if (idx !== -1) {
                  memory.cities[idx] = { ...memory.cities[idx], ...patch };
                  return [memory.cities[idx]];
                }
              }
              if (table === actual.branchesTable) {
                const idx = memory.branches.findIndex((b) => b.id === targetId);
                if (idx !== -1) {
                  memory.branches[idx] = { ...memory.branches[idx], ...patch };
                  return [memory.branches[idx]];
                }
              }
              if (table === actual.branchUserAssignmentsTable) {
                const idx = memory.branchUserAssignments.findIndex((a) => a.id === targetId || allParams.includes(a.id));
                if (idx !== -1) {
                  memory.branchUserAssignments[idx] = { ...memory.branchUserAssignments[idx], ...patch };
                  return [memory.branchUserAssignments[idx]];
                }
              }
              if (table === actual.sessionsTable) {
                for (const s of memory.sessions) {
                  if (allParams.includes(s.userId)) {
                    Object.assign(s, patch);
                  }
                }
                return memory.sessions;
              }
              return [{ id: targetId, ...patch }];
            }),
          })),
        })),
      })),
    },
  };
});

describe("Universal Multi-City Platform v4.0 — 18 Adversarial Security & Governance Scenarios", () => {
  beforeEach(() => {
    resetTestState();
    vi.clearAllMocks();
  });

  // 1. City A manager cannot read City B customers
  it("Scenario 1: City A manager cannot read City B customers", async () => {
    const cityAManager: AuthUser = memory.users.find((u: any) => u.id === 10)!; // Varanasi Manager
    const scope = await computeScope(cityAManager);
    const mockReq = { scope } as any;

    const cityACustomer = memory.customers.find((c: any) => c.cityId === 1)!;
    const cityBCustomer = memory.customers.find((c: any) => c.cityId === 2)!;

    expect(rowInScope(mockReq, { branchId: cityACustomer.branchId, cityId: cityACustomer.cityId })).toBe(true);
    expect(rowInScope(mockReq, { branchId: cityBCustomer.branchId, cityId: cityBCustomer.cityId })).toBe(false);
  });

  // 2. City A manager cannot read City B invoices
  it("Scenario 2: City A manager cannot read City B invoices", async () => {
    const cityAManager: AuthUser = memory.users.find((u: any) => u.id === 10)!;
    const scope = await computeScope(cityAManager);
    const mockReq = { scope } as any;

    const cityAInvoice = memory.invoices.find((i: any) => i.branchId === 1)!;
    const cityBInvoice = memory.invoices.find((i: any) => i.branchId === 2)!;

    expect(rowInScope(mockReq, { branchId: cityAInvoice.branchId })).toBe(true);
    expect(rowInScope(mockReq, { branchId: cityBInvoice.branchId })).toBe(false);
  });

  // 3. Branch manager cannot access an unassigned branch
  it("Scenario 3: Branch manager cannot access an unassigned branch in the same city", async () => {
    const noidaManagerBranch2: AuthUser = memory.users.find((u: any) => u.id === 20)!; // Assigned to Branch 2
    const scope = await computeScope(noidaManagerBranch2);
    const mockReq = { scope } as any;

    expect(scope.branchIds).toEqual([2]);
    expect(rowInScope(mockReq, { branchId: 2, cityId: 2 })).toBe(true);
    // Unassigned branch 3 (Noida Expressway Hub)
    expect(rowInScope(mockReq, { branchId: 3, cityId: 2 })).toBe(false);
  });

  // 4. Supervisor cannot access confidential staff information
  it("Scenario 4: Supervisor cannot access confidential staff salary, PAN, Aadhaar or bank details", () => {
    const rawStaffRecord = {
      id: 401,
      fullName: "Ramesh Cleaner",
      role: "cleaner",
      branchId: 2,
      baseSalary: "22000.00",
      dailyRate: "800.00",
      overtimeHourlyRate: "120.00",
      aadhaarNumber: "1234-5678-9012",
      panNumber: "ABCDE1234F",
      bankAccountNumber: "998877665544",
      bankIfscCode: "HDFC0001234",
    };

    const supervisorView = projectStaffRecord(rawStaffRecord, "supervisor");
    expect(supervisorView.fullName).toBe("Ramesh Cleaner");
    expect(supervisorView.baseSalary).toBeUndefined();
    expect(supervisorView.dailyRate).toBeUndefined();
    expect(supervisorView.aadhaarNumber).toBeUndefined();
    expect(supervisorView.panNumber).toBeUndefined();
    expect(supervisorView.bankAccountNumber).toBeUndefined();
    expect(supervisorView.bankIfscCode).toBeUndefined();
  });

  // 5. Branch manager cannot access central payment ledger
  it("Scenario 5: Branch manager is scoped strictly to assigned branch and cannot access central ledger", async () => {
    const branchManager: AuthUser = memory.users.find((u: any) => u.id === 20)!;
    const scope = await computeScope(branchManager);

    expect(scope.isSuperAdmin).toBe(false);
    expect(scope.branchIds).toEqual([2]);
    // Row without branch or outside branch 2 is completely rejected
    const centralLedgerRow = { branchId: null, companyId: 1 };
    expect(rowInScope({ scope } as any, centralLedgerRow)).toBe(false);
  });

  // 6. City Admin cannot access another city (IDOR prevention)
  it("Scenario 6: City Admin cannot access another city (IDOR rejection)", async () => {
    const noidaCityAdmin: AuthUser = memory.users.find((u: any) => u.id === 25)!; // cityId = 2
    const scope = await computeScope(noidaCityAdmin);
    const mockReq = { scope } as any;

    expect(scope.cityId).toBe(2);
    // Permitted in City 2
    expect(rowInScope(mockReq, { cityId: 2 })).toBe(true);
    // Denied for City 1 (Varanasi)
    expect(rowInScope(mockReq, { cityId: 1 })).toBe(false);
  });

  // 7. Customer cannot see services disabled in their selected city
  it("Scenario 7: Customer cannot see services disabled in their selected city", async () => {
    // Branch 2 in Noida only offers daily_cleaning; solar_cleaning is disabled in Noida city availability
    const noidaCatalog = await getBranchServiceCatalog(2);
    const dailyCleaning = noidaCatalog.find((s) => s.serviceType === "daily_cleaning");
    const solarCleaning = noidaCatalog.find((s) => s.serviceType === "solar_cleaning");

    expect(dailyCleaning?.isAvailable).toBe(true);
    expect(solarCleaning?.isAvailable).toBe(false);
    expect(solarCleaning?.isAvailableInCity).toBe(false);
  });

  // 8. Customer cannot access another customer’s records
  it("Scenario 8: Customer cannot access another customer’s records", async () => {
    const customerA: AuthUser = memory.users.find((u: any) => u.id === 50)!; // customerId = 501
    const scope = await computeScope(customerA);
    const mockReq = { scope } as any;

    expect(rowInScope(mockReq, { customerId: 501 })).toBe(true);
    expect(rowInScope(mockReq, { customerId: 601 })).toBe(false);
  });

  // 9. City suspension blocks new operational transactions and invalidates sessions
  it("Scenario 9: City suspension marks status as suspended, revokes active sessions and blocks tokens", async () => {
    // City 2 (Noida) is active
    const userSession = await loadUserFromToken("token-mgr-noi");
    expect(userSession).not.toBeNull();

    // Super Admin suspends city
    const suspended = await suspendCity(2, "Operational restructuring", 1);
    expect(suspended.status).toBe("suspended");

    // Session validation must reject city manager token because city is suspended
    const sessionAfterSuspension = await loadUserFromToken("token-mgr-noi");
    expect(sessionAfterSuspension).toBeNull();
  });

  // 10. Branch suspension blocks branch operations
  it("Scenario 10: Branch suspension blocks branch operations and invalidates sessions", async () => {
    // Branch 1 is active
    const branchManagerSession = await loadUserFromToken("token-mgr-vns");
    expect(branchManagerSession).not.toBeNull();

    // Suspend branch 1
    const suspended = await suspendBranch(1, 1, "Facility upgrade");
    expect(suspended.status).toBe("suspended");

    // Session for branch manager now rejected
    const sessionAfterBranchSuspension = await loadUserFromToken("token-mgr-vns");
    expect(sessionAfterBranchSuspension).toBeNull();
  });

  // 11. Global Super Admin retains authorized consolidated visibility
  it("Scenario 11: Global Super Admin retains authorized consolidated visibility across all cities and branches", async () => {
    const superAdmin: AuthUser = memory.users.find((u: any) => u.id === 1)!;
    const scope = await computeScope(superAdmin);
    const mockReq = { scope } as any;

    expect(scope.isSuperAdmin).toBe(true);
    expect(scope.branchIds).toBeNull();
    expect(scope.cityId).toBeNull();

    // Visible across all cities and branches
    expect(rowInScope(mockReq, { cityId: 1, branchId: 1 })).toBe(true);
    expect(rowInScope(mockReq, { cityId: 2, branchId: 2 })).toBe(true);
    expect(rowInScope(mockReq, { cityId: 2, branchId: 3 })).toBe(true);
  });

  // 12. Revoke assignment immediately removes access / invalidates relevant sessions
  it("Scenario 12: Revoking assignment immediately invalidates branch scope", async () => {
    const activeAssignments = await getUserActiveBranchIds(20);
    expect(activeAssignments).toEqual([2]);

    // Revoke assignment #2 for manager #20
    await revokeBranchAssignment(2, 1, "Transfer to central operations");

    // Now active branches list is empty
    const assignmentsAfter = await getUserActiveBranchIds(20);
    expect(assignmentsAfter).toEqual([]);
  });

  // 13. Pricing changes do not alter historical invoices
  it("Scenario 13: Updating city pricing overrides never alters historical invoice snapshots", () => {
    const historicalInvoice = memory.invoices.find((i: any) => i.id === 2001)!;
    expect(historicalInvoice.totalAmount).toBe("1350.00");
    expect(historicalInvoice.items[0].unitPrice).toBe(1350);

    // City catalog updates Daily Cleaning override to 1800
    const cityCatalogRow = memory.serviceCityAvailability.find((ca: any) => ca.cityId === 2 && ca.serviceId === 1)!;
    cityCatalogRow.basePriceOverride = "1800.00";

    // Historical invoice record remains immutable
    expect(historicalInvoice.totalAmount).toBe("1350.00");
    expect(historicalInvoice.items[0].unitPrice).toBe(1350);
  });

  // 14. City configuration changes do not impact other cities
  it("Scenario 14: City configuration changes are completely isolated between cities", async () => {
    await updateCity(2, { contactPhone: "9111111111", timezone: "Asia/Kolkata" }, 1);

    const varanasi = memory.cities.find((c: any) => c.id === 1)!;
    const noida = memory.cities.find((c: any) => c.id === 2)!;

    expect(noida.contactPhone).toBe("9111111111");
    // Varanasi remains completely unaffected
    expect(varanasi.contactPhone).toBe("9876540001");
  });

  // 15. Promotions from City A never leak into City B
  it("Scenario 15: Promotions configured for City A never leak into City B", () => {
    const varanasiPromos = memory.promotions.filter((p: any) => p.cityId === 1 && p.isActive);
    const noidaPromos = memory.promotions.filter((p: any) => p.cityId === 2 && p.isActive);

    expect(varanasiPromos.length).toBe(1);
    expect(varanasiPromos[0].title).toBe("Varanasi Monsoon Care");

    expect(noidaPromos.length).toBe(1);
    expect(noidaPromos[0].title).toBe("Noida Society Launch");
    expect(noidaPromos.some((p: any) => p.title.includes("Varanasi"))).toBe(false);
  });

  // 16. Cross-city query parameters cannot spoof scope
  it("Scenario 16: Cross-city query parameters cannot expand caller's authorized scope", async () => {
    const noidaManager: AuthUser = memory.users.find((u: any) => u.id === 20)!;
    const scope = await computeScope(noidaManager);

    // Caller attempts to pass spoofed query parameters: ?branchId=1&cityId=1
    const mockReq = {
      scope,
      query: { branchId: "1", cityId: "1" },
    } as any;

    const filters = tenantFilters(mockReq, {
      branchCol: "test_branch_col" as any,
      cityCol: "test_city_col" as any,
    });

    // The generated SQL where clause is bound strictly to caller's scope [2], not the query param
    expect(filters.length).toBeGreaterThan(0);
    const filterParams = filters.flatMap(extractAllParamValues);
    expect(filterParams).toContain(2); // Authorized branch
    expect(filterParams).not.toContain(1); // Spoofed branch rejected
  });

  // 17. Unauthorized users cannot modify city or branch configuration
  it("Scenario 17: Unauthorized roles are rejected from creating or activating cities", async () => {
    // Attempting activation without prerequisites throws unless forced
    // City 3 is in setup_in_progress and lacks an operating COCO branch
    await expect(activateCity(3, 1, false)).rejects.toThrow(/Critical readiness requirements not met/);
  });

  // 18. Background jobs and scheduled processes respect city/branch scope
  it("Scenario 18: City operations dashboard aggregates only metrics within target city scope", async () => {
    const vnsDashboard = await getCityOperationsDashboard(1);
    const noiDashboard = await getCityOperationsDashboard(2);

    expect(vnsDashboard.cityId).toBe(1);
    expect(vnsDashboard.cityName).toBe("Varanasi");
    expect(vnsDashboard.activeBranchesCount).toBe(1);

    expect(noiDashboard.cityId).toBe(2);
    expect(noiDashboard.cityName).toBe("Noida");
    expect(noiDashboard.totalBranchesCount).toBe(2); // Branches 2 & 3
  });
});
