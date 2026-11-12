import {
  db,
  branchUserAssignmentsTable,
  branchesTable,
  usersTable,
  sessionsTable,
  type BranchUserAssignment,
} from "@workspace/db";
import { eq, and, sql, desc, or, isNull, lte, gte } from "drizzle-orm";
import { logAdminAudit } from "../audit/adminAuditService";
import { logger } from "../logger";

export type BranchAssignmentDetailed = BranchUserAssignment & {
  userName: string;
  userPhone: string;
  userEmail: string | null;
  branchName: string;
  branchCode: string | null;
  branchCity: string;
  assignedByName: string | null;
};

export type AssignBranchUserInput = {
  userId: number;
  branchId: number;
  assignmentRole?: string;
  assignedBy: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
};

export async function assignBranchUser(input: AssignBranchUserInput): Promise<BranchUserAssignment> {
  const { userId, branchId, assignmentRole = "branch_manager", assignedBy, effectiveFrom, effectiveUntil } = input;

  // Rule: User cannot assign themselves
  if (userId === assignedBy) {
    throw new Error("Self-assignment is prohibited. An administrator cannot assign themselves to a branch.");
  }

  // 1. Verify user exists and is active
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new Error("Target user not found or inactive");
  }

  // 2. Verify branch exists and is not suspended
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch) {
    throw new Error("Target branch not found");
  }
  if (branch.status === "suspended" || !branch.isActive) {
    throw new Error("Cannot assign user to a suspended or inactive branch");
  }

  // 3. Consistency check: company alignment
  if (user.companyId && branch.companyId && user.companyId !== branch.companyId) {
    throw new Error("User company and branch company are inconsistent");
  }

  // 4. Check if active assignment already exists for this user and branch
  const existing = await db
    .select()
    .from(branchUserAssignmentsTable)
    .where(
      and(
        eq(branchUserAssignmentsTable.userId, userId),
        eq(branchUserAssignmentsTable.branchId, branchId),
        eq(branchUserAssignmentsTable.isActive, true),
        isNull(branchUserAssignmentsTable.revokedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // If role changed, update it
    if (existing[0]!.assignmentRole !== assignmentRole) {
      const [updated] = await db
        .update(branchUserAssignmentsTable)
        .set({
          assignmentRole,
          updatedAt: new Date(),
        })
        .where(eq(branchUserAssignmentsTable.id, existing[0]!.id))
        .returning();
      return updated!;
    }
    return existing[0]!;
  }

  // 5. Create new assignment record
  const now = new Date();
  const [assignment] = await db
    .insert(branchUserAssignmentsTable)
    .values({
      userId,
      branchId,
      assignmentRole,
      isActive: true,
      assignedBy,
      assignedAt: now,
      effectiveFrom: effectiveFrom ?? now,
      effectiveUntil: effectiveUntil ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 6. Update user role if needed (e.g. promote to branch_manager or supervisor)
  const targetUserRole = assignmentRole === "supervisor" ? "supervisor" : "branch_manager";
  if (user.role !== "superadmin" && user.role !== "central_admin" && user.role !== "admin") {
    await db
      .update(usersTable)
      .set({
        role: targetUserRole as any,
        branchId, // Primary branch for backwards compatibility
        updatedAt: now,
      })
      .where(eq(usersTable.id, userId));
  }

  // 7. Update display field branches.managerName for backwards compatibility
  if (assignmentRole === "branch_manager") {
    await db
      .update(branchesTable)
      .set({
        managerName: user.name,
        updatedAt: now,
      })
      .where(eq(branchesTable.id, branchId));
  }

  // 8. Log administrative audit
  await logAdminAudit({
    action: "branch_user_assigned",
    entityType: "branch_user_assignment",
    entityId: assignment!.id,
    branchId,
    performedBy: assignedBy,
    reason: `Assigned user ${user.name} (${user.phone}) as ${assignmentRole}`,
    details: { userId, assignmentRole, branchName: branch.name },
  });

  logger.info(
    { assignmentId: assignment!.id, userId, branchId, assignmentRole, assignedBy },
    `Assigned user ${userId} to branch ${branchId} as ${assignmentRole}`,
  );

  return assignment!;
}

export type ReplaceBranchManagerInput = {
  branchId: number;
  newUserId: number;
  assignedBy: number;
  reason?: string;
};

export async function replaceBranchManager(input: ReplaceBranchManagerInput): Promise<BranchUserAssignment> {
  const { branchId, newUserId, assignedBy, reason = "Branch manager replacement" } = input;

  if (newUserId === assignedBy) {
    throw new Error("Self-assignment is prohibited. An administrator cannot appoint themselves as branch manager.");
  }

  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch || branch.status === "suspended" || !branch.isActive) {
    throw new Error("Branch not found or suspended");
  }

  const now = new Date();

  // 1. Revoke existing active branch_manager assignments for this branch
  const previousAssignments = await db
    .select()
    .from(branchUserAssignmentsTable)
    .where(
      and(
        eq(branchUserAssignmentsTable.branchId, branchId),
        eq(branchUserAssignmentsTable.assignmentRole, "branch_manager"),
        eq(branchUserAssignmentsTable.isActive, true),
        isNull(branchUserAssignmentsTable.revokedAt),
      ),
    );

  for (const prev of previousAssignments) {
    await db
      .update(branchUserAssignmentsTable)
      .set({
        isActive: false,
        revokedAt: now,
        revocationReason: reason,
        updatedAt: now,
      })
      .where(eq(branchUserAssignmentsTable.id, prev.id));

    // Check if the old manager has any other active branches
    const remainingBranches = await getUserActiveBranchIds(prev.userId);
    if (remainingBranches.length === 0) {
      // Invalidate active sessions immediately
      await db
        .update(sessionsTable)
        .set({ revokedAt: now })
        .where(eq(sessionsTable.userId, prev.userId));
    }

    await logAdminAudit({
      action: "branch_manager_revoked",
      entityType: "branch_user_assignment",
      entityId: prev.id,
      branchId,
      performedBy: assignedBy,
      reason,
      details: { previousUserId: prev.userId },
    });
  }

  // 2. Assign the new branch manager
  return assignBranchUser({
    userId: newUserId,
    branchId,
    assignmentRole: "branch_manager",
    assignedBy,
  });
}

export async function revokeBranchAssignment(
  assignmentId: number,
  revokedBy: number,
  reason: string,
): Promise<BranchUserAssignment> {
  const [assignment] = await db
    .select()
    .from(branchUserAssignmentsTable)
    .where(eq(branchUserAssignmentsTable.id, assignmentId))
    .limit(1);

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const now = new Date();
  const [revoked] = await db
    .update(branchUserAssignmentsTable)
    .set({
      isActive: false,
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
    })
    .where(eq(branchUserAssignmentsTable.id, assignmentId))
    .returning();

  // If user has no remaining active branches, invalidate active sessions immediately
  const remainingBranches = await getUserActiveBranchIds(assignment.userId);
  if (remainingBranches.length === 0) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: now })
      .where(eq(sessionsTable.userId, assignment.userId));
  }

  await logAdminAudit({
    action: "branch_assignment_revoked",
    entityType: "branch_user_assignment",
    entityId: assignmentId,
    branchId: assignment.branchId,
    performedBy: revokedBy,
    reason,
    details: { userId: assignment.userId, assignmentRole: assignment.assignmentRole },
  });

  return revoked!;
}

