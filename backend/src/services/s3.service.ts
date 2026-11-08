import { randomUUID } from "crypto";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DocumentEntityType } from "@prisma/client";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { ApiError } from "@/middleware/errorHandler";

const PRESIGN_SECONDS = 300;

export const s3Client = new S3Client({ region: env.awsRegion, followRegionRedirects: true });

function requireBucket() {
  if (!env.s3Bucket) {
    throw new ApiError(503, "Document storage is not configured. Set S3_BUCKET or AWS_S3_BUCKET.");
  }
}

function mapS3Error(err: unknown, fallback: string): ApiError {
  if (err instanceof ApiError) return err;
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  const message = err instanceof Error ? err.message : fallback;
  if (/CredentialsProviderError|ExpiredToken|InvalidAccessKeyId|SignatureDoesNotMatch|UnrecognizedClientException/i.test(name + message)) {
    return new ApiError(401, "AWS authentication failed. Check local credentials or the EC2 instance role.");
  }
  if (/IllegalLocationConstraintException|PermanentRedirect/i.test(name + message)) {
    return new ApiError(502, "S3 bucket region does not match AWS_REGION. Set AWS_REGION to the bucket's region.");
  }
  if (err instanceof S3ServiceException && (err.$metadata?.httpStatusCode === 403 || err.name === "AccessDenied")) {
    return new ApiError(403, "S3 access denied. The IAM principal cannot use this bucket.");
  }
  if (err instanceof S3ServiceException && (err.$metadata?.httpStatusCode === 404 || err.name === "NoSuchKey" || err.name === "NotFound")) {
    return new ApiError(404, "The file was not found in storage.");
  }
  logger.error({ err }, "S3 error");
  return new ApiError(502, fallback);
}

function sanitizeExtension(originalName: string) {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.slice(0, 8);
}

function folderFor(entityType: DocumentEntityType, shopId: string | null, now = new Date()) {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = env.s3DocumentsPrefix;
  switch (entityType) {
    case "INVOICE":
      return `${prefix}shops/${shopId}/invoices/${year}/${month}`;
    case "EXPENSE":
      return `${prefix}shops/${shopId}/expenses/${year}/${month}`;
    case "PURCHASE_ORDER":
      return `${prefix}shops/${shopId}/purchase-orders/${year}/${month}`;
    case "PRODUCT_IMAGE":
      return `${prefix}shops/${shopId}/product-images`;
    case "SHOP_DOCUMENT":
      return `${prefix}shops/${shopId}/documents`;
    case "ORGANIZATION_AGREEMENT":
      return `${prefix}organization/agreements`;
    case "ORGANIZATION_OTHER":
      return `${prefix}organization/other-documents`;
    case "USER_PROFILE":
      return `${prefix}users/profile-images`;
    default:
      return `${prefix}shops/${shopId}/documents`;
  }
}

export function buildObjectKey(args: { entityType: DocumentEntityType; shopId: string | null; originalName: string }) {
  const ext = sanitizeExtension(args.originalName);
  return `${folderFor(args.entityType, args.shopId)}/${randomUUID()}${ext}`;
}

export async function putObject(args: { key: string; body: Buffer; contentType: string }) {
  requireBucket();
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: args.key,
        Body: args.body,
        ContentType: args.contentType,
        ServerSideEncryption: "AES256",
        StorageClass: "STANDARD",
      })
    );
  } catch (err) {
    throw mapS3Error(err, "Could not upload the file to storage.");
  }
}

export async function presignGet(args: { key: string; filename: string; disposition: "inline" | "attachment" }) {
  requireBucket();
  const safeName = args.filename.replace(/["\r\n]/g, "_");
  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: env.s3Bucket,
        Key: args.key,
        ResponseContentDisposition: `${args.disposition}; filename="${safeName}"`,
      }),
      { expiresIn: PRESIGN_SECONDS }
    );
  } catch (err) {
    throw mapS3Error(err, "Could not create a download link.");
  }
}

export async function deleteObject(key: string) {
  requireBucket();
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  } catch (err) {
    throw mapS3Error(err, "Could not delete the file from storage.");
  }
}

export const s3Config = {
  bucket: env.s3Bucket,
  presignSeconds: PRESIGN_SECONDS,
};
