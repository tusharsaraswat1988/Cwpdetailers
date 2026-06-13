import {
  db,
  dcmsVisitFeedbackTable,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  vehiclesTable,
} from "@workspace/db";
import { eq, and, sql, desc, isNull, gte } from "drizzle-orm";
import { emitNotificationEvent } from "./notificationEvents";

export async function submitVisitFeedback(input: {
  visitId: number;
  customerId: number;
  rating: "yes" | "no";
  comment?: string;
}) {
  const [visitRow] = await db
    .select({
      visit: dcmsVisitsTable,
      subscription: dcmsSubscriptionsTable,
    })
    .from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(
      eq(dcmsVisitsTable.id, input.visitId),
      eq(dcmsSubscriptionsTable.customerId, input.customerId),
      eq(dcmsVisitsTable.status, "completed"),
    ))
    .limit(1);

  if (!visitRow) throw new Error("Visit not found");

  const visitDate = visitRow.visit.visitDate ?? visitRow.visit.visitTime.toISOString().slice(0, 10);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (visitDate !== today) {
    throw new Error("Feedback only accepted for today's completed visit");
  }

  const [feedback] = await db.insert(dcmsVisitFeedbackTable).values({
    visitId: input.visitId,
    customerId: input.customerId,
    rating: input.rating,
    comment: input.comment ?? null,
  }).onConflictDoNothing().returning();

  if (!feedback) throw new Error("Feedback already submitted for this visit");

  if (input.rating === "no") {
    const [ctx] = await db.select({
      vehicleNumber: vehiclesTable.registrationNumber,
    })
      .from(dcmsVisitsTable)
      .innerJoin(vehiclesTable, eq(vehiclesTable.id, dcmsVisitsTable.vehicleId))
      .where(eq(dcmsVisitsTable.id, input.visitId))
      .limit(1);

    await emitNotificationEvent({
      eventType: "negative_feedback",
      entityType: "visit_feedback",
      entityId: feedback.id,
      payload: {
        visitId: input.visitId,
        customerId: input.customerId,
        vehicleNumber: ctx?.vehicleNumber ?? "UNKNOWN",
        comment: input.comment ?? null,
      },
    });
  }

  return feedback;
}

export async function getPendingFeedbackForCustomer(customerId: number) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const visits = await db
    .select({
      visit: dcmsVisitsTable,
      vehicleId: dcmsVisitsTable.vehicleId,
    })
    .from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .leftJoin(dcmsVisitFeedbackTable, eq(dcmsVisitFeedbackTable.visitId, dcmsVisitsTable.id))
    .where(and(
      eq(dcmsSubscriptionsTable.customerId, customerId),
      eq(dcmsVisitsTable.status, "completed"),
      eq(dcmsVisitsTable.visitType, "cleaning"),
      eq(dcmsVisitsTable.visitDate, today),
      isNull(dcmsVisitFeedbackTable.id),
    ))
    .limit(5);

  return visits;
}

export async function getFeedbackStats() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    negative: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.rating} = 'no')::int`,
    positive: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.rating} = 'yes')::int`,
  }).from(dcmsVisitFeedbackTable)
    .where(gte(dcmsVisitFeedbackTable.createdAt, since30));

  const [completedVisits] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(dcmsVisitsTable)
    .where(and(
      eq(dcmsVisitsTable.status, "completed"),
      eq(dcmsVisitsTable.visitType, "cleaning"),
      gte(dcmsVisitsTable.visitTime, since30),
    ));

  const completed = completedVisits?.count ?? 0;
  const feedbackTotal = totals?.total ?? 0;
  const feedbackRate = completed > 0 ? Math.round((feedbackTotal / completed) * 100) : 0;

  const [pendingToday] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .leftJoin(dcmsVisitFeedbackTable, eq(dcmsVisitFeedbackTable.visitId, dcmsVisitsTable.id))
    .where(and(
      eq(dcmsVisitsTable.status, "completed"),
      eq(dcmsVisitsTable.visitType, "cleaning"),
      eq(dcmsVisitsTable.visitDate, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })),
      isNull(dcmsVisitFeedbackTable.id),
    ));

  return {
    negativeFeedbackCount: totals?.negative ?? 0,
    pendingFeedback: pendingToday?.count ?? 0,
    feedbackRate,
    totalFeedback: feedbackTotal,
    positiveFeedback: totals?.positive ?? 0,
  };
}

export async function listRecentNegativeFeedback(limit = 20) {
  return db
    .select({
      feedback: dcmsVisitFeedbackTable,
      visit: dcmsVisitsTable,
      subscriptionId: dcmsVisitsTable.subscriptionId,
    })
    .from(dcmsVisitFeedbackTable)
    .innerJoin(dcmsVisitsTable, eq(dcmsVisitFeedbackTable.visitId, dcmsVisitsTable.id))
    .where(eq(dcmsVisitFeedbackTable.rating, "no"))
    .orderBy(desc(dcmsVisitFeedbackTable.createdAt))
    .limit(limit);
}
