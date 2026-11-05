-- CreateEnum
CREATE TYPE "FlyerImportStatus" AS ENUM ('DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "AliasStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "price_observations" ADD COLUMN     "flyer_id" UUID;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "target_price" DECIMAL(10,2) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius_km" DECIMAL(4,1) NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notified_price" DECIMAL(10,2),
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flyer_imports" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "status" "FlyerImportStatus" NOT NULL,
    "valid_until" TIMESTAMP(3),
    "items_found" INTEGER NOT NULL DEFAULT 0,
    "prices_added" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "raw" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flyer_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "price_alerts_active_idx" ON "price_alerts"("active");

-- CreateIndex
CREATE UNIQUE INDEX "price_alerts_user_id_product_id_key" ON "price_alerts"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "flyer_imports_store_id_created_at_idx" ON "flyer_imports"("store_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_flyer_id_fkey" FOREIGN KEY ("flyer_id") REFERENCES "flyer_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyer_imports" ADD CONSTRAINT "flyer_imports_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyer_imports" ADD CONSTRAINT "flyer_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
