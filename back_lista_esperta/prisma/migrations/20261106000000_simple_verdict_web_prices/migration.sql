-- The verdict ranks by basket price only (docs/DECISIONS.md D-069).
ALTER TABLE "users" DROP COLUMN "cost_per_km",
  DROP COLUMN "value_per_hour";

-- Reference price seen on Google Shopping (D-070).
ALTER TABLE "shopping_list_items" ADD COLUMN "web_price" JSONB;
