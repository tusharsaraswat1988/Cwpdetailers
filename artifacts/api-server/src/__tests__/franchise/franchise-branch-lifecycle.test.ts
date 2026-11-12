import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBranch,
  suspendBranch,
  activateBranch,
  suspendFranchisee,
  activateFranchisee,
} from "../../lib/franchise/branchManagementService";
import { getUnifiedPlatformAnalytics } from "../../lib/analytics/multiCityAnalyticsService";
import {
  getMediaRetentionPolicy,
  maskPlateText,
  coarseGrainCoordinate,
  purgeExpiredVisitMedia,
} from "../../lib/media/mediaRetentionService";
import {
  extractCloudinaryPublicId,
  deleteCloudinaryAsset,
} from "../../lib/cloudinaryStorage";

// Mock Cloudinary uploader
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      destroy: vi.fn().mockResolvedValue({ result: "ok" }),
    },
    utils: {
      api_sign_request: vi.fn().mockReturnValue("mock-signature"),
    },
  },
}));

// In-memory data store for mocking db operations
const memoryStore = {
  branches: [] as any[],
  franchisees: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  cities: [
    { id: 1, name: "Varanasi", isActive: true },
    { id: 2, name: "Noida", isActive: true },
  ],
  customers: [] as any[],
  vehicles: [] as any[],
  dcmsSubscriptions: [] as any[],
  dcmsVisits: [] as any[],
  dcmsExceptions: [] as any[],
  invoices: [] as any[],
  payments: [] as any[],
  staff: [] as any[],
};

