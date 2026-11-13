import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory test state
let mockBookings: any[] = [];
let mockContracts: any[] = [];
let mockServices: any[] = [];
let mockApprovalRequests: any[] = [];
let mockLocationLogs: any[] = [];
let mockExecutions: any[] = [];
let mockLocations: any[] = [];
let advisoryLockHeld = false;

// Mock pending assignment enqueuer
vi.mock("../../lib/assignments/pendingAssignmentEnqueue", () => ({
  enqueuePendingServiceAssignment: vi.fn().mockResolvedValue(1),
}));

// Mock brand identity
vi.mock("../../lib/brandIdentityService", () => ({
  getBrandName: vi.fn().mockResolvedValue("CWP Detailers"),
}));

// Mock scheduling domain service
vi.mock("../../lib/booking/scheduling", () => ({
  schedulingDomainService: {
    validate: vi.fn().mockImplementation(async (input: any) => {
      if (input.scheduledTime === "OCCUPIED_SLOT") {
        return { valid: false, error: "Requested time slot is fully booked" };
      }
      return {
        valid: true,
        window: {
          scheduledDate: input.scheduledDate,
          scheduledTime: input.scheduledTime || "10:00 AM - 12:00 PM",
          scheduledStartAt: new Date(`${input.scheduledDate}T10:00:00Z`),
          scheduledEndAt: new Date(`${input.scheduledDate}T12:00:00Z`),
          durationMinutes: 60,
        },
      };
    }),
  },
}));

// Helper to extract ID from SQL clauses (handles Drizzle queryChunks and composite clauses)
function extractIdFromClause(clause: any): number | undefined {
  if (!clause) return undefined;
  if (typeof clause.right === "number") return clause.right;
  if (clause.right && typeof clause.right.value === "number") return clause.right.value;
  if (clause.right && clause.right.value !== undefined && !isNaN(Number(clause.right.value))) {
    return Number(clause.right.value);
  }
  if (clause.value !== undefined && typeof clause.value === "number") return clause.value;
  if (clause.value !== undefined && !isNaN(Number(clause.value))) return Number(clause.value);

  if (Array.isArray(clause.queryChunks)) {
    for (const chunk of clause.queryChunks) {
      if (chunk && typeof chunk.value === "number") return chunk.value;
      if (chunk && typeof chunk === "number") return chunk;
      if (chunk && chunk.queryChunks) {
        const id = extractIdFromClause(chunk);
        if (id !== undefined) return id;
      }
    }
  }
  if (Array.isArray(clause.clauses)) {
    for (const sub of clause.clauses) {
      const id = extractIdFromClause(sub);
      if (id !== undefined) return id;
    }
  }
  return undefined;
}

function getQueryString(query: any): string {
  if (!query) return "";
  if (typeof query === "string") return query;
  if (Array.isArray(query.queryChunks)) {
    return query.queryChunks
      .map((c: any) => (typeof c === "string" ? c : c?.value !== undefined ? String(c.value) : getQueryString(c)))
      .join(" ");
  }
  return String(query);
}

