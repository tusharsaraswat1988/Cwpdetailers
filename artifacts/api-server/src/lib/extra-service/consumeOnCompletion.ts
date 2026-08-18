import {
  db,
  extraServiceRequestsTable,
  dcmsSubscriptionsTable,
  dcmsActivityLogsTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Entitlement is consumed on wash completion, never on OTP verification.
 * One verified request → one job → at most one DCC wash credit.
 */
export async function consumeExtraServiceOnCompletion(
  executionId: number,
  performedBy: number,
): Promise<boolean> {
  const [request] = await db.select().from(extraServiceRequestsTable)
    .where(eq(extraServiceRequestsTable.executionId, executionId))
    .limit(1);
  if (!request) return false;
  if (request.status !== "otp_verified") return false;
  if (request.entitlementConsumedAt) return true;
  if (request.commercialSource !== "DCC_INCLUDED" || !request.dcmsSubscriptionId) return false;

  const [sub] = await db.select().from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, request.dcmsSubscriptionId))
    .limit(1);
  if (!sub) throw new Error("DCC wash entitlement not found");
  if (sub.remainingWashes <= 0) throw new Error("DCC wash quota already consumed");

  const now = new Date();
  const remainingWashes = sub.remainingWashes - 1;
  const remainingCleanings = sub.remainingCleanings;

  const updated = await db.update(dcmsSubscriptionsTable)
    .set({
      usedWashes: sub.usedWashes + 1,
      remainingWashes,
      updatedAt: now,
      version: sub.version + 1,
      ...(remainingCleanings === 0 && remainingWashes === 0 ? { status: "completed" as const } : {}),
    })
    .where(and(
      eq(dcmsSubscriptionsTable.id, sub.id),
      eq(dcmsSubscriptionsTable.version, sub.version),
      sql`${dcmsSubscriptionsTable.remainingWashes} > 0`,
    ))
    .returning({ id: dcmsSubscriptionsTable.id });

  if (!updated.length) throw new Error("DCC wash quota already consumed");

  await db.update(extraServiceRequestsTable)
    .set({ entitlementConsumedAt: now, updatedAt: now })
    .where(and(
      eq(extraServiceRequestsTable.id, request.id),
      isNull(extraServiceRequestsTable.entitlementConsumedAt),
    ));

  await db.insert(dcmsActivityLogsTable).values({
    subscriptionId: sub.id,
    action: "wash_consumed",
    entityType: "extra_service_request",
    entityId: request.id,
    performedBy,
    metadataJson: {
      visitType: "wash",
      extraServiceRequestId: request.id,
      bookingId: request.bookingId,
      executionId,
      customerConsent: true,
    },
  });

  return true;
}
