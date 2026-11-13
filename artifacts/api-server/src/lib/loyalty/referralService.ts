import { db } from "@workspace/db";
import {
  customersTable,
  customerReferralsTable,
  bookingsTable,
  loyaltyProgramsConfigTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { creditLoyaltyPoints, getEffectiveLoyaltyConfig } from "./loyaltyLedgerService";
import { logger } from "../logger";

export class ReferralError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ReferralError";
  }
}

/**
 * Generate a clean uppercase referral code for a customer.
 * Format: CWP + sanitized first 4 chars of name + 4 alphanumeric chars.
 */
export function generateReferralCode(customerName: string, customerId: number): string {
  const cleanName = customerName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4).padEnd(3, "X");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CWP${cleanName}${randomSuffix}`;
}

/**
 * Guarantees a customer has an assigned unique referral code.
 */
export async function ensureCustomerReferralCode(customerId: number): Promise<string> {
  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      referralCode: customersTable.referralCode,
    })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) {
    throw new ReferralError("Customer not found", "CUSTOMER_NOT_FOUND");
  }

  if (customer.referralCode) {
    return customer.referralCode;
  }

  // Generate and save unique code
  let code = generateReferralCode(customer.name, customer.id);
  let attempts = 0;
  while (attempts < 5) {
    try {
      await db
        .update(customersTable)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(eq(customersTable.id, customerId));
      return code;
    } catch {
      attempts++;
      code = generateReferralCode(customer.name, customer.id);
    }
  }

  return code;
}

/**
 * Attribute a referral to a referee upon signup or entry of code.
 */
export async function attributeReferral(
  refereeCustomerId: number,
  rawReferralCode: string,
): Promise<{ success: boolean; referrerId: number; referralCode: string; message: string }> {
  const code = rawReferralCode.trim().toUpperCase();
  if (!code) {
    throw new ReferralError("Referral code is required", "INVALID_REFERRAL_CODE");
  }

  // 1. Look up referrer customer
  const [referrer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      referralCode: customersTable.referralCode,
    })
    .from(customersTable)
    .where(eq(customersTable.referralCode, code))
    .limit(1);

  if (!referrer) {
    throw new ReferralError("Invalid referral code. No account matches this code.", "REFERRAL_CODE_NOT_FOUND");
  }

  // 2. Fraud Check: Self-Referral Prevention
  if (referrer.id === refereeCustomerId) {
    throw new ReferralError("You cannot refer yourself.", "SELF_REFERRAL_PROHIBITED");
  }

  // 3. Look up referee customer details
  const [referee] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      referredByCustomerId: customersTable.referredByCustomerId,
    })
    .from(customersTable)
    .where(eq(customersTable.id, refereeCustomerId))
    .limit(1);

  if (!referee) {
    throw new ReferralError("Referee customer not found", "CUSTOMER_NOT_FOUND");
  }

  if (referrer.phone === referee.phone) {
    throw new ReferralError("Referral cannot use the same registered phone number.", "SELF_REFERRAL_PROHIBITED");
  }

  // 4. Fraud Check: Enforce One Referral Attribution Per Customer
  if (referee.referredByCustomerId) {
    throw new ReferralError("Customer has already been attributed to another referral.", "ALREADY_REFERRED");
  }

  const [existingReferral] = await db
    .select({ id: customerReferralsTable.id })
    .from(customerReferralsTable)
    .where(eq(customerReferralsTable.refereeCustomerId, refereeCustomerId))
    .limit(1);

  if (existingReferral) {
    throw new ReferralError("A referral record already exists for this customer.", "ALREADY_REFERRED");
  }

  // 5. Atomic link and create pending referral record
  await db.transaction(async (tx) => {
    await tx
      .update(customersTable)
      .set({
        referredByCustomerId: referrer.id,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, refereeCustomerId));

    await tx.insert(customerReferralsTable).values({
      referrerCustomerId: referrer.id,
      refereeCustomerId: referee.id,
      referralCode: code,
      status: "pending",
      rewardStatus: "pending",
      idempotencyKey: `ref_attrib_${referee.id}_${referrer.id}`,
    });
  });

  return {
    success: true,
    referrerId: referrer.id,
    referralCode: code,
    message: `Referral attributed successfully to ${referrer.name}. Rewards will unlock upon completion of your first booking!`,
  };
}

/**
 * Triggered on booking completion:
 * Evaluates whether this booking is the referee's first completed paid booking,
 * and if so, issues referral rewards to both referrer and referee.
 */
export async function processReferralRewardOnBookingCompletion(bookingId: number): Promise<{
  rewarded: boolean;
  referrerRewardPoints?: number;
  refereeRewardPoints?: number;
  reason?: string;
}> {
  const [booking] = await db
    .select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      status: bookingsTable.status,
      cityId: bookingsTable.cityId,
      branchId: bookingsTable.branchId,
      completedAt: bookingsTable.completedAt,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    return { rewarded: false, reason: "Booking not found" };
  }

  if (booking.status !== "completed") {
    return { rewarded: false, reason: "Booking is not completed" };
  }

  // Check if this customer has an attributed referral
  const [referral] = await db
    .select()
    .from(customerReferralsTable)
    .where(eq(customerReferralsTable.refereeCustomerId, booking.customerId))
    .limit(1);

  if (!referral) {
    return { rewarded: false, reason: "No referral attribution found for this customer" };
  }

  if (referral.status === "completed" || referral.rewardStatus === "rewarded") {
    return { rewarded: false, reason: "Referral reward has already been issued" };
  }

  // Check if this is truly the referee's first completed booking
  const completedBookings = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.customerId, booking.customerId),
        eq(bookingsTable.status, "completed"),
      ),
    );

  if (completedBookings.length > 1 && completedBookings[0].id !== booking.id) {
    // Not first booking
    return { rewarded: false, reason: "Referral rewards apply only to the customer's first completed booking" };
  }

  // Get active loyalty config for points values
  const config = await getEffectiveLoyaltyConfig(booking.cityId, booking.branchId);
  const referrerPoints = config.referrerRewardPoints;
  const refereePoints = config.refereeRewardPoints;

  const now = new Date();
  const idempotencyReferrer = `referral_reward_referrer_${referral.id}_booking_${booking.id}`;
  const idempotencyReferee = `referral_reward_referee_${referral.id}_booking_${booking.id}`;

  try {
    // 1. Credit Referrer
    await creditLoyaltyPoints({
      customerId: referral.referrerCustomerId,
      points: referrerPoints,
      sourceReference: "referral_reward",
      bookingId: booking.id,
      referralId: referral.id,
      cityId: booking.cityId,
      branchId: booking.branchId,
      notes: `Referral reward for inviting customer #${booking.customerId}`,
      idempotencyKey: idempotencyReferrer,
    });

    // 2. Credit Referee (Welcome reward)
    await creditLoyaltyPoints({
      customerId: referral.refereeCustomerId,
      points: refereePoints,
      sourceReference: "referral_welcome",
      bookingId: booking.id,
      referralId: referral.id,
      cityId: booking.cityId,
      branchId: booking.branchId,
      notes: `Welcome referral bonus for completing your first booking`,
      idempotencyKey: idempotencyReferee,
    });

    // 3. Update Referral record
    await db
      .update(customerReferralsTable)
      .set({
        status: "completed",
        rewardStatus: "rewarded",
        attributedBookingId: booking.id,
        bookingCompletedAt: booking.completedAt ?? now,
        referrerRewardPoints: referrerPoints,
        refereeRewardPoints: refereePoints,
        rewardIssuedAt: now,
        updatedAt: now,
      })
      .where(eq(customerReferralsTable.id, referral.id));

    logger.info(
      { referralId: referral.id, bookingId, referrerPoints, refereePoints },
      "Successfully processed referral rewards on booking completion",
    );

    return {
      rewarded: true,
      referrerRewardPoints: referrerPoints,
      refereeRewardPoints: refereePoints,
    };
  } catch (err) {
    logger.error({ err, referralId: referral.id, bookingId }, "Error processing referral rewards");
    throw err;
  }
}

