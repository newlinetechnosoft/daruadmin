CREATE TABLE "grocery_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_landing_page" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "grocery_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"origin" text,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "grocery_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid,
	"description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"custom_badge" text,
	"custom_discount_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "grocery_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"sku" text NOT NULL,
	"price" integer NOT NULL,
	"mrp" integer,
	"compare_at_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "grocery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ddc_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_landing_page" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ddc_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ddc_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"origin" text,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ddc_brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ddc_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid,
	"description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"custom_badge" text,
	"custom_discount_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ddc_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ddc_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"sku" text NOT NULL,
	"price" integer NOT NULL,
	"mrp" integer,
	"compare_at_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ddc_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "ddc_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_products" ADD CONSTRAINT "grocery_products_category_id_grocery_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."grocery_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grocery_products" ADD CONSTRAINT "grocery_products_brand_id_grocery_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."grocery_brands"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grocery_variants" ADD CONSTRAINT "grocery_variants_product_id_grocery_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."grocery_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grocery_images" ADD CONSTRAINT "grocery_images_product_id_grocery_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."grocery_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ddc_products" ADD CONSTRAINT "ddc_products_category_id_ddc_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ddc_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ddc_products" ADD CONSTRAINT "ddc_products_brand_id_ddc_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."ddc_brands"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ddc_variants" ADD CONSTRAINT "ddc_variants_product_id_ddc_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ddc_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ddc_images" ADD CONSTRAINT "ddc_images_product_id_ddc_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ddc_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "grocery_categories_slug_idx" ON "grocery_categories" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "grocery_brands_slug_idx" ON "grocery_brands" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "grocery_products_slug_idx" ON "grocery_products" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "grocery_products_category_idx" ON "grocery_products" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "grocery_products_brand_idx" ON "grocery_products" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "grocery_variants_product_idx" ON "grocery_variants" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "grocery_variants_sku_idx" ON "grocery_variants" USING btree ("sku");
--> statement-breakpoint
CREATE INDEX "grocery_images_product_idx" ON "grocery_images" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "ddc_categories_slug_idx" ON "ddc_categories" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "ddc_brands_slug_idx" ON "ddc_brands" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "ddc_products_slug_idx" ON "ddc_products" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "ddc_products_category_idx" ON "ddc_products" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "ddc_products_brand_idx" ON "ddc_products" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "ddc_variants_product_idx" ON "ddc_variants" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "ddc_variants_sku_idx" ON "ddc_variants" USING btree ("sku");
--> statement-breakpoint
CREATE INDEX "ddc_images_product_idx" ON "ddc_images" USING btree ("product_id");