// Mock database with in-memory stores
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          leftJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        offset: vi.fn(() => Promise.resolve(mockApprovalRequests)),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          where: vi.fn((clause: any) => {
            const executeWhere = () => {
              if (fields && typeof fields === "object" && "count" in fields) {
                if (table === actual.bookingsTable) {
                  const makeupCount = mockBookings.filter((b) => b.isMakeupBooking && b.status !== "cancelled").length;
                  return [{ count: makeupCount }];
                }
                if (table === actual.serviceExecutionLocationLogsTable) {
                  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
                  const oldLogs = mockLocationLogs.filter((l) => new Date(l.recordedAt).getTime() < cutoffTime);
                  return [{ count: oldLogs.length }];
                }
                return [{ count: 0 }];
              }

              if (table === actual.bookingsTable) {
                const id = extractIdFromClause(clause);
                if (id !== undefined) {
                  const b = mockBookings.find((item) => item.id === id);
                  return b ? [b] : [];
                }
                return mockBookings;
              }
              if (table === actual.makeupApprovalRequestsTable) {
                const id = extractIdFromClause(clause);
                if (id !== undefined) {
                  const r = mockApprovalRequests.find((item) => item.id === id || item.bookingId === id);
                  return r ? [r] : [];
                }
                return mockApprovalRequests;
              }
              if (table === actual.serviceExecutionsTable) {
                const id = extractIdFromClause(clause);
                const e = mockExecutions.find((item) => item.id === id || item.legacyBookingId === id);
                return e ? [e] : [];
              }
              if (table === actual.serviceLocationsTable) {
                const id = extractIdFromClause(clause);
                const loc = mockLocations.find((l) => l.id === id);
                return loc ? [loc] : [];
              }
              if (table === actual.staffTable) {
                return [{ name: "Rajesh Sharma", phone: "9876543210" }];
              }
              if (table === actual.customersTable) {
                return [{ name: "Sunil Kumar", phone: "9988776655" }];
              }
              return [];
            };

            return {
              limit: vi.fn(() => Promise.resolve(executeWhere().slice(0, 1))),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve(executeWhere())),
              })),
              then: (resolve: any) => resolve(executeWhere()),
            };
          }),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          if (table === actual.makeupApprovalRequestsTable) {
            const row = {
              id: mockApprovalRequests.length + 1,
              status: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
              ...val,
            };
            mockApprovalRequests.push(row);
            return {
              returning: vi.fn(() => Promise.resolve([row])),
            };
          }
          if (table === actual.bookingsTable) {
            const row = {
              id: mockBookings.length + 100,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...val,
            };
            mockBookings.push(row);
            return {
              returning: vi.fn(() => Promise.resolve([row])),
            };
          }
          if (table === actual.serviceExecutionLocationLogsTable) {
            mockLocationLogs.push({ id: mockLocationLogs.length + 1, ...val, recordedAt: val.recordedAt ?? new Date() });
            return Promise.resolve([val]);
          }
          return {
            returning: vi.fn(() => Promise.resolve([{ id: 1, ...val }])),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn((clause: any) => {
            if (table === actual.bookingsTable) {
              const id = extractIdFromClause(clause);
              const b = mockBookings.find((item) => item.id === id);
              if (b) {
                Object.assign(b, updates);
                return {
                  returning: vi.fn(() => Promise.resolve([{ id: b.id }])),
                };
              }
              return {
                returning: vi.fn(() => Promise.resolve([])),
              };
            }
            if (table === actual.makeupApprovalRequestsTable) {
              const id = extractIdFromClause(clause);
              const r = mockApprovalRequests.find((item) => item.id === id);
              if (r && r.status === "pending") {
                Object.assign(r, updates);
                return {
                  returning: vi.fn(() => Promise.resolve([r])),
                };
              }
              // If not found or status was not pending, return empty array to simulate atomic conflict!
              return {
                returning: vi.fn(() => Promise.resolve([])),
              };
            }
            if (table === actual.serviceExecutionsTable) {
              const id = extractIdFromClause(clause);
              const e = mockExecutions.find((item) => item.id === id);
              if (e) Object.assign(e, updates);
              return Promise.resolve();
            }
            return Promise.resolve();
          }),
        })),
      })),
      execute: vi.fn(async (query: any) => {
        const queryStr = getQueryString(query);
        if (queryStr.includes("pg_try_advisory_lock")) {
          if (advisoryLockHeld) {
            return [{ acquired: false }];
          }
          advisoryLockHeld = true;
          return [{ acquired: true }];
        }
        if (queryStr.includes("pg_advisory_unlock")) {
          advisoryLockHeld = false;
          return [{ unlocked: true }];
        }
        if (queryStr.includes("DELETE FROM service_execution_location_logs") || queryStr.includes("to_delete")) {
          const initialCount = mockLocationLogs.length;
          const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
          mockLocationLogs = mockLocationLogs.filter(
            (l) => new Date(l.recordedAt).getTime() >= cutoffTime,
          );
          const deletedCount = initialCount - mockLocationLogs.length;
          return { rowCount: deletedCount };
        }
        return [];
      }),
    },
  };
});

