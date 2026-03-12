-- Multi-Caja support: cash movements, register sequences, shift summary fields

-- 1. Cash Movements table (deposits, withdrawals, transfers between registers)
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  register_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,                 -- 'deposit' | 'withdrawal'
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,               -- 'change_fund' | 'expense' | 'transfer_out' | 'transfer_in' | 'correction' | 'other'
  notes text,
  authorized_by uuid,                 -- user who authorized a withdrawal (if required)
  related_movement_id uuid,           -- links paired transfer movements (withdrawal <-> deposit)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(register_id);

-- 2. Register sequences (per-register ticket folio series)
CREATE TABLE IF NOT EXISTS register_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL UNIQUE,
  series text NOT NULL,               -- 'C1', 'C2', etc.
  last_folio integer NOT NULL DEFAULT 0
);

-- 3. Shift summary columns (populated on shift close)
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_cash_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_card_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_transfer_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_deposits numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_withdrawals numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS transactions_count integer DEFAULT 0;
