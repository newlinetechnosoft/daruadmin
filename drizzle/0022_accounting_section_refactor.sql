-- Accounting section refactor: small, additive schema changes.
-- No existing columns are dropped or renamed.
-- Idempotent: safe to run more than once.

-- 1. Extend ledger_accounts with account type, balance rule, freeze flag, sort order, description
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "account_type" text;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "balance_must_be" text;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "is_frozen" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_accounts_account_type_check'
  ) THEN
    ALTER TABLE "ledger_accounts"
      ADD CONSTRAINT "ledger_accounts_account_type_check"
      CHECK (account_type IN ('cash','bank','receivable','payable','tax','stock_adjustment','round_off','income','expense','cogs','equity','fixed_asset','other'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_accounts_balance_must_be_check'
  ) THEN
    ALTER TABLE "ledger_accounts"
      ADD CONSTRAINT "ledger_accounts_balance_must_be_check"
      CHECK (balance_must_be IN ('debit','credit'));
  END IF;
END $$;

-- 2. Cost center tree (ERPNext-style cost center tree)
CREATE TABLE IF NOT EXISTS "cost_centers" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "parent_id" text,
  "is_group" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_parent_idx" ON "cost_centers" ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_is_active_idx" ON "cost_centers" ("is_active");

-- 3. Link journal lines to cost centers (legacy free-text cost_center is preserved)
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "cost_center_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_cost_center_fkey'
  ) THEN
    ALTER TABLE "journal_lines"
      ADD CONSTRAINT "journal_lines_cost_center_fkey"
      FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_lines_cost_center_id_idx" ON "journal_lines" ("cost_center_id");

-- 4. Indexes for fast GL / party statement lookups
CREATE INDEX IF NOT EXISTS "journal_lines_account_date_idx" ON "journal_lines" ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_lines_party_date_idx" ON "journal_lines" ("party_type", "party_id");

-- 5. Seed default cost centers
INSERT INTO "cost_centers" ("id", "code", "name", "parent_id", "is_group", "is_active")
VALUES
  ('cc_general', 'GEN', 'General', NULL, false, true),
  ('cc_liquor', 'LIQ', 'Liquor', NULL, false, true),
  ('cc_food', 'FOO', 'Food', NULL, false, true),
  ('cc_delivery', 'DEL', 'Delivery', NULL, false, true)
ON CONFLICT ("id") DO NOTHING;

-- 6. Backfill ERPNext-style account types and normal balance for the seeded
--    chart of accounts. Only fills NULLs, so any manual classification done by
--    the owner is preserved. New accounts can leave both fields empty.
UPDATE "ledger_accounts"
SET "account_type" = CASE "code"
  WHEN '1011' THEN 'cash'
  WHEN '1012' THEN 'bank'
  WHEN '1021' THEN 'bank'
  WHEN '1022' THEN 'bank'
  WHEN '1031' THEN 'cash'
  WHEN '1041' THEN 'receivable'
  WHEN '1042' THEN 'receivable'
  WHEN '2011' THEN 'payable'
  WHEN '2021' THEN 'tax'
  WHEN '2022' THEN 'tax'
  WHEN '2023' THEN 'tax'
  WHEN '2031' THEN 'payable'
  WHEN '3010' THEN 'equity'
  WHEN '3020' THEN 'equity'
  WHEN '4010' THEN 'income'
  WHEN '4020' THEN 'income'
  WHEN '4030' THEN 'income'
  WHEN '5011' THEN 'cogs'
  WHEN '5012' THEN 'cogs'
  WHEN '5111' THEN 'expense'
  WHEN '5112' THEN 'expense'
  WHEN '5113' THEN 'expense'
  WHEN '5114' THEN 'round_off'
  WHEN '5120' THEN 'expense'
  WHEN '5130' THEN 'expense'
  ELSE "account_type"
END
WHERE "account_type" IS NULL;
--> statement-breakpoint
UPDATE "ledger_accounts"
SET "balance_must_be" = CASE
  -- Input VAT credit is a receivable even though it is grouped under duties.
  WHEN "code" = '2022' THEN 'debit'
  WHEN "root_type" IN ('asset', 'expense') THEN 'debit'
  WHEN "root_type" IN ('liability', 'equity', 'income') THEN 'credit'
  ELSE "balance_must_be"
END
WHERE "balance_must_be" IS NULL AND "is_group" = false;
--> statement-breakpoint
UPDATE "ledger_accounts"
SET "sort_order" = ("code"::integer * 10)
WHERE "sort_order" = 0 AND "code" ~ '^[0-9]+$';
