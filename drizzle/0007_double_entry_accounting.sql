-- Migration: 0007_double_entry_accounting
-- Description: Frappe-style Double-Entry Accounting Core for Nepal (Chart of Accounts, Journal Entries & Lines, Fiscal Years, Voucher Sequences, and Legacy Ledger Archive)

-- 1. Create fiscal_years table
CREATE TABLE IF NOT EXISTS "fiscal_years" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL,
  "closed_at" timestamp with time zone,
  "closed_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fiscal_years_dates_idx" ON "fiscal_years" ("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "fiscal_years_is_closed_idx" ON "fiscal_years" ("is_closed");

-- 2. Create voucher_sequences table
CREATE TABLE IF NOT EXISTS "voucher_sequences" (
  "id" text PRIMARY KEY NOT NULL,
  "fiscal_year_id" text NOT NULL REFERENCES "fiscal_years"("id") ON DELETE CASCADE,
  "voucher_type" text NOT NULL,
  "prefix" text DEFAULT 'JV' NOT NULL,
  "last_no" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "voucher_sequences_fy_type_idx" ON "voucher_sequences" ("fiscal_year_id", "voucher_type");

-- 3. Create ledger_accounts table
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "root_type" text NOT NULL,
  "parent_id" text,
  "is_group" boolean DEFAULT false NOT NULL,
  "owner_type" text,
  "owner_id" text,
  "currency" text DEFAULT 'NPR' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ledger_accounts_root_type_check" CHECK (root_type IN ('asset', 'liability', 'equity', 'income', 'expense'))
);

CREATE INDEX IF NOT EXISTS "ledger_accounts_root_type_idx" ON "ledger_accounts" ("root_type");
CREATE INDEX IF NOT EXISTS "ledger_accounts_parent_idx" ON "ledger_accounts" ("parent_id");
CREATE INDEX IF NOT EXISTS "ledger_accounts_owner_idx" ON "ledger_accounts" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "ledger_accounts_is_active_idx" ON "ledger_accounts" ("is_active");

-- 4. Create journal_entries table
CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "voucher_no" text NOT NULL UNIQUE,
  "voucher_type" text DEFAULT 'JV' NOT NULL,
  "fiscal_year_id" text NOT NULL REFERENCES "fiscal_years"("id"),
  "posting_date" timestamp with time zone DEFAULT now() NOT NULL,
  "narration" text NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "event" text,
  "posting_status" text DEFAULT 'submitted' NOT NULL,
  "reversal_of" text,
  "metadata" jsonb,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "journal_entries_status_check" CHECK (posting_status IN ('draft', 'submitted', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "journal_entries_fy_idx" ON "journal_entries" ("fiscal_year_id");
CREATE INDEX IF NOT EXISTS "journal_entries_date_idx" ON "journal_entries" ("posting_date");
CREATE INDEX IF NOT EXISTS "journal_entries_status_idx" ON "journal_entries" ("posting_status");
CREATE INDEX IF NOT EXISTS "journal_entries_ref_idx" ON "journal_entries" ("ref_type", "ref_id");
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_ref_event_uniq_idx" ON "journal_entries" ("ref_type", "ref_id", "event")
  WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL AND event IS NOT NULL;

-- 5. Create journal_lines table
CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "journal_entry_id" text NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL REFERENCES "ledger_accounts"("id"),
  "debit" integer DEFAULT 0 NOT NULL,
  "credit" integer DEFAULT 0 NOT NULL,
  "party_type" text,
  "party_id" text,
  "cost_center" text,
  "narration" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "journal_lines_debit_credit_check" CHECK (debit >= 0 AND credit >= 0 AND ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)))
);

CREATE INDEX IF NOT EXISTS "journal_lines_entry_idx" ON "journal_lines" ("journal_entry_id");
CREATE INDEX IF NOT EXISTS "journal_lines_account_idx" ON "journal_lines" ("account_id");
CREATE INDEX IF NOT EXISTS "journal_lines_party_idx" ON "journal_lines" ("party_type", "party_id");

-- 6. Create legacy_ledger_archive table
CREATE TABLE IF NOT EXISTS "legacy_ledger_archive" (
  "id" text PRIMARY KEY NOT NULL,
  "date" text NOT NULL,
  "type" text NOT NULL,
  "category" text NOT NULL,
  "account" text NOT NULL,
  "memo" text NOT NULL,
  "amount" integer NOT NULL,
  "ref_type" text NOT NULL,
  "ref_id" text,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  "original_created_at" timestamp with time zone NOT NULL
);

-- 7. Archive legacy rows from ledger_entries into legacy_ledger_archive if not already archived
INSERT INTO "legacy_ledger_archive" ("id", "date", "type", "category", "account", "memo", "amount", "ref_type", "ref_id", "original_created_at")
SELECT "id", "date", "type", "category", "account", "memo", "amount", "ref_type", "ref_id", "created_at"
FROM "ledger_entries"
ON CONFLICT ("id") DO NOTHING;

-- 8. Seed Nepal Fiscal Years (2081/82, 2082/83, 2083/84)
INSERT INTO "fiscal_years" ("id", "name", "start_date", "end_date", "is_closed")
VALUES
  ('fy-2081-82', '2081/82', '2024-07-16 00:00:00+00', '2025-07-15 23:59:59+00', true),
  ('fy-2082-83', '2082/83', '2025-07-16 00:00:00+00', '2026-07-15 23:59:59+00', true),
  ('fy-2083-84', '2083/84', '2026-07-16 00:00:00+00', '2027-07-15 23:59:59+00', false)
ON CONFLICT ("id") DO NOTHING;

