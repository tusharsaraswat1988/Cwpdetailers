import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory mock database state
const mockDb = {
  branches: [] as any[],
  cities: [] as any[],
  catalogSettings: [] as any[],
  operatingHours: [] as any[],
  subscriptions: [] as any[],
  vehicles: [] as any[],
  customers: [] as any[],
  serviceLocations: [] as any[],
  societies: [] as any[],
  towers: [] as any[],
  staff: [] as any[],
  staffAssignments: [] as any[],
  auditLogs: [] as any[],
};

function extractConditionValues(cond: any, values: Set<string> = new Set()): Set<string> {
  if (!cond) return values;
  if (typeof cond === "string") values.add(cond);
  if (typeof cond?.value === "string") values.add(cond.value);
  if (Array.isArray(cond.queryChunks)) {
    for (const c of cond.queryChunks) extractConditionValues(c, values);
  }
  if (Array.isArray(cond)) {
    for (const c of cond) extractConditionValues(c, values);
  }
  return values;
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => {
          let rows: any[] = [];

          // Determine table
          if (table === actual.branchesTable) {
            rows = [...mockDb.branches];
          } else if (table === actual.citiesTable) {
            rows = [...mockDb.cities];
          } else if (table === actual.catalogSettingsTable) {
            rows = [...mockDb.catalogSettings];
          } else if (table === actual.operatingHoursTable) {
            rows = [...mockDb.operatingHours];
          } else if (table === actual.staffTable) {
            rows = [...mockDb.staff];
          } else if (table === actual.dcmsStaffAssignmentsTable) {
            rows = [...mockDb.staffAssignments];
          } else if (table === actual.dcmsSubscriptionsTable) {
            // Joined query simulation for auto-assigner
            rows = mockDb.subscriptions.map((sub) => {
              const vehicle = mockDb.vehicles.find((v) => v.id === sub.vehicleId) ?? {
                id: sub.vehicleId,
                registrationNumber: "UP14AB1234",
                make: "Honda",
                model: "City",
              };
              const customer = mockDb.customers.find((c) => c.id === sub.customerId) ?? {
                id: sub.customerId,
                name: "Test Customer",
              };
              const serviceLoc = mockDb.serviceLocations.find((l) => l.id === sub.serviceLocationId);
              const society = mockDb.societies.find(
                (s) => s.id === (sub.societyId ?? serviceLoc?.societyId),
              );
              const tower = mockDb.towers.find(
                (t) => t.id === (sub.towerId ?? serviceLoc?.towerId),
              );
              return { sub, vehicle, customer, serviceLoc, society, tower };
            });
          }

          const queryObj: any = {
            innerJoin: vi.fn(() => queryObj),
            leftJoin: vi.fn(() => queryObj),
            where: vi.fn((condition: any) => {
              let filtered = rows;
              if (table === actual.operatingHoursTable && condition) {
                const vals = extractConditionValues(condition);
                if (vals.has("branch")) {
                  filtered = rows.filter((r) => r.scopeType === "branch");
                } else if (vals.has("city")) {
                  filtered = rows.filter((r) => r.scopeType === "city");
                } else if (vals.has("global")) {
                  filtered = rows.filter((r) => r.scopeType === "global");
                }
              }
              return {
                orderBy: vi.fn(() => queryObj),
                limit: vi.fn((n: number) => filtered.slice(0, n)),
                returning: vi.fn(() => filtered),
                then: (resolve: any) => resolve(filtered),
                [Symbol.iterator]: () => filtered[Symbol.iterator](),
              };
            }),
            orderBy: vi.fn(() => queryObj),
            limit: vi.fn((n: number) => rows.slice(0, n)),
            then: (resolve: any) => resolve(rows),
            [Symbol.iterator]: () => rows[Symbol.iterator](),
          };

          return queryObj;
        }),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          const inserted = Array.isArray(vals) ? vals : [vals];
          const withId = inserted.map((row, idx) => ({ id: row.id ?? 1000 + idx, ...row }));
          if (table === actual.dcmsStaffAssignmentsTable) {
            mockDb.staffAssignments.push(...withId);
          }
          return {
            returning: vi.fn(() => withId),
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(() => withId),
            })),
            then: (resolve: any) => resolve(withId),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((patch: any) => ({
          where: vi.fn(() => {
            if (table === actual.dcmsStaffAssignmentsTable) {
              mockDb.staffAssignments.forEach((a) => {
                Object.assign(a, patch);
              });
            } else if (table === actual.branchesTable) {
              mockDb.branches.forEach((b) => {
                Object.assign(b, patch);
              });
            }
            return {
              returning: vi.fn(() => [{ ...mockDb.branches[0], ...patch }]),
              then: (resolve: any) => resolve([]),
            };
          }),
        })),
      })),
    },
  };
});

