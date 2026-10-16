-- Migration 0008: Pricing, Promotions, Coupon Redemptions, Dealer Settlements & Rider Settlements
-- Backed up to Neon branch: backup-before-module-4-pricing-settlements (br-silent-sun-azrq1w6f)

-- 1. Coupon table enhancements
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_customer_limit integer NOT NULL DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_order_only boolean NOT NULL DEFAULT false;

-- 2. Coupon redemptions table (audit and race-safe per-customer tracking)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id text PRIMARY KEY,
  coupon_id text NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  coupon_code text NOT NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  customer_id text REFERENCES "user"(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  order_total integer NOT NULL, -- paisa
  discount_amount integer NOT NULL, -- paisa
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_id_idx ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_order_id_idx ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_customer_id_idx ON coupon_redemptions(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_coupon_order_uniq_idx ON coupon_redemptions(coupon_id, order_id) WHERE order_id IS NOT NULL;

-- 3. Rider payroll formula enhancements on riders table
ALTER TABLE riders ADD COLUMN IF NOT EXISTS base_salary integer NOT NULL DEFAULT 0;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS per_drop_rate integer NOT NULL DEFAULT 5000;

-- 4. Dealer settlements table (for batch settling delivered lines, with public slug and vouchers)
CREATE TABLE IF NOT EXISTS dealer_settlements (
  id text PRIMARY KEY,
  dealer_id text NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  dealer_name text NOT NULL,
  voucher_no text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  gross_amount integer NOT NULL, -- snapshotted dealer cost in paisa
  tds_rate integer NOT NULL DEFAULT 0, -- basis points or percentage
  tds_amount integer NOT NULL DEFAULT 0, -- paisa
  net_amount integer NOT NULL, -- paisa
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'paid' | 'disputed' | 'reversed'
  payment_method text, -- 'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'cheque'
  payment_reference text,
  paid_at timestamp with time zone,
  paid_by text,
  notes text,
  proof_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  journal_entry_id text REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dealer_settlements_dealer_id_idx ON dealer_settlements(dealer_id);
CREATE INDEX IF NOT EXISTS dealer_settlements_status_idx ON dealer_settlements(status);
CREATE INDEX IF NOT EXISTS dealer_settlements_created_at_idx ON dealer_settlements(created_at);

-- 5. Rider settlements table enhancements
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS voucher_no text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS base_salary_amount integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS per_drop_amount integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS commission_amount integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS gross_earnings integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS advances_deducted integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS cash_shortage_deducted integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS cash_held_deducted integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS net_payout integer NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS proof_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS journal_entry_id text REFERENCES journal_entries(id) ON DELETE SET NULL;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS settlements_voucher_no_idx ON settlements(voucher_no);
CREATE INDEX IF NOT EXISTS settlements_slug_idx ON settlements(slug);

-- 6. Seed default shipping zones (Butwal, Tilottama, Siddharthanagar)
INSERT INTO shipping_zones (id, name, areas, delivery_charge, eta_minutes, active, courier, created_at)
VALUES 
  ('zone_butwal', 'Butwal', 'Traffic Chowk, Golpark, Devinagar, Sukhanagar, Deepnagar, Kalikanagar', 15000, 45, true, 'in-house', now()),
  ('zone_tilottama', 'Tilottama', 'Manigram, Drivertole, Kotihawa, Shankarnagar, Bhalwari', 15000, 45, true, 'in-house', now()),
  ('zone_siddharthanagar', 'Siddharthanagar (Bhairahawa)', 'Bank Road, Buspark, Narayanthan, Gallamandi, Airport Road', 15000, 60, true, 'in-house', now())
ON CONFLICT (id) DO UPDATE SET
  delivery_charge = EXCLUDED.delivery_charge,
  active = EXCLUDED.active;
