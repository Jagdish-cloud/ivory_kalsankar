import { Router } from "express";
import { create, list, update } from "@/controllers/users.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(requireRole("SUPER_ADMIN"));
router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.patch("/:id", asyncHandler(update));

export default router;
