import type { NextFunction, Request, RequestHandler, Response } from "express";

export function requestTimeout(ms: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/api/health") return next();
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ message: "Request timed out" });
      }
    }, ms);
    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
