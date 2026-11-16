CREATE TABLE "service_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"polygon" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "service_zones" ("id", "name", "polygon", "is_active", "created_at", "updated_at")
VALUES (
	'00000000-0000-0000-0000-000000000001',
	'Butwal-Tilottama-Bhairahawa',
	'{"type":"Polygon","coordinates":[[[83.44935,27.737863],[83.440853,27.694003],[83.385857,27.68432],[83.399403,27.642685],[83.39181,27.514694],[83.45724,27.505727],[83.527641,27.53991],[83.51586,27.626022],[83.510019,27.661291],[83.525084,27.684336],[83.502407,27.706826],[83.44935,27.737863]]]}'::jsonb,
	true,
	now(),
	now()
);
