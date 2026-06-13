import {
  db,
  dcmsStaffAssignmentsTable,
  dcmsSubscriptionsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { emitNotificationEvent } from "./notificationEvents";
import { todayStrInIST } from "./dateUtils";

/** Notify each staff member that their daily route is ready (morning job). */
export async function notifyDailyRoutesAvailable(dateStr?: string) {
  const date = dateStr ?? todayStrInIST();

  const staffRows = await db.select({
    staffId: dcmsStaffAssignmentsTable.staffId,
    stopCount: sql<number>`count(distinct ${dcmsStaffAssignmentsTable.subscriptionId})::int`,
  })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(
      eq(dcmsStaffAssignmentsTable.isActive, true),
      eq(dcmsSubscriptionsTable.status, "active"),
    ))
    .groupBy(dcmsStaffAssignmentsTable.staffId);

  for (const row of staffRows) {
    await emitNotificationEvent({
      eventType: "daily_route_available",
      entityType: "staff",
      entityId: row.staffId,
      payload: {
        staffId: row.staffId,
        date,
        stopCount: row.stopCount,
      },
    });
  }

  return { notified: staffRows.length, date };
}