function resetMemoryStore() {
  memoryStore.branches = [
    {
      id: 1,
      name: "Varanasi Sigra",
      code: "BR-VAR-001",
      city: "Varanasi",
      cityId: 1,
      isCompanyOperated: true,
      franchiseeId: null,
      legalEntityId: 1,
      status: "active",
      isActive: true,
      operationalNotes: null,
    },
    {
      id: 2,
      name: "Noida Sector 62",
      code: "BR-NOI-001",
      city: "Noida",
      cityId: 2,
      isCompanyOperated: false,
      franchiseeId: 10,
      legalEntityId: 2,
      status: "active",
      isActive: true,
      operationalNotes: null,
    },
  ];

  memoryStore.franchisees = [
    {
      id: 10,
      name: "Amit Sharma",
      phone: "9876543210",
      branchId: 2,
      cityId: 2,
      legalEntityId: 2,
      userId: 101,
      status: "active",
      agreementNumber: "CWP-FRAN-NOI-2026-01",
      commissionPercentage: "15.00",
      finalAmountAgreed: "500000.00",
      amountDeposited: "300000.00",
      dueAmount: "200000.00",
      suspensionReason: null,
      suspendedAt: null,
      suspendedBy: null,
    },
  ];

  memoryStore.users = [
    { id: 101, name: "Amit Sharma", phone: "9876543210", role: "franchisee", branchId: 2 },
    { id: 201, name: "Cleaner Rahul", phone: "9876543211", role: "staff", branchId: 2 },
  ];

  memoryStore.sessions = [
    { id: 1, userId: 101, token: "token-franchisee", revokedAt: null },
    { id: 2, userId: 201, token: "token-cleaner", revokedAt: null },
  ];

  memoryStore.customers = [
    { id: 1, name: "Resident 1", cityId: 2, branchId: 2 },
    { id: 2, name: "Resident 2", cityId: 1, branchId: 1 },
  ];

  memoryStore.vehicles = [{ id: 1 }, { id: 2 }];

  memoryStore.dcmsSubscriptions = [
    { id: 1, customerId: 1, cityId: 2, branchId: 2, franchiseeId: 10, status: "active", remainingCleanings: 2 },
    { id: 2, customerId: 2, cityId: 1, branchId: 1, franchiseeId: null, status: "active", remainingCleanings: 20 },
  ];

  memoryStore.dcmsVisits = [];
  memoryStore.dcmsExceptions = [];
  memoryStore.invoices = [
    { id: 1, branchId: 2, totalAmount: "10000.00", dueAmount: "2000.00", status: "sent" },
    { id: 2, branchId: 1, totalAmount: "15000.00", dueAmount: "0.00", status: "paid" },
  ];
  memoryStore.payments = [
    { id: 1, branchId: 2, amount: "8000.00", status: "completed" },
    { id: 2, branchId: 1, amount: "15000.00", status: "completed" },
  ];
  memoryStore.staff = [
    { id: 1, name: "Staff Varanasi", branchId: 1, franchiseeId: null, isActive: true },
    { id: 2, name: "Staff Noida", branchId: 2, franchiseeId: 10, isActive: true },
  ];
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
        const builder = {
          from: vi.fn((tbl: any) => {
            queryState.table = tbl;
            return builder;
          }),
          leftJoin: vi.fn(() => builder),
          innerJoin: vi.fn(() => builder),
          where: vi.fn((cond: any) => {
            queryState.conditions.push(cond);
            return builder;
          }),
          groupBy: vi.fn(() => builder),
          orderBy: vi.fn(() => builder),
          limit: vi.fn((lim: number) => {
            return Promise.resolve(builder.execute());
          }),
          execute: () => {
            if (queryState.table === actual.branchesTable) {
              return memoryStore.branches.map((b) => ({
                ...b,
                branchId: b.id,
                branchName: b.name,
                cityName: b.city,
                franchiseeName: b.franchiseeId ? memoryStore.franchisees.find((f) => f.id === b.franchiseeId)?.name ?? null : null,
                staffCount: memoryStore.staff.filter((s) => s.branchId === b.id).length,
                activeSubscriptions: memoryStore.dcmsSubscriptions.filter((s) => s.branchId === b.id).length,
                collectedRevenue: memoryStore.payments.filter((p) => p.branchId === b.id).reduce((acc, p) => acc + parseFloat(p.amount), 0),
              }));
            }
            if (queryState.table === actual.franchiseesTable) {
              return memoryStore.franchisees;
            }
            if (queryState.table === actual.citiesTable) {
              return memoryStore.cities.map((c) => ({ cityId: c.id, cityName: c.name }));
            }
            if (queryState.table === actual.dcmsSubscriptionsTable) {
              return [{ count: memoryStore.dcmsSubscriptions.filter((s) => s.status === "active").length }];
            }
            if (queryState.table === actual.customersTable) {
              return [{ count: memoryStore.customers.length }];
            }
            if (queryState.table === actual.vehiclesTable) {
              return [{ count: memoryStore.vehicles.length }];
            }
            if (queryState.table === actual.dcmsVisitsTable) {
              return memoryStore.dcmsVisits;
            }
            if (queryState.table === actual.dcmsOperationalExceptionsTable) {
              return [{ status: "open", count: memoryStore.dcmsExceptions.length }];
            }
            if (queryState.table === actual.invoicesTable) {
              const invoicedTotal = memoryStore.invoices.reduce((acc, i) => acc + parseFloat(i.totalAmount), 0);
              const dueTotal = memoryStore.invoices.reduce((acc, i) => acc + parseFloat(i.dueAmount), 0);
              return [{ invoicedTotal, dueTotal }];
            }
            if (queryState.table === actual.paymentsTable) {
              const collectedTotal = memoryStore.payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
              return [{ collectedTotal }];
            }
            return [];
          },
          then: (resolve: any) => Promise.resolve(builder.execute()).then(resolve),
        };
        return builder;
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          const row = { id: Date.now(), ...vals, createdAt: new Date() };
          if (table === actual.branchesTable) memoryStore.branches.push(row);
          if (table === actual.franchiseesTable) memoryStore.franchisees.push(row);
          return {
            returning: vi.fn(() => Promise.resolve([row])),
            then: (resolve: any) => Promise.resolve([row]).then(resolve),
          };
        }),
      })),
      update: vi.fn((table: any) => {
        let updateValues: any = {};
        return {
          set: vi.fn((vals: any) => {
            updateValues = vals;
            return {
              where: vi.fn((clause: any) => {
                if (table === actual.branchesTable) {
                  let targetBranch = memoryStore.branches[0];
                  if (clause && typeof clause === "object" && clause.right?.value != null) {
                    const targetId = Number(clause.right.value);
                    const found = memoryStore.branches.find((b) => b.id === targetId);
                    if (found) {
                      Object.assign(found, updateValues);
                      targetBranch = found;
                    }
                  } else {
                    for (const b of memoryStore.branches) {
                      Object.assign(b, updateValues);
                    }
                  }
                  return {
                    returning: vi.fn(() => Promise.resolve([targetBranch])),
                    then: (resolve: any) => Promise.resolve([targetBranch]).then(resolve),
                  };
                }
                if (table === actual.franchiseesTable) {
                  let targetF = memoryStore.franchisees[0];
                  if (clause && typeof clause === "object" && clause.right?.value != null) {
                    const targetId = Number(clause.right.value);
                    const found = memoryStore.franchisees.find((f) => f.id === targetId);
                    if (found) {
                      Object.assign(found, updateValues);
                      targetF = found;
                    }
                  } else {
                    for (const f of memoryStore.franchisees) {
                      Object.assign(f, updateValues);
                    }
                  }
                  return {
                    returning: vi.fn(() => Promise.resolve([targetF])),
                    then: (resolve: any) => Promise.resolve([targetF]).then(resolve),
                  };
                }
                if (table === actual.sessionsTable) {
                  for (const s of memoryStore.sessions) {
                    s.revokedAt = updateValues.revokedAt;
                  }
                  return {
                    then: (resolve: any) => Promise.resolve().then(resolve),
                  };
                }
                if (table === actual.dcmsVisitsTable) {
                  for (const v of memoryStore.dcmsVisits) {
                    Object.assign(v, updateValues);
                  }
                  return {
                    then: (resolve: any) => Promise.resolve().then(resolve),
                  };
                }
                return {
                  returning: vi.fn(() => Promise.resolve([])),
                  then: (resolve: any) => Promise.resolve([]).then(resolve),
                };
              }),
            };
          }),
        };
      }),
    },
  };
});

