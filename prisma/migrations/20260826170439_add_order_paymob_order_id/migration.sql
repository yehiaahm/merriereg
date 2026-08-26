-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymobOrderId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymobOrderId_key" ON "Order"("paymobOrderId");