export async function listBranchAssignments(filters?: {
  branchId?: number;
  userId?: number;
  isActive?: boolean;
}): Promise<BranchAssignmentDetailed[]> {
  const conditions = [];
  if (filters?.branchId) conditions.push(eq(branchUserAssignmentsTable.branchId, filters.branchId));
  if (filters?.userId) conditions.push(eq(branchUserAssignmentsTable.userId, filters.userId));
  if (filters?.isActive !== undefined) conditions.push(eq(branchUserAssignmentsTable.isActive, filters.isActive));

  const where = conditions.length ? and(...conditions) : undefined;

  const assignedByUser = db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .as("assigned_by_user");

  const rows = await db
    .select({
      id: branchUserAssignmentsTable.id,
      userId: branchUserAssignmentsTable.userId,
      branchId: branchUserAssignmentsTable.branchId,
      assignmentRole: branchUserAssignmentsTable.assignmentRole,
      isActive: branchUserAssignmentsTable.isActive,
      assignedBy: branchUserAssignmentsTable.assignedBy,
      assignedAt: branchUserAssignmentsTable.assignedAt,
      effectiveFrom: branchUserAssignmentsTable.effectiveFrom,
      effectiveUntil: branchUserAssignmentsTable.effectiveUntil,
      revokedAt: branchUserAssignmentsTable.revokedAt,
      revocationReason: branchUserAssignmentsTable.revocationReason,
      createdAt: branchUserAssignmentsTable.createdAt,
      updatedAt: branchUserAssignmentsTable.updatedAt,
      userName: usersTable.name,
      userPhone: usersTable.phone,
      userEmail: usersTable.email,
      branchName: branchesTable.name,
      branchCode: branchesTable.code,
      branchCity: branchesTable.city,
      assignedByName: sql<string | null>`(SELECT name FROM users WHERE id = ${branchUserAssignmentsTable.assignedBy})`,
    })
    .from(branchUserAssignmentsTable)
    .innerJoin(usersTable, eq(branchUserAssignmentsTable.userId, usersTable.id))
    .innerJoin(branchesTable, eq(branchUserAssignmentsTable.branchId, branchesTable.id))
    .where(where)
    .orderBy(desc(branchUserAssignmentsTable.createdAt));

  return rows as BranchAssignmentDetailed[];
}

/**
 * Returns all active, non-suspended branch IDs assigned to a user.
 * Filters out branches that are suspended or inactive.
 */
export async function getUserActiveBranchIds(userId: number): Promise<number[]> {
  const now = new Date();
  const rows = await db
    .select({ branchId: branchUserAssignmentsTable.branchId })
    .from(branchUserAssignmentsTable)
    .innerJoin(branchesTable, eq(branchUserAssignmentsTable.branchId, branchesTable.id))
    .where(
      and(
        eq(branchUserAssignmentsTable.userId, userId),
        eq(branchUserAssignmentsTable.isActive, true),
        isNull(branchUserAssignmentsTable.revokedAt),
        lte(branchUserAssignmentsTable.effectiveFrom, now),
        or(
          isNull(branchUserAssignmentsTable.effectiveUntil),
          gte(branchUserAssignmentsTable.effectiveUntil, now),
        ),
        eq(branchesTable.status, "active"),
        eq(branchesTable.isActive, true),
      ),
    );

  return rows.map(r => r.branchId);
}

/**
 * Validates whether a user has active authority over a branch.
 */
export async function isUserAssignedToBranch(userId: number, branchId: number): Promise<boolean> {
  const branchIds = await getUserActiveBranchIds(userId);
  return branchIds.includes(branchId);
}
