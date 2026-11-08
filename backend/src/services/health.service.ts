import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/prismaClient";
import { s3Client } from "@/services/s3.service";

const startedAt = Date.now();

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getHealth() {
  let db: "up" | "down" = "down";
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
    db = "up";
  } catch (err) {
    logger.error({ err }, "health check: database unreachable");
  }

  let s3: "ok" | "error" | "skipped" = "skipped";
  if (env.s3Bucket) {
    try {
      await withTimeout(s3Client.send(new HeadBucketCommand({ Bucket: env.s3Bucket })), 2500);
      s3 = "ok";
    } catch (err) {
      s3 = "error";
      logger.warn({ err }, "health check: S3 unreachable");
    }
  }

  const status = db === "down" ? "error" : s3 === "error" ? "degraded" : "ok";
  return {
    status,
    db,
    s3,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    startedAt: new Date(startedAt).toISOString(),
  };
}
