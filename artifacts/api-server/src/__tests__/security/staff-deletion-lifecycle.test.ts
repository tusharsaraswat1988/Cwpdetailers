import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @workspace/db
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    staffTable: { id: "staff_id", isActive: "is_active", verificationStatus: "verification_status", availability: "availability", updatedAt: "updated_at" },
    usersTable: { id: "user_id", staffId: "staff_id", isActive: "is_active", role: "role", updatedAt: "updated_at" },
    sessionsTable: { id: "session_id", userId: "user_id", revokedAt: "revoked_at" },
    serviceExecutionsTable: { assignedStaffId: "assigned_staff_id", substituteForStaffId: "substitute_for_staff_id", authorStaffId: "author_staff_id" },
    dcmsVisitsTable: { staffId: "staff_id" },
    attendanceTable: { staffId: "staff_id" },
    staffPayoutLedgersTable: { staffId: "staff_id" },
    invoicesTable: { receivedByStaffId: "received_by_staff_id" },
    complaintsTable: { relatedStaffId: "related_staff_id" },
    extraServiceRequestsTable: { staffId: "staff_id", otpVerifiedByStaffId: "otp_verified_by_staff_id" },
    dcmsVisitFeedbackTable: { staffId: "staff_id" },
    dcmsOperationalExceptionsTable: { staffId: "staff_id" },
    bookingsTable: { assignedStaffId: "assigned_staff_id", status: "status", updatedAt: "updated_at" },
    serviceAssignmentsTable: { assignedStaffId: "assigned_staff_id", status: "status", notes: "notes", updatedAt: "updated_at" },
    dcmsStaffAssignmentsTable: { staffId: "staff_id", isActive: "is_active" },
    vehiclesTable: { assignedStaffId: "assigned_staff_id" },
    leadsTable: { assignedToStaffId: "assigned_to_staff_id" },
    staffRoleAssignmentsTable: { staffId: "staff_id" },
    staffDocumentsTable: { staffId: "staff_id" },
    staffNotesTable: { staffId: "staff_id", note: "note", authorUserId: "author_user_id", authorName: "author_name" },
    staffLocationLogsTable: { staffId: "staff_id" },
  };
});

import { db } from "@workspace/db";
import {
  checkStaffOperationalHistory,
  permanentlyDeleteStaff,
  deactivateAndOffboardStaff,
  reactivateStaff,
} from "../../lib/staffLifecycleService";

function makeQueryBuilder(rows: any[]) {
  const p = Promise.resolve(rows) as any;
  p.limit = vi.fn().mockImplementation((n?: number) => Promise.resolve(rows.slice(0, n ?? rows.length)));
  return p;
}

