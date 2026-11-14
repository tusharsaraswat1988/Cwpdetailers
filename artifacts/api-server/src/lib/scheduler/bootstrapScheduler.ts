import { getBackgroundWorker } from "./backgroundWorker";
import { seedDefaultScheduledJobs } from "./jobSchedulerService";
import { logger } from "../logger";

let bootstrapped = false;

export async function bootstrapSchedulerWorker(): Promise<void> {
  if (bootstrapped) return;

  try {
    // 1. Seed canonical default scheduled jobs
    await seedDefaultScheduledJobs();

    // 2. Start background worker
    const worker = getBackgroundWorker();
    await worker.start();

    // 3. Register process shutdown hooks for graceful termination
    const shutdownHandler = async (signal: string) => {
      logger.info({ signal }, "Received shutdown signal; stopping scheduler worker...");
      try {
        await worker.stop();
      } catch (err) {
        logger.error({ err }, "Error stopping scheduler worker");
      }
    };

    process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
    process.once("SIGINT", () => shutdownHandler("SIGINT"));

    bootstrapped = true;
    logger.info("Universal Job Scheduler and Background Worker framework bootstrapped successfully");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap scheduler worker");
  }
}
