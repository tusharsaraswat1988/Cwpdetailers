import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateBasementGpsFallback,
  VALID_GPS_UNAVAILABLE_REASONS,
} from "../../lib/dcms/geoFence";
import {
  getMediaRetentionPolicy,
  purgeExpiredVisitMedia,
  setVisitRetentionHold,
} from "../../lib/media/mediaRetentionService";
import {
  createOperationalException,
  resolveOperationalException,
} from "../../lib/dcms/exceptionService";
import { getSocietyDailyOperations } from "../../lib/dcms/societyOperationsService";

// In-memory test state
const state = {
  subscriptions: [] as any[],
  visits: [] as any[],
  exceptions: [] as any[],
  assignments: [] as any[],
  activityLogs: [] as any[],
  societies: [] as any[],
  cities: [] as any[],
  customers: [] as any[],
  vehicles: [] as any[],
  staff: [] as any[],
};

vi.mock("../../lib/notifications/dispatcher", () => ({
  dispatchNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../lib/brandIdentityService", () => ({
  getBrandName: vi.fn().mockResolvedValue("CWP Detailers"),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => {
        return {
          from: vi.fn((table: any) => {
            const builder: any = {
              innerJoin: vi.fn(() => builder),
              leftJoin: vi.fn(() => builder),
              where: vi.fn(() => builder),
              orderBy: vi.fn(() => builder),
              limit: vi.fn((lim: number) => {
                if (table === actual.residentialSocietiesTable) {
                  return Promise.resolve(state.societies);
                }
                if (table === actual.dcmsSubscriptionsTable) {
                  return Promise.resolve(state.subscriptions);
                }
                if (table === actual.dcmsVisitsTable) {
                  return Promise.resolve(state.visits);
                }
                if (table === actual.dcmsOperationalExceptionsTable) {
                  return Promise.resolve(state.exceptions);
                }
                return Promise.resolve([]);
              }),
              then: (resolve: any) => {
                if (table === actual.residentialSocietiesTable) {
                  return resolve(state.societies);
                }
                if (table === actual.dcmsSubscriptionsTable) {
                  return resolve(state.subscriptions);
                }
                if (table === actual.dcmsVisitsTable) {
                  return resolve(state.visits);
                }
                if (table === actual.dcmsStaffAssignmentsTable) {
                  return resolve(state.assignments);
                }
                if (table === actual.dcmsOperationalExceptionsTable) {
                  return resolve(state.exceptions);
                }
                return resolve([]);
              },
            };
            return builder;
          }),
        };
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          const row = { id: 101 + state.exceptions.length, ...val, reportedAt: new Date() };
          if (table === actual.dcmsOperationalExceptionsTable) {
            state.exceptions.push(row);
          }
          if (table === actual.dcmsActivityLogsTable) {
            state.activityLogs.push(row);
          }
          return {
            returning: vi.fn(() => Promise.resolve([row])),
            then: (resolve: any) => resolve([row]),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => {
              if (table === actual.dcmsSubscriptionsTable) {
                const sub = state.subscriptions[0];
                if (sub) {
                  if (typeof updates.remainingCleanings === "object") {
                    sub.remainingCleanings += 1;
                  } else if (updates.remainingCleanings !== undefined) {
                    sub.remainingCleanings = updates.remainingCleanings;
                  }
                  if (updates.status) sub.status = updates.status;
                }
                return Promise.resolve(sub ? [sub] : []);
              }
              if (table === actual.dcmsOperationalExceptionsTable) {
                const exc = state.exceptions[0];
                if (exc) {
                  Object.assign(exc, updates);
                }
                return Promise.resolve(exc ? [exc] : []);
              }
              if (table === actual.dcmsVisitsTable) {
                const visit = state.visits[0];
                if (visit) Object.assign(visit, updates);
                return Promise.resolve(visit ? [visit] : []);
              }
              return Promise.resolve([]);
            }),
            then: (resolve: any) => {
              if (table === actual.dcmsVisitsTable) {
                for (const v of state.visits) {
                  if (!v.retentionHold) {
                    v.photoUrl = updates.photoUrl;
                    v.mediaPurgedAt = updates.mediaPurgedAt;
                  }
                }
              }
              if (table === actual.dcmsSubscriptionsTable) {
                const sub = state.subscriptions[0];
                if (sub) {
                  if (typeof updates.remainingCleanings === "object") {
                    sub.remainingCleanings += 1;
                  } else if (updates.remainingCleanings !== undefined) {
                    sub.remainingCleanings = updates.remainingCleanings;
                  }
                  if (updates.status) sub.status = updates.status;
                }
              }
              if (table === actual.dcmsOperationalExceptionsTable) {
                const exc = state.exceptions[0];
                if (exc) {
                  Object.assign(exc, updates);
                }
              }
              return resolve();
            },
          })),
        })),
      })),
    },
  };
});

