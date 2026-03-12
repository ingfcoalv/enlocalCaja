-- 0024: Add max_discount_percent to users table for discount authorization limits
-- Default 100 means unrestricted; admins set lower values for cashiers
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_discount_percent numeric(5,2) DEFAULT 100;
