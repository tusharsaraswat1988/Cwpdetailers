import app from "./app";
import { logger } from "./lib/logger";
import { runDailyTick } from "./subscriptions/service";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Bootstrap daily-tick scheduler
  bootstrapDailyTick();
});

function getNextMidnightIST(now: Date): Date {
  // Midnight IST = 18:30 UTC
  const next = new Date(now);
  next.setUTCHours(18, 30, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function bootstrapDailyTick() {
  // Run once immediately at startup (idempotent via 6h window)
  runDailyTick().catch(err => {
    logger.error({ err }, "Startup daily tick failed");
  });

  // Schedule next run at midnight IST, then recompute each cycle to avoid drift
  scheduleNextTick();
  logger.info("Daily tick scheduler bootstrapped");
}

function scheduleNextTick() {
  const now = new Date();
  const nextMidnight = getNextMidnightIST(now);
  const delay = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    runDailyTick().catch(err => {
      logger.error({ err }, "Scheduled daily tick failed");
    });
    scheduleNextTick();
  }, delay);
}