describe("Phase 18: Live Technician Tracking, GPS Reliability & Operational Approvals", () => {
  beforeEach(() => {
    mockBookings = [];
    mockContracts = [];
    mockServices = [];
    mockApprovalRequests = [];
    mockLocationLogs = [];
    mockExecutions = [];
    mockLocations = [];
    advisoryLockHeld = false;
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. TRACK-003: Customer Live GPS Tracking & Privacy
  // ==========================================
  describe("TRACK-003: Customer Live GPS Map & Privacy Controls", () => {
    it("enforces IDOR protection: rejects customer trying to view tracking for another customer's booking", async () => {
      const { getLiveTracking } = await import("../../lib/booking/services/trackingService");

      mockBookings.push({
        id: 101,
        customerId: 200,
        status: "assigned",
        assignedStaffId: 10,
        technicianEnRouteAt: new Date(),
        locationLat: 28.5355,
        locationLng: 77.3910,
      });

      const fakeReq: any = {
        user: { id: 999, role: "customer" }, // Different customer!
      };

      await expect(getLiveTracking(fakeReq, 101)).rejects.toThrow("Access denied: You can only view tracking for your own bookings");
    });

    it("enforces multi-city tenant isolation: rejects tracking if city scope mismatches", async () => {
      const { getLiveTracking } = await import("../../lib/booking/services/trackingService");

      mockBookings.push({
        id: 102,
        customerId: 200,
        cityId: 1, // City A (e.g. Varanasi)
        status: "assigned",
        assignedStaffId: 10,
        technicianEnRouteAt: new Date(),
      });

      const fakeReq: any = {
        user: { id: 50, role: "manager" },
        scope: { cityId: 2 }, // City B (e.g. Noida)
      };

      await expect(getLiveTracking(fakeReq, 102)).rejects.toThrow("Access denied: Booking belongs to another city");
    });

    it("immediately closes tracking when booking enters 'in_progress', 'completed', 'cancelled', or 'missed'", async () => {
      const { getLiveTracking } = await import("../../lib/booking/services/trackingService");

      const statuses = ["in_progress", "completed", "cancelled", "missed"] as const;

      for (const status of statuses) {
        mockBookings = [{
          id: 103,
          customerId: 200,
          status,
          assignedStaffId: 10,
          technicianEnRouteAt: new Date(),
          lastKnownLatitude: 28.5355,
          lastKnownLongitude: 77.3910,
        }];

        const fakeReq: any = { user: { id: 200, role: "customer" } };
        const res = await getLiveTracking(fakeReq, 103);

        expect(res.trackingActive).toBe(false);
        expect(res.isEnRoute).toBe(false);
        expect(res.status).toBe(status);
        if (status === "in_progress") {
          expect(res.message).toContain("in progress");
        } else {
          expect(res.message).toContain(`closed for ${status} services`);
        }
      }
    });

    it("flags stale location telemetry when last update is older than 3 minutes", async () => {
      const { getLiveTracking } = await import("../../lib/booking/services/trackingService");

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      mockBookings.push({
        id: 104,
        customerId: 200,
        status: "assigned",
        assignedStaffId: 10,
        technicianEnRouteAt: new Date(Date.now() - 10 * 60 * 1000),
        lastLocationUpdateAt: fiveMinutesAgo,
        lastKnownLatitude: 28.5355,
        lastKnownLongitude: 77.3910,
        locationLat: 28.5400,
        locationLng: 77.3950,
      });

      const fakeReq: any = { user: { id: 200, role: "customer" } };
      const res = await getLiveTracking(fakeReq, 104);

      expect(res.isStale).toBe(true);
      expect(res.fallbackMessage).toBe("Technician is on the way. Tracking details will update upon arrival.");
    });

    it("returns honest connected route polyline when both technician and destination coordinates are valid", async () => {
      const { getLiveTracking } = await import("../../lib/booking/services/trackingService");

      const recentTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago

      mockBookings.push({
        id: 105,
        customerId: 200,
        status: "assigned",
        assignedStaffId: 10,
        technicianEnRouteAt: new Date(Date.now() - 5 * 60 * 1000),
        lastLocationUpdateAt: recentTime,
        lastKnownLatitude: 28.5355,
        lastKnownLongitude: 77.3910,
        locationLat: 28.5420,
        locationLng: 77.3990,
        address: "Tower B, Sector 62, Noida",
        etaMinutes: 12,
      });

      const fakeReq: any = { user: { id: 200, role: "customer" } };
      const res = await getLiveTracking(fakeReq, 105);

      expect(res.trackingActive).toBe(true);
      expect(res.isStale).toBe(false);
      expect(res.technicianLatitude).toBe(28.5355);
      expect(res.technicianLongitude).toBe(77.3910);
      expect(res.destLatitude).toBe(28.5420);
      expect(res.destLongitude).toBe(77.3990);
      expect(res.destAddress).toBe("Tower B, Sector 62, Noida");
      expect(res.routePolyline).toEqual([
        [28.5355, 77.3910],
        [28.5420, 77.3990],
      ]);
    });
  });

  // ==========================================
  // 2. TRACK-004: Location Telemetry Ping & Staff Ownership
  // ==========================================
  describe("TRACK-004: Location Telemetry Ping & Staff Security", () => {
    it("ensures a staff member cannot submit GPS telemetry for another staff member's assignment", async () => {
      const { markTechnicianEnRoute } = await import("../../lib/booking/services/trackingService");

      mockBookings.push({
        id: 106,
        customerId: 200,
        status: "assigned",
        assignedStaffId: 10, // Assigned to staff #10
      });

      mockExecutions.push({
        id: 50,
        legacyBookingId: 106,
        assignedStaffId: 10,
      });

      const fakeReq: any = {
        user: { id: 99, role: "staff", staffId: 99 }, // Staff #99 trying to ping for Staff #10
        scope: { staffId: 99 },
      };

      await expect(
        markTechnicianEnRoute(fakeReq, {
          executionId: 50,
          latitude: 28.5355,
          longitude: 77.3910,
        }),
      ).rejects.toThrow("Only the assigned technician can mark en-route");
    });

    it("suppresses duplicate location pings arriving within 5 seconds with negligible movement (< 5m)", async () => {
      const { markTechnicianEnRoute } = await import("../../lib/booking/services/trackingService");

      const now = new Date();
      mockBookings.push({
        id: 107,
        customerId: 200,
        status: "assigned",
        assignedStaffId: 10,
        technicianEnRouteAt: now,
        lastLocationUpdateAt: now,
        lastKnownLatitude: 28.5355,
        lastKnownLongitude: 77.3910,
        locationLat: 28.5500,
        locationLng: 77.4000,
      });

      mockExecutions.push({
        id: 51,
        legacyBookingId: 107,
        assignedStaffId: 10,
      });

      const fakeReq: any = {
        user: { id: 10, role: "staff", staffId: 10 },
        scope: { staffId: 10 },
      };

      // Second ping 1 second later with identical coordinates
      const res = await markTechnicianEnRoute(fakeReq, {
        executionId: 51,
        latitude: 28.5355,
        longitude: 77.3910,
      });

      expect(res.success).toBe(true);
      expect(res.suppressedDuplicatePing).toBe(true);
      // Verify no duplicate row was pushed
      expect(mockLocationLogs.length).toBe(0);
    });
  });

  // ==========================================
  // 3. PRIVACY-003: Automated GPS Retention Purge Worker
  // ==========================================
  describe("PRIVACY-003: Automated GPS Retention Purge Worker", () => {
    it("purges raw GPS logs older than 7 days while preserving recent logs", async () => {
      const { purgeOldGpsLocationLogs, getGpsRetentionStats } = await import("../../lib/tracking/gpsRetentionWorker");

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      mockLocationLogs = [
        { id: 1, executionId: 50, recordedAt: tenDaysAgo, latitude: 28.5, longitude: 77.3 },
        { id: 2, executionId: 50, recordedAt: tenDaysAgo, latitude: 28.51, longitude: 77.31 },
        { id: 3, executionId: 51, recordedAt: twoDaysAgo, latitude: 28.52, longitude: 77.32 }, // Recent!
      ];

      const result = await purgeOldGpsLocationLogs({ retentionDays: 7, dryRun: false });

      expect(result.success).toBe(true);
      expect(result.recordsDeleted).toBe(2);
      expect(mockLocationLogs.length).toBe(1);
      expect(mockLocationLogs[0].id).toBe(3);

      const stats = getGpsRetentionStats();
      expect(stats.lastSuccessAt).toBeDefined();
      expect(stats.totalRecordsDeleted).toBe(2);
      expect(stats.retentionDaysConfigured).toBe(7);
    });

    it("respects PostgreSQL advisory lock to prevent concurrent multi-instance purge runs", async () => {
      const { purgeOldGpsLocationLogs } = await import("../../lib/tracking/gpsRetentionWorker");

      // Simulate lock already acquired by another worker instance
      advisoryLockHeld = true;

      const result = await purgeOldGpsLocationLogs();

      expect(result.success).toBe(true);
      expect(result.skippedDueToLock).toBe(true);
      expect(result.recordsDeleted).toBe(0);
    });
  });

  // ==========================================
  // 4. ADMIN-022: Supervisor Makeup Approval Queue
  // ==========================================
  describe("ADMIN-022: Supervisor Makeup Approval Queue", () => {
    it("triggers approval required when customer exceeds monthly complimentary quota", async () => {
      const { checkMakeupEligibility, scheduleMakeupBooking } = await import("../../lib/booking/services/makeupService");

      // Customer already had 1 complimentary makeup booking within 30 days
      mockBookings.push(
        {
          id: 201,
          customerId: 300,
          isMakeupBooking: true,
          status: "completed",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
        {
          id: 202,
          customerId: 300,
          status: "missed",
          scheduledDate: "2026-11-10",
          serviceType: "waterless_car_clean",
          cityId: 1,
          branchId: 1,
        },
      );

      const eligibility = await checkMakeupEligibility(202, 300);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.requiresApproval).toBe(true);
      expect(eligibility.usedCount).toBe(1);
      expect(eligibility.quota).toBe(1);
      expect(eligibility.reason).toContain("Complimentary monthly quota reached");

      // When customer schedules, it is routed to approval queue
      const fakeReq: any = {
        user: { id: 300, role: "customer", name: "Sunil Kumar" },
        headers: {},
        log: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      };

      const result = await scheduleMakeupBooking(fakeReq, {
        bookingId: 202,
        scheduledDate: "2026-11-20",
        scheduledTime: "10:00 AM",
        notes: "Need makeup visit for missed wash",
      });

      expect(result.success).toBe(true);
      expect(result.pendingApproval).toBe(true);
      expect(result.requestId).toBeDefined();

      const [approvalReq] = mockApprovalRequests;
      expect(approvalReq.status).toBe("pending");
      expect(approvalReq.bookingId).toBe(202);
      expect(approvalReq.customerId).toBe(300);
      expect(approvalReq.requestedDate).toBe("2026-11-20");

      // Original booking is marked as pending_approval
      const missedBooking = mockBookings.find((b) => b.id === 202);
      expect(missedBooking.makeupEligibilityStatus).toBe("pending_approval");
    });

    it("prevents duplicate pending requests for the same missed booking", async () => {
      const { checkMakeupEligibility } = await import("../../lib/booking/services/makeupService");

      mockBookings.push({
        id: 203,
        customerId: 300,
        status: "missed",
        scheduledDate: "2026-11-10",
      });

      mockApprovalRequests.push({
        id: 1,
        bookingId: 203,
        customerId: 300,
        status: "pending",
      });

      const eligibility = await checkMakeupEligibility(203, 300);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.code).toBe("APPROVAL_PENDING");
      expect(eligibility.reason).toContain("currently pending supervisor review");
    });

    it("supervisor approval revalidates capacity, updates request, creates linked booking, and records audit", async () => {
      const { approveMakeupRequest } = await import("../../lib/booking/services/approvalService");

      mockBookings.push({
        id: 204,
        customerId: 300,
        status: "missed",
        scheduledDate: "2026-11-10",
        serviceType: "waterless_car_clean",
        cityId: 1,
        branchId: 1,
      });

      mockApprovalRequests.push({
        id: 10,
        bookingId: 204,
        customerId: 300,
        cityId: 1,
        branchId: 1,
        requestedDate: "2026-11-22",
        requestedTime: "11:00 AM",
        status: "pending",
      });

      const fakeReq: any = {
        user: { id: 50, role: "manager", name: "Supervisor Dave" },
        headers: {},
        log: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      };

      const result = await approveMakeupRequest(fakeReq, 10, { notes: "Approved as courtesy" });

      expect(result.success).toBe(true);
      expect(result.status).toBe("approved");
      expect(result.booking).toBeDefined();
      expect(result.booking.isMakeupBooking).toBe(true);
      expect(result.booking.rescheduledFromBookingId).toBe(204);

      // Verify request state
      const updatedReq = mockApprovalRequests.find((r) => r.id === 10);
      expect(updatedReq.status).toBe("approved");
      expect(updatedReq.decidedBy).toBe(50);
      expect(updatedReq.decisionReason).toContain("Approved as courtesy");

      // Verify original booking link
      const originalBooking = mockBookings.find((b) => b.id === 204);
      expect(originalBooking.rescheduledToBookingId).toBe(result.booking.id);
      expect(originalBooking.makeupEligibilityStatus).toBe("rescheduled");
    });

    it("supervisor rejection requires mandatory reason, records audit trail, and marks booking ineligible", async () => {
      const { rejectMakeupRequest } = await import("../../lib/booking/services/approvalService");

      mockBookings.push({
        id: 205,
        customerId: 300,
        status: "missed",
        cityId: 1,
        branchId: 1,
      });

      mockApprovalRequests.push({
        id: 11,
        bookingId: 205,
        customerId: 300,
        cityId: 1,
        branchId: 1,
        status: "pending",
      });

      const fakeReq: any = {
        user: { id: 50, role: "manager", name: "Supervisor Dave" },
        headers: {},
        log: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      };

      // Empty rejection reason must fail
      await expect(rejectMakeupRequest(fakeReq, 11, "   ")).rejects.toThrow("A rejection reason is mandatory");

      // Valid rejection
      const result = await rejectMakeupRequest(fakeReq, 11, "Customer has already received 2 courtesy makeups this month");
      expect(result.success).toBe(true);
      expect(result.status).toBe("rejected");

      const reqRow = mockApprovalRequests.find((r) => r.id === 11);
      expect(reqRow.status).toBe("rejected");
      expect(reqRow.decisionReason).toContain("2 courtesy makeups");

      const original = mockBookings.find((b) => b.id === 205);
      expect(original.makeupEligibilityStatus).toBe("ineligible");
    });

    it("concurrency safety: prevents duplicate approval for already decided requests", async () => {
      const { approveMakeupRequest } = await import("../../lib/booking/services/approvalService");

      mockBookings.push({
        id: 206,
        customerId: 300,
        status: "missed",
        cityId: 1,
        branchId: 1,
      });

      mockApprovalRequests.push({
        id: 12,
        bookingId: 206,
        customerId: 300,
        cityId: 1,
        branchId: 1,
        status: "approved", // Already approved!
      });

      const fakeReq: any = {
        user: { id: 50, role: "manager" },
        headers: {},
        log: { error: vi.fn() },
      };

      await expect(approveMakeupRequest(fakeReq, 12)).rejects.toThrow("Request has already been approved");
    });
  });
});
