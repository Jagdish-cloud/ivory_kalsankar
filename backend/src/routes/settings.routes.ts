import { Router } from "express";
import { getGstin, updateGstin } from "@/controllers/settings.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(requireRole("SUPER_ADMIN"));
router.get("/gstin", asyncHandler(getGstin));
router.patch("/gstin", asyncHandler(updateGstin));

export default router;
