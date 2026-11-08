import cron from "node-cron";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { sendLowStockReport } from "@/services/lowStockReport.service";

let task: ReturnType<typeof cron.schedule> | null = null;

function isPrimaryInstance() {
  const instance = process.env.NODE_APP_INSTANCE;
  return !instance || instance === "0";
}

/** Starts the background jobs (end-of-day low stock email). Called once from index.ts. */
export function startScheduler() {
  if (!isPrimaryInstance()) {
    logger.info({ instance: process.env.NODE_APP_INSTANCE }, "scheduler skipped on non-primary PM2 instance");
    return;
  }
  if (!cron.validate(env.lowStockCron)) {
    logger.warn({ expression: env.lowStockCron }, "LOW_STOCK_CRON is not a valid cron expression - low stock email disabled");
    return;
  }
  task = cron.schedule(
    env.lowStockCron,
    async () => {
      try {
        const result = await sendLowStockReport();
        logger.info(
          {
            items: result.items,
            sent: result.sent,
            recipients: result.sent ? result.recipients.length : 0,
            skipped: result.skipped,
            reason: result.reason,
          },
          "low stock report"
        );
      } catch (err) {
        logger.error({ err }, "low stock report failed");
      }
    },
    { timezone: env.cronTimezone }
  );
  logger.info({ expression: env.lowStockCron, timezone: env.cronTimezone }, "low stock email scheduled");
}

export function stopScheduler() {
  task?.stop();
  task = null;
}
