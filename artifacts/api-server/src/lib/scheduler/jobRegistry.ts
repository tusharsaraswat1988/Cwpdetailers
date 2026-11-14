import { db, marketingCampaignsTable, promotionsTable } from "@workspace/db";
import { eq, and, lte, sql } from "drizzle-orm";
import type { JobContext, JobHandler, JobResult } from "./schedulerTypes";
import { evaluateRetentionAutomations } from "../loyalty/retentionAutomationService";
import { processLoyaltyPointsExpiry, processLoyaltyExpiryWarnings } from "../loyalty/loyaltyExpiryService";
import { runDailyTick } from "../../subscriptions/service";
import { runMissedVisitScheduler } from "../dcms/missedVisitScheduler";
import { autoResumeExpiredPauses } from "../dcms/pauseService";
import { runDcmsMaintenanceJobs } from "../dcms/maintenanceService";
import { notifyDailyRoutesAvailable } from "../dcms/routeNotifyService";
import { purgeOldGpsLocationLogs } from "../tracking/gpsRetentionWorker";
import { todayStrInIST } from "../dcms/dateUtils";
import { logger } from "../logger";

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  handlers.set(jobType, handler);
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType);
}

export function listRegisteredJobTypes(): string[] {
  return Array.from(handlers.keys());
}

// ============================================================================
// 1. Retention Automation Handler (Phase 21 Integration)
// ============================================================================
registerJobHandler("retention_automation", async (context: JobContext): Promise<JobResult> => {
  const automationId = context.payload.automationId ? Number(context.payload.automationId) : undefined;
  const cityId = context.cityId ?? (context.payload.cityId ? Number(context.payload.cityId) : undefined);
  const dryRun = Boolean(context.dryRun || context.payload.dryRun);

  const results = await evaluateRetentionAutomations({
    automationId,
    cityId,
    dryRun,
  });

  let totalEvaluated = 0;
  let totalTriggered = 0;
  let totalSkippedConsent = 0;
  let totalSkippedFreqCap = 0;

  for (const r of results) {
    totalEvaluated += r.evaluatedCount;
    totalTriggered += r.triggeredCount;
    totalSkippedConsent += r.skippedConsentCount;
    totalSkippedFreqCap += r.skippedFrequencyCapCount;
  }

  return {
    success: true,
    processedCount: totalTriggered,
    metrics: {
      automationsEvaluated: results.length,
      candidatesEvaluated: totalEvaluated,
      eligibleTriggered: totalTriggered,
      skippedConsent: totalSkippedConsent,
      skippedFrequencyCap: totalSkippedFreqCap,
      dryRun,
    },
    message: `Evaluated ${results.length} retention automations; triggered ${totalTriggered} messages (${totalSkippedConsent} suppressed for consent, ${totalSkippedFreqCap} frequency capped).`,
  };
});

// ============================================================================
// 2. Loyalty Points Expiry Handler (Phase 22 FIFO Expiry)
// ============================================================================
registerJobHandler("loyalty_points_expiry", async (context: JobContext): Promise<JobResult> => {
  const cityId = context.cityId ?? (context.payload.cityId ? Number(context.payload.cityId) : undefined);
  const dryRun = Boolean(context.dryRun || context.payload.dryRun);

  const res = await processLoyaltyPointsExpiry({
    cityId,
    dryRun,
  });

  return {
    success: true,
    processedCount: res.batchesExpired,
    metrics: {
      customersAffected: res.customersProcessed,
      batchesExpired: res.batchesExpired,
      totalPointsExpired: res.totalPointsExpired,
      dryRun: res.dryRun,
    },
    message: `Expired ${res.totalPointsExpired} unredeemed points across ${res.batchesExpired} credit batches for ${res.customersProcessed} customers (dryRun=${res.dryRun}).`,
  };
});

// ============================================================================
// 3. Loyalty Pre-Expiry Warning Notification Handler
// ============================================================================
registerJobHandler("loyalty_expiry_warning", async (context: JobContext): Promise<JobResult> => {
  const cityId = context.cityId ?? (context.payload.cityId ? Number(context.payload.cityId) : undefined);
  const daysNotice = context.payload.daysNotice ? Number(context.payload.daysNotice) : 7;
  const dryRun = Boolean(context.dryRun || context.payload.dryRun);

  const res = await processLoyaltyExpiryWarnings({
    cityId,
    daysNotice,
    dryRun,
  });

  return {
    success: true,
    processedCount: res.customersNotified,
    metrics: {
      customersNotified: res.customersNotified,
      pointsAtRisk: res.pointsAtRisk,
      suppressedConsent: res.suppressedConsent,
      daysNotice,
      dryRun,
    },
    message: `Notified ${res.customersNotified} customers about ${res.pointsAtRisk} points expiring within ${daysNotice} days (${res.suppressedConsent} suppressed).`,
  };
});

