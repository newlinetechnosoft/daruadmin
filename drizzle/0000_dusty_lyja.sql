CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquor_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"origin" text,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquor_brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "liquor_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquor_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "liquor_images" (
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
CREATE TABLE "liquor_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid,
	"description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquor_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "liquor_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"volume_ml" integer NOT NULL,
	"sku" text NOT NULL,
	"price" integer NOT NULL,
	"mrp" integer,
	"abv" numeric(4, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquor_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "grocery_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_categories_slug_unique" UNIQUE("slug")
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
CREATE TABLE "grocery_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
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
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquor_images" ADD CONSTRAINT "liquor_images_product_id_liquor_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."liquor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquor_products" ADD CONSTRAINT "liquor_products_category_id_liquor_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."liquor_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquor_products" ADD CONSTRAINT "liquor_products_brand_id_liquor_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."liquor_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquor_variants" ADD CONSTRAINT "liquor_variants_product_id_liquor_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."liquor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_images" ADD CONSTRAINT "grocery_images_product_id_grocery_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."grocery_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_products" ADD CONSTRAINT "grocery_products_category_id_grocery_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."grocery_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_variants" ADD CONSTRAINT "grocery_variants_product_id_grocery_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."grocery_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "liquor_brands_slug_idx" ON "liquor_brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "liquor_categories_slug_idx" ON "liquor_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "liquor_images_product_idx" ON "liquor_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "liquor_products_slug_idx" ON "liquor_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "liquor_products_category_idx" ON "liquor_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "liquor_products_brand_idx" ON "liquor_products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "liquor_variants_product_idx" ON "liquor_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "liquor_variants_sku_idx" ON "liquor_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "grocery_categories_slug_idx" ON "grocery_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "grocery_images_product_idx" ON "grocery_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "grocery_products_slug_idx" ON "grocery_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "grocery_products_category_idx" ON "grocery_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "grocery_variants_product_idx" ON "grocery_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "grocery_variants_sku_idx" ON "grocery_variants" USING btree ("sku");