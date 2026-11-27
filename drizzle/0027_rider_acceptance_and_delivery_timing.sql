-- Rider assignment acceptance flow + structured delivery scheduling & timing
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_slot" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_scheduled_for" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_assignment_status" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_assigned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_responded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_decline_reason" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_delivery_scheduled_for_idx" ON "orders" ("delivery_scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_rider_assignment_status_idx" ON "orders" ("rider_assignment_status");
--> statement-breakpoint
UPDATE "orders" AS o
SET "confirmed_at" = h."created_at"
FROM (
	SELECT "order_id", MIN("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'confirmed'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."confirmed_at" IS NULL;
--> statement-breakpoint
UPDATE "orders" AS o
SET "delivered_at" = h."created_at"
FROM (
	SELECT "order_id", MIN("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'delivered'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."delivered_at" IS NULL;
--> statement-breakpoint
UPDATE "orders" AS o
SET "rider_assigned_at" = h."created_at"
FROM (
	SELECT "order_id", MAX("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'rider_assigned'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."rider_assigned_at" IS NULL;
--> statement-breakpoint
UPDATE "orders"
SET "rider_assignment_status" = 'accepted'
WHERE "rider_id" IS NOT NULL AND "rider_assignment_status" IS NULL;
