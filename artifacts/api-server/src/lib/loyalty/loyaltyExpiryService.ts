import { db } from "@workspace/db";
import {
  customersTable,
  loyaltyLedgerTable,
  loyaltyProgramsConfigTable,
  notificationsTable,
  commCustomerConsentsTable,
  type LoyaltyLedgerEntry,
} from "@workspace/db";
import { eq, and, sql, asc, lte, gte, gt } from "drizzle-orm";
import { getCustomerLoyaltyBalance, getEffectiveLoyaltyConfig } from "./loyaltyLedgerService";
import { logger } from "../logger";

export interface ExpiryResult {
  customersProcessed: number;
  batchesExpired: number;
  totalPointsExpired: number;
  dryRun: boolean;
  details: Array<{
    customerId: number;
    creditId: number;
    pointsExpired: number;
    newBalance: number;
  }>;
}

export interface ExpiryWarningResult {
  customersNotified: number;
  pointsAtRisk: number;
  suppressedConsent: number;
  dryRun: boolean;
}

/**
 * Consumes points from active earning credits in strict FIFO order (earliest expires_at first).
 * Called during customer redemption / debits so that already-spent points are not expired later.
 */
export async function consumePointsFifo(
  tx: any,
  customerId: number,
  pointsToDebit: number,
): Promise<Array<{ creditId: number; pointsConsumed: number }>> {
  if (pointsToDebit <= 0) return [];

  // Fetch active credit entries with unconsumed points, sorted FIFO by expires_at ASC, id ASC
  const activeCredits = await tx
    .select()
    .from(loyaltyLedgerTable)
    .where(
      and(
        eq(loyaltyLedgerTable.customerId, customerId),
        eq(loyaltyLedgerTable.transactionType, "credit"),
        eq(loyaltyLedgerTable.status, "active"),
        sql`${loyaltyLedgerTable.points} > ${loyaltyLedgerTable.consumedPoints}`,
      ),
    )
    .orderBy(asc(loyaltyLedgerTable.expiresAt), asc(loyaltyLedgerTable.id));

  let remainingToDebit = pointsToDebit;
  const allocations: Array<{ creditId: number; pointsConsumed: number }> = [];

  for (const credit of activeCredits) {
    if (remainingToDebit <= 0) break;

    const availableInBatch = credit.points - credit.consumedPoints;
    const consumeFromBatch = Math.min(availableInBatch, remainingToDebit);

    const newConsumed = credit.consumedPoints + consumeFromBatch;
    await tx
      .update(loyaltyLedgerTable)
      .set({
        consumedPoints: newConsumed,
      })
      .where(eq(loyaltyLedgerTable.id, credit.id));

    allocations.push({ creditId: credit.id, pointsConsumed: consumeFromBatch });
    remainingToDebit -= consumeFromBatch;
  }

  return allocations;
}

/**
 * Automatic Points Expiry Lifecycle Engine.
 * Scans for credit entries whose expires_at is past now and has unconsumed points.
 * Creates immutable expiry ledger records, updates customer balances, and preserves non-negative continuity.
 */
