import { DocumentEntityType, UserRole } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { logger } from "@/config/logger";
import { ApiError } from "@/middleware/errorHandler";
import { storeChainOf } from "@/utils/storeChain";
import { buildObjectKey, deleteObject, presignGet, putObject, s3Config } from "@/services/s3.service";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const PRESIGN_SECONDS = s3Config.presignSeconds;

const IMAGE_TYPES = new Set(["PRODUCT_IMAGE", "USER_PROFILE"] as DocumentEntityType[]);
const ORG_TYPES = new Set(["ORGANIZATION_AGREEMENT", "ORGANIZATION_OTHER"] as DocumentEntityType[]);

const MIME_BY_EXT: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
};

const PRODUCT_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface AuthContext {
  userId: string;
  storeId: string;
  role: UserRole;
}

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  entityType: DocumentEntityType;
  shopId?: string | null;
  entityId?: string | null;
}

function extensionOf(name: string, mimeType?: string) {
  const match = /\.[a-z0-9]+$/i.exec(name.trim());
  if (match) return match[0].toLowerCase();
  const mime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "application/pdf") return ".pdf";
  if (mime === "text/csv") return ".csv";
  return "";
}

function looksLike(buffer: Buffer, ...bytes: number[]) {
  return bytes.every((b, i) => buffer[i] === b);
}

function matchesMagic(ext: string, buffer: Buffer) {
  if (buffer.length < 4) return false;
  if (ext === ".jpg" || ext === ".jpeg") return looksLike(buffer, 0xff, 0xd8, 0xff);
  if (ext === ".png") return looksLike(buffer, 0x89, 0x50, 0x4e, 0x47);
  if (ext === ".pdf") return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  if (ext === ".webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (ext === ".docx" || ext === ".xlsx") return looksLike(buffer, 0x50, 0x4b, 0x03, 0x04);
  if (ext === ".doc") return looksLike(buffer, 0xd0, 0xcf, 0x11, 0xe0);
  if (ext === ".xls") return looksLike(buffer, 0xd0, 0xcf, 0x11, 0xe0) || looksLike(buffer, 0x09, 0x08);
  if (ext === ".csv") return true;
  return false;
}

function validateFile(input: UploadInput) {
  const ext = extensionOf(input.originalName, input.mimeType);
  const allowed = MIME_BY_EXT[ext];
  if (!allowed) throw new ApiError(400, "That file type is not allowed");
  if (IMAGE_TYPES.has(input.entityType) && !PRODUCT_IMAGE_EXTS.has(ext)) {
    throw new ApiError(400, "Product and profile photos must be JPG, PNG or WEBP");
  }
  const declared = (input.mimeType || "").split(";")[0].trim().toLowerCase();
  if (declared && !allowed.includes(declared) && declared !== "application/octet-stream") {
    throw new ApiError(400, `File MIME type "${declared}" does not match ${ext}`);
  }
  if (!matchesMagic(ext, input.buffer)) {
    throw new ApiError(400, "The file contents do not match the declared type");
  }
  const max = IMAGE_TYPES.has(input.entityType) ? IMAGE_MAX_BYTES : DOCUMENT_MAX_BYTES;
  if (input.buffer.length === 0) throw new ApiError(400, "The file is empty");
  if (input.buffer.length > max) {
    throw new ApiError(400, IMAGE_TYPES.has(input.entityType) ? "Images cannot be larger than 5 MB" : "Files cannot be larger than 10 MB");
  }
  return { ext, mimeType: allowed[0] };
}

async function resolveShopId(auth: AuthContext, entityType: DocumentEntityType, requested?: string | null) {
  if (ORG_TYPES.has(entityType)) {
    if (auth.role !== "SUPER_ADMIN") throw new ApiError(403, "Only a super admin can store organization documents");
    return null;
  }
  if (entityType === "USER_PROFILE") {
    return requested && auth.role === "SUPER_ADMIN" ? requested : auth.storeId;
  }
  if (auth.role === "SUPER_ADMIN") {
    const shopId = requested || auth.storeId;
    const store = await prisma.store.findFirst({ where: { id: shopId, isActive: true }, select: { id: true } });
    if (!store) throw new ApiError(404, "Store not found");
    return store.id;
  }
  if (requested && requested !== auth.storeId) {
    throw new ApiError(403, "You can only upload documents for your own store");
  }
  return auth.storeId;
}

async function canRead(auth: AuthContext, doc: { shopId: string | null; entityType: DocumentEntityType; entityId: string | null; uploadedById: string }) {
  if (auth.role === "SUPER_ADMIN") return true;
  if (ORG_TYPES.has(doc.entityType)) return false;
  if (doc.entityType === "USER_PROFILE") return doc.uploadedById === auth.userId;
  if (!doc.shopId) return false;
  if (doc.shopId === auth.storeId) return true;
  if (doc.entityType === "PRODUCT_IMAGE") {
    const [userChain, shopChain] = await Promise.all([storeChainOf(auth.storeId), storeChainOf(doc.shopId)]);
    return userChain === shopChain;
  }
  return false;
}

function documentIdFromUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("s3:")) return url.slice(3);
  return null;
}

export function persistableProductImage(image: { url: string; imageType: string; sortOrder: number; documentId?: string | null }) {
  const documentId = image.documentId || documentIdFromUrl(image.url);
  if (documentId) {
    return { url: `s3:${documentId}`, imageType: image.imageType, sortOrder: image.sortOrder, documentId };
  }
  return { url: image.url, imageType: image.imageType, sortOrder: image.sortOrder, documentId: null as string | null };
}

