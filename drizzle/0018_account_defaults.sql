CREATE TABLE IF NOT EXISTS "account_defaults" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "account_id" text NOT NULL REFERENCES "ledger_accounts"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_defaults_account_id_idx" ON "account_defaults" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_defaults_key_idx" ON "account_defaults" USING btree ("key");
--> statement-breakpoint
INSERT INTO "account_defaults" ("id", "key", "account_id")
VALUES
  ('def_CASH_IN_HAND', 'CASH_IN_HAND', 'acc_1011'),
  ('def_BANK_MAIN', 'BANK_MAIN', 'acc_1012'),
  ('def_ESEWA_CLEARING', 'ESEWA_CLEARING', 'acc_1021'),
  ('def_KHALTI_CLEARING', 'KHALTI_CLEARING', 'acc_1022'),
  ('def_RIDER_COD_CASH', 'RIDER_COD_CASH', 'acc_1031'),
  ('def_CUSTOMER_RECEIVABLE', 'CUSTOMER_RECEIVABLE', 'acc_1041'),
  ('def_STAFF_RIDER_ADVANCES', 'STAFF_RIDER_ADVANCES', 'acc_1042'),
  ('def_DEALER_PAYABLE', 'DEALER_PAYABLE', 'acc_2011'),
  ('def_VAT_OUTPUT', 'VAT_OUTPUT', 'acc_2021'),
  ('def_VAT_INPUT', 'VAT_INPUT', 'acc_2022'),
  ('def_TDS_PAYABLE', 'TDS_PAYABLE', 'acc_2023'),
  ('def_RIDER_PAYABLE', 'RIDER_PAYABLE', 'acc_2031'),
  ('def_OWNER_CAPITAL', 'OWNER_CAPITAL', 'acc_3010'),
  ('def_RETAINED_EARNINGS', 'RETAINED_EARNINGS', 'acc_3020'),
  ('def_SALES', 'SALES', 'acc_4010'),
  ('def_DELIVERY_INCOME', 'DELIVERY_INCOME', 'acc_4020'),
  ('def_OTHER_INCOME', 'OTHER_INCOME', 'acc_4030'),
  ('def_COGS_LIQUOR', 'COGS_LIQUOR', 'acc_5011'),
  ('def_COGS_GROCERY', 'COGS_GROCERY', 'acc_5012'),
  ('def_RIDER_EXPENSE', 'RIDER_EXPENSE', 'acc_5111'),
  ('def_DISCOUNTS', 'DISCOUNTS', 'acc_5112'),
  ('def_GATEWAY_FEES', 'GATEWAY_FEES', 'acc_5113'),
  ('def_ROUND_OFF', 'ROUND_OFF', 'acc_5114'),
  ('def_RENT_UTILITIES', 'RENT_UTILITIES', 'acc_5120'),
  ('def_ADMIN_EXPENSE', 'ADMIN_EXPENSE', 'acc_5130')
ON CONFLICT ("key") DO NOTHING;
