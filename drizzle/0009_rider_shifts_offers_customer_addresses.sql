-- Migration 0009: Rider Shifts/Attendance, Offers Engine, Customer Saved Addresses, and compare_at_price
-- Backed up to Neon branch: backup-before-b6-b10-payroll-offers (br-snowy-rice-azk5vhlt)

-- 1. Rider shifts / attendance table
CREATE TABLE IF NOT EXISTS rider_shifts (
  id text PRIMARY KEY,
  rider_id text NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'completed'
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_minutes integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rider_shifts_rider_id_idx ON rider_shifts(rider_id);
CREATE INDEX IF NOT EXISTS rider_shifts_status_idx ON rider_shifts(status);
CREATE INDEX IF NOT EXISTS rider_shifts_started_at_idx ON rider_shifts(started_at);

-- 2. Offers & Promotions table
CREATE TABLE IF NOT EXISTS offers (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'percent', -- 'bogo' | 'percent' | 'fixed' | 'free_delivery' | 'bundle'
  scope text NOT NULL DEFAULT 'all', -- 'all' | 'category' | 'brand' | 'product' | 'variant'
  scope_id text,
  discount_value integer NOT NULL DEFAULT 0, -- percent or paisa
  min_order_amount integer NOT NULL DEFAULT 0, -- paisa
  banner_url text,
  heading text,
  description text,
  priority integer NOT NULL DEFAULT 0,
  stackable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_slug_idx ON offers(slug);
CREATE INDEX IF NOT EXISTS offers_active_idx ON offers(active);
CREATE INDEX IF NOT EXISTS offers_type_idx ON offers(type);
CREATE INDEX IF NOT EXISTS offers_scope_idx ON offers(scope, scope_id);

-- 3. Customer Saved Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home', -- 'Home' | 'Work' | 'Other'
  address text NOT NULL,
  city text NOT NULL DEFAULT 'Butwal',
  landmark text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  is_default boolean NOT NULL DEFAULT false,
  contact_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS customer_addresses_is_default_idx ON customer_addresses(is_default);

-- 4. Original-price strikethrough (compare_at_price)
ALTER TABLE liquor_variants ADD COLUMN IF NOT EXISTS compare_at_price integer;
ALTER TABLE grocery_variants ADD COLUMN IF NOT EXISTS compare_at_price integer;
