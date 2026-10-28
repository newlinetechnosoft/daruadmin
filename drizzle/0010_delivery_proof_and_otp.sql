-- Migration 0010: Proof of Delivery (Photo & Customer OTP)
-- Order delivery verification: customer receives OTP upon order creation/dispatch; rider confirms delivery via OTP or photo proof

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_photo_url text;

CREATE INDEX IF NOT EXISTS orders_delivery_otp_idx ON orders(delivery_otp);
