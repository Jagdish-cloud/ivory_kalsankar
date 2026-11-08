-- Ivory Lace - consolidated database schema for local/manual setup.
-- Production databases MUST use Prisma migrations:
--   cd backend && npx prisma migrate deploy
--
-- This file is a reference dump and may lag Prisma. Prefer:
--   createdb -U postgres ivory_lace
--   cd backend && npx prisma migrate deploy && npm run prisma:seed

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BarcodeMode" AS ENUM ('LATER', 'SYSTEM', 'MANUAL');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Store Manager',
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Cup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colour" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,

    CONSTRAINT "Colour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "categoryId" TEXT,
    "subCategoryId" TEXT,
    "styleName" TEXT NOT NULL,
    "supplierStyleCode" TEXT,
    "internalStyleCode" TEXT NOT NULL,
    "hsnCode" TEXT,
    "countryOfOrigin" TEXT,
    "launchDate" TIMESTAMP(3),
    "description" TEXT,
    "supplierManufacturer" TEXT,
    "leadTimeDays" INTEGER,
    "reorderLevelPcs" INTEGER,
    "shelfLocation" TEXT,
    "defaultDiscountPct" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "padded" TEXT,
    "wired" TEXT,
    "cupConstruction" TEXT,
    "numberOfPanels" TEXT,
    "coverage" TEXT,
    "strapType" TEXT,
    "strapWidth" TEXT,
    "adjustableStraps" TEXT,
    "removableStraps" TEXT,
    "hookAndEye" TEXT,
    "underbandWidth" TEXT,
    "fabricComposition" TEXT,
    "lining" TEXT,
    "gsm" TEXT,
    "elasticType" TEXT,
    "elasticWidth" TEXT,
    "seamType" TEXT,
    "finish" TEXT,
    "washCare" TEXT,
    "tags" TEXT[],

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeId" TEXT,
    "cupId" TEXT,
    "colourId" TEXT,
    "skuCode" TEXT NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2),
    "sellingPriceInput" DECIMAL(10,2) NOT NULL,
    "isGstInclusive" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" DECIMAL(4,2) NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "gstAmount" DECIMAL(10,2) NOT NULL,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "lowStockAlertPcs" INTEGER NOT NULL DEFAULT 10,
    "outOfStockAlertPcs" INTEGER NOT NULL DEFAULT 0,
    "barcodeMode" "BarcodeMode" NOT NULL DEFAULT 'LATER',
    "barcodeValue" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStock" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_categoryId_name_key" ON "SubCategory"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Size_label_key" ON "Size"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Cup_label_key" ON "Cup"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Colour_name_key" ON "Colour"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_internalStyleCode_key" ON "Product"("internalStyleCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecification_productId_key" ON "ProductSpecification"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_skuCode_key" ON "ProductVariant"("skuCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_barcodeValue_key" ON "ProductVariant"("barcodeValue");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sizeId_cupId_colourId_key" ON "ProductVariant"("productId", "sizeId", "cupId", "colourId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantStock_variantId_storeId_key" ON "VariantStock"("variantId", "storeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_cupId_fkey" FOREIGN KEY ("cupId") REFERENCES "Cup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==== Phase 2: Customers + Billing (POS) ====

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SALE', 'SALE_CANCEL');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerNo" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "anniversaryDate" TIMESTAMP(3),
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "notes" TEXT,
    "isLoyaltyMember" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "customerGstin" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "roundOff" DECIMAL(6,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "variantId" TEXT,
    "styleName" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "sizeLabel" TEXT,
    "cupLabel" TEXT,
    "colourName" TEXT,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstRate" DECIMAL(4,2) NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT,
    "storeId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "invoiceId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNo_key" ON "Customer"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobile_key" ON "Customer"("mobile");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_city_idx" ON "Customer"("city");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_storeId_createdAt_idx" ON "Invoice"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_variantId_idx" ON "InvoiceItem"("variantId");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_invoiceId_idx" ON "StockMovement"("invoiceId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ===========================================================================
-- Phase 3 - Multi-store, cross-store billing, returns/exchanges (applies on top of Phase 1+2 above)
-- Identical to backend/prisma/migrations/20261025000000_multistore_returns/migration.sql
-- ===========================================================================
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
ALTER TABLE "Invoice" ADD COLUMN     "billedAtStoreId" TEXT,
ADD COLUMN     "checkoutGroupId" TEXT,
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeId" TEXT,
ADD COLUMN     "qrToken" TEXT,
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

-- ---------------------------------------------------------------------------
-- Data backfill for existing rows
-- ---------------------------------------------------------------------------

-- User.role: free text -> enum (existing users become managers unless clearly admin/cashier).
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE
    WHEN lower("role") LIKE '%super%' THEN 'SUPER_ADMIN'
    WHEN lower("role") LIKE '%cashier%' THEN 'CASHIER'
    ELSE 'MANAGER'
  END
)::"UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MANAGER';

-- Stores: firm name defaults to the store name.
UPDATE "Store" SET "firmName" = "name" WHERE "firmName" IS NULL;

-- Invoices: billed-at store = selling store, seller snapshot, unique QR token.
UPDATE "Invoice" i SET
  "billedAtStoreId" = i."storeId",
  "sellerFirmName" = COALESCE(s."firmName", s."name"),
  "sellerGstin" = s."gstin",
  "sellerAddress" = NULLIF(concat_ws(', ', s."addressLine", s."city", s."state", s."pincode"), ''),
  "qrToken" = md5(random()::text || i."id") || md5(clock_timestamp()::text || i."id")
FROM "Store" s WHERE s."id" = i."storeId";

ALTER TABLE "Invoice" ALTER COLUMN "billedAtStoreId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "qrToken" SET NOT NULL;
CREATE UNIQUE INDEX "Invoice_qrToken_key" ON "Invoice"("qrToken");

-- Invoice items: record the discount as a percent discount.
UPDATE "InvoiceItem" SET "discountValue" = "discountPct";

-- ---------------------------------------------------------------------------
-- Transfers + Kalsankar saree lookup options (apply on an existing database)
-- ---------------------------------------------------------------------------

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "transferSeq" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'RECEIVING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransferSource" AS ENUM ('PLANNED', 'POS_SCAN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';

CREATE TABLE IF NOT EXISTS "SareeLookupOption" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "SareeLookupOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SareeLookupOption_field_name_key" ON "SareeLookupOption"("field", "name");
CREATE INDEX IF NOT EXISTS "SareeLookupOption_field_idx" ON "SareeLookupOption"("field");

CREATE TABLE IF NOT EXISTS "StockTransfer" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransfer_packageCode_key" ON "StockTransfer"("packageCode");
CREATE INDEX IF NOT EXISTS "StockTransfer_chain_createdAt_idx" ON "StockTransfer"("chain", "createdAt");
CREATE INDEX IF NOT EXISTS "StockTransfer_fromStoreId_createdAt_idx" ON "StockTransfer"("fromStoreId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockTransfer_toStoreId_createdAt_idx" ON "StockTransfer"("toStoreId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockTransfer_status_idx" ON "StockTransfer"("status");

CREATE TABLE IF NOT EXISTS "StockTransferLine" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransferLine_transferId_variantId_key" ON "StockTransferLine"("transferId", "variantId");
CREATE INDEX IF NOT EXISTS "StockTransferLine_variantId_idx" ON "StockTransferLine"("variantId");

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "transferId" TEXT;
CREATE INDEX IF NOT EXISTS "StockMovement_transferId_idx" ON "StockMovement"("transferId");

DO $$ BEGIN
  ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_packageReceivedById_fkey" FOREIGN KEY ("packageReceivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VerificationBatch" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "VerificationBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationBatch_storeId_completedAt_idx" ON "VerificationBatch"("storeId", "completedAt");

CREATE TABLE IF NOT EXISTS "VerificationLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "styleName" TEXT NOT NULL,
    "colour" TEXT,
    "scannedAt" TIMESTAMP(3),
    "scannedById" TEXT,
    CONSTRAINT "VerificationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationLine_batchId_variantId_key" ON "VerificationLine"("batchId", "variantId");
CREATE INDEX IF NOT EXISTS "VerificationLine_variantId_idx" ON "VerificationLine"("variantId");

DO $$ BEGIN
  ALTER TABLE "VerificationBatch" ADD CONSTRAINT "VerificationBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "VerificationBatch" ADD CONSTRAINT "VerificationBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "VerificationLine" ADD CONSTRAINT "VerificationLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VerificationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "VerificationLine" ADD CONSTRAINT "VerificationLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "VerificationLine" ADD CONSTRAINT "VerificationLine_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Documents (S3 metadata). Apply on an existing database with the statements below.

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

-- ---------------------------------------------------------------------------
-- Production readiness (AppSetting + indexes). Prefer prisma migrate deploy.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "User_storeId_idx" ON "User"("storeId");
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX IF NOT EXISTS "VariantStock_storeId_idx" ON "VariantStock"("storeId");
CREATE INDEX IF NOT EXISTS "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "StockMovement_storeId_idx" ON "StockMovement"("storeId");
CREATE INDEX IF NOT EXISTS "ReturnExchange_billedAtStoreId_idx" ON "ReturnExchange"("billedAtStoreId");
CREATE INDEX IF NOT EXISTS "CreditNote_billedAtStoreId_idx" ON "CreditNote"("billedAtStoreId");


