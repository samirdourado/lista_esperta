-- Phase 4: OpenStreetMap as store source, store categories, discovery cache, claim message.
-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "StoreSource" ADD VALUE 'OSM';

-- DropIndex
DROP INDEX "stores_google_place_id_key";

-- AlterTable
ALTER TABLE "store_claims" ADD COLUMN     "message" TEXT;

-- AlterTable (edited by hand: rename keeps existing ids instead of drop + add)
ALTER TABLE "stores" RENAME COLUMN "google_place_id" TO "external_id";
ALTER TABLE "stores" ADD COLUMN     "company_data" JSONB,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "store_categories" (
    "store_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "store_categories_pkey" PRIMARY KEY ("store_id","category_id")
);

-- CreateTable
CREATE TABLE "place_discovery_cells" (
    "cell_key" TEXT NOT NULL,
    "status" "DiscoveryStatus" NOT NULL DEFAULT 'PENDING',
    "stores_found" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_discovery_cells_pkey" PRIMARY KEY ("cell_key")
);

-- CreateIndex
CREATE INDEX "store_categories_category_id_idx" ON "store_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_source_external_id_key" ON "stores"("source", "external_id");

-- AddForeignKey
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

