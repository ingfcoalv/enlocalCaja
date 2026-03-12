-- Add missing unit/conversion columns that were in Drizzle schema but never migrated
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS conversion_factor numeric(10,4);
