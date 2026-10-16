ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "whatsapp_number" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dealer_items" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"catalog_type" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dealer_items" ADD CONSTRAINT "dealer_items_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dealer_items_dealer_id_idx" ON "dealer_items" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dealer_items_product_idx" ON "dealer_items" USING btree ("catalog_type","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_items_unique_idx" ON "dealer_items" USING btree ("dealer_id","catalog_type","product_id");
