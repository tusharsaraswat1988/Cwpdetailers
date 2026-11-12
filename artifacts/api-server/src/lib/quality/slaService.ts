import { db, complaintsTable, slaPoliciesTable, slaEscalationLogsTable } from "@workspace/db";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { logger } from "../logger";
import { dispatchNotification } from "../notifications/dispatcher";

export type SlaStatus = "on_track" | "approaching_breach" | "breached";

/**
 * Resolves the best matching SLA policy for a ticket or exception.
 * Specificity order:
 * 1. Exact city + category + priority
 * 2. City + category
 * 3. City + priority
 * 4. Global category + priority
 * 5. Global priority
 * 6. Default active policy
 */
export async function resolveSlaPolicy(params: {
  cityId?: number | null;
  serviceType?: string | null;
  category?: string;
  priority?: string;
}): Promise<typeof slaPoliciesTable.$inferSelect | null> {
  const policies = await db
    .select()
    .from(slaPoliciesTable)
    .where(eq(slaPoliciesTable.isActive, true))
    .orderBy(desc(slaPoliciesTable.id));

  if (policies.length === 0) return null;

  const targetCategory = params.category || "all";
  const targetPriority = params.priority || "all";
  const targetCityId = params.cityId ?? null;

  // 1. Exact match: city + category + priority
  if (targetCityId) {
    const exact = policies.find(
      (p) =>
        p.cityId === targetCityId &&
        (p.category === targetCategory || p.category === "all") &&
        (p.priority === targetPriority || p.priority === "all")
    );
    if (exact) return exact;
  }

  // 2. Global category + priority match
  const globalMatch = policies.find(
    (p) =>
      p.cityId == null &&
      p.category === targetCategory &&
      p.priority === targetPriority
  );
  if (globalMatch) return globalMatch;

  // 3. Category match
  const catMatch = policies.find(
    (p) => p.category === targetCategory && (p.cityId == null || p.cityId === targetCityId)
  );
  if (catMatch) return catMatch;

  // 4. Priority match
  const prioMatch = policies.find(
    (p) => p.priority === targetPriority && (p.cityId == null || p.cityId === targetCityId)
  );
  if (prioMatch) return prioMatch;

  // 5. General fallback
  return policies.find((p) => p.category === "all" && p.priority === "all") || policies[0] || null;
}

/**
 * Calculates response and resolution deadlines from an SLA policy.
 */
export function calculateSlaDeadlines(
  baseTime: Date,
  policy: typeof slaPoliciesTable.$inferSelect | null,
  priority?: string
): { responseDueAt: Date; resolutionDueAt: Date } {
  let responseMins = policy?.responseTargetMinutes ?? 720;
  let resolutionMins = policy?.resolutionTargetMinutes ?? 1440;

  // Dynamic safety overrides for urgent priorities if no policy specified
  if (!policy) {
    if (priority === "urgent") {
      responseMins = 60;
      resolutionMins = 240;
    } else if (priority === "high") {
      responseMins = 180;
      resolutionMins = 720;
    }
  }

  const responseDueAt = new Date(baseTime.getTime() + responseMins * 60 * 1000);
  const resolutionDueAt = new Date(baseTime.getTime() + resolutionMins * 60 * 1000);

  return { responseDueAt, resolutionDueAt };
}

/**
 * Handles pausing or resuming the SLA clock when ticket status changes
 * (e.g. pausing clock when status is 'awaiting_customer').
 */
export async function handleSlaClockTransition(
  ticketId: number,
  oldStatus: string,
  newStatus: string
) {
  const [ticket] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, ticketId))
    .limit(1);

  if (!ticket || !ticket.resolutionDueAt) return;

  const now = new Date();

  // Entering awaiting_customer -> Pause clock
  if (newStatus === "awaiting_customer" && oldStatus !== "awaiting_customer") {
    await db
      .update(complaintsTable)
      .set({
        slaPausedAt: now,
        slaStatus: "on_track",
        updatedAt: now,
      })
      .where(eq(complaintsTable.id, ticketId));
    logger.info({ ticketId }, "SLA clock paused: awaiting customer response");
  }

  // Leaving awaiting_customer -> Resume clock and shift due dates forward
  if (oldStatus === "awaiting_customer" && newStatus !== "awaiting_customer" && ticket.slaPausedAt) {
    const pausedMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(ticket.slaPausedAt).getTime()) / 60000)
    );
    const newTotalPaused = (ticket.slaTotalPausedMinutes || 0) + pausedMinutes;
    const shiftMs = pausedMinutes * 60 * 1000;

    const newResponseDue = ticket.responseDueAt
      ? new Date(new Date(ticket.responseDueAt).getTime() + shiftMs)
      : undefined;
    const newResolutionDue = new Date(new Date(ticket.resolutionDueAt).getTime() + shiftMs);

    await db
      .update(complaintsTable)
      .set({
        slaPausedAt: null,
        slaTotalPausedMinutes: newTotalPaused,
        responseDueAt: newResponseDue,
        resolutionDueAt: newResolutionDue,
        updatedAt: now,
      })
      .where(eq(complaintsTable.id, ticketId));

    logger.info(
      { ticketId, pausedMinutes, newTotalPaused, newResolutionDue },
      "SLA clock resumed: deadlines extended by paused interval"
    );
  }
}