describe("Staff Deletion & Offboarding Lifecycle (STAFF-025)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkStaffOperationalHistory", () => {
    it("reports canDelete = true when all operational record counts are zero", async () => {
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => makeQueryBuilder([{ count: 0 }])),
        }),
      }));

      const result = await checkStaffOperationalHistory(42);

      expect(result.staffId).toBe(42);
      expect(result.canDelete).toBe(true);
      expect(result.hasHistory).toBe(false);
      expect(result.totalHistoricalRecords).toBe(0);
      expect(result.counts.serviceExecutions).toBe(0);
      expect(result.counts.attendance).toBe(0);
      expect(result.counts.payouts).toBe(0);
      expect(result.counts.invoices).toBe(0);
    });

    it("reports canDelete = false and hasHistory = true when service executions exist", async () => {
      let callIndex = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 1) {
              return makeQueryBuilder([{ count: 14 }]);
            }
            return makeQueryBuilder([{ count: 0 }]);
          }),
        }),
      }));

      const result = await checkStaffOperationalHistory(101);

      expect(result.canDelete).toBe(false);
      expect(result.hasHistory).toBe(true);
      expect(result.counts.serviceExecutions).toBe(14);
      expect(result.totalHistoricalRecords).toBe(14);
    });

    it("aggregates all historical counts across attendance, visits, and payouts", async () => {
      let callIndex = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 2) return makeQueryBuilder([{ count: 25 }]); // dcmsVisits
            if (callIndex === 3) return makeQueryBuilder([{ count: 20 }]); // attendance
            if (callIndex === 4) return makeQueryBuilder([{ count: 2 }]);  // payouts
            return makeQueryBuilder([{ count: 0 }]);
          }),
        }),
      }));

      const result = await checkStaffOperationalHistory(88);

      expect(result.canDelete).toBe(false);
      expect(result.counts.dcmsVisits).toBe(25);
      expect(result.counts.attendance).toBe(20);
      expect(result.counts.payouts).toBe(2);
      expect(result.totalHistoricalRecords).toBe(47);
    });
  });

  describe("permanentlyDeleteStaff", () => {
    it("refuses to delete staff if operational history exists, throwing an informative error", async () => {
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => makeQueryBuilder([{ count: 5 }])),
        }),
      }));

      await expect(permanentlyDeleteStaff(55)).rejects.toThrow(
        /Cannot permanently delete staff member with operational history/
      );
    });

    it("successfully cleans up assignments, auxiliary tables, login user, and staff row when 0 history", async () => {
      let countCheck = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            countCheck++;
            if (countCheck <= 13) {
              return makeQueryBuilder([{ count: 0 }]);
            }
            if (countCheck === 14) {
              // Staff row lookup
              return makeQueryBuilder([{ id: 77, userId: 12 }]);
            }
            // Linked user lookup
            return makeQueryBuilder([{ id: 12, role: "staff", staffId: 77 }]);
          }),
        }),
      }));

      (db.delete as any).mockImplementation(() => ({
        where: vi.fn().mockResolvedValue({}),
      }));

      (db.update as any).mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }));

      const res = await permanentlyDeleteStaff(77);
      expect(res.deleted).toBe(true);
      expect(res.message).toContain("permanently deleted");
    });
  });

  describe("deactivateAndOffboardStaff", () => {
    it("updates staff isActive to false, verificationStatus to suspended, and availability to unavailable", async () => {
      let updatedSet: any = null;

      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            makeQueryBuilder([{ id: 99, name: "Ramesh", userId: 400 }])
          ),
        }),
      }));

      (db.update as any).mockImplementation(() => ({
        set: vi.fn().mockImplementation((val: any) => {
          if (!updatedSet) updatedSet = val;
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      }));

      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockResolvedValue({}),
      }));

      const res = await deactivateAndOffboardStaff(99, { reason: "Resigned from Varanasi branch" });

      expect(res.deactivated).toBe(true);
      expect(updatedSet.isActive).toBe(false);
      expect(updatedSet.verificationStatus).toBe("suspended");
      expect(updatedSet.availability).toBe("unavailable");
    });

    it("unassigns in-flight assignments and sets active bookings to waiting_assignment", async () => {
      const updatedTables: any[] = [];

      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            makeQueryBuilder([{ id: 10, name: "Sunil", userId: 20 }])
          ),
        }),
      }));

      (db.update as any).mockImplementation((table: any) => {
        updatedTables.push(table);
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        };
      });

      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockResolvedValue({}),
      }));

      await deactivateAndOffboardStaff(10);

      expect(updatedTables.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("reactivateStaff", () => {
    it("restores isActive to true, availability to available, and reactivates linked user", async () => {
      let updatedStaffSet: any = null;

      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            makeQueryBuilder([{ id: 33, name: "Pooja", verificationStatus: "suspended", userId: 50 }])
          ),
        }),
      }));

      (db.update as any).mockImplementation(() => ({
        set: vi.fn().mockImplementation((val: any) => {
          if (!updatedStaffSet) updatedStaffSet = val;
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      }));

      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockResolvedValue({}),
      }));

      const res = await reactivateStaff(33);

      expect(res.activated).toBe(true);
      expect(updatedStaffSet.isActive).toBe(true);
      expect(updatedStaffSet.verificationStatus).toBe("verified");
      expect(updatedStaffSet.availability).toBe("available");
    });
  });
});