export async function resolveStoredImageUrl(image: { url: string; documentId?: string | null }) {
  const documentId = image.documentId || documentIdFromUrl(image.url);
  if (!documentId) return image.url;
  const doc = await prisma.document.findFirst({ where: { id: documentId, deletedAt: null } });
  if (!doc) return image.url;
  return presignGet({ key: doc.s3Key, filename: doc.originalFileName, disposition: "inline" });
}

export async function resolveProductImages<T extends { url: string; documentId?: string | null }>(images: T[]) {
  return Promise.all(images.map(async (image) => ({ ...image, url: await resolveStoredImageUrl(image) })));
}

function toDto(doc: {
  id: string;
  shopId: string | null;
  entityType: DocumentEntityType;
  entityId: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
}) {
  return {
    id: doc.id,
    shopId: doc.shopId,
    entityType: doc.entityType,
    entityId: doc.entityId,
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    uploadedById: doc.uploadedById,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    url: doc.url,
    expiresIn: doc.url ? PRESIGN_SECONDS : undefined,
  };
}

export async function uploadDocument(auth: AuthContext, input: UploadInput) {
  const { mimeType } = validateFile(input);
  const shopId = await resolveShopId(auth, input.entityType, input.shopId);
  const key = buildObjectKey({ entityType: input.entityType, shopId, originalName: input.originalName });
  await putObject({ key, body: input.buffer, contentType: mimeType });
  try {
    const row = await prisma.document.create({
      data: {
        shopId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        originalFileName: input.originalName.slice(0, 255),
        s3Bucket: s3Config.bucket,
        s3Key: key,
        mimeType,
        fileSize: input.buffer.length,
        uploadedById: auth.userId,
      },
    });
    const url = await presignGet({ key, filename: row.originalFileName, disposition: "inline" });
    return toDto({ ...row, url });
  } catch (err) {
    try {
      await deleteObject(key);
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr, key }, "orphan S3 object after DB insert failure");
    }
    throw err;
  }
}

export async function listDocuments(
  auth: AuthContext,
  query: { shopId?: string; entityType?: DocumentEntityType; entityId?: string }
) {
  const shopId = auth.role === "SUPER_ADMIN" ? query.shopId : auth.storeId;
  const rows = await prisma.document.findMany({
    where: {
      deletedAt: null,
      ...(shopId ? { shopId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(auth.role !== "SUPER_ADMIN" && !query.entityType ? { entityType: { notIn: [...ORG_TYPES] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const visible = [];
  for (const row of rows) {
    if (await canRead(auth, row)) visible.push(toDto(row));
  }
  return visible;
}

async function loadVisible(auth: AuthContext, id: string) {
  const row = await prisma.document.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new ApiError(404, "Document not found");
  if (!(await canRead(auth, row))) throw new ApiError(403, "You do not have access to this document");
  return row;
}

export async function getDocument(auth: AuthContext, id: string) {
  const row = await loadVisible(auth, id);
  const url = await presignGet({ key: row.s3Key, filename: row.originalFileName, disposition: "inline" });
  return toDto({ ...row, url });
}

export async function downloadDocument(auth: AuthContext, id: string) {
  const row = await loadVisible(auth, id);
  const url = await presignGet({ key: row.s3Key, filename: row.originalFileName, disposition: "attachment" });
  return { url, expiresIn: PRESIGN_SECONDS, fileName: row.originalFileName };
}

export async function deleteDocument(auth: AuthContext, id: string) {
  const row = await prisma.document.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new ApiError(404, "Document not found");
  const canDelete =
    auth.role === "SUPER_ADMIN" ||
    (row.shopId === auth.storeId && !ORG_TYPES.has(row.entityType)) ||
    (row.entityType === "USER_PROFILE" && row.uploadedById === auth.userId);
  if (!canDelete) throw new ApiError(403, "You do not have permission to delete this document");
  await deleteObject(row.s3Key);
  try {
    await prisma.document.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
  } catch (err) {
    logger.error({ err, s3Key: row.s3Key }, "S3 object deleted but document metadata was not marked deleted");
    throw new ApiError(500, "The file was removed from storage but the record could not be updated. Contact support.");
  }
}

export async function attachEntityId(documentId: string, entityId: string) {
  await prisma.document.updateMany({ where: { id: documentId, deletedAt: null }, data: { entityId } });
}

export async function purgeDocumentIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) {
    const row = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!row) continue;
    try {
      await deleteObject(row.s3Key);
      await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    } catch (err) {
      logger.error({ err, documentId: id }, "failed to remove product image document");
    }
  }
}

export async function archiveBuffer(args: {
  auth: AuthContext;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  entityType: DocumentEntityType;
  shopId: string;
  entityId: string;
}) {
  return uploadDocument(args.auth, {
    buffer: args.buffer,
    originalName: args.originalName,
    mimeType: args.mimeType,
    entityType: args.entityType,
    shopId: args.shopId,
    entityId: args.entityId,
  });
}

export function parseEntityType(value: unknown): DocumentEntityType {
  const allowed = Object.values(DocumentEntityType);
  if (typeof value === "string" && (allowed as string[]).includes(value)) return value as DocumentEntityType;
  throw new ApiError(400, "A valid entityType is required");
}
