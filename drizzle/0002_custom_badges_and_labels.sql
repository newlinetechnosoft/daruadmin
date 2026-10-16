ALTER TABLE "liquor_products" ADD COLUMN IF NOT EXISTS "custom_badge" text;--> statement-breakpoint
ALTER TABLE "liquor_products" ADD COLUMN IF NOT EXISTS "custom_discount_label" text;--> statement-breakpoint
ALTER TABLE "grocery_products" ADD COLUMN IF NOT EXISTS "custom_badge" text;--> statement-breakpoint
ALTER TABLE "grocery_products" ADD COLUMN IF NOT EXISTS "custom_discount_label" text;
