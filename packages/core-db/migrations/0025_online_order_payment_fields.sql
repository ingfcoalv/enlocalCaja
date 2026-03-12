-- 0025: Add payment_method_cloud, payment_status_cloud, delivery_address to invoices
-- and modifier_selections, special_instructions to invoice_items for online orders

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method_cloud text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status_cloud text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_number text;

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS special_instructions text;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS modifier_selections jsonb;