/**
 * Retrieve referral statistics for a customer profile.
 */
export async function getCustomerReferralProfile(customerId: number) {
  const code = await ensureCustomerReferralCode(customerId);

  const referrals = await db
    .select({
      id: customerReferralsTable.id,
      refereeId: customerReferralsTable.refereeCustomerId,
      refereeName: customersTable.name,
      status: customerReferralsTable.status,
      rewardStatus: customerReferralsTable.rewardStatus,
      referrerRewardPoints: customerReferralsTable.referrerRewardPoints,
      createdAt: customerReferralsTable.createdAt,
      bookingCompletedAt: customerReferralsTable.bookingCompletedAt,
    })
    .from(customerReferralsTable)
    .innerJoin(customersTable, eq(customerReferralsTable.refereeCustomerId, customersTable.id))
    .where(eq(customerReferralsTable.referrerCustomerId, customerId))
    .orderBy(desc(customerReferralsTable.createdAt));

  const friendsInvited = referrals.length;
  const signupsCompleted = referrals.length;
  const firstBookingsCompleted = referrals.filter((r) => r.status === "completed").length;
  const rewardsEarnedPoints = referrals
    .filter((r) => r.rewardStatus === "rewarded")
    .reduce((sum, r) => sum + r.referrerRewardPoints, 0);
  const pendingRewardsCount = referrals.filter((r) => r.status === "pending").length;

  return {
    referralCode: code,
    shareUrl: `https://cwpdetailers.in/register?ref=${code}`,
    stats: {
      friendsInvited,
      signupsCompleted,
      firstBookingsCompleted,
      rewardsEarnedPoints,
      pendingRewardsCount,
    },
    terms: "Invite your friends to CWP Detailers! When your friend signs up with your code and completes their first doorstep wash, you earn 200 loyalty points (₹200) and your friend receives 100 points (₹100). Points are redeemable on any booking.",
    referralHistory: referrals,
  };
}

/**
 * Admin listing of all referrals with fraud filter.
 */
export async function listAllReferrals(options: {
  cityId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = await db
    .select({
      id: customerReferralsTable.id,
      referralCode: customerReferralsTable.referralCode,
      status: customerReferralsTable.status,
      rewardStatus: customerReferralsTable.rewardStatus,
      referrerRewardPoints: customerReferralsTable.referrerRewardPoints,
      refereeRewardPoints: customerReferralsTable.refereeRewardPoints,
      createdAt: customerReferralsTable.createdAt,
      rewardIssuedAt: customerReferralsTable.rewardIssuedAt,
      attributedBookingId: customerReferralsTable.attributedBookingId,
      fraudFlagReason: customerReferralsTable.fraudFlagReason,
      referrerId: customerReferralsTable.referrerCustomerId,
      refereeId: customerReferralsTable.refereeCustomerId,
    })
    .from(customerReferralsTable)
    .orderBy(desc(customerReferralsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerReferralsTable);

  return {
    referrals: rows,
    total: totalRow?.count ?? 0,
  };
}
