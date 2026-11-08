import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV ?? "development";
const envDir = process.cwd();
const envSpecific = path.join(envDir, `.env.${nodeEnv}`);
const envFallback = path.join(envDir, ".env");

if (fs.existsSync(envSpecific)) {
  dotenv.config({ path: envSpecific });
}
dotenv.config({ path: envFallback });

const isProduction = nodeEnv === "production";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const jwtSecret = required("JWT_SECRET");
if (isProduction) {
  if (jwtSecret === "change-me-in-production" || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters and must not use the example value in production");
  }
}

const s3Bucket = (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "").trim();
if (isProduction && !s3Bucket) {
  throw new Error("S3_BUCKET or AWS_S3_BUCKET is required in production");
}

const defaultCors = "http://localhost:5173";
const corsOriginRaw = process.env.CORS_ORIGIN ?? defaultCors;

export const env = {
  nodeEnv,
  isProduction,
  isDevelopment: nodeEnv === "development",
  port: Number(process.env.PORT ?? 4100),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: corsOriginRaw.split(",")[0]?.trim() || defaultCors,
  corsOrigins: parseOrigins(corsOriginRaw),
  /** Public URL of the web app - embedded in invoice QR codes. */
  appPublicUrl: (process.env.APP_PUBLIC_URL ?? process.env.CORS_ORIGIN?.split(",")[0] ?? defaultCors).replace(/\/$/, ""),
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 90_000),
  enableLocalUploads: (process.env.ENABLE_LOCAL_UPLOADS ?? (isProduction ? "false" : "true")) === "true",
  seedUserEmail: process.env.SEED_USER_EMAIL ?? (isProduction ? "" : "anjali@ivorylace.in"),
  seedUserPassword: process.env.SEED_USER_PASSWORD ?? "",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? (isProduction ? "" : "admin@ivorylace.in"),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? "false") === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "Ivory Lace <no-reply@ivorylace.in>",
  },
  /** Cron expression for the end-of-day low stock email (server local time unless CRON_TZ is set). */
  lowStockCron: process.env.LOW_STOCK_CRON ?? "0 21 * * *",
  cronTimezone: process.env.CRON_TZ ?? "Asia/Kolkata",
  defaultEmailRecipient: process.env.DEFAULT_EMAIL_RECIPIENT ?? "",

  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  s3Bucket,
  s3DocumentsPrefix: (process.env.S3_DOCUMENTS_PREFIX ?? "documents/").replace(/\/?$/, "/"),
};
