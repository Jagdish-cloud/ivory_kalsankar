import { Router } from "express";
import { download, getById, list, remove, upload } from "@/controllers/documents.controller";
import { uploadLimiter } from "@/middleware/rateLimits";
import { uploadSingleDocument } from "@/middleware/upload";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.post("/upload", uploadLimiter, uploadSingleDocument, asyncHandler(upload));
router.get("/", asyncHandler(list));
router.get("/:id/download", asyncHandler(download));
router.get("/:id", asyncHandler(getById));
router.delete("/:id", asyncHandler(remove));

export default router;
