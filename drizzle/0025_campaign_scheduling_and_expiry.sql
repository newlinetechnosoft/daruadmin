-- Notification Scheduling, Publishing & Expiry Management Migration
-- Adds full date-time scheduling fields, timezone preservation, multi-channel delivery logs, and idempotency safeguards.

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "channels" text[] DEFAULT ARRAY['push']::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "target_audience_details" jsonb;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "estimated_recipients" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduled_date" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduled_time" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expiry_date" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expiry_time" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Asia/Kathmandu' NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "cta_url" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "cta_text" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "banner_placement" text DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "banner_id" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "offer_slug" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expired_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "delivery_progress" jsonb;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "analytics" jsonb;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "job_id" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expire_job_id" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_expires_at_idx" ON "campaigns" ("expires_at");
--> statement-breakpoint

-- Create campaign_deliveries for granular per-recipient delivery tracking and database-level idempotency
CREATE TABLE IF NOT EXISTS "campaign_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "channel" text NOT NULL,
  "recipient" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "sent_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_deliveries_campaign_id_idx" ON "campaign_deliveries" ("campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_deliveries_user_id_idx" ON "campaign_deliveries" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_deliveries_status_idx" ON "campaign_deliveries" ("status");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'campaign_deliveries_campaign_user_channel_uniq_idx'
  ) THEN
    CREATE UNIQUE INDEX "campaign_deliveries_campaign_user_channel_uniq_idx"
    ON "campaign_deliveries" ("campaign_id", "user_id", "channel");
  END IF;
END $$;
