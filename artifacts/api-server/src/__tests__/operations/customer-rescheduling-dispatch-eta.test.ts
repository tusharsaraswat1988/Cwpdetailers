import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory test store
let mockBookings: any[] = [];
let mockContracts: any[] = [];
let mockServices: any[] = [];
let mockNotifications: any[] = [];
let mockLocationLogs: any[] = [];
let mockExecutions: any[] = [];

// Mock brand identity
vi.mock("../../lib/brandIdentityService", () => ({
  getBrandName: vi.fn().mockResolvedValue("CWP Detailers"),
}));

// Mock pending assignment enqueuer
vi.mock("../../lib/assignments/pendingAssignmentEnqueue", () => ({
  enqueuePendingServiceAssignment: vi.fn().mockResolvedValue(1),
}));

// Mock schedulingDomainService
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
          scheduledTime: input.scheduledTime || "09:00 AM - 11:00 AM",
          scheduledStartAt: new Date(`${input.scheduledDate}T09:00:00Z`),
          scheduledEndAt: new Date(`${input.scheduledDate}T11:00:00Z`),
          durationMinutes: 60,
        },
      };
    }),
  },
}));

// Mock database with in-memory tables
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          where: vi.fn((clause: any) => ({
            limit: vi.fn(() => {
              if (table === actual.bookingsTable) {
                const id = extractIdFromClause(clause);
                const b = mockBookings.find((item) => item.id === id);
                return Promise.resolve(b ? [b] : []);
              }
              if (table === actual.customerContractsTable) {
                const id = extractIdFromClause(clause);
                const c = mockContracts.find((item) => item.id === id);
                return Promise.resolve(c ? [c] : []);
              }
              if (table === actual.servicesTable) {
                const id = extractIdFromClause(clause);
                const s = mockServices.find((item) => item.id === id);
                return Promise.resolve(s ? [s] : []);
              }
              if (table === actual.notificationsTable) {
                const key = extractClauseValue(clause);
                const n = mockNotifications.find((item) => item.dedupeKey === key);
                return Promise.resolve(n ? [n] : []);
              }
              if (table === actual.serviceExecutionsTable) {
                const id = extractIdFromClause(clause);
                const e = mockExecutions.find((item) => item.id === id || item.legacyBookingId === id);
                return Promise.resolve(e ? [e] : []);
              }
              if (table === actual.staffTable) {
                return Promise.resolve([{ name: "Vikram Singh", phone: "9876543210" }]);
              }
              if (table === actual.customersTable) {
                return Promise.resolve([{ name: "Arjun Verma", phone: "9988776655" }]);
              }
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
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
          if (table === actual.notificationsTable) {
            const row = {
              id: mockNotifications.length + 1,
              createdAt: new Date(),
              ...val,
            };
            mockNotifications.push(row);
            return {
              returning: vi.fn(() => Promise.resolve([row])),
            };
          }
          if (table === actual.serviceExecutionLocationLogsTable) {
            mockLocationLogs.push(val);
            return Promise.resolve([val]);
          }
          return {
            returning: vi.fn(() => Promise.resolve([{ id: 1, ...val }])),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((clause: any) => {
            if (table === actual.bookingsTable) {
              const id = extractIdFromClause(clause);
              const b = mockBookings.find((item) => item.id === id);
              if (!b) return { returning: vi.fn(() => Promise.resolve([])) };

              // Check if clause requires rescheduledToBookingId IS NULL (atomic lock)
              const hasNullCheck = hasRescheduledNullCheck(clause);
              if (hasNullCheck && b.rescheduledToBookingId != null) {
                return { returning: vi.fn(() => Promise.resolve([])) };
              }

              Object.assign(b, vals);
              return {
                returning: vi.fn(() => Promise.resolve([{ id: b.id }])),
              };
            }
            if (table === actual.serviceExecutionsTable) {
              const id = extractIdFromClause(clause);
              const e = mockExecutions.find((item) => item.id === id);
              if (e) Object.assign(e, vals);
              return {
                returning: vi.fn(() => Promise.resolve(e ? [e] : [])),
              };
            }
            return {
              returning: vi.fn(() => Promise.resolve([])),
            };
          }),
        })),
      })),
    },
  };
});

