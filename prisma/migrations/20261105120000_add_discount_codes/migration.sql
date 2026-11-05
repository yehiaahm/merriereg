-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "label" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscount" INTEGER,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "oncePerCustomer" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "showInBar" BOOLEAN NOT NULL DEFAULT false,
    "showAtCheckout" BOOLEAN NOT NULL DEFAULT true,
    "barText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_codeKey_key" ON "DiscountCode"("codeKey");

-- CreateIndex
CREATE INDEX "DiscountCode_active_idx" ON "DiscountCode"("active");

-- Seed the two codes that were previously hard-coded so existing links, the
-- promo bar and the checkout keep working after this deploy. Admins can edit,
-- disable or delete them from Admin > Discount Codes.
INSERT INTO "DiscountCode" ("id", "code", "codeKey", "label", "type", "value", "showInBar", "showAtCheckout", "barText", "updatedAt")
VALUES
  ('seed_discount_follow10', 'FOLLOW10', 'FOLLOW10', 'Follow Us & Get 10% Off', 'PERCENT', 10, true, true, 'Follow Us & Get 10% Off (Code: FOLLOW10)', CURRENT_TIMESTAMP),
  ('seed_discount_pasmala1', 'Pasmala.1', 'PASMALA.1', 'Get 10% Off Your Order', 'PERCENT', 10, true, true, 'Get 10% Off Your Order (Code: Pasmala.1)', CURRENT_TIMESTAMP);
