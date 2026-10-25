-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "sizeChartId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeChartId" TEXT;

-- CreateTable
CREATE TABLE "SizeChart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'BODY',
    "garmentFlat" BOOLEAN NOT NULL DEFAULT false,
    "fit" TEXT,
    "stretch" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sizes" JSONB NOT NULL,
    "ease" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SizeChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_sizeChartId_idx" ON "Category"("sizeChartId");

-- CreateIndex
CREATE INDEX "Product_sizeChartId_idx" ON "Product"("sizeChartId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_sizeChartId_fkey" FOREIGN KEY ("sizeChartId") REFERENCES "SizeChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sizeChartId_fkey" FOREIGN KEY ("sizeChartId") REFERENCES "SizeChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
