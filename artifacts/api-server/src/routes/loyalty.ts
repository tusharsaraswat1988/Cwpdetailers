import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  loyaltyProgramsConfigTable,
  retentionAutomationsTable,
  loyaltyLedgerTable,
  customerReferralsTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  getCustomerReferralProfile,
  attributeReferral,
  listAllReferrals,
} from "../lib/loyalty/referralService";
import {
  getCustomerLoyaltyBalance,
  getCustomerLedgerHistory,
  validateLoyaltyRedemption,
  creditLoyaltyPoints,
  debitLoyaltyPoints,
  getEffectiveLoyaltyConfig,
} from "../lib/loyalty/loyaltyLedgerService";
import {
  evaluateRetentionAutomations,
  getRetentionAnalytics,
} from "../lib/loyalty/retentionAutomationService";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

function requireStaffOrAdmin(req: any, res: any, next: any) {
  const role = req.user?.role;
  if (!role || !["superadmin", "central_admin", "admin", "branch_manager", "manager", "staff"].includes(role)) {
    return res.status(403).json({ error: "Access denied. Staff or admin role required." });
  }
  next();
}

export const loyaltyRouter = Router();

// ============================================================================
// CUSTOMER ROUTES
// ============================================================================

/**
 * GET /api/loyalty/my-rewards
 * Fetch current customer's loyalty balance, referral profile, and recent ledger activity.
 */
loyaltyRouter.get("/loyalty/my-rewards", requireAuth, async (req, res) => {
  try {
    const customerId = (req.user as any)?.customerId ?? req.scope?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No customer profile linked to this session" });
    }

    const [referralProfile, ledgerSummary] = await Promise.all([
      getCustomerReferralProfile(customerId),
      getCustomerLedgerHistory(customerId, 10, 0),
    ]);

    return res.json({
      customerId,
      referral: referralProfile,
      loyalty: {
        balance: ledgerSummary.balance,
        rupeeValue: ledgerSummary.rupeeValue,
        recentActivity: ledgerSummary.entries,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching customer rewards profile");
    return res.status(500).json({ error: err.message || "Failed to load rewards profile" });
  }
});

/**
 * POST /api/loyalty/referrals/attribute
 * Attribute a referral code to the current customer.
 */
loyaltyRouter.post("/loyalty/referrals/attribute", requireAuth, async (req, res) => {
  try {
    const customerId = (req.user as any)?.customerId ?? req.scope?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No customer profile linked to this session" });
    }

    const { referralCode } = req.body;
    if (!referralCode) {
      return res.status(400).json({ error: "Referral code is required" });
    }

    const result = await attributeReferral(customerId, referralCode);
    return res.json(result);
  } catch (err: any) {
    logger.warn({ err, body: req.body }, "Referral attribution rejected");
    return res.status(400).json({
      error: err.message || "Failed to attribute referral code",
      code: err.code || "REFERRAL_ATTRIBUTION_FAILED",
    });
  }
});

/**
 * POST /api/loyalty/validate-redemption
 * Validate loyalty points redemption for booking checkout.
 */
loyaltyRouter.post("/loyalty/validate-redemption", requireAuth, async (req, res) => {
  try {
    const customerId = (req.user as any)?.customerId ?? req.scope?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No customer profile linked to this session" });
    }

    const { pointsToRedeem, orderAmount, cityId, branchId } = req.body;
    if (pointsToRedeem == null || orderAmount == null) {
      return res.status(400).json({ error: "pointsToRedeem and orderAmount are required" });
    }

    const validation = await validateLoyaltyRedemption(
      customerId,
      Number(pointsToRedeem),
      Number(orderAmount),
      cityId ? Number(cityId) : null,
      branchId ? Number(branchId) : null,
    );

    return res.json(validation);
  } catch (err: any) {
    logger.error({ err }, "Error validating loyalty redemption");
    return res.status(500).json({ error: err.message || "Failed to validate redemption" });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /api/loyalty/admin/overview
 * Executive overview of referral and loyalty metrics.
 */
loyaltyRouter.get("/loyalty/admin/overview", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    // 1. Referral stats
    const [referralStats] = await db
      .select({
        totalReferrals: sql<number>`count(*)::int`,
        completedReferrals: sql<number>`count(case when ${customerReferralsTable.status} = 'completed' then 1 end)::int`,
        pendingReferrals: sql<number>`count(case when ${customerReferralsTable.status} = 'pending' then 1 end)::int`,
        rewardsIssuedPoints: sql<number>`coalesce(sum(${customerReferralsTable.referrerRewardPoints} + ${customerReferralsTable.refereeRewardPoints}), 0)::int`,
      })
      .from(customerReferralsTable);

    // 2. Loyalty stats
    const [loyaltyStats] = await db
      .select({
        totalPointsIssued: sql<number>`coalesce(sum(case when ${loyaltyLedgerTable.transactionType} = 'credit' then ${loyaltyLedgerTable.points} else 0 end), 0)::int`,
        totalPointsRedeemed: sql<number>`coalesce(sum(case when ${loyaltyLedgerTable.transactionType} = 'debit' then ${loyaltyLedgerTable.points} else 0 end), 0)::int`,
        outstandingPointsLiability: sql<number>`coalesce(sum(case when ${loyaltyLedgerTable.transactionType} = 'credit' and ${loyaltyLedgerTable.status} = 'active' then ${loyaltyLedgerTable.points} when ${loyaltyLedgerTable.transactionType} in ('debit', 'expiry', 'reversal') and ${loyaltyLedgerTable.status} = 'active' then -${loyaltyLedgerTable.points} else 0 end), 0)::int`,
      })
      .from(loyaltyLedgerTable);

    // 3. Retention automation stats
    const retentionSummary = await getRetentionAnalytics();

    return res.json({
      referrals: {
        totalSignups: referralStats?.totalReferrals ?? 0,
        completedConversions: referralStats?.completedReferrals ?? 0,
        pendingConversions: referralStats?.pendingReferrals ?? 0,
        rewardsIssuedPoints: referralStats?.rewardsIssuedPoints ?? 0,
        conversionRatePct: referralStats?.totalReferrals
          ? Math.round(((referralStats.completedReferrals ?? 0) / referralStats.totalReferrals) * 100)
          : 0,
      },
      loyalty: {
        totalPointsIssued: loyaltyStats?.totalPointsIssued ?? 0,
        totalPointsRedeemed: loyaltyStats?.totalPointsRedeemed ?? 0,
        outstandingPointsLiability: loyaltyStats?.outstandingPointsLiability ?? 0,
        rupeeLiabilityValue: (loyaltyStats?.outstandingPointsLiability ?? 0) * 1.0,
      },
      retention: retentionSummary,
    });
  } catch (err: any) {
    logger.error({ err }, "Error loading loyalty admin overview");
    return res.status(500).json({ error: err.message || "Failed to load admin overview" });
  }
});

/**
 * GET /api/loyalty/admin/referrals
 * List all customer referrals with filters.
 */
loyaltyRouter.get("/loyalty/admin/referrals", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const referrals = await listAllReferrals({
      status: status ? String(status) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
    return res.json(referrals);
  } catch (err: any) {
    logger.error({ err }, "Error listing referrals");
    return res.status(500).json({ error: err.message || "Failed to list referrals" });
  }
});

/**
 * GET /api/loyalty/admin/config
 * Get active loyalty program config.
 */
loyaltyRouter.get("/loyalty/admin/config", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const config = await getEffectiveLoyaltyConfig();
    return res.json(config);
  } catch (err: any) {
    logger.error({ err }, "Error fetching loyalty config");
    return res.status(500).json({ error: err.message || "Failed to fetch config" });
  }
});

