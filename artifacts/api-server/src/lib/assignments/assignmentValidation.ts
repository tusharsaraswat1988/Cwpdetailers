/**
 * Phase 5.3 assignment validation helpers.
 * Does NOT validate attendance or routes.
 */

import type { staffTable } from "@workspace/db";

type StaffRow = typeof staffTable.$inferSelect;

export function assertStaffAssignable(staff: StaffRow | undefined | null): asserts staff is StaffRow {
  if (!staff) throw new Error("Staff member not found or inactive");
  if (!staff.isActive) throw new Error("Staff member is inactive");
  if (staff.verificationStatus === "suspended") {
    throw new Error("Staff member is suspended and cannot be assigned");
  }
}

/**
 * Branch isolation: staff must belong to the same branch as the job when both are set.
 */
export function assertStaffBranchMatch(
  staff: StaffRow,
  jobBranchId: number | null | undefined,
): void {
  if (jobBranchId == null) return;
  if (staff.branchId !== jobBranchId) {
    throw new Error(
      `Staff belongs to a different branch (staff branch #${staff.branchId}, job branch #${jobBranchId})`,
    );
  }
}
