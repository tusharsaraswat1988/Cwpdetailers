import app from "./app";
import { bootstrapAdminFromEnv } from "./lib/bootstrapAdmin";
import { bootstrapMasterDataIfEmpty, bootstrapDcmsPlansIfEmpty } from "./lib/bootstrapMasterData";
import { ensureStartupMigrations } from "./lib/startupMigrations";
import { logger } from "./lib/logger";
import { processPendingNotificationEvents } from "./lib/push/eventProcessor";
import { ensureWebPushConfigured } from "./lib/push/webPushService";
import { bootstrapJobOrchestration } from "./lib/job-orchestration/bootstrap";
import { validateStartupEnvironment } from "./lib/startupEnv";
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
  bootstrapPushEventProcessor();
  bootstrapJobOrchestration();
  bootstrapSchedulerWorker().catch(err => {
    logger.error({ err }, "Scheduler background worker bootstrap failed");
  });
});

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
