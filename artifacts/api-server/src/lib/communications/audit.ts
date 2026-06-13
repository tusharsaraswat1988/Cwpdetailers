import { db } from "@workspace/db";
import { commAuditLogsTable } from "@workspace/db";

export async function logCommAudit(params: {
  action: string;
  resource: string;
  resourceId?: number | null;
  userId?: number | null;
  companyId?: number | null;
  payload?: Record<string, unknown>;
}) {
  await db.insert(commAuditLogsTable).values({
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId ?? null,
    userId: params.userId ?? null,
    companyId: params.companyId ?? null,
    payload: params.payload ?? {},
  });
}