describe("CWP Multi-City — Franchise, Branch & Media Retention Architecture", () => {
  beforeEach(() => {
    resetMemoryStore();
    process.env.CLOUDINARY_CLOUD_NAME = "cwp-test";
    process.env.CLOUDINARY_API_KEY = "123456789";
    process.env.CLOUDINARY_API_SECRET = "secret";
  });

  describe("1. Branch Operations Management (BR-001, FRAN-001)", () => {
    it("creates a Company-Operated (COCO) branch with generated code and legal entity linkage", async () => {
      const branch = await createBranch(
        {
          name: "Varanasi Lanka",
          city: "Varanasi",
          cityId: 1,
          legalEntityId: 1,
          isCompanyOperated: true,
          serviceAvailability: ["daily_cleaning", "car_washing"],
        },
        1
      );

      expect(branch).toBeDefined();
      expect(branch.name).toBe("Varanasi Lanka");
      expect(branch.isCompanyOperated).toBe(true);
      expect(branch.status).toBe("active");
      expect(branch.code).toMatch(/^BR-VAR-/);
      expect(branch.serviceAvailability).toContain("daily_cleaning");
    });

    it("rejects creating a Franchise-Operated (FOFO) branch linked to a franchisee partner (COCO-001)", async () => {
      await expect(
        createBranch(
          {
            name: "Noida Expressway",
            code: "BR-NOI-EXP",
            city: "Noida",
            cityId: 2,
            franchiseeId: 10,
            legalEntityId: 2,
            isCompanyOperated: false,
          },
          1
        )
      ).rejects.toThrow("All new operating branches must use the Company-Owned, Company-Operated (COCO) model");
    });

    it("suspends a branch, invalidates staff sessions, and appends audit notes", async () => {
      const suspended = await suspendBranch(1, "Quality audit failure", 99);

      expect(suspended.status).toBe("suspended");
      expect(suspended.isActive).toBe(false);
      expect(suspended.operationalNotes).toContain("Quality audit failure");

      // Verify sessions revocation
      expect(memoryStore.sessions[0].revokedAt).not.toBeNull();
    });

    it("reactivates a suspended branch restoring operational readiness", async () => {
      const activated = await activateBranch(1, 99, true);

      expect(activated.status).toBe("active");
      expect(activated.isActive).toBe(true);
    });
  });

  describe("2. Franchise Partner Lifecycle & Governance (FRAN-001)", () => {
    it("suspends a franchisee partner, revokes app logins, and cascades suspension to linked FOFO branch", async () => {
      const suspended = await suspendFranchisee(10, "Royalty default and non-compliance", 99);

      expect(suspended.status).toBe("suspended");
      expect(suspended.suspensionReason).toBe("Royalty default and non-compliance");
      expect(suspended.suspendedBy).toBe(99);
      expect(suspended.suspendedAt).toBeInstanceOf(Date);

      // Verify session revocation
      expect(memoryStore.sessions[0].revokedAt).toBeInstanceOf(Date);

      // Verify associated branch was suspended
      const linkedBranch = memoryStore.branches.find((b) => b.id === 2);
      expect(linkedBranch.status).toBe("suspended");
      expect(linkedBranch.isActive).toBe(false);
    });

    it("activates a franchisee partner and restores the associated branch to active", async () => {
      const activated = await activateFranchisee(10, 99);

      expect(activated.status).toBe("active");
      expect(activated.suspensionReason).toBeNull();
      expect(activated.suspendedAt).toBeNull();

      const linkedBranch = memoryStore.branches.find((b) => b.id === 2);
      expect(linkedBranch.status).toBe("active");
      expect(linkedBranch.isActive).toBe(true);
    });
  });

  describe("3. Multi-City Platform Analytics (DASH-003)", () => {
    it("aggregates multi-city operational and financial KPIs across active tenants", async () => {
      const analytics = await getUnifiedPlatformAnalytics();

      expect(analytics.operational).toBeDefined();
      expect(analytics.operational.activeSubscriptions).toBe(2);
      expect(analytics.operational.activeCustomers).toBe(2);

      expect(analytics.financial).toBeDefined();
      expect(analytics.financial.invoicedRevenue).toBe(25000);
      expect(analytics.financial.collectedRevenue).toBe(23000);
      expect(analytics.financial.outstandingDues).toBe(2000);
      expect(analytics.financial.collectionRate).toBe(92);

      expect(analytics.cityBreakdown.length).toBeGreaterThanOrEqual(2);
      expect(analytics.branchBreakdown.length).toBeGreaterThanOrEqual(2);

      const fofoBranch = analytics.branchBreakdown.find((b) => b.branchId === 2);
      expect(fofoBranch?.isCompanyOperated).toBe(false);
      expect(fofoBranch?.franchiseeName).toBe("Amit Sharma");
    });
  });

  describe("4. Media Retention, Cloudinary Purge & Privacy Controls (MEDIA-007, MEDIA-008)", () => {
    it("publishes clear media retention policy with 30-day routine and 90-day dispute protection", () => {
      const policy = getMediaRetentionPolicy();
      expect(policy.routineRetentionDays).toBe(30);
      expect(policy.exceptionRetentionDays).toBe(90);
      expect(policy.privacyControls.cloudinaryAssetPurge).toBe(true);
      expect(policy.privacyControls.plateOcrMasking).toBe(true);
      expect(policy.privacyControls.gpsCoarseGraining).toBe(true);
      expect(policy.privacyControls.disputeHoldProtection).toBe(true);
    });

    it("extracts public ID from Cloudinary image URLs", () => {
      const url1 = "https://res.cloudinary.com/cwp-test/image/upload/v1698765432/cwp/noida/visit-abc1234.jpg";
      const publicId1 = extractCloudinaryPublicId(url1);
      expect(publicId1).toBe("cwp/noida/visit-abc1234");

      const url2 = "https://res.cloudinary.com/cwp-test/image/upload/cwp/varanasi/visit-xyz9876.png";
      const publicId2 = extractCloudinaryPublicId(url2);
      expect(publicId2).toBe("cwp/varanasi/visit-xyz9876");

      expect(extractCloudinaryPublicId("")).toBeNull();
    });

    it("redacts license plate OCR text to protect residential movement history", () => {
      expect(maskPlateText("UP65AB1234")).toBe("UP65****34");
      expect(maskPlateText("DL1CAB1234")).toBe("DL1C****34");
      expect(maskPlateText("HR26")).toBe("****");
      expect(maskPlateText(null)).toBeNull();
    });

    it("coarse-grains high-precision GPS coordinates to 2 decimal places (~1.1 km)", () => {
      expect(coarseGrainCoordinate(28.5355172)).toBe(28.54);
      expect(coarseGrainCoordinate(77.3910265)).toBe(77.39);
      expect(coarseGrainCoordinate(0)).toBe(0);
      expect(coarseGrainCoordinate(null)).toBeNull();
    });

    it("executes Cloudinary asset deletion gracefully when deleting an asset", async () => {
      const res = await deleteCloudinaryAsset(
        "https://res.cloudinary.com/cwp-test/image/upload/v1698765432/cwp/noida/visit-abc1234.jpg"
      );
      expect(res.success).toBe(true);
    });

    it("purges expired routine cleaning media while protecting active disputes and applying privacy controls", async () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      memoryStore.dcmsVisits = [
        {
          id: 501,
          subscriptionId: 1,
          visitTime: oldDate,
          photoUrl: "https://res.cloudinary.com/cwp-test/image/upload/v1/cwp/noida/photo1.jpg",
          ocrText: "UP65AB1234",
          latitude: 28.53551,
          longitude: 77.39102,
          retentionHold: false,
          mediaPurgedAt: null,
        },
      ];

      const result = await purgeExpiredVisitMedia({ days: 30, performedBy: 99 });

      expect(result.eligibleCount).toBe(1);
      expect(result.purgedCount).toBe(1);
      expect(result.cloudinaryDeletedCount).toBe(1);
      expect(result.visitIds).toContain(501);

      // Verify visit state updated with privacy masking
      const updated = memoryStore.dcmsVisits[0];
      expect(updated.photoUrl).toBeNull();
      expect(updated.mediaPurgedAt).toBeInstanceOf(Date);
      expect(updated.mediaPurgedBy).toBe(99);
      expect(updated.ocrText).toBe("UP65****34");
      expect(updated.latitude).toBe(28.54);
      expect(updated.longitude).toBe(77.39);
      expect(updated.cloudinaryDeletionStatus).toBe("deleted");
    });
  });
});
