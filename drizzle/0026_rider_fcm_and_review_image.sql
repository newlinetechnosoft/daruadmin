ALTER TABLE "riders" ADD COLUMN IF NOT EXISTS "fcm_token" text;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rider_device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL REFERENCES "riders"("id") ON DELETE cascade,
	"token" text NOT NULL,
	"device_type" text DEFAULT 'android' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rider_device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_device_tokens_rider_id_idx" ON "rider_device_tokens" ("rider_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_device_tokens_token_idx" ON "rider_device_tokens" ("token");
