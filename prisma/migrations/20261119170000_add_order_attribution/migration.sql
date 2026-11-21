-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fbclid" TEXT,
ADD COLUMN     "metaFbc" TEXT,
ADD COLUMN     "metaFbp" TEXT,
ADD COLUMN     "metaUserAgent" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- CreateIndex
CREATE INDEX "Order_utmSource_idx" ON "Order"("utmSource");
