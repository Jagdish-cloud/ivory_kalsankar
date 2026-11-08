import rateLimit from "express-rate-limit";

const jsonMessage = { message: "Too many requests, please try again later" };

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonMessage,
  skip: (req) => req.path === "/health" || req.path === "/api/health",
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonMessage,
});
