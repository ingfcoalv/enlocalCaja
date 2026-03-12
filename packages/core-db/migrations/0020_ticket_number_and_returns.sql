-- Add ticket_number to invoices for human-readable POS ticket IDs (e.g. 20260306-0001)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ticket_number text;
CREATE INDEX IF NOT EXISTS invoices_ticket_number_idx ON invoices(ticket_number);

-- POS returns (simplified returns for direct POS sales)
CREATE TABLE IF NOT EXISTS pos_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  ticket_number text,
  reason text NOT NULL,
  total_refunded numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  user_id uuid,
  notes text,
  register_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES pos_returns(id) ON DELETE CASCADE,
  invoice_item_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  quantity numeric(12,4) NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_refund numeric(12,2) NOT NULL DEFAULT 0,
  restocked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
