warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ReturnVerificationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExchangeType" AS ENUM ('RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('NONE', 'PAYMENT_COLLECTED', 'REFUND', 'STORE_CREDIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_NOTE';
ALTER TYPE "PaymentMethod" ADD VALUE 'STORE_CREDIT';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RETURN_IN';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_storeId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "storeCreditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billedAtStoreId" TEXT NOT NULL,
ADD COLUMN     "checkoutGroupId" TEXT,
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeId" TEXT,
ADD COLUMN     "qrToken" TEXT NOT NULL,
ADD COLUMN     "sellerAddress" TEXT,
ADD COLUMN     "sellerFirmName" TEXT,
ADD COLUMN     "sellerGstin" TEXT,
ADD COLUMN     "splitCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "splitIndex" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "defaultDiscountPct";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "costPrice",
DROP COLUMN "discountPct";

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "creditNoteId" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "creditNoteSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firmName" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
ALTER COLUMN "storeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "receiveBills" BOOLEAN NOT NULL DEFAULT true,
    "receiveLowStock" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnExchange" (
    "id" TEXT NOT NULL,
    "exchangeNo" SERIAL NOT NULL,
    "type" "ExchangeType" NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "customerId" TEXT,
    "billedAtStoreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditTotal" DECIMAL(12,2) NOT NULL,
    "replacementTotal" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "settlementType" "SettlementType" NOT NULL DEFAULT 'NONE',
    "settlementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "settlementMethod" "PaymentMethod",
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "billedAtStoreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "originalInvoiceNumber" TEXT NOT NULL,
    "originalInvoiceDate" TIMESTAMP(3) NOT NULL,
    "exchangeId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "customerGstin" TEXT,
    "sellerFirmName" TEXT,
    "sellerGstin" TEXT,
    "sellerAddress" TEXT,
    "qrToken" TEXT NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "roundOff" DECIMAL(6,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteItem" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "variantId" TEXT,
    "styleName" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "sizeLabel" TEXT,
    "cupLabel" TEXT,
    "colourName" TEXT,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstRate" DECIMAL(4,2) NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "verificationStatus" "ReturnVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verificationNote" TEXT,

    CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditLedger" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "storeId" TEXT,
    "exchangeId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailRecipient_email_key" ON "EmailRecipient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnExchange_exchangeNo_key" ON "ReturnExchange"("exchangeNo");

-- CreateIndex
CREATE INDEX "ReturnExchange_originalInvoiceId_idx" ON "ReturnExchange"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "ReturnExchange_createdAt_idx" ON "ReturnExchange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_qrToken_key" ON "CreditNote"("qrToken");

-- CreateIndex
CREATE INDEX "CreditNote_createdAt_idx" ON "CreditNote"("createdAt");

-- CreateIndex
CREATE INDEX "CreditNote_storeId_createdAt_idx" ON "CreditNote"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditNote_originalInvoiceId_idx" ON "CreditNote"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_exchangeId_idx" ON "CreditNote"("exchangeId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_invoiceItemId_idx" ON "CreditNoteItem"("invoiceItemId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_verificationStatus_idx" ON "CreditNoteItem"("verificationStatus");

-- CreateIndex
CREATE INDEX "StoreCreditLedger_customerId_createdAt_idx" ON "StoreCreditLedger"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_qrToken_key" ON "Invoice"("qrToken");

-- CreateIndex
CREATE INDEX "Invoice_billedAtStoreId_createdAt_idx" ON "Invoice"("billedAtStoreId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_checkoutGroupId_idx" ON "Invoice"("checkoutGroupId");

-- CreateIndex
CREATE INDEX "Invoice_exchangeId_idx" ON "Invoice"("exchangeId");

-- CreateIndex
CREATE INDEX "StockMovement_creditNoteId_idx" ON "StockMovement"("creditNoteId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billedAtStoreId_fkey" FOREIGN KEY ("billedAtStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ReturnExchange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchange" ADD CONSTRAINT "ReturnExchange_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchange" ADD CONSTRAINT "ReturnExchange_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchange" ADD CONSTRAINT "ReturnExchange_billedAtStoreId_fkey" FOREIGN KEY ("billedAtStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchange" ADD CONSTRAINT "ReturnExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_billedAtStoreId_fkey" FOREIGN KEY ("billedAtStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ReturnExchange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditLedger" ADD CONSTRAINT "StoreCreditLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditLedger" ADD CONSTRAINT "StoreCreditLedger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditLedger" ADD CONSTRAINT "StoreCreditLedger_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ReturnExchange"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
Γöé  Update available 6.19.3 -> 8.0.0-rc.27                 Γöé
Γöé                                                         Γöé
Γöé  This is a major update - please follow the guide at    Γöé
Γöé  https://pris.ly/d/major-version-upgrade                Γöé
Γöé                                                         Γöé
Γöé  Run the following to update                            Γöé
Γöé    npm i --save-dev prisma@latest                       Γöé
Γöé    npm i @prisma/client@latest                          Γöé
ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ

