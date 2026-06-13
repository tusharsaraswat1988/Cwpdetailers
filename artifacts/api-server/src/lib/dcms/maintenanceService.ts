import { db, dcmsStaffAssignmentsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";

/** Deactivate staff assignments for completed/expired/cancelled subscriptions. */
export async function cleanupInactiveAssignments() {
  const result = await db.update(dcmsStaffAssignmentsTable)
    .set({ isActive: false })
    .where(and(
      eq(dcmsStaffAssignmentsTable.isActive, true),
      sql`${dcmsStaffAssignmentsTable.subscriptionId} IN (
        SELECT id FROM dcms_subscriptions WHERE status IN ('completed', 'expired', 'cancelled')
      )`,
    ))
    .returning({ id: dcmsStaffAssignmentsTable.id });

  return { deactivated: result.length };
}

/** Remove stale pending pause requests older than 30 days. */
export async function cleanupStalePauseRequests() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { dcmsPauseHistoryTable } = await import("@workspace/db");
  const { eq: eqFn, and: andFn } = await import("drizzle-orm");

  const result = await db.update(dcmsPauseHistoryTable)
    .set({ approvalStatus: "rejected", action: "pause_rejected" })
    .where(andFn(
      eqFn(dcmsPauseHistoryTable.action, "pause_requested"),
      eqFn(dcmsPauseHistoryTable.approvalStatus, "pending"),
      lt(dcmsPauseHistoryTable.createdAt, cutoff),
    ))
    .returning({ id: dcmsPauseHistoryTable.id });

  return { rejected: result.length };
}

export async function runDcmsMaintenanceJobs() {
  const [assignments, pauseRequests] = await Promise.all([
    cleanupInactiveAssignments(),
    cleanupStalePauseRequests(),
  ]);
  return { assignments, pauseRequests };
}
