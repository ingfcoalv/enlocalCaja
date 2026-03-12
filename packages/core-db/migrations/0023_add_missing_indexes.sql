-- 0023: Add missing indexes for common query patterns

-- Remission notes: frequently filtered by status and customer
CREATE INDEX IF NOT EXISTS idx_remission_notes_status ON remission_notes(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_remission_notes_customer_id ON remission_notes(customer_id);
--> statement-breakpoint

-- Products: filtered by category
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
--> statement-breakpoint

-- Payments: joined on invoice_id and shift_id
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payments_shift_id ON payments(shift_id);
--> statement-breakpoint

-- Cash shifts: filtered by status and register
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cash_shifts_register_id ON cash_shifts(register_id);
--> statement-breakpoint

-- POS returns: joined on invoice_id
CREATE INDEX IF NOT EXISTS idx_pos_returns_invoice_id ON pos_returns(invoice_id);
--> statement-breakpoint

-- Receivables: filtered by status and customer
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_receivables_customer_id ON receivables(customer_id);
--> statement-breakpoint

-- Invoice relations: lookup by invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_relations_invoice_id ON invoice_relations(invoice_id);
--> statement-breakpoint

-- Invoice payment details: lookup by invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_payment_details_invoice_id ON invoice_payment_details(invoice_id);
--> statement-breakpoint

-- Carta porte: lookup by invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_carta_porte_invoice_id ON invoice_carta_porte(invoice_id);
