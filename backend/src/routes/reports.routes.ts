import { Router } from "express";
import { customSummary, monthlySummary, sendLowStock } from "@/controllers/reports.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/summary", asyncHandler(customSummary));
router.get("/monthly", asyncHandler(monthlySummary));

router.post("/low-stock/send", requireRole("SUPER_ADMIN"), asyncHandler(sendLowStock));

export default router;
