import { Router } from "express";
import {
  create,
  currentVerificationBatch,
  generateVerificationBatch,
  getById,
  list,
  nextSareeId,
  outOfStock,
  previewGst,
  remove,
  summary,
  update,
  verifySaree,
} from "@/controllers/inventory.controller";
import { labelVariants } from "@/controllers/labels.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/label-variants", asyncHandler(labelVariants));
router.get("/sarees/next-id", asyncHandler(nextSareeId));
router.get("/verification-batches/current", asyncHandler(currentVerificationBatch));
router.post("/verification-batches", requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(generateVerificationBatch));
router.post("/sarees/verify", asyncHandler(verifySaree));
router.get("/summary", asyncHandler(summary));
router.get("/out-of-stock", asyncHandler(outOfStock));
router.get("/products", asyncHandler(list));
router.get("/products/gst-preview", previewGst);
router.get("/products/:id", asyncHandler(getById));
router.post("/products", asyncHandler(create));
router.patch("/products/:id", asyncHandler(update));
router.delete("/products/:id", requireRole("SUPER_ADMIN"), asyncHandler(remove));

export default router;
