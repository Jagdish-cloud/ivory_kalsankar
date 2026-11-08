import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Not found" });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
      .join("; ");
    return res.status(400).json({ message: message || "Invalid request" });
  }

  logger.error({ err, requestId: req.requestId, path: req.path, method: req.method }, "unhandled error");
  const message = env.isProduction
    ? "Internal server error"
    : err instanceof Error
      ? err.message
      : "Internal server error";
  return res.status(500).json({ message });
}
