-- Rider-submitted settlement requests (partial COD cash remittances).
-- Requests stay pending until a manager or admin approves them.
ALTER TABLE "rider_cash_handovers" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'cash' NOT NULL;
--> statement-breakpoint
ALTER TABLE "rider_cash_handovers" ADD COLUMN IF NOT EXISTS "payment_reference" text;
--> statement-breakpoint
ALTER TABLE "rider_cash_handovers" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "rider_cash_handovers" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
--> statement-breakpoint
ALTER TABLE "rider_cash_handovers" ADD COLUMN IF NOT EXISTS "journal_entry_id" text;
