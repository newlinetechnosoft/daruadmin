ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "is_reversed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reversed_by" text;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_reversed_by_journal_entries_id_fk'
  ) THEN
    ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_journal_entries_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "journal_entries"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entries_is_reversed_idx" ON "journal_entries" USING btree ("is_reversed");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entries_reversed_by_idx" ON "journal_entries" USING btree ("reversed_by");
