import { db } from "@workspace/db";
import {
  customersTable,
  loyaltyLedgerTable,
  loyaltyProgramsConfigTable,
  type LoyaltyProgramConfig,
  type LoyaltyLedgerEntry,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../logger";
import { consumePointsFifo } from "./loyaltyExpiryService";

export class LoyaltyError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "LoyaltyError";
  }
}

/**
 * Deterministically resolve effective loyalty program configuration:
 * Precedence: Branch Override > City Override > Global Default
 */
export async function getEffectiveLoyaltyConfig(
  cityId?: number | null,
  branchId?: number | null,
): Promise<LoyaltyProgramConfig> {
  const allConfigs = await db
    .select()
    .from(loyaltyProgramsConfigTable)
    .where(eq(loyaltyProgramsConfigTable.isActive, true));

  if (allConfigs.length === 0) {
    // Return hardcoded safe fallback if table is empty
    return {
      id: 0,
      name: "Default CWP Loyalty Program",
      cityId: null,
      branchId: null,
      pointsPer100Spent: 5,
      firstBookingBonusPoints: 50,
      referrerRewardPoints: 200,
      refereeRewardPoints: 100,
      redemptionRupeesPerPoint: "1.00",
      minRedemptionPoints: 50,
      maxRedemptionPointsPerOrder: 500,
      maxRedemptionPercentageOrder: 50,
      pointsValidityDays: 180,
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // 1. Branch Override
  if (branchId) {
    const branchConfig = allConfigs.find((c) => c.branchId === branchId);
    if (branchConfig) return branchConfig;
  }

  // 2. City Override
  if (cityId) {
    const cityConfig = allConfigs.find((c) => c.cityId === cityId && c.branchId == null);
    if (cityConfig) return cityConfig;
  }

  // 3. Global Default
  const globalConfig = allConfigs.find((c) => c.cityId == null && c.branchId == null);
  if (globalConfig) return globalConfig;

  return allConfigs[0];
}

/**
 * Authoritative ledger-derived customer loyalty points balance.
 * Sums credit transactions minus debit/expiry/reversal transactions.
 */
export async function getCustomerLoyaltyBalance(customerId: number): Promise<number> {
  const [row] = await db
    .select({
      balance: sql<number>`COALESCE(
        SUM(
          CASE 
            WHEN ${loyaltyLedgerTable.transactionType} = 'credit' AND ${loyaltyLedgerTable.status} = 'active' THEN ${loyaltyLedgerTable.points}
            WHEN ${loyaltyLedgerTable.transactionType} IN ('debit', 'expiry', 'reversal') AND ${loyaltyLedgerTable.status} = 'active' THEN -${loyaltyLedgerTable.points}
            ELSE 0
          END
        ), 0
      )::int`,
    })
    .from(loyaltyLedgerTable)
    .where(eq(loyaltyLedgerTable.customerId, customerId));

  return row?.balance ?? 0;
}

/**
 * Sync customer loyalty balance cache on customersTable
 */
async function syncCustomerBalanceCache(customerId: number, balance: number): Promise<void> {
  await db
    .update(customersTable)
    .set({
      loyaltyPointsBalance: balance,
      updatedAt: new Date(),
    })
    .where(eq(customersTable.id, customerId));
}

/**
 * Atomically credit loyalty points to customer ledger.
 */
export async function creditLoyaltyPoints(params: {
  customerId: number;
  points: number;
  sourceReference:
    | "booking_completion"
    | "first_booking_bonus"
    | "referral_reward"
    | "referral_welcome"
    | "admin_adjustment"
    | "retention_campaign";
  rupeeEquivalent?: number;
  bookingId?: number | null;
  referralId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  notes?: string;
  idempotencyKey?: string;
  createdBy?: number | null;
}): Promise<LoyaltyLedgerEntry> {
  if (params.points <= 0) {
    throw new LoyaltyError("Points to credit must be greater than zero", "INVALID_POINTS");
  }

  // Idempotency check
  if (params.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(loyaltyLedgerTable)
      .where(eq(loyaltyLedgerTable.idempotencyKey, params.idempotencyKey))
      .limit(1);

    if (existing) {
      logger.info({ idempotencyKey: params.idempotencyKey }, "Idempotent points credit skipped");
      return existing;
    }
  }

  const config = await getEffectiveLoyaltyConfig(params.cityId, params.branchId);
  const rupeesPerPoint = parseFloat(config.redemptionRupeesPerPoint);
  const rupeeEquivalent = params.rupeeEquivalent ?? (params.points * rupeesPerPoint);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.pointsValidityDays);

  return await db.transaction(async (tx) => {
    // Lock customer row to prevent race conditions
    const [customer] = await tx
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, params.customerId))
      .for("update");

    if (!customer) {
      throw new LoyaltyError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    const currentBalance = await getCustomerLoyaltyBalance(params.customerId);
    const balanceAfter = currentBalance + params.points;

    const [entry] = await tx
      .insert(loyaltyLedgerTable)
      .values({
        customerId: params.customerId,
        cityId: params.cityId ?? null,
        branchId: params.branchId ?? null,
        transactionType: "credit",
        points: params.points,
        rupeeEquivalent: rupeeEquivalent.toFixed(2),
        balanceAfter,
        sourceReference: params.sourceReference,
        bookingId: params.bookingId ?? null,
        referralId: params.referralId ?? null,
        status: "active",
        idempotencyKey: params.idempotencyKey ?? null,
        expiresAt,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
      })
      .returning();

    await tx
      .update(customersTable)
      .set({
        loyaltyPointsBalance: balanceAfter,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, params.customerId));

    return entry;
  });
}

