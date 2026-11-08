-- Additive production-readiness migration: AppSetting + missing indexes.
-- Does not drop tables, columns, or data.

CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "User_storeId_idx" ON "User"("storeId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "VariantStock_storeId_idx" ON "VariantStock"("storeId");
CREATE INDEX "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX "StockMovement_storeId_idx" ON "StockMovement"("storeId");
CREATE INDEX "ReturnExchange_billedAtStoreId_idx" ON "ReturnExchange"("billedAtStoreId");
CREATE INDEX "CreditNote_billedAtStoreId_idx" ON "CreditNote"("billedAtStoreId");
