-- Online orders from marketplace
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cloud_status TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_type_cloud TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Ensure columns exist even without mod-invoicing
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Prevent duplicate online orders from cloud
CREATE UNIQUE INDEX IF NOT EXISTS invoices_cloud_id_unique ON invoices (cloud_id) WHERE cloud_id IS NOT NULL;

-- Ensure payments table exists for online order delivery
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  method text NOT NULL DEFAULT 'cash',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  tip numeric(12,2) NOT NULL DEFAULT 0,
  shift_id uuid,
  user_id uuid,
  customer_id uuid,
  is_abono boolean NOT NULL DEFAULT false,
  register_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
