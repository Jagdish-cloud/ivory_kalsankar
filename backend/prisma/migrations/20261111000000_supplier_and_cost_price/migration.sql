-- CreateTable
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_code_key" ON "Supplier"("code");

-- AlterTable
ALTER TABLE "SareeDetail" ADD COLUMN IF NOT EXISTS "supplierPhone" TEXT;
ALTER TABLE "SareeDetail" ADD COLUMN IF NOT EXISTS "supplierCity" TEXT;
ALTER TABLE "SareeDetail" ADD COLUMN IF NOT EXISTS "supplierState" TEXT;
ALTER TABLE "SareeDetail" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2);
