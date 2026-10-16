ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dealer_id" text REFERENCES "dealers"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "order_items_dealer_id_idx" ON "order_items" ("dealer_id");
