CREATE TABLE IF NOT EXISTS "grocery_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"origin" text,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_brands_slug_idx" ON "grocery_brands" USING btree ("slug");
--> statement-breakpoint
ALTER TABLE "grocery_products" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grocery_products_brand_id_grocery_brands_id_fk'
  ) THEN
    ALTER TABLE "grocery_products" ADD CONSTRAINT "grocery_products_brand_id_grocery_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "grocery_brands"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_products_brand_idx" ON "grocery_products" USING btree ("brand_id");
