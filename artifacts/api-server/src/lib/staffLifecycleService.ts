import {
  db,
  staffTable,
  usersTable,
  sessionsTable,
  serviceExecutionsTable,
  dcmsVisitsTable,
  attendanceTable,
  staffPayoutLedgersTable,
  invoicesTable,
  complaintsTable,
  extraServiceRequestsTable,
  dcmsVisitFeedbackTable,
  dcmsOperationalExceptionsTable,
  bookingsTable,
  serviceAssignmentsTable,
  dcmsStaffAssignmentsTable,
  vehiclesTable,
  leadsTable,
  staffRoleAssignmentsTable,
  staffDocumentsTable,
  staffNotesTable,
  staffLocationLogsTable,
} from "@workspace/db";
import { eq, or, and, sql, ne, inArray } from "drizzle-orm";

export interface StaffOperationalCounts {
  serviceExecutions: number;
  dcmsVisits: number;
  attendance: number;
  payouts: number;
  invoices: number;
  complaints: number;
  extraServices: number;
  visitFeedback: number;
  operationalExceptions: number;
  completedBookings: number;
  activeAssignments: number;
}

export interface StaffOperationalHistory {
  staffId: number;
  canDelete: boolean;
  hasHistory: boolean;
  totalHistoricalRecords: number;
  counts: StaffOperationalCounts;
}

/**
 * Checks whether a staff member has any historical or operational records.
 * If totalHistoricalRecords > 0, hard deletion is blocked to protect data integrity and audit trails.
 */
