import { Router } from "express";
import { create, list, remove, sendTest, update } from "@/controllers/emailRecipients.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(requireRole("SUPER_ADMIN"));
router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.post("/test", asyncHandler(sendTest));
router.patch("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

export default router;