describe("Basement Geofence Security & Fallback Hardening (SEC-024 / GEO-006)", () => {
  it("allows standard completions when accurate GPS fix is present", () => {
    const res = validateBasementGpsFallback({
      staffLat: 28.628,
      staffLng: 77.364,
      isBasement: false,
      hasPhoto: true,
    });
    expect(res.allowed).toBe(true);
    expect(res.requiresAudit).toBe(false);
  });

  it("strictly rejects 0,0 coordinates for open street / residential villas (no bypass)", () => {
    const res = validateBasementGpsFallback({
      staffLat: 0,
      staffLng: 0,
      isBasement: false,
      hasPhoto: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/mandatory for street and open residential/i);
    expect(res.requiresAudit).toBe(false);
  });

  it("rejects underground basement completions without an authorized reason code", () => {
    const res = validateBasementGpsFallback({
      staffLat: 0,
      staffLng: 0,
      isBasement: true,
      gpsUnavailableReason: "unknown_custom_reason",
      hasPhoto: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/requires a valid reason/i);
  });

  it("rejects underground basement completions without photo evidence", () => {
    const res = validateBasementGpsFallback({
      staffLat: 0,
      staffLng: 0,
      isBasement: true,
      gpsUnavailableReason: "underground_basement_no_signal",
      hasPhoto: false,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/Photo evidence is strictly mandatory/i);
  });

  it("permits deep basement fallback under audited conditions when reason and photo are provided", () => {
    const res = validateBasementGpsFallback({
      staffLat: 0,
      staffLng: 0,
      isBasement: true,
      gpsUnavailableReason: "underground_basement_no_signal",
      hasPhoto: true,
    });
    expect(res.allowed).toBe(true);
    expect(res.requiresAudit).toBe(true);
  });
});

describe("Media Privacy & 30-Day Auto-Purge Worker (MEDIA-007)", () => {
  beforeEach(() => {
    state.visits = [
      {
        id: 1,
        visitTime: new Date(Date.now() - 35 * 86400000), // 35 days ago (expired)
        photoUrl: "https://res.cloudinary.com/cwp/image/upload/v1/visit-1.jpg",
        mediaPurgedAt: null,
        retentionHold: false,
      },
      {
        id: 2,
        visitTime: new Date(Date.now() - 40 * 86400000), // 40 days ago but has retentionHold
        photoUrl: "https://res.cloudinary.com/cwp/image/upload/v1/visit-2.jpg",
        mediaPurgedAt: null,
        retentionHold: true,
      },
      {
        id: 3,
        visitTime: new Date(Date.now() - 10 * 86400000), // 10 days ago (fresh)
        photoUrl: "https://res.cloudinary.com/cwp/image/upload/v1/visit-3.jpg",
        mediaPurgedAt: null,
        retentionHold: false,
      },
    ];
    state.exceptions = [];
  });

  it("provides customer-facing 30-day retention policy disclosure", () => {
    const policy = getMediaRetentionPolicy();
    expect(policy.routineRetentionDays).toBe(30);
    expect(policy.exceptionRetentionDays).toBe(90);
    expect(policy.notice).toContain("30 days");
  });

  it("previews purgeable records in dryRun mode without modifying database", async () => {
    // Only visit 1 is >30 days old and retentionHold is false
    const eligibleVisit1 = state.visits.filter(v => v.id === 1);
    state.visits = eligibleVisit1;

    const res = await purgeExpiredVisitMedia({ days: 30, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.eligibleCount).toBe(1);
    expect(res.purgedCount).toBe(0);
    expect(res.visitIds).toEqual([1]);
    expect(state.visits[0].photoUrl).not.toBeNull();
  });

  it("executes routine purge and nullifies photoUrl while preserving visit audit records", async () => {
    const eligibleVisit1 = state.visits.filter(v => v.id === 1);
    state.visits = eligibleVisit1;

    const res = await purgeExpiredVisitMedia({ days: 30, dryRun: false });
    expect(res.dryRun).toBe(false);
    expect(res.purgedCount).toBe(1);
    expect(state.visits[0].photoUrl).toBeNull();
    expect(state.visits[0].mediaPurgedAt).toBeInstanceOf(Date);
  });

  it("toggles retention hold on a disputed visit to protect evidence", async () => {
    state.visits = [{ id: 4, photoUrl: "http://photo.jpg", retentionHold: false }];
    const updated = await setVisitRetentionHold(4, true, "Customer dispute under investigation");
    expect(updated.retentionHold).toBe(true);
  });
});

describe("Operational Exceptions Lifecycle & Atomic Resolution", () => {
  beforeEach(() => {
    state.subscriptions = [
      {
        id: 10,
        customerId: 5,
        vehicleId: 22,
        societyId: 101,
        cityId: 1,
        remainingCleanings: 15,
        usedCleanings: 11,
        status: "active",
      },
    ];
    state.exceptions = [];
    state.activityLogs = [];
  });

  it("creates an operational exception and records an activity audit log", async () => {
    const exc = await createOperationalException({
      subscriptionId: 10,
      societyId: 101,
      cityId: 1,
      exceptionType: "car_not_available",
      reason: "Designated bay B2-14 was empty during 06:30 morning round",
      evidencePhotoUrl: "https://cloudinary.com/empty-bay.jpg",
      reportedBy: 7,
    });

    expect(exc).toBeDefined();
    expect(exc.exceptionType).toBe("car_not_available");
    expect(exc.status).toBe("open");
    expect(state.activityLogs.some(l => l.action === "exception_reported")).toBe(true);
  });

  it("resolves exception with grant_makeup_credit by atomically crediting subscription", async () => {
    state.exceptions = [
      {
        id: 55,
        subscriptionId: 10,
        exceptionType: "customer_complaint",
        status: "open",
        reason: "Missed windshield clean",
      },
    ];

    const resolved = await resolveOperationalException({
      exceptionId: 55,
      action: "grant_makeup_credit",
      resolutionNotes: "Granted 1 courtesy make-up cleaning credit for missed exterior windshield wipe",
      resolvedBy: 1,
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionAction).toBe("grant_makeup_credit");
    expect(state.subscriptions[0].remainingCleanings).toBe(16);
    expect(state.activityLogs.some(l => l.action === "makeup_credit_granted")).toBe(true);
  });
});

describe("Society-Level Operations Dashboard Aggregation (DASH-002)", () => {
  beforeEach(() => {
    state.societies = [
      {
        id: 101,
        name: "Gaur City 2 - 16th Avenue",
        code: "GC-16",
        cityId: 1,
        cityName: "Noida",
        totalTowers: 14,
      },
    ];
    state.subscriptions = [
      { id: 1, societyId: 101, status: "active" },
      { id: 2, societyId: 101, status: "active" },
      { id: 3, societyId: 101, status: "active" },
    ];
    state.visits = [
      { id: 10, subscriptionId: 1, visitDate: "2026-11-12", visitType: "cleaning", status: "completed", staffId: 5 },
      { id: 11, subscriptionId: 2, visitDate: "2026-11-12", visitType: "cleaning", status: "car_not_available", staffId: 5 },
    ];
    state.assignments = [
      { subscriptionId: 1, staffId: 5, staffName: "Rahul Sharma", isActive: true },
      { subscriptionId: 2, staffId: 5, staffName: "Rahul Sharma", isActive: true },
      { subscriptionId: 3, staffId: 5, staffName: "Rahul Sharma", isActive: true },
    ];
    state.exceptions = [
      { id: 99, societyId: 101, status: "open", exceptionType: "car_not_available" },
    ];
  });

  it("accurately computes society completion percentages, pending jobs, and cleaner breakdown", async () => {
    const report = await getSocietyDailyOperations("2026-11-12", 1);

    expect(report.summary.totalSocieties).toBe(1);
    expect(report.summary.totalActiveSubscriptions).toBe(3);
    expect(report.summary.totalCompletedToday).toBe(1);
    expect(report.summary.totalCarNotAvailableToday).toBe(1);
    expect(report.summary.totalPendingToday).toBe(1); // 3 total - 1 completed - 1 cna = 1 pending
    expect(report.summary.overallCompletionPercentage).toBe(33); // 1 / 3 = 33%
    expect(report.summary.totalOpenExceptions).toBe(1);

    const soc = report.societies[0];
    expect(soc.societyName).toBe("Gaur City 2 - 16th Avenue");
    expect(soc.activeSubscriptionsCount).toBe(3);
    expect(soc.completedTodayCount).toBe(1);
    expect(soc.carNotAvailableTodayCount).toBe(1);
    expect(soc.pendingTodayCount).toBe(1);
    expect(soc.completionPercentage).toBe(33);

    expect(soc.assignedStaff.length).toBe(1);
    expect(soc.assignedStaff[0].staffName).toBe("Rahul Sharma");
    expect(soc.assignedStaff[0].assignedCount).toBe(3);
    expect(soc.assignedStaff[0].completedCount).toBe(1);
  });
});
