-- Google Shopping results kept as reference prices and as a shared cache (D-076).
CREATE TABLE "web_searches" (
    "id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_searches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "web_offers" (
    "id" UUID NOT NULL,
    "search_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "store" TEXT NOT NULL,
    "url" TEXT,
    "thumbnail" TEXT,
    "delivery" TEXT,
    "nearby" TEXT,

    CONSTRAINT "web_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "web_searches_query_place_searched_at_idx" ON "web_searches"("query", "place", "searched_at");
CREATE INDEX "web_offers_search_id_idx" ON "web_offers"("search_id");
-- The verdict looks offers up by name (pg_trgm, already enabled in the first migration).
CREATE INDEX "web_offers_title_trgm_idx" ON "web_offers" USING gin ("title" gin_trgm_ops);

ALTER TABLE "web_offers" ADD CONSTRAINT "web_offers_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "web_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
