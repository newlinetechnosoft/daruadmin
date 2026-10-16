-- Migration 0005: Order State Machine & Audit History Enhancement
-- Module 1: Order State Machine

-- 1. Add order audit and failure/cancellation fields to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_legacy" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_failure_reason" text;

-- 2. Enhance order_status_history with audit columns while preserving legacy status & actor
ALTER TABLE "order_status_history" ADD COLUMN IF NOT EXISTS "from_status" text;
ALTER TABLE "order_status_history" ADD COLUMN IF NOT EXISTS "to_status" text;
ALTER TABLE "order_status_history" ADD COLUMN IF NOT EXISTS "actor_id" text;
ALTER TABLE "order_status_history" ADD COLUMN IF NOT EXISTS "actor_role" text;
ALTER TABLE "order_status_history" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

CREATE INDEX IF NOT EXISTS "order_status_history_to_status_idx" ON "order_status_history" ("to_status");

-- 3. Data Migration: Map legacy statuses in orders
-- packing -> confirmed
UPDATE "orders" SET "status" = 'confirmed' WHERE "status" = 'packing';
-- assigned -> rider_assigned
UPDATE "orders" SET "status" = 'rider_assigned' WHERE "status" = 'assigned';

-- 4. Flag legacy orders that have a rider assigned but no dealer
UPDATE "orders" SET "is_legacy" = true WHERE "rider_id" IS NOT NULL AND "dealer_id" IS NULL;

-- 5. Data Migration: Map legacy statuses in order_status_history
UPDATE "order_status_history" SET "status" = 'confirmed' WHERE "status" = 'packing';
UPDATE "order_status_history" SET "status" = 'rider_assigned' WHERE "status" = 'assigned';

-- Backfill to_status from status
UPDATE "order_status_history" SET "to_status" = "status" WHERE "to_status" IS NULL;

-- Backfill from_status using LAG() ordered by created_at per order
WITH ranked AS (
  SELECT 
    id,
    LAG(to_status) OVER (PARTITION BY order_id ORDER BY created_at ASC) AS prev_status
  FROM "order_status_history"
)
UPDATE "order_status_history"
SET "from_status" = COALESCE(ranked.prev_status, 'pending')
FROM ranked
WHERE "order_status_history"."id" = ranked.id 
  AND "order_status_history"."from_status" IS NULL;

-- 6. Add CHECK constraint on orders.status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" 
      CHECK ("status" IN (
        'pending', 
        'confirmed', 
        'dealer_assigned', 
        'rider_assigned', 
        'picked_up', 
        'out_for_delivery', 
        'delivered', 
        'delivery_failed', 
        'returned', 
        'cancelled'
      ));
  END IF;
END $$;
