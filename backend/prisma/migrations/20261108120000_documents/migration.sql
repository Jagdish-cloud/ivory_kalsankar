-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DocumentEntityType" AS ENUM (
    'INVOICE',
    'EXPENSE',
    'PURCHASE_ORDER',
    'PRODUCT_IMAGE',
    'SHOP_DOCUMENT',
    'ORGANIZATION_AGREEMENT',
    'ORGANIZATION_OTHER',
    'USER_PROFILE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "entityType" "DocumentEntityType" NOT NULL,
    "entityId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Document_s3Key_key" ON "Document"("s3Key");
CREATE INDEX IF NOT EXISTS "Document_shopId_entityType_entityId_idx" ON "Document"("shopId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Document_uploadedById_idx" ON "Document"("uploadedById");

ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "documentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
