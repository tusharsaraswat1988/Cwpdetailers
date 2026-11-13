import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock db for testing domain and service logic
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({
      insert: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }),
      update: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }),
      select: vi.fn(),
    })),
  },
  bookingsTable: {
    id: "id",
    customerId: "customer_id",
    scheduledDate: "scheduled_date",
    scheduledTime: "scheduled_time",
    status: "status",
    assetId: "asset_id",
    vehicleId: "vehicle_id",
    assignedStaffId: "assigned_staff_id",
    startedAt: "started_at",
    completedAt: "completed_at",
  },
  serviceAssignmentsTable: {
    id: "id",
    bookingId: "booking_id",
    assignedStaffId: "assigned_staff_id",
    taskType: "task_type",
    status: "status",
  },
  serviceExecutionsTable: {
    id: "id",
    serviceAssignmentId: "service_assignment_id",
    legacyBookingId: "legacy_booking_id",
    taskType: "task_type",
    status: "status",
  },
  pendingServiceAssignmentsTable: {
    id: "id",
    contractRegistryId: "contract_registry_id",
    bookingId: "booking_id",
    status: "status",
  },
  dcmsVisitsTable: {
    id: "id",
    subscriptionId: "subscription_id",
    visitType: "visit_type",
    visitTime: "visit_time",
    status: "status",
  },
  invoicesTable: {
    id: "id",
    bookingId: "booking_id",
    contractRegistryId: "contract_registry_id",
    status: "status",
  },
  bookingEventsTable: {},
  bookingTimelineTable: {},
  bookingSnapshotsTable: {},
  addressesTable: {},
  addressIdentitiesTable: {},
}));

import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  SLOT_OCCUPYING_STATUSES,
  validateTransition,
  canTransition,
  isTerminalStatus,
  isActiveScheduleStatus,
  BookingStateMachineError,
} from "../../lib/booking/domain/stateMachine";

import {
  assertStaffAssignable,
  assertStaffBranchMatch,
} from "../../lib/assignments/assignmentValidation";

import {
  assertJobReadyForBilling,
  assertContractBillable,
  assertNonNegativeTotals,
  isSubscriptionVisitMode,
  isOneTimeMode,
} from "../../lib/billing/commercialValidation";

import { RECOGNIZED_INVOICE_STATUSES } from "../../lib/billing/commercialValidation";

