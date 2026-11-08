import { Router } from "express";
import { uploadDocument } from "@/services/documents.service";
import { uploadProductImages } from "@/middleware/upload";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiError } from "@/middleware/errorHandler";

const router = Router();

router.post(
  "/",
  uploadProductImages,
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) throw new ApiError(400, "Choose at least one image");
    const shopId = typeof req.body?.storeId === "string" && req.body.storeId ? req.body.storeId : req.auth!.storeId;
    const uploaded = [];
    for (const file of files) {
      const doc = await uploadDocument(
        { userId: req.auth!.userId, storeId: req.auth!.storeId, role: req.auth!.role },
        {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          entityType: "PRODUCT_IMAGE",
          shopId,
        }
      );
      uploaded.push({ url: doc.url, originalName: doc.originalFileName, documentId: doc.id });
    }
    res.status(201).json({ files: uploaded });
  })
);

export default router;
