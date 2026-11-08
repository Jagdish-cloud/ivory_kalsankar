import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "@/middleware/errorHandler";
import {
  deleteDocument,
  downloadDocument,
  getDocument,
  listDocuments,
  parseEntityType,
  uploadDocument,
  type AuthContext,
} from "@/services/documents.service";

function authOf(req: Request): AuthContext {
  return { userId: req.auth!.userId, storeId: req.auth!.storeId, role: req.auth!.role };
}

export async function upload(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new ApiError(400, "Choose a file to upload");
  const entityType = parseEntityType(req.body.entityType);
  const shopId = typeof req.body.shopId === "string" && req.body.shopId ? req.body.shopId : undefined;
  const entityId = typeof req.body.entityId === "string" && req.body.entityId ? req.body.entityId : undefined;
  const doc = await uploadDocument(authOf(req), {
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    entityType,
    shopId,
    entityId,
  });
  res.status(201).json(doc);
}

export async function list(req: Request, res: Response) {
  const query = z
    .object({
      shopId: z.string().uuid().optional(),
      entityType: z.enum([
        "INVOICE",
        "EXPENSE",
        "PURCHASE_ORDER",
        "PRODUCT_IMAGE",
        "SHOP_DOCUMENT",
        "ORGANIZATION_AGREEMENT",
        "ORGANIZATION_OTHER",
        "USER_PROFILE",
      ]).optional(),
      entityId: z.string().optional(),
    })
    .parse(req.query);
  const items = await listDocuments(authOf(req), query);
  res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const doc = await getDocument(authOf(req), req.params.id as string);
  res.json(doc);
}

export async function download(req: Request, res: Response) {
  const result = await downloadDocument(authOf(req), req.params.id as string);
  res.json(result);
}

export async function remove(req: Request, res: Response) {
  await deleteDocument(authOf(req), req.params.id as string);
  res.status(204).send();
}
