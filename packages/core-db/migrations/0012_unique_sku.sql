-- Deduplicate existing non-empty SKUs before adding unique constraint
-- Appends "-DUP-N" suffix to duplicates (keeps the oldest row untouched)
DO $$
DECLARE
  dup RECORD;
  r RECORD;
  i INT;
BEGIN
  FOR dup IN
    SELECT sku FROM products
    WHERE sku IS NOT NULL AND sku != ''
    GROUP BY sku HAVING COUNT(*) > 1
  LOOP
    i := 1;
    FOR r IN
      SELECT id FROM products
      WHERE sku = dup.sku
      ORDER BY created_at ASC
      OFFSET 1  -- skip the first (oldest) row
    LOOP
      UPDATE products SET sku = dup.sku || '-DUP-' || i WHERE id = r.id;
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_sku_unique"
  ON products (sku) WHERE sku IS NOT NULL AND sku != '';
