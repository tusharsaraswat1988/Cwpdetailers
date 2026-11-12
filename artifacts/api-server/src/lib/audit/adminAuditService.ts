import { db, adminAuditLogsTable, type AdminAuditLog } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { logger } from "../logger";

export type LogAdminAuditParams = {
  action: string;
  entityType: string;
  entityId: number;
  cityId?: number | null;
  branchId?: number | null;
  performedBy: number;
  reason?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function logAdminAudit(params: LogAdminAuditParams): Promise<AdminAuditLog> {
  const [log] = await db
    .insert(adminAuditLogsTable)
    .values({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      cityId: params.cityId ?? null,
      branchId: params.branchId ?? null,
      performedBy: params.performedBy,
      reason: params.reason ?? null,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? null,
    })
    .returning();

  logger.info(
    {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      performedBy: params.performedBy,
    },
    `[ADMIN AUDIT] ${params.action} on ${params.entityType}:${params.entityId} by user ${params.performedBy}`,
  );

  return log!;
}

export async function listAdminAuditLogs(filters?: {
  entityType?: string;
  entityId?: number;
  branchId?: number;
  action?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const conditions = [];
  if (filters?.entityType) conditions.push(eq(adminAuditLogsTable.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(adminAuditLogsTable.entityId, filters.entityId));
  if (filters?.branchId) conditions.push(eq(adminAuditLogsTable.branchId, filters.branchId));
  if (filters?.action) conditions.push(eq(adminAuditLogsTable.action, filters.action));

  const where = conditions.length ? and(...conditions) : undefined;
  const lim = Math.min(filters?.limit ?? 50, 200);

  return db
    .select()
    .from(adminAuditLogsTable)
    .where(where)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(lim);
}
