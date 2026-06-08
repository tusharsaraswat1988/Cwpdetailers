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

function bootstrapDailyTick() {
  // Run immediately on startup if today's tick hasn't run yet
  runDailyTick().catch(err => {
    logger.error({ err }, "Startup daily tick failed");
  });

  // Schedule next run at midnight IST
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  // Convert to IST: add 5h 30m
  const nextTickMs = nextMidnight.getTime() + (5 * 60 + 30) * 60 * 1000 - now.getTime();

  setTimeout(() => {
    runDailyTick().catch(err => {
      logger.error({ err }, "Scheduled daily tick failed");
    });
    // After first midnight run, repeat every 24h
    setInterval(() => {
      runDailyTick().catch(err => {
        logger.error({ err }, "Scheduled daily tick failed");
      });
    }, 24 * 60 * 60 * 1000);
  }, Math.max(0, nextTickMs));

  logger.info("Daily tick scheduler bootstrapped");
}
