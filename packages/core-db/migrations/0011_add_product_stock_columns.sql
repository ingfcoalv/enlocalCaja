-- Add current_stock and min_stock columns that exist in Drizzle schema but were never migrated
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock numeric(12,4) DEFAULT '0';
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock numeric(12,4) DEFAULT '0';
