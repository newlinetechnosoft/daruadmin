CREATE TABLE IF NOT EXISTS "recycle_bin" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "data" jsonb NOT NULL,
  "deleted_by" text DEFAULT 'Admin' NOT NULL,
  "deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recycle_bin_entity_type_idx" ON "recycle_bin" USING btree ("entity_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recycle_bin_expires_at_idx" ON "recycle_bin" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recycle_bin_deleted_at_idx" ON "recycle_bin" USING btree ("deleted_at");