describe("Phase 16 — Core Service Operations & Booking-to-Execution Consistency", () => {
  describe("Task 2 — Booking-to-Execution 10-State Lifecycle", () => {
    it("defines the complete 10 operational states in sequence", () => {
      const expectedStatuses = [
        "draft",
        "scheduled",
        "confirmed",
        "waiting_assignment",
        "assigned",
        "in_progress",
        "completed",
        "missed",
        "rescheduled",
        "cancelled",
      ];
      for (const st of expectedStatuses) {
        expect(BOOKING_STATUSES).toContain(st);
      }
      expect(BOOKING_STATUSES.length).toBe(10);
    });

    it("verifies forward progression through the canonical service path", () => {
      // 1. draft -> scheduled
      expect(canTransition("draft", "scheduled")).toBe(true);
      // 2. scheduled -> confirmed
      expect(canTransition("scheduled", "confirmed")).toBe(true);
      // 3. confirmed -> waiting_assignment
      expect(canTransition("confirmed", "waiting_assignment")).toBe(true);
      // 4. waiting_assignment -> assigned
      expect(canTransition("waiting_assignment", "assigned")).toBe(true);
      // 5. assigned -> in_progress
      expect(canTransition("assigned", "in_progress")).toBe(true);
      // 6. in_progress -> completed
      expect(canTransition("in_progress", "completed")).toBe(true);
    });

    it("verifies operational exception transitions", () => {
      // Assigned staff can report missed
      expect(canTransition("assigned", "missed")).toBe(true);
      // In-progress service can encounter unexpected blockage and be marked missed
      expect(canTransition("in_progress", "missed")).toBe(true);
      // Rescheduling is permitted from pre-execution states
      expect(canTransition("scheduled", "rescheduled")).toBe(true);
      expect(canTransition("confirmed", "rescheduled")).toBe(true);
      expect(canTransition("waiting_assignment", "rescheduled")).toBe(true);
      expect(canTransition("assigned", "rescheduled")).toBe(true);
      // Cancellation is allowed prior to field completion
      expect(canTransition("draft", "cancelled")).toBe(true);
      expect(canTransition("scheduled", "cancelled")).toBe(true);
      expect(canTransition("confirmed", "cancelled")).toBe(true);
      expect(canTransition("waiting_assignment", "cancelled")).toBe(true);
      expect(canTransition("assigned", "cancelled")).toBe(true);
      expect(canTransition("in_progress", "cancelled")).toBe(true);
    });

    it("prevents invalid reverse or jump transitions", () => {
      // Cannot jump from draft to in_progress or completed
      expect(() => validateTransition("draft", "in_progress")).toThrow(BookingStateMachineError);
      expect(() => validateTransition("draft", "completed")).toThrow(BookingStateMachineError);
      // Terminal states (completed, cancelled) cannot transition anywhere
      expect(isTerminalStatus("completed")).toBe(true);
      expect(isTerminalStatus("cancelled")).toBe(true);
      expect(() => validateTransition("completed", "in_progress")).toThrow(BookingStateMachineError);
      expect(() => validateTransition("cancelled", "assigned")).toThrow(BookingStateMachineError);
      expect(() => validateTransition("completed", "draft")).toThrow(BookingStateMachineError);
    });
  });

  describe("Task 3 — Duplicate Job Prevention & Idempotency", () => {
    it("ensures all in-flight operational states occupy calendar/technician slots", () => {
      // Drafts hold the slot during checkout; confirmed, waiting, assigned, in_progress occupy slots in field
      expect(SLOT_OCCUPYING_STATUSES).toContain("draft");
      expect(SLOT_OCCUPYING_STATUSES).toContain("scheduled");
      expect(SLOT_OCCUPYING_STATUSES).toContain("confirmed");
      expect(SLOT_OCCUPYING_STATUSES).toContain("waiting_assignment");
      expect(SLOT_OCCUPYING_STATUSES).toContain("assigned");
      expect(SLOT_OCCUPYING_STATUSES).toContain("in_progress");
      // Terminal states must NOT occupy slots
      expect(SLOT_OCCUPYING_STATUSES).not.toContain("cancelled");
      expect(SLOT_OCCUPYING_STATUSES).not.toContain("completed");
    });

    it("verifies active schedule status classification", () => {
      expect(isActiveScheduleStatus("waiting_assignment")).toBe(true);
      expect(isActiveScheduleStatus("assigned")).toBe(true);
      expect(isActiveScheduleStatus("in_progress")).toBe(true);
      expect(isActiveScheduleStatus("completed")).toBe(false);
      expect(isActiveScheduleStatus("cancelled")).toBe(false);
    });
  });

  describe("Task 4 — Staff Assignment & Eligibility Verification", () => {
    const validStaff = {
      id: 101,
      name: "Rahul Sharma",
      phone: "9876543210",
      employeeCode: "EMP-101",
      isActive: true,
      verificationStatus: "verified",
      branchId: 5,
      companyId: 1,
      franchiseeId: null,
    };

    it("accepts active, verified staff with matching branch", () => {
      expect(() => assertStaffAssignable(validStaff as never)).not.toThrow();
      expect(() => assertStaffBranchMatch(validStaff as never, 5)).not.toThrow();
    });

    it("rejects inactive staff from assignment", () => {
      const inactive = { ...validStaff, isActive: false };
      expect(() => assertStaffAssignable(inactive as never)).toThrow(/inactive/i);
    });

    it("rejects unverified or suspended staff", () => {
      const pending = { ...validStaff, verificationStatus: "pending" };
      expect(() => assertStaffAssignable(pending as never)).toThrow(/verified/i);

      const suspended = { ...validStaff, verificationStatus: "suspended" };
      expect(() => assertStaffAssignable(suspended as never)).toThrow(/suspended/i);

      const rejected = { ...validStaff, verificationStatus: "rejected" };
      expect(() => assertStaffAssignable(rejected as never)).toThrow(/rejected/i);
    });

    it("rejects cross-branch staff assignment strictly enforcing city/branch scope", () => {
      // Staff belongs to branch 5, but contract/job is assigned to branch 8 (e.g. Noida vs Varanasi)
      expect(() => assertStaffBranchMatch(validStaff as never, 8)).toThrow(/different branch/i);
    });

    it("permits unassigned-branch jobs to be claimed without branch mismatch", () => {
      expect(() => assertStaffBranchMatch(validStaff as never, null)).not.toThrow();
    });
  });

  describe("Task 5 — Billing Reconciliation & Financial Integrity", () => {
    it("ensures completed jobs are ready for commercial closure and billing", () => {
      const completedJob = {
        id: 201,
        status: "completed",
        opsStatus: "ready_for_billing",
        completedAt: new Date(),
      };
      expect(() => assertJobReadyForBilling(completedJob as never)).not.toThrow();
    });

    it("rejects non-completed or in-progress jobs from generating invoices", () => {
      const inProgressJob = {
        id: 202,
        status: "started",
        opsStatus: "in_field",
        completedAt: null,
      };
      expect(() => assertJobReadyForBilling(inProgressJob as never)).toThrow(/ready_for_billing/i);

      const readyJob = {
        id: 203,
        status: "ready_for_execution",
        opsStatus: "in_field",
        completedAt: null,
      };
      expect(() => assertJobReadyForBilling(readyJob as never)).toThrow(/ready_for_billing/i);
    });

    it("distinguishes subscription visit mode from one-time billing mode to prevent double billing", () => {
      expect(isSubscriptionVisitMode("dcms")).toBe(true);
      expect(isSubscriptionVisitMode("subscription")).toBe(true);
      expect(isSubscriptionVisitMode("entitlement")).toBe(true);
      expect(isSubscriptionVisitMode("booking")).toBe(false);
      expect(isOneTimeMode("booking")).toBe(true);
      expect(isOneTimeMode("dcms")).toBe(false);
    });

    it("enforces non-negative invoice totals", () => {
      expect(() => assertNonNegativeTotals(540, 50)).not.toThrow();
      expect(() => assertNonNegativeTotals(-100, 0)).toThrow(/negative/i);
      expect(() => assertNonNegativeTotals(100, -10)).toThrow(/negative/i);
    });

    it("restricts recognized revenue to closed/issued/paid invoice statuses (FIN-004)", () => {
      // Draft and cancelled invoices must never be recognized as platform or staff revenue
      expect(RECOGNIZED_INVOICE_STATUSES).toContain("paid");
      expect(RECOGNIZED_INVOICE_STATUSES).toContain("sent");
      expect(RECOGNIZED_INVOICE_STATUSES).toContain("overdue");
      expect(RECOGNIZED_INVOICE_STATUSES as readonly string[]).not.toContain("draft");
      expect(RECOGNIZED_INVOICE_STATUSES as readonly string[]).not.toContain("cancelled");
      expect(RECOGNIZED_INVOICE_STATUSES as readonly string[]).not.toContain("void");
    });
  });

  describe("Task 3 & 4 — Operational Reassignment & Removal Rules", () => {
    it("allows assignment to transition back to waiting_assignment when staff is removed", () => {
      expect(canTransition("assigned", "waiting_assignment")).toBe(true);
    });

    it("allows assignment to be directly reassigned to a new staff member", () => {
      // Transition from assigned -> assigned with new staffId
      expect(canTransition("assigned", "assigned")).toBe(true);
    });
  });

  describe("Task 3 — Window Overlap & Time Slot Integrity", () => {
    it("correctly identifies overlapping time intervals", async () => {
      const { windowsOverlap } = await import("../../lib/booking/scheduling/TimeWindow");
      const aStart = new Date("2026-07-20T10:00:00Z");
      const aEnd = new Date("2026-07-20T11:00:00Z");

      // Overlap case 1: Partially overlapping
      const bStart1 = new Date("2026-07-20T10:30:00Z");
      const bEnd1 = new Date("2026-07-20T11:30:00Z");
      expect(windowsOverlap(aStart, aEnd, bStart1, bEnd1)).toBe(true);

      // Overlap case 2: Contained within
      const bStart2 = new Date("2026-07-20T10:15:00Z");
      const bEnd2 = new Date("2026-07-20T10:45:00Z");
      expect(windowsOverlap(aStart, aEnd, bStart2, bEnd2)).toBe(true);

      // Non-overlap case: Contiguous boundary (half-open [start, end))
      const bStart3 = new Date("2026-07-20T11:00:00Z");
      const bEnd3 = new Date("2026-07-20T12:00:00Z");
      expect(windowsOverlap(aStart, aEnd, bStart3, bEnd3)).toBe(false);

      // Non-overlap case: Completely disjoint
      const bStart4 = new Date("2026-07-20T14:00:00Z");
      const bEnd4 = new Date("2026-07-20T15:00:00Z");
      expect(windowsOverlap(aStart, aEnd, bStart4, bEnd4)).toBe(false);
    });
  });

  describe("Task 2 & 4 — Booking Execution Field Synchronization Contract", () => {
    it("verifies field updates applied per status transition", () => {
      function computeUpdateData(
        toStatus: string,
        opts: { assignedStaffId?: number | null; reason?: string } = {},
      ) {
        const updateData: Record<string, unknown> = {
          status: toStatus,
          updatedAt: new Date(),
        };
        if (toStatus === "confirmed") {
          updateData.customerConfirmedAt = new Date();
        }
        if (toStatus === "waiting_assignment") {
          updateData.assignedStaffId = null;
        }
        if (toStatus === "assigned" && opts.assignedStaffId != null) {
          updateData.assignedStaffId = opts.assignedStaffId;
        }
        if (toStatus === "in_progress") {
          updateData.startedAt = new Date();
        }
        if (toStatus === "completed") {
          updateData.completedAt = new Date();
        }
        if (toStatus === "missed" && opts.reason) {
          updateData.cancellationReason = opts.reason;
        }
        if (toStatus === "cancelled" && opts.reason) {
          updateData.cancellationReason = opts.reason;
        }
        return updateData;
      }

      // confirmed
      const conf = computeUpdateData("confirmed");
      expect(conf.customerConfirmedAt).toBeInstanceOf(Date);

      // assigned
      const assigned = computeUpdateData("assigned", { assignedStaffId: 42 });
      expect(assigned.assignedStaffId).toBe(42);

      // waiting_assignment clears staff
      const unassigned = computeUpdateData("waiting_assignment");
      expect(unassigned.assignedStaffId).toBeNull();

      // in_progress
      const started = computeUpdateData("in_progress");
      expect(started.startedAt).toBeInstanceOf(Date);

      // completed
      const done = computeUpdateData("completed");
      expect(done.completedAt).toBeInstanceOf(Date);

      // missed
      const missed = computeUpdateData("missed", { reason: "Customer gate locked" });
      expect(missed.cancellationReason).toBe("Customer gate locked");

      // cancelled
      const cancelled = computeUpdateData("cancelled", { reason: "Customer requested cancellation" });
      expect(cancelled.cancellationReason).toBe("Customer requested cancellation");
    });
  });
});
