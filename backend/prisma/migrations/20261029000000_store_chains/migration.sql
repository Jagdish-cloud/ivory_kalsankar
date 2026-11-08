-- CreateEnum
CREATE TYPE "StoreChain" AS ENUM ('IVORY_LACE', 'KALSANKAR_OS');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "chain" "StoreChain" NOT NULL DEFAULT 'IVORY_LACE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "chain" "StoreChain" NOT NULL DEFAULT 'IVORY_LACE';

-- CreateIndex
CREATE INDEX "Store_chain_idx" ON "Store"("chain");

-- CreateIndex
CREATE INDEX "Product_chain_idx" ON "Product"("chain");

-- CreateTable
CREATE TABLE "SareeDetail" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sareeCategory" TEXT NOT NULL,
    "sareeType" TEXT,
    "subcategory" TEXT,
    "weavingTechnique" TEXT,
    "fabricComposition" TEXT,
    "colour" TEXT NOT NULL,
    "secondaryColour" TEXT,
    "designPattern" TEXT,
    "borderType" TEXT,
    "borderWidth" TEXT,
    "palluType" TEXT,
    "blousePiece" TEXT,
    "sareeLength" TEXT,
    "occasion" TEXT,
    "regionOfOrigin" TEXT,
    "productPhotographType" TEXT,
    "certification" TEXT,
    "supplierName" TEXT,
    "supplierCode" TEXT,
    "supplierInvoiceNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "originalStoreId" TEXT,
    "department" TEXT,
    "rackLocation" TEXT,
    "stockStatus" TEXT,
    "dateReceived" TIMESTAMP(3),
    "lastPhysicalVerification" TIMESTAMP(3),
    "lastVerifiedBy" TEXT,
    "stockCondition" TEXT,
    "reservationStatus" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "SareeDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SareeDetail_productId_key" ON "SareeDetail"("productId");

-- AddForeignKey
ALTER TABLE "SareeDetail" ADD CONSTRAINT "SareeDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AppSequence" (
    "chain" "StoreChain" NOT NULL,
    "sareeSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppSequence_pkey" PRIMARY KEY ("chain")
);

INSERT INTO "AppSequence" ("chain", "sareeSeq") VALUES ('KALSANKAR_OS', 0);