// ============================================================================
// 4. Marketing CMS Campaign & Coupon Lifecycle Handler (Phase 20 Integration)
// ============================================================================
registerJobHandler("campaign_lifecycle", async (context: JobContext): Promise<JobResult> => {
  const now = new Date();
  const dryRun = Boolean(context.dryRun || context.payload.dryRun);

  // 1. Transition scheduled campaigns whose start_date has arrived to active
  const scheduledToActivate = await db
    .select({ id: marketingCampaignsTable.id, name: marketingCampaignsTable.name })
    .from(marketingCampaignsTable)
    .where(
      and(
        eq(marketingCampaignsTable.status, "scheduled"),
        lte(marketingCampaignsTable.startDate, now),
      ),
    );

  let activatedCount = 0;
  if (!dryRun) {
    for (const c of scheduledToActivate) {
      await db
        .update(marketingCampaignsTable)
        .set({ status: "active", updatedAt: now })
        .where(eq(marketingCampaignsTable.id, c.id));
      activatedCount++;
    }
  } else {
    activatedCount = scheduledToActivate.length;
  }

  // 2. Transition active campaigns whose end_date has arrived to completed
  const activeToComplete = await db
    .select({ id: marketingCampaignsTable.id, name: marketingCampaignsTable.name })
    .from(marketingCampaignsTable)
    .where(
      and(
        eq(marketingCampaignsTable.status, "active"),
        lte(marketingCampaignsTable.endDate, now),
      ),
    );

  let completedCount = 0;
  if (!dryRun) {
    for (const c of activeToComplete) {
      await db
        .update(marketingCampaignsTable)
        .set({ status: "completed", updatedAt: now })
        .where(eq(marketingCampaignsTable.id, c.id));
      completedCount++;
    }
  } else {
    completedCount = activeToComplete.length;
  }

  // 3. Deactivate expired coupons in promotions table
  const expiredCoupons = await db
    .select({ id: promotionsTable.id, code: promotionsTable.code })
    .from(promotionsTable)
    .where(
      and(
        eq(promotionsTable.isActive, true),
        lte(promotionsTable.validTo, now),
      ),
    );

  let expiredCouponCount = 0;
  if (!dryRun) {
    for (const p of expiredCoupons) {
      await db
        .update(promotionsTable)
        .set({ isActive: false, updatedAt: now })
        .where(eq(promotionsTable.id, p.id));
      expiredCouponCount++;
    }
  } else {
    expiredCouponCount = expiredCoupons.length;
  }

  return {
    success: true,
    processedCount: activatedCount + completedCount + expiredCouponCount,
    metrics: {
      activatedCampaigns: activatedCount,
      completedCampaigns: completedCount,
      deactivatedCoupons: expiredCouponCount,
      dryRun,
    },
    message: `Campaign lifecycle: activated ${activatedCount} campaigns, completed ${completedCount} campaigns, deactivated ${expiredCouponCount} expired coupons.`,
  };
});

// ============================================================================
// 5. Subscription Daily Tick Handler
// ============================================================================
registerJobHandler("subscription_daily_tick", async (context: JobContext): Promise<JobResult> => {
  if (context.dryRun) {
    return { success: true, message: "Dry-run: subscription daily tick skipped" };
  }
  await runDailyTick();
  return {
    success: true,
    message: "Subscription daily maintenance tick executed successfully.",
  };
});

// ============================================================================
// 6. DCMS End-Of-Day Missed Visit Scheduler Handler
// ============================================================================
registerJobHandler("dcms_missed_visit", async (context: JobContext): Promise<JobResult> => {
  const dateStr = (context.payload.date as string) || todayStrInIST();
  if (context.dryRun) {
    return { success: true, message: `Dry-run: DCMS missed-visit scheduler skipped for ${dateStr}` };
  }

  const result = await runMissedVisitScheduler(dateStr);
  await autoResumeExpiredPauses(dateStr);
  await runDcmsMaintenanceJobs();

  return {
    success: true,
    metrics: result,
    message: `DCMS missed visit scheduler completed for ${dateStr}.`,
  };
});

// ============================================================================
// 7. Morning Route Push Notification Handler
// ============================================================================
registerJobHandler("morning_route_notify", async (context: JobContext): Promise<JobResult> => {
  if (context.dryRun) {
    return { success: true, message: "Dry-run: Morning route notification skipped" };
  }
  const result = await notifyDailyRoutesAvailable();
  return {
    success: true,
    metrics: result,
    message: `Morning route push notifications processed.`,
  };
});

// ============================================================================
// 8. GPS Telemetry Retention Purge Handler
// ============================================================================
registerJobHandler("gps_retention_purge", async (context: JobContext): Promise<JobResult> => {
  const retentionDays = context.payload.retentionDays ? Number(context.payload.retentionDays) : undefined;
  const dryRun = Boolean(context.dryRun || context.payload.dryRun);

  const result = await purgeOldGpsLocationLogs({
    retentionDays,
    dryRun,
  });

  return {
    success: result.success,
    processedCount: result.recordsDeleted,
    metrics: result,
    message: `GPS retention purge: deleted ${result.recordsDeleted} records older than ${result.cutoffDate} (dryRun=${result.dryRun}).`,
  };
});