/**
 * Atomically debit loyalty points from customer ledger (e.g. checkout redemption).
 */
export async function debitLoyaltyPoints(params: {
  customerId: number;
  points: number;
  sourceReference: "checkout_redemption" | "admin_adjustment";
  bookingId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  notes?: string;
  idempotencyKey?: string;
  createdBy?: number | null;
}): Promise<LoyaltyLedgerEntry> {
  if (params.points <= 0) {
    throw new LoyaltyError("Points to debit must be greater than zero", "INVALID_POINTS");
  }

  // Idempotency check
  if (params.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(loyaltyLedgerTable)
      .where(eq(loyaltyLedgerTable.idempotencyKey, params.idempotencyKey))
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  const config = await getEffectiveLoyaltyConfig(params.cityId, params.branchId);
  const rupeesPerPoint = parseFloat(config.redemptionRupeesPerPoint);
  const rupeeEquivalent = params.points * rupeesPerPoint;

  return await db.transaction(async (tx) => {
    // Lock customer row
    const [customer] = await tx
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, params.customerId))
      .for("update");

    if (!customer) {
      throw new LoyaltyError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    const currentBalance = await getCustomerLoyaltyBalance(params.customerId);
    if (currentBalance < params.points) {
      throw new LoyaltyError(
        `Insufficient points balance. You have ${currentBalance} points available.`,
        "INSUFFICIENT_POINTS_BALANCE",
      );
    }

    const balanceAfter = currentBalance - params.points;

    const [entry] = await tx
      .insert(loyaltyLedgerTable)
      .values({
        customerId: params.customerId,
        cityId: params.cityId ?? null,
        branchId: params.branchId ?? null,
        transactionType: "debit",
        points: params.points,
        rupeeEquivalent: rupeeEquivalent.toFixed(2),
        balanceAfter,
        sourceReference: params.sourceReference,
        bookingId: params.bookingId ?? null,
        status: "active",
        idempotencyKey: params.idempotencyKey ?? null,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
      })
      .returning();

    await tx
      .update(customersTable)
      .set({
        loyaltyPointsBalance: balanceAfter,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, params.customerId));

    // Allocate debit to earliest active credit batches via FIFO
    try {
      await consumePointsFifo(tx, params.customerId, params.points);
    } catch (allocErr) {
      logger.warn({ allocErr, customerId: params.customerId }, "FIFO points consumption allocation non-fatal failure");
    }

    return entry;
  });
}

/**
 * Reverse a previous loyalty ledger transaction (e.g. cancelled/refunded booking).
 */
export async function reverseLoyaltyTransaction(
  ledgerId: number,
  reason: string,
  actorId?: number,
): Promise<LoyaltyLedgerEntry> {
  const [original] = await db
    .select()
    .from(loyaltyLedgerTable)
    .where(eq(loyaltyLedgerTable.id, ledgerId))
    .limit(1);

  if (!original) {
    throw new LoyaltyError("Original ledger transaction not found", "TRANSACTION_NOT_FOUND");
  }

  if (original.status === "reversed") {
    throw new LoyaltyError("Transaction has already been reversed", "ALREADY_REVERSED");
  }

  return await db.transaction(async (tx) => {
    const currentBalance = await getCustomerLoyaltyBalance(original.customerId);
    let balanceAfter: number;
    let reversalType: "credit" | "debit" | "reversal";

    if (original.transactionType === "debit") {
      // Reversing a debit means crediting back the points
      reversalType = "credit";
      balanceAfter = currentBalance + original.points;
    } else {
      // Reversing a credit means debiting points
      reversalType = "reversal";
      balanceAfter = Math.max(0, currentBalance - original.points);
    }

    const [reversalEntry] = await tx
      .insert(loyaltyLedgerTable)
      .values({
        customerId: original.customerId,
        cityId: original.cityId,
        branchId: original.branchId,
        transactionType: reversalType,
        points: original.points,
        rupeeEquivalent: original.rupeeEquivalent,
        balanceAfter,
        sourceReference: "refund_reversal",
        bookingId: original.bookingId,
        referralId: original.referralId,
        reversalOfId: original.id,
        status: "active",
        notes: `Reversal of tx #${original.id}: ${reason}`,
        createdBy: actorId ?? null,
      })
      .returning();

    // Mark original as reversed
    await tx
      .update(loyaltyLedgerTable)
      .set({ status: "reversed" })
      .where(eq(loyaltyLedgerTable.id, original.id));

    await tx
      .update(customersTable)
      .set({
        loyaltyPointsBalance: balanceAfter,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, original.customerId));

    return reversalEntry;
  });
}

