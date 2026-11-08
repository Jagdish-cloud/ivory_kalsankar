import { Router } from "express";
import { create, list, options, update } from "@/controllers/stores.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

// Any signed-in user can see the list of stores (stock is visible across all stores).
router.get("/options", asyncHandler(options));

// Managing the store tree is a super-admin task.
router.get("/", requireRole("SUPER_ADMIN"), asyncHandler(list));
router.post("/", requireRole("SUPER_ADMIN"), asyncHandler(create));
router.patch("/:id", requireRole("SUPER_ADMIN"), asyncHandler(update));

export default router;