export async function processLoyaltyPointsExpiry(options?: {
  cityId?: number;
  dryRun?: boolean;
}): Promise<ExpiryResult> {
  const now = new Date();
  const dryRun = options?.dryRun ?? false;

  logger.info({ dryRun, cityId: options?.cityId }, "Starting automated loyalty points expiry run");

  // Find all active credit entries where expires_at <= NOW() and points > consumed_points
  const expiredCreditsQuery = db
    .select({
      id: loyaltyLedgerTable.id,
      customerId: loyaltyLedgerTable.customerId,
      cityId: loyaltyLedgerTable.cityId,
      branchId: loyaltyLedgerTable.branchId,
      points: loyaltyLedgerTable.points,
      consumedPoints: loyaltyLedgerTable.consumedPoints,
      expiresAt: loyaltyLedgerTable.expiresAt,
      rupeeEquivalent: loyaltyLedgerTable.rupeeEquivalent,
    })
    .from(loyaltyLedgerTable)
    .where(
      and(
        eq(loyaltyLedgerTable.transactionType, "credit"),
        eq(loyaltyLedgerTable.status, "active"),
        lte(loyaltyLedgerTable.expiresAt, now),
        sql`${loyaltyLedgerTable.points} > ${loyaltyLedgerTable.consumedPoints}`,
        options?.cityId ? eq(loyaltyLedgerTable.cityId, options.cityId) : undefined,
      ),
    )
    .orderBy(asc(loyaltyLedgerTable.expiresAt), asc(loyaltyLedgerTable.id))
    .limit(500);

  const expiredCreditBatches = await expiredCreditsQuery;

  let customersProcessed = 0;
  let batchesExpired = 0;
  let totalPointsExpired = 0;
  const details: ExpiryResult["details"] = [];
  const processedCustomerSet = new Set<number>();

  for (const batch of expiredCreditBatches) {
    const unconsumedPoints = batch.points - batch.consumedPoints;
    if (unconsumedPoints <= 0) continue;

    if (dryRun) {
      batchesExpired++;
      totalPointsExpired += unconsumedPoints;
      processedCustomerSet.add(batch.customerId);
      details.push({
        customerId: batch.customerId,
        creditId: batch.id,
        pointsExpired: unconsumedPoints,
        newBalance: 0,
      });
      continue;
    }

    // Atomic execution per batch with customer lock
    await db.transaction(async (tx) => {
      // 1. Lock customer row for update
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, batch.customerId))
        .for("update");

      if (!customer) return;

      // 2. Derive authoritative balance
      const currentBalance = await getCustomerLoyaltyBalance(batch.customerId);
      if (currentBalance <= 0) {
        // Mark credit as fully consumed/expired to prevent reprocessing
        await tx
          .update(loyaltyLedgerTable)
          .set({ consumedPoints: batch.points, status: "expired" })
          .where(eq(loyaltyLedgerTable.id, batch.id));
        return;
      }

      // 3. Guarantee non-negative balance: cannot expire more than current balance
      const pointsToExpire = Math.min(unconsumedPoints, currentBalance);
      if (pointsToExpire <= 0) return;

      const idempotencyKey = `expiry_tx_${batch.id}_${batch.expiresAt ? batch.expiresAt.toISOString().slice(0, 10) : now.toISOString().slice(0, 10)}`;

      // Check idempotency
      const [existing] = await tx
        .select()
        .from(loyaltyLedgerTable)
        .where(eq(loyaltyLedgerTable.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        logger.warn({ idempotencyKey }, "Points expiry transaction already recorded, skipping");
        return;
      }

      const balanceAfter = currentBalance - pointsToExpire;
      const config = await getEffectiveLoyaltyConfig(batch.cityId, batch.branchId);
      const rupeesPerPoint = parseFloat(config.redemptionRupeesPerPoint);
      const rupeeEquivalent = (pointsToExpire * rupeesPerPoint).toFixed(2);

      // 4. Insert immutable expiry ledger entry
      await tx.insert(loyaltyLedgerTable).values({
        customerId: batch.customerId,
        cityId: batch.cityId,
        branchId: batch.branchId,
        transactionType: "expiry",
        points: pointsToExpire,
        rupeeEquivalent,
        balanceAfter,
        sourceReference: "points_expiry",
        reversalOfId: batch.id,
        status: "active",
        idempotencyKey,
        notes: `Automated FIFO expiry of ${pointsToExpire} points from credit batch #${batch.id}`,
      });

      // 5. Update credit entry: mark fully consumed and expired
      await tx
        .update(loyaltyLedgerTable)
        .set({
          consumedPoints: batch.points,
          status: "expired",
        })
        .where(eq(loyaltyLedgerTable.id, batch.id));

      // 6. Sync customer cached points balance
      await tx
        .update(customersTable)
        .set({
          loyaltyPointsBalance: balanceAfter,
          updatedAt: now,
        })
        .where(eq(customersTable.id, batch.customerId));

      batchesExpired++;
      totalPointsExpired += pointsToExpire;
      processedCustomerSet.add(batch.customerId);
      details.push({
        customerId: batch.customerId,
        creditId: batch.id,
        pointsExpired: pointsToExpire,
        newBalance: balanceAfter,
      });
    });
  }

  customersProcessed = processedCustomerSet.size;
  logger.info(
    { customersProcessed, batchesExpired, totalPointsExpired, dryRun },
    "Loyalty points expiry completed",
  );

  return {
    customersProcessed,
    batchesExpired,
    totalPointsExpired,
    dryRun,
    details: details.slice(0, 50),
  };
}

