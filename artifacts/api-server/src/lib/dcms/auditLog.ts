import { db, dcmsActivityLogsTable } from "@workspace/db";

export type AuditAction =
  | "plan_created"
  | "plan_updated"
  | "plan_deleted"
  | "plan_deactivated"
  | "plan_activated"
  | "subscription_created"
  | "assignment_changed"
  | "visit_uploaded"
  | "visit_rejected"
  | "wash_consumed"
  | "cleaning_consumed"
  | "location_changed"
  | "renewal_completed"
  | "subscription_paused"
  | "subscription_resumed"
  | "missed_visit_recorded"
  | "pause_requested"
  | "pause_rejected";

export async function logDcmsActivity(input: {
  subscriptionId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  performedBy?: number | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(dcmsActivityLogsTable).values({
    subscriptionId: input.subscriptionId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    performedBy: input.performedBy ?? null,
    metadataJson: input.metadata ?? null,
  });
}
