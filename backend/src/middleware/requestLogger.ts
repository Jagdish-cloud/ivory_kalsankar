import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/config/logger";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"]) || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  if (req.path === "/api/health") {
    return next();
  }

  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        userId: req.auth?.userId,
      },
      "request"
    );
  });
  next();
}