/**
 * PUT /api/loyalty/admin/config
 * Update loyalty program config.
 */
loyaltyRouter.put("/loyalty/admin/config", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const {
      pointsPer100Spent,
      firstBookingBonusPoints,
      referrerRewardPoints,
      refereeRewardPoints,
      redemptionRupeesPerPoint,
      minRedemptionPoints,
      maxRedemptionPointsPerOrder,
      maxRedemptionPercentageOrder,
      pointsValidityDays,
    } = req.body;

    const [updated] = await db
      .update(loyaltyProgramsConfigTable)
      .set({
        pointsPer100Spent: pointsPer100Spent != null ? Number(pointsPer100Spent) : undefined,
        firstBookingBonusPoints: firstBookingBonusPoints != null ? Number(firstBookingBonusPoints) : undefined,
        referrerRewardPoints: referrerRewardPoints != null ? Number(referrerRewardPoints) : undefined,
        refereeRewardPoints: refereeRewardPoints != null ? Number(refereeRewardPoints) : undefined,
        redemptionRupeesPerPoint: redemptionRupeesPerPoint != null ? String(redemptionRupeesPerPoint) : undefined,
        minRedemptionPoints: minRedemptionPoints != null ? Number(minRedemptionPoints) : undefined,
        maxRedemptionPointsPerOrder: maxRedemptionPointsPerOrder != null ? Number(maxRedemptionPointsPerOrder) : undefined,
        maxRedemptionPercentageOrder: maxRedemptionPercentageOrder != null ? Number(maxRedemptionPercentageOrder) : undefined,
        pointsValidityDays: pointsValidityDays != null ? Number(pointsValidityDays) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyProgramsConfigTable.isActive, true))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    logger.error({ err }, "Error updating loyalty config");
    return res.status(500).json({ error: err.message || "Failed to update config" });
  }
});

