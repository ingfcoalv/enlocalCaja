-- Migration: Add remissions module tables, customer credit fields, product fiscal fields, price lists, invoice links
-- Changes from initial schema (0000)

-- ─── New tables: price_lists, product_prices ────────────────────────────

CREATE TABLE IF NOT EXISTS "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── New table: invoice_links ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_invoice_id" uuid NOT NULL,
	"cfdi_invoice_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_links" ADD CONSTRAINT "invoice_links_sale_invoice_id_invoices_id_fk" FOREIGN KEY ("sale_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_links" ADD CONSTRAINT "invoice_links_cfdi_invoice_id_invoices_id_fk" FOREIGN KEY ("cfdi_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Customers: add new columns ─────────────────────────────────────────

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cellphone" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_name" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "price_list_id" uuid REFERENCES "price_lists"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_discount" numeric(5, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_days" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_balance" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_status" text DEFAULT 'good' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "person_type" text DEFAULT 'fisica' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "codigo_postal_fiscal" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email_facturas" text;
--> statement-breakpoint

-- ─── Products: add fiscal columns ────────────────────────────────────────

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cost" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "objeto_impuesto" text DEFAULT '02' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ieps_rate" numeric(5, 4) DEFAULT '0' NOT NULL;
--> statement-breakpoint

-- Update sat_code default for products (existing rows without sat_code get default)
ALTER TABLE "products" ALTER COLUMN "sat_code" SET DEFAULT '01010101';
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "sat_code" SET NOT NULL;
--> statement-breakpoint
UPDATE "products" SET "sat_code" = '01010101' WHERE "sat_code" IS NULL;
--> statement-breakpoint

-- ─── Remission Notes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remission_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" integer NOT NULL,
	"series" text DEFAULT 'NR' NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_rfc" text,
	"payment_type" text NOT NULL,
	"credit_days" integer,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ticket_id" uuid,
	"delivered_by" uuid,
	"delivered_at" timestamp with time zone,
	"received_by" text,
	"received_id_doc" text,
	"signature_url" text,
	"prepared_by" uuid,
	"prepared_at" timestamp with time zone,
	"delivery_address" text,
	"delivery_notes" text,
	"internal_notes" text,
	"created_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"cloud_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_notes" ADD CONSTRAINT "remission_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_notes" ADD CONSTRAINT "remission_notes_ticket_id_invoices_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Remission Note Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remission_note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remission_note_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0.1600' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"quantity_prepared" numeric(12, 4) DEFAULT '0' NOT NULL,
	"quantity_delivered" numeric(12, 4) DEFAULT '0' NOT NULL,
	"quantity_returned" numeric(12, 4) DEFAULT '0' NOT NULL,
	"sat_code" text,
	"sat_unit" text DEFAULT 'E48' NOT NULL,
	"inventory_deducted" boolean DEFAULT false NOT NULL,
	"inventory_movement_id" uuid,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_note_items" ADD CONSTRAINT "remission_note_items_remission_note_id_remission_notes_id_fk" FOREIGN KEY ("remission_note_id") REFERENCES "public"."remission_notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_note_items" ADD CONSTRAINT "remission_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Remission Returns ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remission_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remission_note_id" uuid NOT NULL,
	"folio" integer NOT NULL,
	"series" text DEFAULT 'DEV' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"return_type" text NOT NULL,
	"reason_category" text NOT NULL,
	"reason" text NOT NULL,
	"total_returned" numeric(12, 2) DEFAULT '0' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"completed_at" timestamp with time zone,
	"ticket_adjusted" boolean DEFAULT false NOT NULL,
	"credit_note_id" uuid,
	"receivable_adjusted" boolean DEFAULT false NOT NULL,
	"cloud_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_returns" ADD CONSTRAINT "remission_returns_remission_note_id_remission_notes_id_fk" FOREIGN KEY ("remission_note_id") REFERENCES "public"."remission_notes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Remission Return Items ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remission_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"remission_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity_requested" numeric(12, 4) NOT NULL,
	"quantity_accepted" numeric(12, 4) DEFAULT '0' NOT NULL,
	"quantity_rejected" numeric(12, 4) DEFAULT '0' NOT NULL,
	"item_status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"product_condition" text,
	"condition_notes" text,
	"restocked_quantity" numeric(12, 4) DEFAULT '0' NOT NULL,
	"inventory_movement_id" uuid,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_refund" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_return_items" ADD CONSTRAINT "remission_return_items_return_id_remission_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."remission_returns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_return_items" ADD CONSTRAINT "remission_return_items_remission_item_id_remission_note_items_id_fk" FOREIGN KEY ("remission_item_id") REFERENCES "public"."remission_note_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Receivables (Cuentas por Cobrar) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"remission_note_id" uuid,
	"invoice_id" uuid,
	"original_amount" numeric(12, 2) NOT NULL,
	"adjustments" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"issued_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"last_payment_date" timestamp with time zone,
	"days_overdue" integer DEFAULT 0 NOT NULL,
	"cloud_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivables" ADD CONSTRAINT "receivables_ticket_id_invoices_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivables" ADD CONSTRAINT "receivables_remission_note_id_remission_notes_id_fk" FOREIGN KEY ("remission_note_id") REFERENCES "public"."remission_notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivables" ADD CONSTRAINT "receivables_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Receivable Payments (Cobros) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "receivable_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receivable_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference" text,
	"payment_complement_id" uuid,
	"complement_emitted" boolean DEFAULT false NOT NULL,
	"received_by" uuid NOT NULL,
	"notes" text,
	"cloud_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivable_payments" ADD CONSTRAINT "receivable_payments_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ─── Remission Status History ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remission_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remission_note_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_by_name" text NOT NULL,
	"changed_by_role" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remission_status_history" ADD CONSTRAINT "remission_status_history_remission_note_id_remission_notes_id_fk" FOREIGN KEY ("remission_note_id") REFERENCES "public"."remission_notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
