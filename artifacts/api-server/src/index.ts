import app from "./app";
import { bootstrapAdminFromEnv } from "./lib/bootstrapAdmin";
import { bootstrapMasterDataIfEmpty, bootstrapDcmsPlansIfEmpty } from "./lib/bootstrapMasterData";
import { ensureStartupMigrations } from "./lib/startupMigrations";
import { logger } from "./lib/logger";
import { runDailyTick } from "./subscriptions/service";
import { runMissedVisitScheduler } from "./lib/dcms/missedVisitScheduler";
import { autoResumeExpiredPauses } from "./lib/dcms/pauseService";
import { runDcmsMaintenanceJobs } from "./lib/dcms/maintenanceService";
import { notifyDailyRoutesAvailable } from "./lib/dcms/routeNotifyService";
import { processPendingNotificationEvents } from "./lib/push/eventProcessor";
import { ensureWebPushConfigured } from "./lib/push/webPushService";
import { todayStrInIST, getNext2359IST } from "./lib/dcms/dateUtils";
import { bootstrapJobOrchestration } from "./lib/job-orchestration/bootstrap";
import { validateStartupEnvironment } from "./lib/startupEnv";
import { startGpsRetentionScheduler } from "./lib/tracking/gpsRetentionWorker";
import { bootstrapSchedulerWorker } from "./lib/scheduler/bootstrapScheduler";

process.on("uncaughtException", (err: any) => {
  const msg = err?.message || String(err);
  if (
    msg.includes("Connection terminated") ||
    msg.includes("terminating connection") ||
    msg.includes("ECONNRESET") ||
    msg.includes("closed") ||
    msg.includes("socket")
  ) {
    logger.warn({ err }, "Caught transient database connection termination (recovering)");
    return;
  }
  logger.error({ err }, "Uncaught exception");
});

process.on("unhandledRejection", (reason: any) => {
  const msg = reason?.message || String(reason);
  if (
    msg.includes("Connection terminated") ||
    msg.includes("terminating connection") ||
    msg.includes("ECONNRESET") ||
    msg.includes("closed") ||
    msg.includes("socket")
  ) {
    logger.warn({ reason }, "Caught transient async database error (recovering)");
    return;
  }
  logger.error({ reason }, "Unhandled async rejection");
});

const envSummary = validateStartupEnvironment();
const port = envSummary.port;
const dbHost = envSummary.databaseHost;

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, dbHost }, "Server listening");
  ensureStartupMigrations().catch(err => {
    logger.error({ err }, "Startup migrations failed");
  });
  if (!ensureWebPushConfigured()) {
    logger.warn("Web push not configured — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT");
  }
  bootstrapMasterDataIfEmpty()
    .then(() => bootstrapDcmsPlansIfEmpty())
    .catch(err => {
      logger.error({ err }, "Catalog bootstrap failed");
    });
  bootstrapAdminFromEnv().catch(err => {
    logger.error({ err }, "Super admin bootstrap failed");
  });
  bootstrapSubscriptionTick();
  bootstrapDcmsScheduler();
  bootstrapMorningRouteNotify();
  bootstrapPushEventProcessor();
  bootstrapJobOrchestration();
  startGpsRetentionScheduler();
  bootstrapSchedulerWorker().catch(err => {
    logger.error({ err }, "Scheduler background worker bootstrap failed");
  });
});

function getNextMidnightIST(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(18, 30, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function bootstrapSubscriptionTick() {
  runDailyTick().catch(err => {
    logger.error({ err }, "Startup subscription tick failed");
  });
  scheduleNextSubscriptionTick();
  logger.info("Subscription maintenance tick bootstrapped");
}

function scheduleNextSubscriptionTick() {
  const now = new Date();
  const nextMidnight = getNextMidnightIST(now);
  const delay = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    runDailyTick().catch(err => {
      logger.error({ err }, "Scheduled subscription tick failed");
    });
    scheduleNextSubscriptionTick();
  }, delay);
}

function bootstrapDcmsScheduler() {
  scheduleDcmsEndOfDay();
  logger.info("DCMS missed-visit scheduler bootstrapped (23:59 IST)");
}

function scheduleDcmsEndOfDay() {
  const now = new Date();
  const next2359 = getNext2359IST(now);
  const delay = next2359.getTime() - now.getTime();

  setTimeout(async () => {
    const date = todayStrInIST();
    try {
      const result = await runMissedVisitScheduler(date);
      logger.info({ result }, "DCMS missed visit scheduler completed");
      await autoResumeExpiredPauses(date);
      await runDcmsMaintenanceJobs();
    } catch (err) {
      logger.error({ err }, "DCMS end-of-day scheduler failed");
    }
    scheduleDcmsEndOfDay();
  }, delay);
}

/** 6:00 AM IST — notify staff that today's route is ready. */
function getNext6AmIST(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(0, 30, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function bootstrapMorningRouteNotify() {
  scheduleMorningRouteNotify();
  logger.info("DCMS morning route push scheduler bootstrapped (06:00 IST)");
}

function scheduleMorningRouteNotify() {
  const now = new Date();
  const next = getNext6AmIST(now);
  const delay = next.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const result = await notifyDailyRoutesAvailable();
      logger.info({ result }, "Daily route push notifications sent");
    } catch (err) {
      logger.error({ err }, "Morning route notify failed");
    }
    scheduleMorningRouteNotify();
  }, delay);
}

function bootstrapPushEventProcessor() {
  processPendingNotificationEvents().catch(err => {
    logger.error({ err }, "Startup push event processing failed");
  });
  setInterval(() => {
    processPendingNotificationEvents().catch(err => {
      logger.error({ err }, "Periodic push event processing failed");
    });
  }, 60_000);
  logger.info("Push notification event processor bootstrapped");
}
