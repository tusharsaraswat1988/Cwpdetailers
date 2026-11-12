import {
  db,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  dcmsVisitFeedbackTable,
  complaintsTable,
  customersTable,
  staffTable,
  residentialSocietiesTable,
} from "@workspace/db";
import { eq, and, desc, inArray, isNull, gte, sql } from "drizzle-orm";
import { logger } from "../logger";
import { createSupportTicket } from "../support/supportTicketService";

export type SubmitFeedbackInput = {
  visitId: number;
  customerId: number;
  ratingScore: number; // 1 to 5
  comment?: string;
  tags?: string[];
  issueReported?: boolean;
};

export async function submitVisitFeedback(input: SubmitFeedbackInput) {
  if (input.ratingScore < 1 || input.ratingScore > 5) {
    throw new Error("Rating score must be between 1 and 5");
  }

  // 1. Fetch visit and verify eligibility
  const [visit] = await db
    .select({
      id: dcmsVisitsTable.id,
      subscriptionId: dcmsVisitsTable.subscriptionId,
      vehicleId: dcmsVisitsTable.vehicleId,
      staffId: dcmsVisitsTable.staffId,
      status: dcmsVisitsTable.status,
      visitDate: dcmsVisitsTable.visitDate,
      visitTime: dcmsVisitsTable.visitTime,
    })
    .from(dcmsVisitsTable)
    .where(eq(dcmsVisitsTable.id, input.visitId))
    .limit(1);

  if (!visit) {
    throw new Error("Cleaning visit not found");
  }

  if (visit.status !== "completed") {
    throw new Error("Feedback can only be submitted for completed cleaning visits");
  }

  // 2. Fetch subscription and verify customer ownership (IDOR guard)
  const [sub] = await db
    .select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      cityId: dcmsSubscriptionsTable.cityId,
      branchId: dcmsSubscriptionsTable.branchId,
      societyId: dcmsSubscriptionsTable.societyId,
      parkingBay: dcmsSubscriptionsTable.parkingBay,
    })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, visit.subscriptionId))
    .limit(1);

  if (!sub || sub.customerId !== input.customerId) {
    throw new Error("Access denied: You can only submit feedback for your own vehicle visits");
  }

  const [customer] = await db
    .select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone })
    .from(customersTable)
    .where(eq(customersTable.id, input.customerId))
    .limit(1);

  const now = new Date();
  const ratingText = `${input.ratingScore} star${input.ratingScore > 1 ? "s" : ""}`;
  const isNegative = input.ratingScore <= 2 || Boolean(input.issueReported);

  // 3. Check for existing feedback (controlled update within 48h vs duplicate rejection)
  const [existing] = await db
    .select()
    .from(dcmsVisitFeedbackTable)
    .where(eq(dcmsVisitFeedbackTable.visitId, input.visitId))
    .limit(1);

  let feedbackId: number;
  let linkedComplaintId = existing?.complaintId ?? null;

  if (existing) {
    const ageHours = (now.getTime() - new Date(existing.createdAt).getTime()) / (3600 * 1000);
    if (ageHours > 48) {
      throw new Error("Feedback for this visit was already finalized and cannot be modified after 48 hours");
    }

    const [updated] = await db
      .update(dcmsVisitFeedbackTable)
      .set({
        rating: ratingText,
        ratingScore: input.ratingScore,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
        issueReported: isNegative,
        updatedAt: now,
      })
      .where(eq(dcmsVisitFeedbackTable.id, existing.id))
      .returning();

    feedbackId = updated.id;
  } else {
    const [inserted] = await db
      .insert(dcmsVisitFeedbackTable)
      .values({
        visitId: input.visitId,
        subscriptionId: sub.id,
        customerId: input.customerId,
        staffId: visit.staffId,
        cityId: sub.cityId,
        branchId: sub.branchId,
        rating: ratingText,
        ratingScore: input.ratingScore,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
        issueReported: isNegative,
        complaintId: null,
      })
      .returning();

    feedbackId = inserted.id;
  }

  // 4. Automated Support Ticket for Negative Ratings
  if (isNegative && !linkedComplaintId) {
    const priority = input.ratingScore === 1 ? "urgent" : "high";
    const tagList = (input.tags && input.tags.length > 0) ? ` (${input.tags.join(", ")})` : "";
    const title = `Service Quality Concern: ${ratingText} on Visit #${visit.id}${tagList}`;
    const description = input.comment
      ? `Customer Feedback: "${input.comment}". Rating: ${input.ratingScore}/5.${tagList}`
      : `Customer reported low satisfaction (${input.ratingScore}/5 stars) for cleaning visit on ${visit.visitDate}.${tagList}`;

    const ticket = await createSupportTicket({
      caller: { isStaffOrAdmin: false, customerId: input.customerId, name: customer?.name || "Customer" },
      customerId: input.customerId,
      type: "quality",
      priority,
      title,
      description,
      subscriptionId: sub.id,
      visitId: visit.id,
    });

    linkedComplaintId = ticket.id;

    await db
      .update(dcmsVisitFeedbackTable)
      .set({ complaintId: ticket.id, updatedAt: now })
      .where(eq(dcmsVisitFeedbackTable.id, feedbackId));

    logger.warn(
      { visitId: visit.id, ratingScore: input.ratingScore, complaintId: ticket.id },
      "Negative visit feedback auto-converted to Support Ticket"
    );
  }

  return {
    success: true,
    feedbackId,
    ratingScore: input.ratingScore,
    isNegative,
    complaintId: linkedComplaintId,
  };
}

/**
 * Returns recent completed visits without feedback for a customer (last 7 days).
 */
export async function getCustomerPendingFeedback(customerId: number, limit = 5) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const dateStr = sevenDaysAgo.toISOString().split("T")[0];

  const eligibleVisits = await db
    .select({
      visitId: dcmsVisitsTable.id,
      visitDate: dcmsVisitsTable.visitDate,
      visitTime: dcmsVisitsTable.visitTime,
      subscriptionId: dcmsVisitsTable.subscriptionId,
      vehicleId: dcmsVisitsTable.vehicleId,
      staffId: dcmsVisitsTable.staffId,
      photoUrl: dcmsVisitsTable.photoUrl,
      feedbackId: dcmsVisitFeedbackTable.id,
    })
    .from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .leftJoin(dcmsVisitFeedbackTable, eq(dcmsVisitsTable.id, dcmsVisitFeedbackTable.visitId))
    .where(
      and(
        eq(dcmsSubscriptionsTable.customerId, customerId),
        eq(dcmsVisitsTable.status, "completed"),
        gte(dcmsVisitsTable.visitDate, dateStr),
        isNull(dcmsVisitFeedbackTable.id)
      )
    )
    .orderBy(desc(dcmsVisitsTable.visitTime))
    .limit(limit);

  return eligibleVisits;
}