/**
 * GET /api/loyalty/admin/automations
 * List retention automations.
 */
loyaltyRouter.get("/loyalty/admin/automations", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const automations = await db.select().from(retentionAutomationsTable).orderBy(desc(retentionAutomationsTable.id));
    return res.json(automations);
  } catch (err: any) {
    logger.error({ err }, "Error listing automations");
    return res.status(500).json({ error: err.message || "Failed to list automations" });
  }
});

/**
 * POST /api/loyalty/admin/automations
 * Create or update a retention automation.
 */
loyaltyRouter.post("/loyalty/admin/automations", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id, name, triggerType, delayDays, couponCode, rewardPoints, titleTemplate, messageTemplate, frequencyCapDays, channel, isActive } = req.body;

    if (!name || !triggerType || !titleTemplate || !messageTemplate) {
      return res.status(400).json({ error: "name, triggerType, titleTemplate, and messageTemplate are required" });
    }

    if (id) {
      const [updated] = await db
        .update(retentionAutomationsTable)
        .set({
          name,
          triggerType,
          delayDays: delayDays ? Number(delayDays) : undefined,
          couponCode: couponCode || null,
          rewardPoints: rewardPoints ? Number(rewardPoints) : 0,
          titleTemplate,
          messageTemplate,
          frequencyCapDays: frequencyCapDays ? Number(frequencyCapDays) : 30,
          channel: channel || "in_app",
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          updatedAt: new Date(),
        })
        .where(eq(retentionAutomationsTable.id, Number(id)))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db
        .insert(retentionAutomationsTable)
        .values({
          name,
          triggerType,
          delayDays: delayDays ? Number(delayDays) : 7,
          couponCode: couponCode || null,
          rewardPoints: rewardPoints ? Number(rewardPoints) : 0,
          titleTemplate,
          messageTemplate,
          frequencyCapDays: frequencyCapDays ? Number(frequencyCapDays) : 30,
          channel: channel || "in_app",
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        })
        .returning();
      return res.status(201).json(created);
    }
  } catch (err: any) {
    logger.error({ err }, "Error creating/updating automation");
    return res.status(500).json({ error: err.message || "Failed to save automation" });
  }
});

/**
 * POST /api/loyalty/admin/automations/run
 * Trigger an automation evaluation (live or dry-run).
 */
loyaltyRouter.post("/loyalty/admin/automations/run", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const { automationId, dryRun, cityId } = req.body;
    const results = await evaluateRetentionAutomations({
      automationId: automationId ? Number(automationId) : undefined,
      dryRun: Boolean(dryRun),
      cityId: cityId ? Number(cityId) : undefined,
    });
    return res.json({ success: true, dryRun: Boolean(dryRun), results });
  } catch (err: any) {
    logger.error({ err }, "Error running retention automations");
    return res.status(500).json({ error: err.message || "Failed to evaluate automations" });
  }
});

/**
 * GET /api/loyalty/admin/customer-ledger/:customerId
 * View complete points ledger for a specific customer.
 */
loyaltyRouter.get("/loyalty/admin/customer-ledger/:customerId", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const ledger = await getCustomerLedgerHistory(customerId, 100, 0);
    return res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        referralCode: customer.referralCode,
      },
      ...ledger,
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching customer ledger");
    return res.status(500).json({ error: err.message || "Failed to fetch ledger" });
  }
});

/**
 * POST /api/loyalty/admin/ledger/adjust
 * Administrative manual points adjustment with mandatory audit reason.
 */
loyaltyRouter.post("/api/loyalty/admin/ledger/adjust", requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const { customerId, points, type, notes } = req.body;
    if (!customerId || !points || !type || !notes) {
      return res.status(400).json({ error: "customerId, points, type ('credit'|'debit'), and notes are required" });
    }

    const actorId = req.user?.id;
    let entry;

    if (type === "credit") {
      entry = await creditLoyaltyPoints({
        customerId: Number(customerId),
        points: Number(points),
        sourceReference: "admin_adjustment",
        notes: `Admin adjustment: ${notes}`,
        createdBy: actorId,
      });
    } else if (type === "debit") {
      entry = await debitLoyaltyPoints({
        customerId: Number(customerId),
        points: Number(points),
        sourceReference: "admin_adjustment",
        notes: `Admin adjustment: ${notes}`,
        createdBy: actorId,
      });
    } else {
      return res.status(400).json({ error: "Invalid adjustment type. Must be 'credit' or 'debit'" });
    }

    return res.json({ success: true, entry });
  } catch (err: any) {
    logger.error({ err }, "Error adjusting customer points");
    return res.status(400).json({ error: err.message || "Failed to adjust points" });
  }
});
