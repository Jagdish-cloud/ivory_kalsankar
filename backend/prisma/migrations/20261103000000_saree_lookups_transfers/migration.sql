-- AlterTable
ALTER TABLE "Store" ADD COLUMN "transferSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'RECEIVING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferSource" AS ENUM ('PLANNED', 'POS_SCAN');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';

-- CreateTable
CREATE TABLE "SareeLookupOption" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SareeLookupOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "chain" "StoreChain" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TransferSource" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "packageReceivedAt" TIMESTAMP(3),
    "packageReceivedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "styleName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "scannedOutAt" TIMESTAMP(3),
    "scannedInAt" TIMESTAMP(3),

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SareeLookupOption_field_name_key" ON "SareeLookupOption"("field", "name");

-- CreateIndex
CREATE INDEX "SareeLookupOption_field_idx" ON "SareeLookupOption"("field");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_packageCode_key" ON "StockTransfer"("packageCode");

-- CreateIndex
CREATE INDEX "StockTransfer_chain_createdAt_idx" ON "StockTransfer"("chain", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_fromStoreId_createdAt_idx" ON "StockTransfer"("fromStoreId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_toStoreId_createdAt_idx" ON "StockTransfer"("toStoreId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferLine_transferId_variantId_key" ON "StockTransferLine"("transferId", "variantId");

-- CreateIndex
CREATE INDEX "StockTransferLine_variantId_idx" ON "StockTransferLine"("variantId");

-- CreateIndex
CREATE INDEX "StockMovement_transferId_idx" ON "StockMovement"("transferId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_packageReceivedById_fkey" FOREIGN KEY ("packageReceivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default Kalsankar dropdown values
INSERT INTO "SareeLookupOption" ("id", "field", "name") VALUES
  (gen_random_uuid()::text, 'sareeCategory', 'Silk'),
  (gen_random_uuid()::text, 'sareeCategory', 'Cotton'),
  (gen_random_uuid()::text, 'sareeCategory', 'Linen'),
  (gen_random_uuid()::text, 'sareeCategory', 'Synthetic'),
  (gen_random_uuid()::text, 'sareeCategory', 'Blend'),
  (gen_random_uuid()::text, 'sareeType', 'Kanchipuram'),
  (gen_random_uuid()::text, 'sareeType', 'Banarasi'),
  (gen_random_uuid()::text, 'sareeType', 'Mysore'),
  (gen_random_uuid()::text, 'sareeType', 'Paithani'),
  (gen_random_uuid()::text, 'sareeType', 'Patola'),
  (gen_random_uuid()::text, 'sareeType', 'Chanderi'),
  (gen_random_uuid()::text, 'sareeType', 'Tussar'),
  (gen_random_uuid()::text, 'sareeType', 'Organza'),
  (gen_random_uuid()::text, 'subcategory', 'Pure silk'),
  (gen_random_uuid()::text, 'subcategory', 'Art silk'),
  (gen_random_uuid()::text, 'subcategory', 'Katan silk'),
  (gen_random_uuid()::text, 'subcategory', 'Tissue'),
  (gen_random_uuid()::text, 'subcategory', 'Cotton silk'),
  (gen_random_uuid()::text, 'weavingTechnique', 'Handloom'),
  (gen_random_uuid()::text, 'weavingTechnique', 'Powerloom'),
  (gen_random_uuid()::text, 'weavingTechnique', 'Handwoven'),
  (gen_random_uuid()::text, 'fabricComposition', 'Silk'),
  (gen_random_uuid()::text, 'fabricComposition', 'Cotton'),
  (gen_random_uuid()::text, 'fabricComposition', 'Linen'),
  (gen_random_uuid()::text, 'fabricComposition', 'Polyester'),
  (gen_random_uuid()::text, 'fabricComposition', 'Silk blend'),
  (gen_random_uuid()::text, 'colour', 'Maroon'),
  (gen_random_uuid()::text, 'colour', 'Gold'),
  (gen_random_uuid()::text, 'colour', 'Red'),
  (gen_random_uuid()::text, 'colour', 'Green'),
  (gen_random_uuid()::text, 'colour', 'Blue'),
  (gen_random_uuid()::text, 'colour', 'Pink'),
  (gen_random_uuid()::text, 'colour', 'Purple'),
  (gen_random_uuid()::text, 'colour', 'Mustard'),
  (gen_random_uuid()::text, 'colour', 'Black'),
  (gen_random_uuid()::text, 'colour', 'Cream'),
  (gen_random_uuid()::text, 'colour', 'White'),
  (gen_random_uuid()::text, 'secondaryColour', 'Gold'),
  (gen_random_uuid()::text, 'secondaryColour', 'Silver'),
  (gen_random_uuid()::text, 'secondaryColour', 'Maroon'),
  (gen_random_uuid()::text, 'secondaryColour', 'Green'),
  (gen_random_uuid()::text, 'secondaryColour', 'Red'),
  (gen_random_uuid()::text, 'secondaryColour', 'Cream'),
  (gen_random_uuid()::text, 'secondaryColour', 'None'),
  (gen_random_uuid()::text, 'designPattern', 'Temple border'),
  (gen_random_uuid()::text, 'designPattern', 'Floral'),
  (gen_random_uuid()::text, 'designPattern', 'Checks'),
  (gen_random_uuid()::text, 'designPattern', 'Stripes'),
  (gen_random_uuid()::text, 'designPattern', 'Peacock'),
  (gen_random_uuid()::text, 'designPattern', 'Zari butta'),
  (gen_random_uuid()::text, 'designPattern', 'Plain'),
  (gen_random_uuid()::text, 'borderType', 'Contrast border'),
  (gen_random_uuid()::text, 'borderType', 'Self border'),
  (gen_random_uuid()::text, 'borderType', 'Zari border'),
  (gen_random_uuid()::text, 'borderType', 'Temple border'),
  (gen_random_uuid()::text, 'palluType', 'Rich zari pallu'),
  (gen_random_uuid()::text, 'palluType', 'Plain pallu'),
  (gen_random_uuid()::text, 'palluType', 'Contrast pallu'),
  (gen_random_uuid()::text, 'palluType', 'Woven pallu'),
  (gen_random_uuid()::text, 'blousePiece', 'Included'),
  (gen_random_uuid()::text, 'blousePiece', 'Not included'),
  (gen_random_uuid()::text, 'occasion', 'Wedding'),
  (gen_random_uuid()::text, 'occasion', 'Festival'),
  (gen_random_uuid()::text, 'occasion', 'Party'),
  (gen_random_uuid()::text, 'occasion', 'Casual'),
  (gen_random_uuid()::text, 'occasion', 'Ceremonial'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Tamil Nadu'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Karnataka'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Uttar Pradesh'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'West Bengal'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Gujarat'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Maharashtra'),
  (gen_random_uuid()::text, 'regionOfOrigin', 'Andhra Pradesh'),
  (gen_random_uuid()::text, 'productPhotographType', 'Front / Full saree'),
  (gen_random_uuid()::text, 'productPhotographType', 'Pallu'),
  (gen_random_uuid()::text, 'productPhotographType', 'Border'),
  (gen_random_uuid()::text, 'productPhotographType', 'Blouse piece'),
  (gen_random_uuid()::text, 'productPhotographType', 'Draped'),
  (gen_random_uuid()::text, 'certification', 'Silk Mark'),
  (gen_random_uuid()::text, 'certification', 'Handloom Mark'),
  (gen_random_uuid()::text, 'certification', 'GI tag'),
  (gen_random_uuid()::text, 'certification', 'None'),
  (gen_random_uuid()::text, 'stockStatus', 'Available'),
  (gen_random_uuid()::text, 'stockStatus', 'Reserved'),
  (gen_random_uuid()::text, 'stockStatus', 'Sold'),
  (gen_random_uuid()::text, 'stockStatus', 'In transit'),
  (gen_random_uuid()::text, 'stockCondition', 'Good'),
  (gen_random_uuid()::text, 'stockCondition', 'Excellent'),
  (gen_random_uuid()::text, 'stockCondition', 'Fair'),
  (gen_random_uuid()::text, 'reservationStatus', 'Available'),
  (gen_random_uuid()::text, 'reservationStatus', 'Reserved')
ON CONFLICT ("field", "name") DO NOTHING;
