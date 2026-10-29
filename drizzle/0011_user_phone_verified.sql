-- Migration 0011: User phone verification & unique constraint
-- Mobile numbers are now the primary identifier for customers on Mezmani.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_unique_idx" ON "user"("phone") WHERE "phone" IS NOT NULL;
