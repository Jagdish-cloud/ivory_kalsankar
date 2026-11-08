import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@/config/env";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { requireAuth } from "@/middleware/auth";
import { requestLogger } from "@/middleware/requestLogger";
import { requestTimeout } from "@/middleware/requestTimeout";
import { apiLimiter, uploadLimiter } from "@/middleware/rateLimits";
import { getHealth } from "@/services/health.service";
import authRoutes from "@/routes/auth.routes";
import lookupsRoutes from "@/routes/lookups.routes";
import inventoryRoutes from "@/routes/inventory.routes";
import uploadsRoutes from "@/routes/uploads.routes";
import documentsRoutes from "@/routes/documents.routes";
import customersRoutes from "@/routes/customers.routes";
import billingRoutes from "@/routes/billing.routes";
import storesRoutes from "@/routes/stores.routes";
import usersRoutes from "@/routes/users.routes";
import returnsRoutes from "@/routes/returns.routes";
import reportsRoutes from "@/routes/reports.routes";
import emailRecipientsRoutes from "@/routes/emailRecipients.routes";
import settingsRoutes from "@/routes/settings.routes";
import transfersRoutes from "@/routes/transfers.routes";

export const app = express();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(requestTimeout(env.requestTimeoutMs));
app.use(requestLogger);

if (env.enableLocalUploads) {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}

app.get("/api/health", async (_req, res) => {
  const health = await getHealth();
  res.status(health.db === "down" ? 503 : 200).json(health);
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/lookups", requireAuth, lookupsRoutes);
app.use("/api/inventory", requireAuth, inventoryRoutes);
app.use("/api/uploads", requireAuth, uploadLimiter, uploadsRoutes);
app.use("/api/documents", requireAuth, documentsRoutes);
app.use("/api/customers", requireAuth, customersRoutes);
app.use("/api/billing", requireAuth, billingRoutes);
app.use("/api/stores", requireAuth, storesRoutes);
app.use("/api/users", requireAuth, usersRoutes);
app.use("/api/returns", requireAuth, returnsRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);
app.use("/api/email-recipients", requireAuth, emailRecipientsRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/transfers", requireAuth, transfersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
