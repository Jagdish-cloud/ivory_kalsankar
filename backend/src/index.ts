import type { Server } from "http";
import { app } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/prismaClient";
import { startScheduler, stopScheduler } from "@/services/scheduler";

const server: Server = app.listen(env.port, () => {
  logger.info({ port: env.port }, "store API listening");
  startScheduler();
});

server.requestTimeout = env.requestTimeoutMs + 5_000;
server.headersTimeout = env.requestTimeoutMs + 10_000;

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  stopScheduler();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 10_000).unref();
  });
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, "prisma disconnect failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  void shutdown("uncaughtException");
});
