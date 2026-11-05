-- Phase 5: store photos, price retraction, anonymous demand signals.
-- AlterTable
ALTER TABLE "price_observations" ADD COLUMN     "retracted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "store_photos" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_signals" (
    "product_id" UUID NOT NULL,
    "cell_key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "lists" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "demand_signals_pkey" PRIMARY KEY ("product_id","cell_key","day")
);

-- CreateIndex
CREATE INDEX "store_photos_store_id_idx" ON "store_photos"("store_id");

-- CreateIndex
CREATE INDEX "demand_signals_cell_key_day_idx" ON "demand_signals"("cell_key", "day");

-- AddForeignKey
ALTER TABLE "store_photos" ADD CONSTRAINT "store_photos_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

