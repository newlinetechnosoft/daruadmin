-- ERP Accounting Expansion: Multi-branch, BS periods, expenses, bank management, attachments, and period closing.
-- Non-destructive, backward-compatible, idempotent migration.

-- 1. Branches Table
CREATE TABLE IF NOT EXISTS "branches" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "city" text,
  "address" text,
  "phone" text,
  "is_head_office" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_code_idx" ON "branches" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_is_active_idx" ON "branches" ("is_active");
--> statement-breakpoint

-- Seed default head-office branch if none exists
INSERT INTO "branches" ("id", "code", "name", "city", "address", "phone", "is_head_office", "is_active")
VALUES ('br_butwal_main', 'BUTWAL', 'Butwal Main Branch (Head Office)', 'Butwal', 'Traffic Chowk, Butwal', '071-540000', true, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- 2. Accounting Periods (BS Months per Fiscal Year)
CREATE TABLE IF NOT EXISTS "accounting_periods" (
  "id" text PRIMARY KEY NOT NULL,
  "fiscal_year_id" text NOT NULL REFERENCES "fiscal_years"("id") ON DELETE CASCADE,
  "period_no" integer NOT NULL,
  "name" text NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "closed_at" timestamp with time zone,
  "closed_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_periods_fy_idx" ON "accounting_periods" ("fiscal_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_periods_dates_idx" ON "accounting_periods" ("start_date", "end_date");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'accounting_periods_fy_no_uniq' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX "accounting_periods_fy_no_uniq" ON "accounting_periods" ("fiscal_year_id", "period_no");
  END IF;
END $$;
--> statement-breakpoint

-- 3. Extend Journal Entries for Drafts & Branches
ALTER TABLE "journal_entries" ALTER COLUMN "voucher_no" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "branch_id" text;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "submitted_by" text;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_branch_id_fkey'
  ) THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entries_branch_idx" ON "journal_entries" ("branch_id");
--> statement-breakpoint

-- 4. Extend Journal Lines for Branches
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "branch_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_branch_id_fkey'
  ) THEN
    ALTER TABLE "journal_lines"
      ADD CONSTRAINT "journal_lines_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_lines_branch_idx" ON "journal_lines" ("branch_id");
--> statement-breakpoint

-- 5. Voucher Attachments
CREATE TABLE IF NOT EXISTS "voucher_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "journal_entry_id" text NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "name" text NOT NULL,
  "size" integer DEFAULT 0 NOT NULL,
  "mime_type" text,
  "uploaded_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_attachments_entry_idx" ON "voucher_attachments" ("journal_entry_id");
--> statement-breakpoint

-- 6. Expense Categories
CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "default_account_id" text REFERENCES "ledger_accounts"("id") ON DELETE SET NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_categories_account_idx" ON "expense_categories" ("default_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_categories_is_active_idx" ON "expense_categories" ("is_active");
--> statement-breakpoint

-- Seed default expense categories mapped to standard COA accounts
INSERT INTO "expense_categories" ("id", "name", "description", "default_account_id", "is_active")
VALUES
  ('exp_cat_rent', 'Rent & Office Lease', 'Office, warehouse and store premises rental expenses', 'acc_5120', true),
  ('exp_cat_utilities', 'Electricity & Utilities', 'Electricity, water, heating and municipal utilities', 'acc_5120', true),
  ('exp_cat_internet', 'Internet & Telecommunications', 'Broadband internet, cellular and telephone connectivity', 'acc_5130', true),
  ('exp_cat_marketing', 'Marketing & Promotions', 'Online advertising, offline printing and event marketing', 'acc_5130', true),
  ('exp_cat_repairs', 'Repairs & Maintenance', 'Store maintenance, IT equipment and vehicle repairs', 'acc_5130', true),
  ('exp_cat_fuel', 'Vehicle Fuel & Travel', 'Delivery fleet fuel and staff local transit expenses', 'acc_5111', true),
  ('exp_cat_admin', 'General & Administrative', 'Office supplies, stationary and administrative expenses', 'acc_5130', true),
  ('exp_cat_bank', 'Bank Charges & Gateway Fees', 'Merchant transaction fees, bank service charges and SMS fees', 'acc_5113', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- 7. Expenses Table
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text PRIMARY KEY NOT NULL,
  "expense_number" text NOT NULL UNIQUE,
  "category_account_id" text NOT NULL REFERENCES "ledger_accounts"("id"),
  "payment_account_id" text REFERENCES "ledger_accounts"("id"),
  "amount" integer NOT NULL,
  "tax_amount" integer DEFAULT 0 NOT NULL,
  "expense_date" timestamp with time zone DEFAULT now() NOT NULL,
  "vendor_name" text,
  "vendor_pan" text,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "cost_center_id" text REFERENCES "cost_centers"("id") ON DELETE SET NULL,
  "payment_method" text DEFAULT 'cash',
  "payment_reference" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "receipt_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "submitted_by" text NOT NULL,
  "submitted_at" timestamp with time zone,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "paid_by" text,
  "paid_at" timestamp with time zone,
  "journal_entry_id" text REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("category_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_payment_acc_idx" ON "expenses" ("payment_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_branch_idx" ON "expenses" ("branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_status_idx" ON "expenses" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("expense_date");
--> statement-breakpoint

-- 8. Bank Accounts Table
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "bank_name" text NOT NULL,
  "account_number" text NOT NULL UNIQUE,
  "account_name" text NOT NULL,
  "branch_name" text,
  "ledger_account_id" text REFERENCES "ledger_accounts"("id") ON DELETE SET NULL,
  "currency" text DEFAULT 'NPR' NOT NULL,
  "opening_balance" integer DEFAULT 0 NOT NULL,
  "current_balance" integer DEFAULT 0 NOT NULL,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_accounts_ledger_acc_idx" ON "bank_accounts" ("ledger_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_accounts_branch_idx" ON "bank_accounts" ("branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_accounts_is_active_idx" ON "bank_accounts" ("is_active");
--> statement-breakpoint

-- Seed default bank account linked to BANK_MAIN (acc_1012)
INSERT INTO "bank_accounts" ("id", "bank_name", "account_number", "account_name", "branch_name", "ledger_account_id", "branch_id", "is_active")
VALUES ('bank_nabil_main', 'Nabil Bank Ltd', '0100017500001', 'Daru Gang Pvt Ltd', 'Butwal Branch', 'acc_1012', 'br_butwal_main', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- 9. Bank Transactions Table
CREATE TABLE IF NOT EXISTS "bank_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "bank_account_id" text NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
  "transaction_date" timestamp with time zone NOT NULL,
  "description" text NOT NULL,
  "reference_no" text,
  "debit" integer DEFAULT 0 NOT NULL,
  "credit" integer DEFAULT 0 NOT NULL,
  "matched_journal_line_id" text REFERENCES "journal_lines"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'unmatched' NOT NULL,
  "reconciled_at" timestamp with time zone,
  "reconciled_by" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_bank_acc_idx" ON "bank_transactions" ("bank_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_date_idx" ON "bank_transactions" ("transaction_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_status_idx" ON "bank_transactions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_matched_line_idx" ON "bank_transactions" ("matched_journal_line_id");
--> statement-breakpoint

-- 10. Period Closing Vouchers Table
CREATE TABLE IF NOT EXISTS "period_closing_vouchers" (
  "id" text PRIMARY KEY NOT NULL,
  "fiscal_year_id" text NOT NULL REFERENCES "fiscal_years"("id"),
  "closing_journal_entry_id" text NOT NULL REFERENCES "journal_entries"("id"),
  "retained_earnings_account_id" text NOT NULL REFERENCES "ledger_accounts"("id"),
  "net_profit_or_loss" integer NOT NULL,
  "closed_by" text NOT NULL,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "period_closing_fy_idx" ON "period_closing_vouchers" ("fiscal_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "period_closing_entry_idx" ON "period_closing_vouchers" ("closing_journal_entry_id");
