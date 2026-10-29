ALTER TABLE "liquor_categories" ADD COLUMN IF NOT EXISTS "show_on_landing_page" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_categories" ADD COLUMN IF NOT EXISTS "show_on_landing_page" boolean DEFAULT false NOT NULL;
