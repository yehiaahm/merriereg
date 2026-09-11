-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION,
ALTER COLUMN "shippingArea" DROP NOT NULL,
ALTER COLUMN "shippingStreet" DROP NOT NULL,
ALTER COLUMN "shippingBuilding" DROP NOT NULL;