export async function checkStaffOperationalHistory(staffId: number): Promise<StaffOperationalHistory> {
  const [execRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceExecutionsTable)
    .where(
      or(
        eq(serviceExecutionsTable.assignedStaffId, staffId),
        eq(serviceExecutionsTable.substituteForStaffId, staffId),
        eq(serviceExecutionsTable.authorStaffId, staffId)
      )
    );

  const [visitRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsVisitsTable)
    .where(eq(dcmsVisitsTable.staffId, staffId));

  const [attRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(eq(attendanceTable.staffId, staffId));

  const [payoutRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(staffPayoutLedgersTable)
    .where(eq(staffPayoutLedgersTable.staffId, staffId));

  const [invRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoicesTable)
    .where(eq(invoicesTable.receivedByStaffId, staffId));

  const [compRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(complaintsTable)
    .where(eq(complaintsTable.relatedStaffId, staffId));

  const [extraRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(extraServiceRequestsTable)
    .where(
      or(
        eq(extraServiceRequestsTable.staffId, staffId),
        eq(extraServiceRequestsTable.otpVerifiedByStaffId, staffId)
      )
    );

  const [feedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsVisitFeedbackTable)
    .where(eq(dcmsVisitFeedbackTable.staffId, staffId));

  const [exceptRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsOperationalExceptionsTable)
    .where(eq(dcmsOperationalExceptionsTable.staffId, staffId));

  const [bookRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.assignedStaffId, staffId),
        inArray(bookingsTable.status, ["completed", "in_progress"])
      )
    );

  // Active / in-flight routes & assignments
  const [assignRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceAssignmentsTable)
    .where(
      and(
        eq(serviceAssignmentsTable.assignedStaffId, staffId),
        ne(serviceAssignmentsTable.status, "removed")
      )
    );

  const [dcmsAssignRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsStaffAssignmentsTable)
    .where(
      and(
        eq(dcmsStaffAssignmentsTable.staffId, staffId),
        eq(dcmsStaffAssignmentsTable.isActive, true)
      )
    );

  const [vehRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehiclesTable)
    .where(eq(vehiclesTable.assignedStaffId, staffId));

  const serviceExecutions = execRow?.count ?? 0;
  const dcmsVisits = visitRow?.count ?? 0;
  const attendance = attRow?.count ?? 0;
  const payouts = payoutRow?.count ?? 0;
  const invoices = invRow?.count ?? 0;
  const complaints = compRow?.count ?? 0;
  const extraServices = extraRow?.count ?? 0;
  const visitFeedback = feedRow?.count ?? 0;
  const operationalExceptions = exceptRow?.count ?? 0;
  const completedBookings = bookRow?.count ?? 0;
  const activeAssignments = (assignRow?.count ?? 0) + (dcmsAssignRow?.count ?? 0) + (vehRow?.count ?? 0);

  const totalHistoricalRecords =
    serviceExecutions +
    dcmsVisits +
    attendance +
    payouts +
    invoices +
    complaints +
    extraServices +
    visitFeedback +
    operationalExceptions +
    completedBookings;

  const hasHistory = totalHistoricalRecords > 0;
  const canDelete = !hasHistory;

  return {
    staffId,
    canDelete,
    hasHistory,
    totalHistoricalRecords,
    counts: {
      serviceExecutions,
      dcmsVisits,
      attendance,
      payouts,
      invoices,
      complaints,
      extraServices,
      visitFeedback,
      operationalExceptions,
      completedBookings,
      activeAssignments,
    },
  };
}

/**
 * Permanently deletes a staff member from the database strictly when NO operational history exists.
 * Cascades removal of auxiliary records and user account.
 */
export async function permanentlyDeleteStaff(staffId: number): Promise<{ deleted: boolean; message: string }> {
  const history = await checkStaffOperationalHistory(staffId);
  if (!history.canDelete) {
    throw new Error(
      `Cannot permanently delete staff member with operational history (${history.totalHistoricalRecords} historical records found). Deactivate instead.`
    );
  }

  // 1. Unassign non-historical route/vehicle links
  await db
    .delete(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.assignedStaffId, staffId));

  await db
    .delete(dcmsStaffAssignmentsTable)
    .where(eq(dcmsStaffAssignmentsTable.staffId, staffId));

  await db
    .update(vehiclesTable)
    .set({ assignedStaffId: null })
    .where(eq(vehiclesTable.assignedStaffId, staffId));

  await db
    .update(leadsTable)
    .set({ assignedToStaffId: null })
    .where(eq(leadsTable.assignedToStaffId, staffId));

  await db
    .update(bookingsTable)
    .set({ assignedStaffId: null })
    .where(eq(bookingsTable.assignedStaffId, staffId));

  // 2. Auxiliary staff tables
  await db
    .delete(staffRoleAssignmentsTable)
    .where(eq(staffRoleAssignmentsTable.staffId, staffId));

  await db
    .delete(staffDocumentsTable)
    .where(eq(staffDocumentsTable.staffId, staffId));

  await db
    .delete(staffNotesTable)
    .where(eq(staffNotesTable.staffId, staffId));

  await db
    .delete(staffLocationLogsTable)
    .where(eq(staffLocationLogsTable.staffId, staffId));

  // 3. Find linked login user
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);

  if (staff) {
    const linkedUsers = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.staffId, staffId),
          staff.userId ? eq(usersTable.id, staff.userId) : sql`false`
        )
      );

    for (const u of (Array.isArray(linkedUsers) ? linkedUsers : [])) {
      // Invalidate sessions
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, u.id));
      // Delete user if role is staff
      if (u.role === "staff") {
        await db.delete(usersTable).where(eq(usersTable.id, u.id));
      } else {
        await db.update(usersTable).set({ staffId: null }).where(eq(usersTable.id, u.id));
      }
    }
  }

  // 4. Finally delete the staff row
  await db.delete(staffTable).where(eq(staffTable.id, staffId));

  return {
    deleted: true,
    message: "Staff member permanently deleted.",
  };
}

/**
 * Gracefully offboards and deactivates a staff member:
 * - Marks isActive = false, verificationStatus = 'suspended'
 * - Immediately invalidates all portal login sessions
 * - Disables user portal account
 * - Clears in-flight/active route & vehicle assignments
 * - Writes an audit record to staff notes
 */
