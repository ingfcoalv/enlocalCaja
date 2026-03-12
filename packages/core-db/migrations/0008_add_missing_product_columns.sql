-- Add missing product columns that exist in Drizzle schema but not in DB
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price numeric(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_tiers jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_from_marketplace boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'local';
