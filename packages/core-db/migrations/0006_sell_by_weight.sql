-- Add sell_by_weight flag to products for bulk/weight-based selling
ALTER TABLE products ADD COLUMN IF NOT EXISTS sell_by_weight boolean NOT NULL DEFAULT false;
