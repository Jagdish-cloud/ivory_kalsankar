import { Router } from "express";
import { login, me } from "@/controllers/auth.controller";
import { requireAuth } from "@/middleware/auth";
import { loginLimiter } from "@/middleware/rateLimits";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.post("/login", loginLimiter, asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
