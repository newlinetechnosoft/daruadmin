ALTER TABLE "grocery_categories" RENAME TO "food_categories";
--> statement-breakpoint
ALTER TABLE "grocery_brands" RENAME TO "food_brands";
--> statement-breakpoint
ALTER TABLE "grocery_products" RENAME TO "food_products";
--> statement-breakpoint
ALTER TABLE "grocery_variants" RENAME TO "food_variants";
--> statement-breakpoint
ALTER TABLE "grocery_images" RENAME TO "food_images";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_categories_slug_idx" RENAME TO "food_categories_slug_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_brands_slug_idx" RENAME TO "food_brands_slug_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_products_slug_idx" RENAME TO "food_products_slug_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_products_category_idx" RENAME TO "food_products_category_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_products_brand_idx" RENAME TO "food_products_brand_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_variants_product_idx" RENAME TO "food_variants_product_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_variants_sku_idx" RENAME TO "food_variants_sku_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "grocery_images_product_idx" RENAME TO "food_images_product_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_categories_slug_unique') THEN
    ALTER TABLE "food_categories" RENAME CONSTRAINT "grocery_categories_slug_unique" TO "food_categories_slug_unique";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_brands_slug_unique') THEN
    ALTER TABLE "food_brands" RENAME CONSTRAINT "grocery_brands_slug_unique" TO "food_brands_slug_unique";
  ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_brands_slug_key') THEN
    ALTER TABLE "food_brands" RENAME CONSTRAINT "grocery_brands_slug_key" TO "food_brands_slug_unique";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_products_slug_unique') THEN
    ALTER TABLE "food_products" RENAME CONSTRAINT "grocery_products_slug_unique" TO "food_products_slug_unique";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_variants_sku_unique') THEN
    ALTER TABLE "food_variants" RENAME CONSTRAINT "grocery_variants_sku_unique" TO "food_variants_sku_unique";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_images_product_id_grocery_products_id_fk') THEN
    ALTER TABLE "food_images" RENAME CONSTRAINT "grocery_images_product_id_grocery_products_id_fk" TO "food_images_product_id_food_products_id_fk";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_products_category_id_grocery_categories_id_fk') THEN
    ALTER TABLE "food_products" RENAME CONSTRAINT "grocery_products_category_id_grocery_categories_id_fk" TO "food_products_category_id_food_categories_id_fk";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_products_brand_id_grocery_brands_id_fk') THEN
    ALTER TABLE "food_products" RENAME CONSTRAINT "grocery_products_brand_id_grocery_brands_id_fk" TO "food_products_brand_id_food_brands_id_fk";
  ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_products_brand_id_fkey') THEN
    ALTER TABLE "food_products" RENAME CONSTRAINT "grocery_products_brand_id_fkey" TO "food_products_brand_id_food_brands_id_fk";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grocery_variants_product_id_grocery_products_id_fk') THEN
    ALTER TABLE "food_variants" RENAME CONSTRAINT "grocery_variants_product_id_grocery_products_id_fk" TO "food_variants_product_id_food_products_id_fk";
  END IF;
END $$;
--> statement-breakpoint
UPDATE "dealer_items" SET "catalog_type" = 'food' WHERE "catalog_type" = 'grocery';
--> statement-breakpoint
UPDATE "order_items" SET "catalog_type" = 'food' WHERE "catalog_type" = 'grocery';
--> statement-breakpoint
UPDATE "banners" SET "placement" = 'food' WHERE "placement" = 'grocery';
--> statement-breakpoint
UPDATE "recycle_bin" SET "entity_type" = 'food_product' WHERE "entity_type" = 'grocery_product';
--> statement-breakpoint
UPDATE "recycle_bin" SET "entity_type" = 'food_category' WHERE "entity_type" = 'grocery_category';
--> statement-breakpoint
UPDATE "recycle_bin" SET "entity_type" = 'food_brand' WHERE "entity_type" = 'grocery_brand';
--> statement-breakpoint
UPDATE "user_permissions" SET "module" = 'food' WHERE "module" = 'grocery';
--> statement-breakpoint
UPDATE "ledger_accounts" SET "name" = 'COGS Food' WHERE "code" = '5012' AND "name" = 'COGS Grocery';
--> statement-breakpoint
UPDATE "account_defaults" SET "key" = 'COGS_FOOD' WHERE "key" = 'COGS_GROCERY';
--> statement-breakpoint
UPDATE "journal_lines" SET "cost_center" = 'food' WHERE "cost_center" = 'grocery';