/**
 * Evaluates ticket SLA progress, checks for breach or approaching breach,
 * and triggers escalations with audit logs.
 */
export async function evaluateTicketSla(ticketId: number): Promise<{
  slaStatus: SlaStatus;
  isBreached: boolean;
  minutesRemaining: number;
  escalationLevel: number;
}> {
  const [ticket] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, ticketId))
    .limit(1);

  if (!ticket || !ticket.resolutionDueAt) {
    return { slaStatus: "on_track", isBreached: false, minutesRemaining: 9999, escalationLevel: 0 };
  }

  // If already resolved or closed, SLA is frozen
  if (ticket.status === "resolved" || ticket.status === "closed") {
    const finalStatus = (ticket.slaStatus as SlaStatus) || "on_track";
    return {
      slaStatus: finalStatus,
      isBreached: finalStatus === "breached",
      minutesRemaining: 0,
      escalationLevel: ticket.escalationLevel || 0,
    };
  }

  const now = new Date();
  const resolutionDue = new Date(ticket.resolutionDueAt);
  const minutesRemaining = Math.round((resolutionDue.getTime() - now.getTime()) / 60000);

  // If currently paused, report on_track
  if (ticket.status === "awaiting_customer" || ticket.slaPausedAt) {
    return {
      slaStatus: "on_track",
      isBreached: false,
      minutesRemaining,
      escalationLevel: ticket.escalationLevel || 0,
    };
  }

  let slaStatus: SlaStatus = "on_track";
  let isBreached = false;

  if (minutesRemaining <= 0) {
    slaStatus = "breached";
    isBreached = true;
  } else if (minutesRemaining <= 120) {
    // Within 2 hours of deadline
    slaStatus = "approaching_breach";
  }

  let currentLevel = ticket.escalationLevel || 0;

  // Level 1 Escalation: Approaching breach / breached -> Alert Supervisor & Branch Admin
  if (isBreached && currentLevel < 1) {
    currentLevel = 1;
    await db
      .update(complaintsTable)
      .set({
        slaStatus,
        escalationLevel: currentLevel,
        escalatedAt: now,
        updatedAt: now,
      })
      .where(eq(complaintsTable.id, ticketId));

    await db.insert(slaEscalationLogsTable).values({
      complaintId: ticket.id,
      slaPolicyId: ticket.slaPolicyId ?? null,
      escalationLevel: 1,
      reason: `SLA Resolution Deadline Breached (${Math.abs(minutesRemaining)} mins overdue)`,
      escalatedToRole: "branch_supervisor",
      escalatedToUserId: ticket.assignedSupervisorId ?? null,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        category: ticket.type,
        priority: ticket.priority,
        minutesOverdue: Math.abs(minutesRemaining),
      },
    });

    logger.warn({ ticketId, ticketNumber: ticket.ticketNumber }, "SLA Escalation Level 1: Supervisor alerted");
  }

  // Level 2 Escalation: Overdue > 4h or Urgent Breached -> Central Superadmin Escalation
  if (isBreached && (Math.abs(minutesRemaining) > 240 || ticket.priority === "urgent") && currentLevel < 2) {
    currentLevel = 2;
    await db
      .update(complaintsTable)
      .set({
        slaStatus: "breached",
        escalationLevel: currentLevel,
        escalatedAt: now,
        updatedAt: now,
      })
      .where(eq(complaintsTable.id, ticketId));

    await db.insert(slaEscalationLogsTable).values({
      complaintId: ticket.id,
      slaPolicyId: ticket.slaPolicyId ?? null,
      escalationLevel: 2,
      reason: `Critical SLA Breach: Unresolved urgent ticket > 4h overdue`,
      escalatedToRole: "central_superadmin",
      metadata: {
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
        minutesOverdue: Math.abs(minutesRemaining),
      },
    });

    logger.error(
      { ticketId, ticketNumber: ticket.ticketNumber },
      "SLA Escalation Level 2: Central Superadmin notified"
    );
  }

  if (ticket.slaStatus !== slaStatus && currentLevel === (ticket.escalationLevel || 0)) {
    await db
      .update(complaintsTable)
      .set({ slaStatus, updatedAt: now })
      .where(eq(complaintsTable.id, ticketId));
  }

  return {
    slaStatus,
    isBreached,
    minutesRemaining,
    escalationLevel: currentLevel,
  };
}