export async function deactivateAndOffboardStaff(
  staffId: number,
  options?: { reason?: string; actionUserId?: number }
): Promise<{ deactivated: boolean; message: string }> {
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);

  if (!staff) {
    throw new Error("Staff member not found");
  }

  const reason = options?.reason?.trim() || "Deactivated / Offboarded by administrator";

  // 1. Update staff status
  await db
    .update(staffTable)
    .set({
      isActive: false,
      verificationStatus: "suspended",
      availability: "unavailable",
      updatedAt: new Date(),
    })
    .where(eq(staffTable.id, staffId));

  // 2. Invalidate login user & active sessions
  const linkedUsers = await db
    .select()
    .from(usersTable)
    .where(
      or(
        eq(usersTable.staffId, staffId),
        staff.userId ? eq(usersTable.id, staff.userId) : sql`false`
      )
    );

  for (const u of (Array.isArray(linkedUsers) ? linkedUsers : [])) {
    await db
      .update(usersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(usersTable.id, u.id));

    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessionsTable.userId, u.id), sql`revoked_at IS NULL`));
  }

  // 3. Clear active assignments so customers are not left unserviced
  await db
    .update(serviceAssignmentsTable)
    .set({
      status: "removed",
      notes: sql`COALESCE(notes, '') || ' [Staff offboarded]'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceAssignmentsTable.assignedStaffId, staffId),
        ne(serviceAssignmentsTable.status, "removed")
      )
    );

  await db
    .update(dcmsStaffAssignmentsTable)
    .set({ isActive: false })
    .where(eq(dcmsStaffAssignmentsTable.staffId, staffId));

  await db
    .update(vehiclesTable)
    .set({ assignedStaffId: null })
    .where(eq(vehiclesTable.assignedStaffId, staffId));

  // 4. In-flight bookings reset to waiting_assignment
  await db
    .update(bookingsTable)
    .set({
      assignedStaffId: null,
      status: "waiting_assignment",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookingsTable.assignedStaffId, staffId),
        inArray(bookingsTable.status, ["assigned", "waiting_assignment", "scheduled", "confirmed"])
      )
    );

  // 5. Append audit note
  await db.insert(staffNotesTable).values({
    staffId,
    authorUserId: options?.actionUserId,
    authorName: options?.actionUserId ? undefined : "System",
    note: `[Offboarded]: ${reason}`,
  });

  return {
    deactivated: true,
    message: "Staff member successfully deactivated, sessions revoked, and active assignments unassigned.",
  };
}

/**
 * Reactivates a previously deactivated / suspended staff member.
 */
export async function reactivateStaff(
  staffId: number,
  options?: { actionUserId?: number }
): Promise<{ activated: boolean; message: string }> {
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);

  if (!staff) {
    throw new Error("Staff member not found");
  }

  await db
    .update(staffTable)
    .set({
      isActive: true,
      verificationStatus: staff.verificationStatus === "suspended" ? "verified" : staff.verificationStatus,
      availability: "available",
      updatedAt: new Date(),
    })
    .where(eq(staffTable.id, staffId));

  // Re-enable linked portal user
  const linkedUsers = await db
    .select()
    .from(usersTable)
    .where(
      or(
        eq(usersTable.staffId, staffId),
        staff.userId ? eq(usersTable.id, staff.userId) : sql`false`
      )
    );

  for (const u of (Array.isArray(linkedUsers) ? linkedUsers : [])) {
    await db
      .update(usersTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(usersTable.id, u.id));
  }

  // Append audit note
  await db.insert(staffNotesTable).values({
    staffId,
    authorUserId: options?.actionUserId,
    authorName: options?.actionUserId ? undefined : "System",
    note: "[Reactivated]: Staff member reactivated by administrator",
  });

  return {
    activated: true,
    message: "Staff member successfully reactivated.",
  };
}
