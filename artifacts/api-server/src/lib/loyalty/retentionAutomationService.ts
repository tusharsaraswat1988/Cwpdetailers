import { db } from "@workspace/db";
import {
  customersTable,
  bookingsTable,
  dcmsSubscriptionsTable,
  loyaltyLedgerTable,
  retentionAutomationsTable,
  retentionExecutionLogsTable,
  notificationsTable,
  commCustomerConsentsTable,
  type RetentionAutomation,
} from "@workspace/db";
import { eq, and, sql, desc, gte, lte, isNull } from "drizzle-orm";
import { creditLoyaltyPoints } from "./loyaltyLedgerService";
import { logger } from "../logger";

export interface AutomationEvaluationResult {
  automationId: number;
  automationName: string;
  triggerType: string;
  evaluatedCount: number;
  triggeredCount: number;
  skippedConsentCount: number;
  skippedFrequencyCapCount: number;
  dryRun: boolean;
  sampleRecipients: { customerId: number; customerName: string; phone: string; reason: string }[];
}

/**
 * Execute retention automations across candidate customers.
 */
export async function evaluateRetentionAutomations(options: {
  automationId?: number;
  dryRun?: boolean;
  cityId?: number;
}): Promise<AutomationEvaluationResult[]> {
  const dryRun = options.dryRun ?? false;

  let query = db
    .select()
    .from(retentionAutomationsTable)
    .where(eq(retentionAutomationsTable.isActive, true));

  if (options.automationId) {
    query = db
      .select()
      .from(retentionAutomationsTable)
      .where(and(eq(retentionAutomationsTable.isActive, true), eq(retentionAutomationsTable.id, options.automationId)));
  }

  const automations = await query;
  const results: AutomationEvaluationResult[] = [];

  for (const auto of automations) {
    const res = await processSingleAutomation(auto, dryRun, options.cityId);
    results.push(res);
  }

  return results;
}