function extractIdFromClause(clause: any): number | undefined {
  if (!clause) return undefined;
  if (typeof clause.right === "number") return clause.right;
  if (clause.right && typeof clause.right.value === "number") return clause.right.value;
  if (clause.right && clause.right.value !== undefined && !isNaN(Number(clause.right.value))) {
    return Number(clause.right.value);
  }
  if (Array.isArray(clause.queryChunks)) {
    for (const chunk of clause.queryChunks) {
      if (chunk && typeof chunk.value === "number") return chunk.value;
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

function hasRescheduledNullCheck(clause: any): boolean {
  if (!clause) return false;
  if (Array.isArray(clause.queryChunks)) {
    for (const chunk of clause.queryChunks) {
      if (typeof chunk?.value === "string" && chunk.value.includes("rescheduled_to_booking_id IS NULL")) {
        return true;
      }
    }
  }
  if (Array.isArray(clause.clauses)) {
    return clause.clauses.some((sub: any) => hasRescheduledNullCheck(sub));
  }
  return false;
}

function extractClauseValue(clause: any): string | undefined {
  if (!clause) return undefined;
  if (typeof clause.right === "string") return clause.right;
  if (clause.right && typeof clause.right.value === "string") return clause.right.value;
  if (clause.right && clause.right.value !== undefined) return String(clause.right.value);
  if (Array.isArray(clause.queryChunks)) {
    for (const chunk of clause.queryChunks) {
      if (chunk && typeof chunk.value === "string") return chunk.value;
    }
  }
  return undefined;
}

import {
  checkMakeupEligibility,
  scheduleMakeupBooking,
} from "../../lib/booking/services/makeupService";

import {
  calculateDistanceKm,
  calculateEta,
  markTechnicianEnRoute,
  getLiveTracking,
} from "../../lib/booking/services/trackingService";

import {
  dispatchNotification,
  notifyTechnicianEnRoute,
  notifyServiceStarted,
  notifyServiceMissed,
  notifyMakeupBookingConfirmed,
  notifyStaffReassigned,
  notifyStaffScheduleChanged,
  notifyStaffAssignmentCancelled,
  notifyAdminAssignmentFailure,
  notifyAdminServiceMissed,
  notifyAdminRepeatedFailure,
  notifyAdminRescheduleApprovalRequired,
} from "../../lib/notifications/dispatcher";

describe("Phase 17 — Customer Self-Service Rescheduling, Dispatch Notifications & ETA Foundation", () => {
  beforeEach(() => {
    mockBookings = [];
    mockContracts = [];
    mockServices = [];
    mockNotifications = [];
    mockLocationLogs = [];
    mockExecutions = [];
  });

  describe("Task 1 & Task 7 — Missed Service Eligibility (OPS-005 / CUST-021)", () => {
    it("permits self-service makeup scheduling for a legitimate missed booking", async () => {
      mockBookings.push({
        id: 101,
        customerId: 10,
        status: "missed",
        scheduledDate: "2026-11-12",
        serviceType: "deep_cleaning",
        rescheduledToBookingId: null,
      });

      const result = await checkMakeupEligibility(101, 10);
      expect(result.eligible).toBe(true);
      expect(result.booking?.id).toBe(101);
    });

    it("rejects completed bookings from self-service makeup scheduling", async () => {
      mockBookings.push({
        id: 102,
        customerId: 10,
        status: "completed",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: null,
      });

      const result = await checkMakeupEligibility(102, 10);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("ALREADY_COMPLETED");
    });

    it("rejects cancelled bookings from self-service makeup scheduling", async () => {
      mockBookings.push({
        id: 103,
        customerId: 10,
        status: "cancelled",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: null,
      });

      const result = await checkMakeupEligibility(103, 10);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("CANCELLED");
    });

    it("rejects bookings that are not in missed status (e.g. scheduled or assigned)", async () => {
      mockBookings.push({
        id: 104,
        customerId: 10,
        status: "assigned",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: null,
      });

      const result = await checkMakeupEligibility(104, 10);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("NOT_MISSED");
    });

    it("rejects bookings where a makeup service has already been scheduled", async () => {
      mockBookings.push({
        id: 105,
        customerId: 10,
        status: "missed",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: 205, // already has replacement
      });

      const result = await checkMakeupEligibility(105, 10);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("ALREADY_RESCHEDULED");
      expect(result.rescheduledToBookingId).toBe(205);
    });

    it("blocks makeup scheduling if the associated subscription contract is cancelled or terminated", async () => {
      mockContracts.push({
        id: 50,
        status: "cancelled",
      });
      mockBookings.push({
        id: 106,
        customerId: 10,
        status: "missed",
        scheduledDate: "2026-11-12",
        contractRegistryId: 50,
        rescheduledToBookingId: null,
      });

      const result = await checkMakeupEligibility(106, 10);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("SUBSCRIPTION_INELIGIBLE");
    });
  });

  describe("Customer Authorization & IDOR Protection", () => {
    it("rejects an unauthorized customer attempting to check or reschedule another customer's booking", async () => {
      mockBookings.push({
        id: 107,
        customerId: 10, // Owned by customer 10
        status: "missed",
        scheduledDate: "2026-11-12",
      });

      // Customer 99 attempts to access Customer 10's booking
      const eligibility = await checkMakeupEligibility(107, 99);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.code).toBe("FORBIDDEN");

      const req: any = {
        user: { id: 99, role: "customer" },
        headers: {},
      };

      await expect(
        scheduleMakeupBooking(req, {
          bookingId: 107,
          scheduledDate: "2026-11-20",
          scheduledTime: "09:00 AM - 11:00 AM",
        }),
      ).rejects.toThrow(/not authorized/);
    });

    it("rejects an unauthorized customer attempting to view live tracking of another customer's service", async () => {
      mockBookings.push({
        id: 108,
        customerId: 10,
        status: "in_progress",
      });

      const req: any = {
        user: { id: 99, role: "customer" },
      };

      await expect(getLiveTracking(req, 108)).rejects.toThrow(/Access denied/);
    });
  });

  describe("Linked Booking Creation & Non-Duplication of Billing", () => {
    it("creates a linked makeup booking with ₹0 complimentary fulfillment and preserves original history", async () => {
      mockBookings.push({
        id: 110,
        customerId: 10,
        cityId: 1,
        branchId: 2,
        status: "missed",
        serviceType: "foam_wash",
        scheduledDate: "2026-11-12",
        scheduledTime: "10:00 AM",
        rescheduledToBookingId: null,
      });

      const req: any = {
        user: { id: 10, role: "customer", name: "Arjun Verma" },
        headers: { "x-request-id": "req-phase17-makeup-1" },
        log: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
      };

      const result = await scheduleMakeupBooking(req, {
        bookingId: 110,
        scheduledDate: "2026-11-20",
        scheduledTime: "09:00 AM - 11:00 AM",
        notes: "Please call on arrival",
      });

      expect(result.success).toBe(true);
      expect(result.makeupBooking).toBeDefined();
      expect(result.makeupBooking.isMakeupBooking).toBe(true);
      expect(result.makeupBooking.rescheduledFromBookingId).toBe(110);
      expect(result.makeupBooking.status).toBe("waiting_assignment");

      // Verify original booking is linked and preserves 'missed' audit status
      const original = mockBookings.find((b) => b.id === 110);
      expect(original.rescheduledToBookingId).toBe(result.makeupBooking.id);
      expect(original.status).toBe("missed"); // Historical record is NOT destroyed
      expect(original.makeupEligibilityStatus).toBe("rescheduled");
    });

    it("prevents repeated makeup booking creation for the same missed service", async () => {
      mockBookings.push({
        id: 111,
        customerId: 10,
        status: "missed",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: 199, // already rescheduled
      });

      const req: any = {
        user: { id: 10, role: "customer" },
        headers: {},
      };

      await expect(
        scheduleMakeupBooking(req, {
          bookingId: 111,
          scheduledDate: "2026-11-20",
        }),
      ).rejects.toThrow(/already been scheduled/);
    });

    it("prevents slot collision when target slot is unavailable", async () => {
      mockBookings.push({
        id: 112,
        customerId: 10,
        status: "missed",
        scheduledDate: "2026-11-12",
        rescheduledToBookingId: null,
      });

      const req: any = {
        user: { id: 10, role: "customer" },
        headers: {},
      };

      await expect(
        scheduleMakeupBooking(req, {
          bookingId: 112,
          scheduledDate: "2026-11-20",
          scheduledTime: "OCCUPIED_SLOT",
        }),
      ).rejects.toThrow(/Requested time slot is fully booked/);
    });
  });

  describe("Technician En-Route, Location Privacy & Non-Fabricated ETA Foundation (TRACK-001 / TRACK-002)", () => {
    it("calculates accurate Haversine distance between coordinates", () => {
      // Sector 62 Noida to Sector 18 Noida (~9.5 km)
      const dist = calculateDistanceKm(28.628, 77.3649, 28.5708, 77.326);
      expect(dist).toBeGreaterThan(7);
      expect(dist).toBeLessThan(12);
    });

    it("derives non-fabricated urban ETA using city speed heuristic + parking buffer", () => {
      // 5km distance at 20km/h = 15 mins + 5 mins buffer = 20 mins
      const currentLat = 28.628;
      const currentLng = 77.3649;
      // offset by ~5km south
      const destLat = currentLat - 0.045;
      const destLng = currentLng;

      const eta = calculateEta(currentLat, currentLng, destLat, destLng);
      expect(eta).not.toBeNull();
      expect(eta?.etaMinutes).toBeGreaterThanOrEqual(15);
      expect(eta?.etaMinutes).toBeLessThanOrEqual(30);
      expect(eta?.estimatedArrivalAt).toBeInstanceOf(Date);
    });

    it("refuses to fabricate ETA when coordinates are missing or zero", () => {
      expect(calculateEta(0, 0, 28.62, 77.36)).toBeNull();
      expect(calculateEta(null, null, 28.62, 77.36)).toBeNull();
      expect(calculateEta(28.62, 77.36, undefined, undefined)).toBeNull();
    });

    it("refuses to fabricate precise ETA when distance exceeds realistic urban dispatch (> 50 km)", () => {
      // Delhi to Agra (~180 km)
      const eta = calculateEta(28.62, 77.36, 27.18, 78.0);
      expect(eta).toBeNull();
    });

    it("marks technician en-route and updates tracking state", async () => {
      mockBookings.push({
        id: 120,
        customerId: 10,
        assignedStaffId: 7,
        status: "assigned",
        locationLat: 28.628,
        locationLng: 77.3649,
      });

      const req: any = {
        log: { info: vi.fn(), error: vi.fn() },
      };

      const result = await markTechnicianEnRoute(req, {
        bookingId: 120,
        latitude: 28.635,
        longitude: 77.37,
      });

      expect(result.success).toBe(true);
      expect(result.enRouteAt).toBeDefined();

      const booking = mockBookings.find((b) => b.id === 120);
      expect(booking.technicianEnRouteAt).toBeDefined();
    });

    it("enforces strict privacy controls: shuts down tracking immediately after service completion", async () => {
      mockBookings.push({
        id: 121,
        customerId: 10,
        status: "completed", // Service finished!
        technicianEnRouteAt: new Date(),
        lastKnownLatitude: 28.628,
        lastKnownLongitude: 77.3649,
      });

      const req: any = {
        user: { id: 10, role: "customer" },
      };

      const tracking = await getLiveTracking(req, 121);
      expect(tracking.trackingActive).toBe(false);
      expect((tracking as any).currentLatitude).toBeUndefined(); // Coordinates hidden!
      expect((tracking as any).currentLongitude).toBeUndefined();
    });

    it("provides honest fallback message when technician is en-route but GPS location is unavailable", async () => {
      mockBookings.push({
        id: 122,
        customerId: 10,
        assignedStaffId: 7,
        status: "assigned",
        technicianEnRouteAt: new Date(),
        // No location coordinates logged
      });

      const req: any = {
        user: { id: 10, role: "customer" },
      };

      const tracking = await getLiveTracking(req, 122);
      expect(tracking.isEnRoute).toBe(true);
      expect(tracking.etaMinutes).toBeNull(); // Honest null ETA
      expect(tracking.fallbackMessage).toBe("Technician is on the way. Tracking details will update upon arrival.");
    });
  });

  describe("Task 2 — Operational Dispatch Notifications (NOTIF-004)", () => {
    it("guarantees notification idempotency via dedupeKey", async () => {
      const input = {
        template: "booking_confirmed" as const,
        customerId: 10,
        vars: { customerName: "Arjun", serviceName: "Foam Wash", scheduledDate: "2026-11-20" },
        dedupeKey: "idempotent-booking-120-test",
      };

      const first = await dispatchNotification(input);
      expect(first.skipped).toBe(false);

      const second = await dispatchNotification(input);
      expect(second.skipped).toBe(true);
      expect(second.reason).toBe("duplicate");
    });

    it("masks sensitive customer unit/flat addresses when sensitiveMasked: true", async () => {
      const result = await dispatchNotification({
        title: "Staff Assignment",
        message: "Service assigned at Gaur City Flat 402-B Tower 3",
        customerId: 10,
        sensitiveMasked: true,
      });

      expect(result.skipped).toBe(false);
      const inserted = mockNotifications[mockNotifications.length - 1];
      expect(inserted.message).toContain("Flat ***");
      expect(inserted.message).not.toContain("Flat 402-B");
    });

    it("dispatches technician en-route notification to customer", async () => {
      await expect(
        notifyTechnicianEnRoute({
          bookingId: 120,
          customerId: 10,
          customerName: "Arjun Verma",
          staffName: "Vikram Singh",
          serviceName: "Interior Spa",
          etaMinutes: 15,
        }),
      ).resolves.not.toThrow();
    });

    it("dispatches makeup booking confirmation notification", async () => {
      await expect(
        notifyMakeupBookingConfirmed({
          bookingId: 201,
          originalBookingId: 101,
          customerId: 10,
          customerName: "Arjun Verma",
          serviceName: "Deep Cleaning",
          scheduledDate: "2026-11-22",
          scheduledTime: "09:00 AM",
        }),
      ).resolves.not.toThrow();
    });

    it("dispatches staff reassignment and schedule cancellation notifications", async () => {
      await expect(
        notifyStaffReassigned({
          staffId: 7,
          staffName: "Vikram Singh",
          customerId: 10,
          customerName: "Arjun Verma",
          serviceName: "Foam Wash",
          scheduledDate: "2026-11-20",
          bookingId: 120,
        }),
      ).resolves.not.toThrow();

      await expect(
        notifyStaffAssignmentCancelled({
          staffId: 7,
          staffName: "Vikram Singh",
          customerName: "Arjun Verma",
          serviceName: "Foam Wash",
          scheduledDate: "2026-11-20",
          bookingId: 120,
          reason: "Customer requested makeup reschedule",
        }),
      ).resolves.not.toThrow();
    });

    it("dispatches operational exception alerts to admin/supervisors", async () => {
      await expect(
        notifyAdminAssignmentFailure({
          bookingId: 120,
          serviceName: "Solar Panel Deep Clean",
          cityName: "Noida",
        }),
      ).resolves.not.toThrow();

      await expect(
        notifyAdminServiceMissed({
          bookingId: 120,
          customerName: "Arjun Verma",
          staffName: "Vikram Singh",
          reason: "Customer vehicle bay locked and inaccessible",
        }),
      ).resolves.not.toThrow();

      await expect(
        notifyAdminRepeatedFailure({
          customerId: 10,
          customerName: "Arjun Verma",
          customerPhone: "9988776655",
          failureCount: 3,
        }),
      ).resolves.not.toThrow();

      await expect(
        notifyAdminRescheduleApprovalRequired({
          bookingId: 120,
          customerName: "Arjun Verma",
          reason: "Exceeds daily complimentary makeup limit",
        }),
      ).resolves.not.toThrow();
    });
  });
});
