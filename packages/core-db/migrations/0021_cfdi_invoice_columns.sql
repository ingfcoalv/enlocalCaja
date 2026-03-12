-- 0021: Add missing CFDI 4.0 columns to invoices and invoice_items
-- These columns are defined in the Drizzle schema but missing from SQL migrations

-- ─── invoices: receptor fields ───────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_rfc text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_nombre text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_regimen text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_cp text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_email text;
--> statement-breakpoint

-- ─── invoices: currency / exchange ───────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6);
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_conditions text;
--> statement-breakpoint

-- ─── invoices: tax breakdown fields ──────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_discounts numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_16 numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_8 numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_0 numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_exempt numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_ieps numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_transferred numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_retained numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_isr_retained numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_retained numeric(12,2) NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ─── invoices: CFDI relations ────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_cfdi_type text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
--> statement-breakpoint

-- ─── invoices: source tracking ───────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos';
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_id uuid;
--> statement-breakpoint

-- ─── invoices: timbrado / XML fields ─────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xml_original_chain text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_certificate_number text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_stamp_date text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_digital_stamp text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issuer_seal text;
--> statement-breakpoint

-- ─── invoices: cancellation ──────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_uuid text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_response text;
--> statement-breakpoint

-- ─── invoices: global invoice ────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_periodicity text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_month text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_year text;
--> statement-breakpoint

-- ─── invoices: carta porte / pdf ─────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS has_carta_porte boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_generated boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- ─── invoices: audit fields ──────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS observations text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS error_message text;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emitted_by uuid;
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emitted_at timestamptz;
--> statement-breakpoint

-- ─── invoice_items: CFDI 4.0 fields ─────────────────────────
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit text;
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS objeto_imp text;
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS no_identificacion text;
--> statement-breakpoint

-- IVA trasladado
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_base numeric(12,2);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_rate numeric(8,6);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_amount numeric(12,2);
--> statement-breakpoint

-- IEPS trasladado
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_base numeric(12,2);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_rate numeric(8,6);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_amount numeric(12,2);
--> statement-breakpoint

-- IVA retenido
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_base numeric(12,2);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_rate numeric(8,6);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_amount numeric(12,2);
--> statement-breakpoint

-- ISR retenido
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_base numeric(12,2);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_rate numeric(8,6);
--> statement-breakpoint
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_amount numeric(12,2);
