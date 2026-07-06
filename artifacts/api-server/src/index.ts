import app from "./app";
import { bootstrapAdminFromEnv } from "./lib/bootstrapAdmin";
import { bootstrapMasterDataIfEmpty, bootstrapDcmsPlansIfEmpty } from "./lib/bootstrapMasterData";
import { logger } from "./lib/logger";
import { runDailyTick } from "./subscriptions/service";
import { runMissedVisitScheduler } from "./lib/dcms/missedVisitScheduler";
import { autoResumeExpiredPauses } from "./lib/dcms/pauseService";
import { runDcmsMaintenanceJobs } from "./lib/dcms/maintenanceService";
import { notifyDailyRoutesAvailable } from "./lib/dcms/routeNotifyService";
import { processPendingNotificationEvents } from "./lib/push/eventProcessor";
import { todayStrInIST, getNext2359IST } from "./lib/dcms/dateUtils";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const dbHost = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "not-set";

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, dbHost }, "Server listening");
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