/**
 * Calculate loyalty points earned for a completed booking.
 */
export async function calculatePointsEarned(
  bookingAmount: number,
  customerId: number,
  cityId?: number | null,
  branchId?: number | null,
): Promise<{ basePoints: number; bonusPoints: number; totalPoints: number }> {
  if (bookingAmount <= 0) return { basePoints: 0, bonusPoints: 0, totalPoints: 0 };

  const config = await getEffectiveLoyaltyConfig(cityId, branchId);
  const basePoints = Math.floor((bookingAmount / 100) * config.pointsPer100Spent);

  // Check if first completed booking
  let bonusPoints = 0;
  const priorBookings = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loyaltyLedgerTable)
    .where(
      and(
        eq(loyaltyLedgerTable.customerId, customerId),
        eq(loyaltyLedgerTable.sourceReference, "booking_completion"),
      ),
    );

  if ((priorBookings[0]?.count ?? 0) === 0) {
    bonusPoints = config.firstBookingBonusPoints;
  }

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
  };
}

/**
 * Validate loyalty points redemption for checkout.
 */
export async function validateLoyaltyRedemption(
  customerId: number,
  pointsToRedeem: number,
  orderAmount: number,
  cityId?: number | null,
  branchId?: number | null,
): Promise<{
  isValid: boolean;
  pointsToRedeem: number;
  discountAmount: number;
  finalPayable: number;
  availableBalance: number;
  errorMessage?: string;
}> {
  const currentBalance = await getCustomerLoyaltyBalance(customerId);
  const config = await getEffectiveLoyaltyConfig(cityId, branchId);
  const rupeesPerPoint = parseFloat(config.redemptionRupeesPerPoint);

  if (pointsToRedeem <= 0) {
    return {
      isValid: false,
      pointsToRedeem: 0,
      discountAmount: 0,
      finalPayable: orderAmount,
      availableBalance: currentBalance,
      errorMessage: "Points to redeem must be greater than zero.",
    };
  }

  if (pointsToRedeem > currentBalance) {
    return {
      isValid: false,
      pointsToRedeem: 0,
      discountAmount: 0,
      finalPayable: orderAmount,
      availableBalance: currentBalance,
      errorMessage: `Insufficient points. You have ${currentBalance} points available.`,
    };
  }

  if (pointsToRedeem < config.minRedemptionPoints) {
    return {
      isValid: false,
      pointsToRedeem: 0,
      discountAmount: 0,
      finalPayable: orderAmount,
      availableBalance: currentBalance,
      errorMessage: `Minimum redemption is ${config.minRedemptionPoints} points.`,
    };
  }

  if (pointsToRedeem > config.maxRedemptionPointsPerOrder) {
    return {
      isValid: false,
      pointsToRedeem: 0,
      discountAmount: 0,
      finalPayable: orderAmount,
      availableBalance: currentBalance,
      errorMessage: `Maximum points redeemable per booking is ${config.maxRedemptionPointsPerOrder} points.`,
    };
  }

  const rawDiscount = pointsToRedeem * rupeesPerPoint;
  const maxDiscountAllowed = (orderAmount * config.maxRedemptionPercentageOrder) / 100;

  if (rawDiscount > maxDiscountAllowed) {
    const maxPointsForOrder = Math.floor(maxDiscountAllowed / rupeesPerPoint);
    return {
      isValid: false,
      pointsToRedeem: 0,
      discountAmount: 0,
      finalPayable: orderAmount,
      availableBalance: currentBalance,
      errorMessage: `Redemption cannot exceed ${config.maxRedemptionPercentageOrder}% of order value (max ${maxPointsForOrder} points for this booking).`,
    };
  }

  const discountAmount = Math.min(rawDiscount, orderAmount);
  const finalPayable = Math.max(0, orderAmount - discountAmount);

  return {
    isValid: true,
    pointsToRedeem,
    discountAmount,
    finalPayable,
    availableBalance: currentBalance,
  };
}

/**
 * Get customer loyalty ledger history.
 */
export async function getCustomerLedgerHistory(
  customerId: number,
  limit: number = 20,
  offset: number = 0,
) {
  const balance = await getCustomerLoyaltyBalance(customerId);
  const entries = await db
    .select()
    .from(loyaltyLedgerTable)
    .where(eq(loyaltyLedgerTable.customerId, customerId))
    .orderBy(desc(loyaltyLedgerTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loyaltyLedgerTable)
    .where(eq(loyaltyLedgerTable.customerId, customerId));

  return {
    balance,
    rupeeValue: balance * 1.0, // standard conversion
    totalCount: totalCountRow?.count ?? 0,
    entries,
  };
}