/**
 * Pre-expiry warning notification generator.
 * Alerts customers whose points are approaching expiry (e.g. 7 days before).
 */
export async function processLoyaltyExpiryWarnings(options?: {
  daysNotice?: number;
  cityId?: number;
  dryRun?: boolean;
}): Promise<ExpiryWarningResult> {
  const daysNotice = options?.daysNotice ?? 7;
  const dryRun = options?.dryRun ?? false;
  const now = new Date();
  const warningWindowStart = now;
  const warningWindowEnd = new Date(now.getTime() + daysNotice * 24 * 60 * 60 * 1000);

  // Find credits expiring within window with unconsumed points
  const expiringCredits = await db
    .select({
      id: loyaltyLedgerTable.id,
      customerId: loyaltyLedgerTable.customerId,
      points: loyaltyLedgerTable.points,
      consumedPoints: loyaltyLedgerTable.consumedPoints,
      expiresAt: loyaltyLedgerTable.expiresAt,
      cityId: loyaltyLedgerTable.cityId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
    })
    .from(loyaltyLedgerTable)
    .innerJoin(customersTable, eq(loyaltyLedgerTable.customerId, customersTable.id))
    .where(
      and(
        eq(loyaltyLedgerTable.transactionType, "credit"),
        eq(loyaltyLedgerTable.status, "active"),
        gte(loyaltyLedgerTable.expiresAt, warningWindowStart),
        lte(loyaltyLedgerTable.expiresAt, warningWindowEnd),
        sql`${loyaltyLedgerTable.points} > ${loyaltyLedgerTable.consumedPoints}`,
        options?.cityId ? eq(loyaltyLedgerTable.cityId, options.cityId) : undefined,
      ),
    )
    .limit(200);

  // Group by customer
  const customerMap = new Map<number, {
    customerName: string;
    customerPhone: string;
    cityId: number | null;
    totalExpiringPoints: number;
    earliestExpiry: Date;
  }>();

  for (const c of expiringCredits) {
    const unconsumed = c.points - c.consumedPoints;
    if (unconsumed <= 0) continue;

    const existing = customerMap.get(c.customerId);
    if (!existing) {
      customerMap.set(c.customerId, {
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        cityId: c.cityId,
        totalExpiringPoints: unconsumed,
        earliestExpiry: c.expiresAt || warningWindowEnd,
      });
    } else {
      existing.totalExpiringPoints += unconsumed;
      if (c.expiresAt && c.expiresAt < existing.earliestExpiry) {
        existing.earliestExpiry = c.expiresAt;
      }
    }
  }

  let customersNotified = 0;
  let pointsAtRisk = 0;
  let suppressedConsent = 0;

  for (const [customerId, info] of customerMap.entries()) {
    pointsAtRisk += info.totalExpiringPoints;

    // Check marketing consent
    const [consent] = await db
      .select()
      .from(commCustomerConsentsTable)
      .where(
        and(
          eq(commCustomerConsentsTable.customerId, customerId),
          eq(commCustomerConsentsTable.channel, "in_app"),
        ),
      )
      .limit(1);

    if (consent && !consent.optedIn) {
      suppressedConsent++;
      continue;
    }

    if (!dryRun) {
      const dedupeKey = `points_expiring_warn_${customerId}_${now.toISOString().slice(0, 10)}`;

      // Insert in-app notification
      await db.insert(notificationsTable).values({
        customerId,
        cityId: info.cityId,
        type: "general",
        title: "Your Loyalty Points Are Expiring Soon!",
        message: `Hi ${info.customerName}, you have ${info.totalExpiringPoints} points expiring soon. Redeem them on your next car detailing service!`,
        channel: "in_app",
        deliveryStatus: "sent",
        isMarketing: true,
        actionUrl: "/customer/loyalty",
        dedupeKey,
      }).onConflictDoNothing();

      customersNotified++;
    } else {
      customersNotified++;
    }
  }

  return {
    customersNotified,
    pointsAtRisk,
    suppressedConsent,
    dryRun,
  };
}
