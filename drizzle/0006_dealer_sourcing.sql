-- Migration 0006: Dealer Sourcing & Purchasing Model
-- Module 2: Dealer Sourcing & Purchasing

-- 1. Add Nepal compliance, credit terms, and VAT fields to dealers table
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "vat_number" text;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "provides_vat_bill" boolean DEFAULT false NOT NULL;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "tds_rate" numeric(5, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "credit_limit" integer DEFAULT 0 NOT NULL;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "payment_terms_days" integer DEFAULT 0 NOT NULL;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "opening_balance" integer DEFAULT 0 NOT NULL;

-- 2. Enhance dealer_items with cost pricing, availability flags, and effective date
ALTER TABLE "dealer_items" ADD COLUMN IF NOT EXISTS "cost_price" integer DEFAULT 0 NOT NULL;
ALTER TABLE "dealer_items" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT true NOT NULL;
ALTER TABLE "dealer_items" ADD COLUMN IF NOT EXISTS "effective_from" timestamp with time zone DEFAULT now() NOT NULL;

-- 3. Create dealer_price_history table for tracking cost price adjustments
CREATE TABLE IF NOT EXISTS "dealer_price_history" (
  "id" text PRIMARY KEY NOT NULL,
  "dealer_id" text NOT NULL REFERENCES "dealers"("id") ON DELETE cascade,
  "catalog_type" text NOT NULL,
  "product_id" uuid NOT NULL,
  "cost_price" integer NOT NULL,
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dealer_price_history_dealer_idx" ON "dealer_price_history" ("dealer_id");
CREATE INDEX IF NOT EXISTS "dealer_price_history_product_idx" ON "dealer_price_history" ("catalog_type", "product_id");

-- 4. Add dealer sourcing and settlement tracking to order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dealer_cost_price" integer;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "actual_dealer_cost_price" integer;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dealer_bill_photo_url" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sourcing_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "is_settled" boolean DEFAULT false NOT NULL;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "settlement_id" text;

CREATE INDEX IF NOT EXISTS "order_items_sourcing_status_idx" ON "order_items" ("sourcing_status");
CREATE INDEX IF NOT EXISTS "order_items_settlement_id_idx" ON "order_items" ("settlement_id");

-- 5. Backfill existing assigned order_items
UPDATE "order_items" 
SET 
  "sourcing_status" = 'assigned',
  "dealer_cost_price" = COALESCE("dealer_cost_price", ROUND("unit_price" * 0.85))
WHERE "dealer_id" IS NOT NULL;

-- 6. Add CHECK constraint on order_items sourcing_status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_sourcing_status_check'
  ) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sourcing_status_check" 
      CHECK ("sourcing_status" IN ('pending', 'assigned', 'unavailable', 'picked_up'));
  END IF;
END $$;