vi.mock("../../lib/staffEcosystem/operationalRoles", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    staffHasOperationalRole: vi.fn(async (staffId: number, roleSlug: string) => {
      const s = mockDb.staff.find((st) => st.id === staffId);
      return s?.operationalRoles?.includes(roleSlug) ?? true;
    }),
  };
});

vi.mock("../../lib/audit/adminAuditService", () => ({
  logAdminAudit: vi.fn(async (entry: any) => {
    mockDb.auditLogs.push(entry);
  }),
}));

import {
  resolveConfigKey,
  resolveBranchOperationalSettings,
  resolveOperatingHours,
  DEFAULT_OPERATIONAL_CONFIG,
} from "../../lib/config/configInheritanceResolver";
import {
  getServiceWorkflowDefinition,
  listAllServiceWorkflowDefinitions,
  generateExecutionChecklist,
  validateServiceExecutionTransition,
  getExecutionModelForService,
  DAILY_CLEANING_WORKFLOW,
  CAR_WASH_WORKFLOW,
  CERAMIC_COATING_WORKFLOW,
} from "../../lib/services/serviceWorkflowEngine";
import {
  autoAssignSocietyClusters,
} from "../../lib/dcms/societyAutoAssignmentService";

describe("Phase B Operations & Backend Engine Enhancements", () => {
  beforeEach(() => {
    mockDb.branches = [];
    mockDb.cities = [];
    mockDb.catalogSettings = [];
    mockDb.operatingHours = [];
    mockDb.subscriptions = [];
    mockDb.vehicles = [];
    mockDb.customers = [];
    mockDb.serviceLocations = [];
    mockDb.societies = [];
    mockDb.towers = [];
    mockDb.staff = [];
    mockDb.staffAssignments = [];
    mockDb.auditLogs = [];
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CITY-006: Hierarchical Configuration Inheritance Resolver
  // ════════════════════════════════════════════════════════════════════════════
  describe("CITY-006: Hierarchical Configuration Inheritance Resolver", () => {
    it("resolves branch override when set on branch.customSettings", async () => {
      mockDb.branches.push({
        id: 10,
        name: "Noida Hub",
        cityId: 7,
        customSettings: {
          maxCarsPerCleaner: 35,
          dcmsShiftStartTime: "05:30",
        },
      });
      mockDb.cities.push({
        id: 7,
        name: "Noida",
        operationalSettings: {
          maxCarsPerCleaner: 28,
        },
      });

      const res = await resolveConfigKey<number>("maxCarsPerCleaner", { branchId: 10 });
      expect(res.value).toBe(35);
      expect(res.source).toBe("branch");
      expect(res.branchId).toBe(10);
      expect(res.cityId).toBe(7);
      expect(res.isCityDisabled).toBe(false);
    });

    it("falls back to city override when branch does not override", async () => {
      mockDb.branches.push({
        id: 10,
        name: "Noida Hub",
        cityId: 7,
        customSettings: {},
      });
      mockDb.cities.push({
        id: 7,
        name: "Noida",
        operationalSettings: {
          washLeadTimeHours: 6,
        },
      });

      const res = await resolveConfigKey<number>("washLeadTimeHours", { branchId: 10 });
      expect(res.value).toBe(6);
      expect(res.source).toBe("city");
    });

    it("falls back to global setting from catalogSettingsTable when neither branch nor city overrides", async () => {
      mockDb.branches.push({ id: 10, name: "Noida Hub", cityId: 7, customSettings: {} });
      mockDb.cities.push({ id: 7, name: "Noida", operationalSettings: {} });
      mockDb.catalogSettings.push({
        id: 1,
        key: "customPlatformFlag",
        value: "enterprise_v2",
      });

      const res = await resolveConfigKey<string>("customPlatformFlag", { branchId: 10 });
      expect(res.value).toBe("enterprise_v2");
      expect(res.source).toBe("global");
    });

    it("falls back to hardcoded system default when no database overrides exist", async () => {
      mockDb.branches.push({ id: 10, name: "Noida Hub", cityId: 7, customSettings: {} });
      mockDb.cities.push({ id: 7, name: "Noida", operationalSettings: {} });

      const res = await resolveConfigKey<number>("geofenceToleranceMeters", { branchId: 10 });
      expect(res.value).toBe(DEFAULT_OPERATIONAL_CONFIG.geofenceToleranceMeters); // 250
      expect(res.source).toBe("default");
    });

    it("enforces CITY-007: strict city prohibition blocks branch override", async () => {
      mockDb.branches.push({
        id: 10,
        name: "Noida Hub",
        cityId: 7,
        customSettings: {
          ceramic_coating_enabled: true,
        },
      });
      mockDb.cities.push({
        id: 7,
        name: "Noida",
        operationalSettings: {
          ceramic_coating_enabled_disabled: true,
        },
      });

      const res = await resolveConfigKey<boolean>("ceramic_coating_enabled", { branchId: 10 });
      expect(res.isCityDisabled).toBe(true);
      expect(res.source).toBe("city");
      expect(res.value).toBeNull();
    });

    it("resolves full branch operational settings dictionary with source breakdown", async () => {
      mockDb.branches.push({
        id: 5,
        name: "Varanasi Central",
        cityId: 1,
        customSettings: {
          maxCarsPerCleaner: 30,
        },
      });
      mockDb.cities.push({
        id: 1,
        name: "Varanasi",
        operationalSettings: {
          dcmsShiftStartTime: "06:30",
        },
      });

      const resolved = await resolveBranchOperationalSettings(5);
      expect(resolved.branchId).toBe(5);
      expect(resolved.branchName).toBe("Varanasi Central");
      expect(resolved.settings.maxCarsPerCleaner).toBe(30);
      expect(resolved.sources.maxCarsPerCleaner).toBe("branch");
      expect(resolved.settings.dcmsShiftStartTime).toBe("06:30");
      expect(resolved.sources.dcmsShiftStartTime).toBe("city");
      expect(resolved.sources.geofenceToleranceMeters).toBe("default");
    });

    it("resolves operating hours following Branch -> City -> Global hierarchy", async () => {
      mockDb.operatingHours.push(
        {
          id: 101,
          scopeType: "global",
          dayOfWeek: 1, // Monday
          isWorkingDay: true,
          openTime: "08:00",
          closeTime: "18:00",
          slotStepMinutes: 15,
          maxConcurrentSlots: 8,
        },
        {
          id: 102,
          scopeType: "branch",
          branchId: 5,
          dayOfWeek: 1,
          isWorkingDay: true,
          openTime: "07:00", // Branch opens earlier
          closeTime: "19:00",
          slotStepMinutes: 30,
          maxConcurrentSlots: 10,
        },
      );

      const hours = await resolveOperatingHours({ branchId: 5, dayOfWeek: 1 });
      expect(hours.openTime).toBe("07:00");
      expect(hours.closeTime).toBe("19:00");
      expect(hours.source).toBe("branch");
      expect(hours.scopeType).toBe("branch");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. SVC-002: Service Workflow State Machine & Operational Engine
  // ════════════════════════════════════════════════════════════════════════════
  describe("SVC-002: Service Workflow State Machine & Operational Engine", () => {
    it("registers all 5 core service workflow models with distinct execution paradigms", () => {
      const workflows = listAllServiceWorkflowDefinitions();
      expect(workflows.length).toBe(5);

      const types = workflows.map((w) => w.serviceType);
      expect(types).toContain("daily_cleaning");
      expect(types).toContain("car_wash");
      expect(types).toContain("interior_detailing");
      expect(types).toContain("ceramic_coating");
      expect(types).toContain("solar_cleaning");
    });

    it("differentiates daily cleaning (batch route, waterless) from car wash and detailing", () => {
      const dcms = getServiceWorkflowDefinition("daily_cleaning");
      expect(dcms.bookingMode).toBe("recurring_subscription");
      expect(dcms.executionModel).toBe("batch_route");
      expect(dcms.resourceRequirements.waterRequired).toBe(false);
      expect(dcms.resourceRequirements.electricityRequired).toBe(false);
      expect(dcms.timingConstraints.timeSlotRequired).toBe(false);

      const wash = getServiceWorkflowDefinition("car_wash");
      expect(wash.bookingMode).toBe("slot_appointment");
      expect(wash.executionModel).toBe("dedicated_job");
      expect(wash.resourceRequirements.waterRequired).toBe(true);
      expect(wash.resourceRequirements.electricityRequired).toBe(true);
      expect(wash.timingConstraints.timeSlotRequired).toBe(true);

      const ceramic = getServiceWorkflowDefinition("ceramic_coating");
      expect(ceramic.bookingMode).toBe("full_day_bay");
      expect(ceramic.executionModel).toBe("multi_stage_studio");
      expect(ceramic.timingConstraints.estimatedDurationMinutes).toBe(420);
    });

    it("generates required checklist items tailored to service category", () => {
      const dcmsChecklist = generateExecutionChecklist("daily_cleaning");
      expect(dcmsChecklist.length).toBeGreaterThan(3);
      expect(dcmsChecklist[0].label).toContain("Verify vehicle registration");

      const solarChecklist = generateExecutionChecklist("solar_cleaning");
      expect(solarChecklist.some((i) => i.label.toLowerCase().includes("harness"))).toBe(true);
    });

    it("validates permissible service execution state transitions", () => {
      // Valid transition: scheduled -> in_progress -> completed (with valid photos)
      const t1 = validateServiceExecutionTransition({
        serviceType: "daily_cleaning",
        currentStatus: "scheduled",
        targetStatus: "in_progress",
      });
      expect(t1.allowed).toBe(true);

      const t2 = validateServiceExecutionTransition({
        serviceType: "daily_cleaning",
        currentStatus: "in_progress",
        targetStatus: "completed",
        payload: { photosCount: 1 },
      });
      expect(t2.allowed).toBe(true);

      // Invalid transition: completed -> in_progress (terminal status cannot reopen)
      const t3 = validateServiceExecutionTransition({
        serviceType: "daily_cleaning",
        currentStatus: "completed",
        targetStatus: "in_progress",
      });
      expect(t3.allowed).toBe(false);
      expect(t3.reason).toContain("not permitted");

      // Insufficient photos for car wash (requires at least 2 photos)
      const t4 = validateServiceExecutionTransition({
        serviceType: "car_wash",
        currentStatus: "in_progress",
        targetStatus: "completed",
        payload: { photosCount: 1 }, // Less than required 2
      });
      expect(t4.allowed).toBe(false);
      expect(t4.reason).toContain("requires at least 2 completion photo(s)");
    });

    it("correctly resolves execution model helper", () => {
      expect(getExecutionModelForService("daily_cleaning")).toBe("batch_route");
      expect(getExecutionModelForService("car_wash")).toBe("dedicated_job");
      expect(getExecutionModelForService("ceramic_coating")).toBe("multi_stage_studio");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. JOB-001: Society Cluster Auto-Assignment Engine
  // ════════════════════════════════════════════════════════════════════════════
  describe("JOB-001: Society Cluster Auto-Assignment Engine", () => {
    it("clusters subscriptions by society and tower and allocates to cleaners within capacity", async () => {
      // Setup Branch
      mockDb.branches.push({ id: 5, name: "Noida Branch", cityId: 7, customSettings: {} });

      // Setup Cleaners
      mockDb.staff.push(
        {
          id: 101,
          name: "Ramesh Cleaner",
          phone: "9876543210",
          branchId: 5,
          isActive: true,
          availability: "available",
          staffCategory: "cleaning_staff",
          role: "technician",
        },
        {
          id: 102,
          name: "Suresh Cleaner",
          phone: "9876543211",
          branchId: 5,
          isActive: true,
          availability: "available",
          staffCategory: "cleaning_staff",
          role: "technician",
        },
      );

      // Setup Societies & Towers
      mockDb.societies.push(
        { id: 201, name: "Jaypee Greens Wish Town", branchId: 5 },
        { id: 202, name: "ATS Village", branchId: 5 },
      );
      mockDb.towers.push(
        { id: 301, societyId: 201, name: "Tower A" },
        { id: 302, societyId: 201, name: "Tower B" },
      );

      // Setup 5 subscriptions across Tower A and Tower B
      for (let i = 1; i <= 5; i++) {
        mockDb.vehicles.push({
          id: i,
          registrationNumber: `UP16AB000${i}`,
          make: "Hyundai",
          model: "Creta",
        });
        mockDb.subscriptions.push({
          id: i,
          customerId: i,
          branchId: 5,
          vehicleId: i,
          societyId: 201,
          towerId: i <= 3 ? 301 : 302,
          parkingBay: `B1-0${i}`,
          status: "active",
        });
      }

      // Run Auto-Assignment
      const result = await autoAssignSocietyClusters({
        branchId: 5,
        maxCarsPerCleaner: 25,
        dryRun: false,
        assignedBy: 1, // Superadmin
      });

      expect(result.branchId).toBe(5);
      expect(result.assignedCount).toBe(5);
      expect(result.cleanersUtilized).toBe(1); // 5 cars fit easily in Cleaner 1's 25-car cap
      expect(result.allocations[0].staffId).toBe(101);
      expect(result.allocations[0].stops.length).toBe(5);

      // Verify route orders are sequential (1..5)
      const routeOrders = result.allocations[0].stops.map((s) => s.routeOrder);
      expect(routeOrders).toEqual([1, 2, 3, 4, 5]);

      // Verify DB persistence
      expect(mockDb.staffAssignments.length).toBe(5);
      expect(mockDb.staffAssignments[0].staffId).toBe(101);
      expect(mockDb.staffAssignments[0].isActive).toBe(true);

      // Verify Audit Logging
      expect(mockDb.auditLogs.length).toBe(1);
      expect(mockDb.auditLogs[0].action).toBe("society_cluster_auto_assigned");
    });

    it("balances workload across multiple cleaners when car count exceeds single cleaner cap", async () => {
      mockDb.branches.push({ id: 5, name: "Noida Branch", cityId: 7, customSettings: {} });

      mockDb.staff.push(
        {
          id: 101,
          name: "Ramesh Cleaner",
          phone: "9876543210",
          branchId: 5,
          isActive: true,
          availability: "available",
          staffCategory: "cleaning_staff",
          role: "technician",
        },
        {
          id: 102,
          name: "Suresh Cleaner",
          phone: "9876543211",
          branchId: 5,
          isActive: true,
          availability: "available",
          staffCategory: "cleaning_staff",
          role: "technician",
        },
      );

      mockDb.societies.push({ id: 201, name: "Jaypee Greens Wish Town", branchId: 5 });

      // Setup 6 subscriptions with maxCarsPerCleaner = 3
      for (let i = 1; i <= 6; i++) {
        mockDb.vehicles.push({
          id: i,
          registrationNumber: `UP16AB100${i}`,
          make: "Tata",
          model: "Nexon",
        });
        mockDb.subscriptions.push({
          id: i,
          customerId: i,
          branchId: 5,
          vehicleId: i,
          societyId: 201,
          parkingBay: `P-${i}`,
          status: "active",
        });
      }

      const result = await autoAssignSocietyClusters({
        branchId: 5,
        maxCarsPerCleaner: 3, // Cap at 3 cars per cleaner
        dryRun: false,
        assignedBy: 1,
      });

      expect(result.assignedCount).toBe(6);
      expect(result.cleanersUtilized).toBe(2);
      expect(result.allocations[0].stops.length).toBe(3);
      expect(result.allocations[1].stops.length).toBe(3);
      expect(result.allocations[0].staffId).toBe(101);
      expect(result.allocations[1].staffId).toBe(102);
    });

    it("respects dryRun flag without mutating assignments table", async () => {
      mockDb.branches.push({ id: 5, name: "Noida Branch", cityId: 7, customSettings: {} });
      mockDb.staff.push({
        id: 101,
        name: "Ramesh Cleaner",
        branchId: 5,
        isActive: true,
        availability: "available",
        staffCategory: "cleaning_staff",
        role: "technician",
      });
      mockDb.subscriptions.push({
        id: 1,
        customerId: 1,
        branchId: 5,
        vehicleId: 1,
        status: "active",
      });

      const result = await autoAssignSocietyClusters({
        branchId: 5,
        dryRun: true,
        assignedBy: 1,
      });

      expect(result.dryRun).toBe(true);
      expect(result.assignedCount).toBe(1);
      // DB was NOT mutated
      expect(mockDb.staffAssignments.length).toBe(0);
      expect(mockDb.auditLogs.length).toBe(0);
    });

    it("reports unassigned overflow when subscriptions exceed total cleaner fleet capacity", async () => {
      mockDb.branches.push({ id: 5, name: "Noida Branch", cityId: 7, customSettings: {} });
      // Only 1 cleaner with cap of 2 cars
      mockDb.staff.push({
        id: 101,
        name: "Solo Cleaner",
        branchId: 5,
        isActive: true,
        availability: "available",
        staffCategory: "cleaning_staff",
        role: "technician",
      });

      // 4 active subscriptions
      for (let i = 1; i <= 4; i++) {
        mockDb.vehicles.push({
          id: i,
          registrationNumber: `UP16AB200${i}`,
          make: "Maruti",
          model: "Swift",
        });
        mockDb.subscriptions.push({
          id: i,
          customerId: i,
          branchId: 5,
          vehicleId: i,
          status: "active",
        });
      }

      const result = await autoAssignSocietyClusters({
        branchId: 5,
        maxCarsPerCleaner: 2,
        dryRun: true,
        assignedBy: 1,
      });

      expect(result.assignedCount).toBe(2);
      expect(result.unassignedCount).toBe(2);
      expect(result.unassignedSubscriptions.length).toBe(2);
      expect(result.unassignedSubscriptions[0].reason).toContain("reached workload capacity");
    });
  });
});
