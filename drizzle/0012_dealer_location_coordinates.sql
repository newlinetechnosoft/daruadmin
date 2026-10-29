-- Migration 0012: Dealer shop location coordinates and spatial index
-- Adds spatial indexing and coordinate boundary checks to dealers table.

ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "lat" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "lng" numeric(10, 7);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dealers_location_idx" ON "dealers"("lat", "lng");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dealers_lat_range_check'
  ) THEN
    ALTER TABLE "dealers" ADD CONSTRAINT "dealers_lat_range_check" CHECK ("lat" IS NULL OR ("lat" >= -90 AND "lat" <= 90));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dealers_lng_range_check'
  ) THEN
    ALTER TABLE "dealers" ADD CONSTRAINT "dealers_lng_range_check" CHECK ("lng" IS NULL OR ("lng" >= -180 AND "lng" <= 180));
  END IF;
END $$;
