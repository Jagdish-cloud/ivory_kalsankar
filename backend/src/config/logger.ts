import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.logLevel,
  base: { service: "ivory-lace-api", env: env.nodeEnv },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.Authorization",
      "password",
      "passwordHash",
      "token",
      "smtp.pass",
      "SMTP_PASS",
      "JWT_SECRET",
      "DATABASE_URL",
      "*.password",
      "*.token",
    ],
    remove: true,
  },
});