async function processSingleAutomation(
  auto: RetentionAutomation,
  dryRun: boolean,
  filterCityId?: number,
): Promise<AutomationEvaluationResult> {
  const now = new Date();
  const delayMs = auto.delayDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(now.getTime() - delayMs);

  let candidateCustomers: { id: number; name: string; phone: string; cityId: number | null }[] = [];

  if (auto.triggerType === "registered_no_booking") {
    // Customers registered before cutoffDate with 0 bookings
    candidateCustomers = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        cityId: customersTable.cityId,
      })
      .from(customersTable)
      .leftJoin(bookingsTable, eq(customersTable.id, bookingsTable.customerId))
      .where(
        and(
          lte(customersTable.createdAt, cutoffDate),
          isNull(bookingsTable.id),
          filterCityId ? eq(customersTable.cityId, filterCityId) : undefined,
          auto.cityId ? eq(customersTable.cityId, auto.cityId) : undefined,
        ),
      )
      .limit(100);
  } else if (auto.triggerType === "inactive_customer") {
    // Customers whose latest booking completed was before cutoffDate
    const inactiveRows = await db.execute(sql`
      SELECT c.id, c.name, c.phone, c.city_id
      FROM customers c
      WHERE EXISTS (
        SELECT 1 FROM bookings b WHERE b.customer_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM bookings b2 
        WHERE b2.customer_id = c.id 
        AND b2.created_at >= ${cutoffDate}
      )
      ${filterCityId ? sql`AND c.city_id = ${filterCityId}` : sql``}
      ${auto.cityId ? sql`AND c.city_id = ${auto.cityId}` : sql``}
      LIMIT 100;
    `);

    candidateCustomers = inactiveRows.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
      phone: String(r.phone),
      cityId: r.city_id ? Number(r.city_id) : null,
    }));
  } else if (auto.triggerType === "subscription_expiring") {
    // Active DCMS subscriptions with <= 3 cleanings remaining or nearing end date
    const subRows = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        cityId: customersTable.cityId,
      })
      .from(dcmsSubscriptionsTable)
      .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
      .where(
        and(
          eq(dcmsSubscriptionsTable.status, "active"),
          lte(dcmsSubscriptionsTable.cleaningsRemaining, 3),
          filterCityId ? eq(customersTable.cityId, filterCityId) : undefined,
          auto.cityId ? eq(customersTable.cityId, auto.cityId) : undefined,
        ),
      )
      .limit(100);

    candidateCustomers = subRows;
  } else if (auto.triggerType === "points_expiring") {
    // Customers with points expiring within delayDays
    const expiringCutoff = new Date(now.getTime() + delayMs);
    const expiringLedger = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        cityId: customersTable.cityId,
      })
      .from(loyaltyLedgerTable)
      .innerJoin(customersTable, eq(loyaltyLedgerTable.customerId, customersTable.id))
      .where(
        and(
          eq(loyaltyLedgerTable.transactionType, "credit"),
          eq(loyaltyLedgerTable.status, "active"),
          gte(loyaltyLedgerTable.expiresAt, now),
          lte(loyaltyLedgerTable.expiresAt, expiringCutoff),
          filterCityId ? eq(customersTable.cityId, filterCityId) : undefined,
        ),
      )
      .limit(100);

    candidateCustomers = expiringLedger;
  } else {
    // General fallback: recent completed booking follow-up
    candidateCustomers = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        cityId: customersTable.cityId,
      })
      .from(bookingsTable)
      .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .where(
        and(
          eq(bookingsTable.status, "completed"),
          lte(bookingsTable.completedAt, cutoffDate),
          filterCityId ? eq(customersTable.cityId, filterCityId) : undefined,
        ),
      )
      .limit(100);
  }

  // Deduplicate candidates
  const uniqueMap = new Map<number, (typeof candidateCustomers)[0]>();
  for (const c of candidateCustomers) {
    uniqueMap.set(c.id, c);
  }
  const uniqueCandidates = Array.from(uniqueMap.values());

  let triggeredCount = 0;
  let skippedConsentCount = 0;
  let skippedFrequencyCapCount = 0;
  const sampleRecipients: AutomationEvaluationResult["sampleRecipients"] = [];

  const freqCapMs = auto.frequencyCapDays * 24 * 60 * 60 * 1000;
  const freqCapCutoff = new Date(now.getTime() - freqCapMs);

  for (const candidate of uniqueCandidates) {
    // 1. Consent Check: Ensure customer hasn't opted out of marketing communications
    const [consent] = await db
      .select()
      .from(commCustomerConsentsTable)
      .where(
        and(
          eq(commCustomerConsentsTable.customerId, candidate.id),
          eq(commCustomerConsentsTable.channel, auto.channel),
        ),
      )
      .limit(1);

    if (consent && !consent.optedIn) {
      skippedConsentCount++;
      continue;
    }

    // 2. Frequency Cap Check: Has this automation sent to this customer within frequencyCapDays?
    const [recentLog] = await db
      .select()
      .from(retentionExecutionLogsTable)
      .where(
        and(
          eq(retentionExecutionLogsTable.automationId, auto.id),
          eq(retentionExecutionLogsTable.customerId, candidate.id),
          gte(retentionExecutionLogsTable.createdAt, freqCapCutoff),
          eq(retentionExecutionLogsTable.status, "sent"),
        ),
      )
      .limit(1);

    if (recentLog) {
      skippedFrequencyCapCount++;
      continue;
    }

    // Prepare message
    const formattedTitle = auto.titleTemplate
      .replace(/{customerName}/g, candidate.name)
      .replace(/{couponCode}/g, auto.couponCode || "");

    const formattedMessage = auto.messageTemplate
      .replace(/{customerName}/g, candidate.name)
      .replace(/{couponCode}/g, auto.couponCode || "")
      .replace(/{points}/g, String(auto.rewardPoints));

    sampleRecipients.push({
      customerId: candidate.id,
      customerName: candidate.name,
      phone: candidate.phone,
      reason: `Met trigger ${auto.triggerType} (Delay: ${auto.delayDays}d)`,
    });

    if (!dryRun) {
      try {
        // Create in-app notification in notificationsTable
        const [notification] = await db
          .insert(notificationsTable)
          .values({
            userId: null,
            customerId: candidate.id,
            cityId: candidate.cityId,
            type: "retention_campaign",
            title: formattedTitle,
            message: formattedMessage,
            channel: auto.channel as any,
            status: "sent",
            isMarketing: true,
            actionUrl: auto.couponCode ? `/services?coupon=${auto.couponCode}` : `/services`,
            metadata: {
              automationId: auto.id,
              couponCode: auto.couponCode,
              rewardPoints: auto.rewardPoints,
            },
          })
          .returning();

        // Optionally award bonus points if specified on automation
        if (auto.rewardPoints > 0) {
          await creditLoyaltyPoints({
            customerId: candidate.id,
            points: auto.rewardPoints,
            sourceReference: "retention_campaign",
            cityId: candidate.cityId,
            notes: `Bonus points from retention campaign: ${auto.name}`,
            idempotencyKey: `auto_${auto.id}_cust_${candidate.id}_${now.toISOString().slice(0, 10)}`,
          });
        }

        // Log successful execution
        await db.insert(retentionExecutionLogsTable).values({
          automationId: auto.id,
          customerId: candidate.id,
          cityId: candidate.cityId,
          channel: auto.channel,
          notificationId: notification?.id ?? null,
          status: "sent",
          messagePayload: {
            title: formattedTitle,
            message: formattedMessage,
            couponCode: auto.couponCode,
          },
        });

        triggeredCount++;
      } catch (err) {
        logger.error({ err, automationId: auto.id, customerId: candidate.id }, "Failed to execute retention automation");
        await db.insert(retentionExecutionLogsTable).values({
          automationId: auto.id,
          customerId: candidate.id,
          cityId: candidate.cityId,
          channel: auto.channel,
          status: "failed",
          messagePayload: { error: String(err) },
        });
      }
    } else {
      triggeredCount++;
    }
  }

  if (!dryRun && triggeredCount > 0) {
    await db
      .update(retentionAutomationsTable)
      .set({
        totalEvaluatedCount: sql`${retentionAutomationsTable.totalEvaluatedCount} + ${uniqueCandidates.length}`,
        totalTriggeredCount: sql`${retentionAutomationsTable.totalTriggeredCount} + ${triggeredCount}`,
        lastRunAt: now,
        updatedAt: now,
      })
      .where(eq(retentionAutomationsTable.id, auto.id));
  }

  return {
    automationId: auto.id,
    automationName: auto.name,
    triggerType: auto.triggerType,
    evaluatedCount: uniqueCandidates.length,
    triggeredCount,
    skippedConsentCount,
    skippedFrequencyCapCount,
    dryRun,
    sampleRecipients: sampleRecipients.slice(0, 10),
  };
}

/**
 * Retrieve high-level retention automation analytics.
 */
export async function getRetentionAnalytics(cityId?: number) {
  const automations = await db.select().from(retentionAutomationsTable);

  const [logsSummary] = await db
    .select({
      totalSent: sql<number>`count(case when ${retentionExecutionLogsTable.status} = 'sent' then 1 end)::int`,
      totalFailed: sql<number>`count(case when ${retentionExecutionLogsTable.status} = 'failed' then 1 end)::int`,
    })
    .from(retentionExecutionLogsTable);

  return {
    totalAutomations: automations.length,
    activeAutomations: automations.filter((a) => a.isActive).length,
    totalMessagesSent: logsSummary?.totalSent ?? 0,
    totalFailures: logsSummary?.totalFailed ?? 0,
    automationsList: automations,
  };
}