-- 9. Seed Voucher Sequences for FY 2083/84
INSERT INTO "voucher_sequences" ("id", "fiscal_year_id", "voucher_type", "prefix", "last_no")
VALUES
  ('seq_fy-2083-84_JV', 'fy-2083-84', 'JV', 'JV', 0),
  ('seq_fy-2083-84_PV', 'fy-2083-84', 'PV', 'PV', 0),
  ('seq_fy-2083-84_RV', 'fy-2083-84', 'RV', 'RV', 0),
  ('seq_fy-2083-84_CV', 'fy-2083-84', 'CV', 'CV', 0),
  ('seq_fy-2083-84_SV', 'fy-2083-84', 'SV', 'SV', 0)
ON CONFLICT ("fiscal_year_id", "voucher_type") DO NOTHING;

-- 10. Seed Nepal Chart of Accounts (Root Groups & Primary Accounts)
INSERT INTO "ledger_accounts" ("id", "code", "name", "root_type", "parent_id", "is_group")
VALUES
  -- Root Groups
  ('acc_grp_1000', '1000', 'Application of Funds (Assets)', 'asset', NULL, true),
  ('acc_grp_2000', '2000', 'Source of Funds (Liabilities)', 'liability', NULL, true),
  ('acc_grp_3000', '3000', 'Capital & Equity', 'equity', NULL, true),
  ('acc_grp_4000', '4000', 'Operating Revenue (Income)', 'income', NULL, true),
  ('acc_grp_5000', '5000', 'Operating Expenses', 'expense', NULL, true),

  -- Asset Subgroups & Accounts
  ('acc_grp_1010', '1010', 'Cash & Bank Balances', 'asset', 'acc_grp_1000', true),
  ('acc_1011', '1011', 'Cash in Hand', 'asset', 'acc_grp_1010', false),
  ('acc_1012', '1012', 'Main Operating Bank Account', 'asset', 'acc_grp_1010', false),
  ('acc_grp_1020', '1020', 'Digital Wallets & Gateways', 'asset', 'acc_grp_1000', true),
  ('acc_1021', '1021', 'eSewa Clearing Account', 'asset', 'acc_grp_1020', false),
  ('acc_1022', '1022', 'Khalti Clearing Account', 'asset', 'acc_grp_1020', false),
  ('acc_grp_1030', '1030', 'Rider Cash Holdings', 'asset', 'acc_grp_1000', true),
  ('acc_1031', '1031', 'Rider Undeposited COD Cash', 'asset', 'acc_grp_1030', false),
  ('acc_grp_1040', '1040', 'Trade Receivables & Advances', 'asset', 'acc_grp_1000', true),
  ('acc_1041', '1041', 'Customer Trade Receivables', 'asset', 'acc_grp_1040', false),
  ('acc_1042', '1042', 'Staff & Rider Advances', 'asset', 'acc_grp_1040', false),

  -- Liability Subgroups & Accounts
  ('acc_grp_2010', '2010', 'Trade Payables (Dealers)', 'liability', 'acc_grp_2000', true),
  ('acc_2011', '2011', 'Dealer Procurement Payable', 'liability', 'acc_grp_2010', false),
  ('acc_grp_2020', '2020', 'Duties & Taxes Payable (IRD Nepal)', 'liability', 'acc_grp_2000', true),
  ('acc_2021', '2021', 'VAT Output Payable (13%)', 'liability', 'acc_grp_2020', false),
  ('acc_2022', '2022', 'VAT Input Credit / Receivable (13%)', 'liability', 'acc_grp_2020', false),
  ('acc_2023', '2023', 'TDS Withholding Tax Payable', 'liability', 'acc_grp_2020', false),
  ('acc_grp_2030', '2030', 'Payroll & Staff Payables', 'liability', 'acc_grp_2000', true),
  ('acc_2031', '2031', 'Rider Salary & Commission Payable', 'liability', 'acc_grp_2030', false),

  -- Equity Accounts
  ('acc_3010', '3010', 'Owner Capital', 'equity', 'acc_grp_3000', false),
  ('acc_3020', '3020', 'Retained Earnings', 'equity', 'acc_grp_3000', false),

  -- Income Accounts
  ('acc_4010', '4010', 'Sales Revenue (Merchandise Net)', 'income', 'acc_grp_4000', false),
  ('acc_4020', '4020', 'Delivery Fee Income', 'income', 'acc_grp_4000', false),
  ('acc_4030', '4030', 'Other Operating Income', 'income', 'acc_grp_4000', false),

  -- Expense Accounts (COGS & Operations)
  ('acc_grp_5010', '5010', 'Cost of Goods Sold (Dealer Sourcing)', 'expense', 'acc_grp_5000', true),
  ('acc_5011', '5011', 'COGS - Liquor Purchases', 'expense', 'acc_grp_5010', false),
  ('acc_5012', '5012', 'COGS - Grocery Purchases', 'expense', 'acc_grp_5010', false),
  ('acc_grp_5100', '5100', 'Fulfillment & Logistics Expenses', 'expense', 'acc_grp_5000', true),
  ('acc_5111', '5111', 'Rider Delivery Payout & Commission', 'expense', 'acc_grp_5100', false),
  ('acc_5112', '5112', 'Discounts & Coupons Allowed', 'expense', 'acc_grp_5100', false),
  ('acc_5113', '5113', 'Payment Gateway Commission', 'expense', 'acc_grp_5100', false),
  ('acc_5114', '5114', 'Paisa Round-off Difference', 'expense', 'acc_grp_5100', false),
  ('acc_5120', '5120', 'Office Rent & Utilities', 'expense', 'acc_grp_5000', false),
  ('acc_5130', '5130', 'General Administrative Expense', 'expense', 'acc_grp_5000', false)
ON CONFLICT ("code") DO NOTHING;
