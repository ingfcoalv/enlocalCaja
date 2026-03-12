-- Migration: Add quotes module tables (quotes, quote_items, quote_emails, quote_activities)

-- ─── Quotes (Cotizaciones) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" integer NOT NULL,
	"series" text DEFAULT 'COT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_quote_id" uuid,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"customer_rfc" text,
	"customer_address" text,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_days" integer DEFAULT 30 NOT NULL,
	"valid_until" timestamp with time zone,
	"conditions" text,
	"notes" text,
	"terms_and_conditions" text,
	"sales_person_name" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_name" text,
	"follow_up_date" timestamp with time zone,
	"follow_up_notes" text,
	"converted_to_ticket_id" uuid,
	"converted_to_remission_id" uuid,
	"converted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejected_reason" text,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"cloud_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Quote Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"item_type" text DEFAULT 'product' NOT NULL,
	"product_id" uuid,
	"service_id" uuid,
	"item_name" text NOT NULL,
	"item_description" text,
	"item_sku" text,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0.1600' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"group_name" text,
	"is_optional" boolean DEFAULT false NOT NULL,
	"sat_code" text,
	"sat_unit" text DEFAULT 'E48' NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Quote Emails (historial de envios) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "quote_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"sent_to" text NOT NULL,
	"sent_cc" text,
	"subject" text NOT NULL,
	"body" text,
	"attached_pdf" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_by" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Quote Activities (timeline de actividad) ────────────────────────────

CREATE TABLE IF NOT EXISTS "quote_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"metadata" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Foreign Keys ────────────────────────────────────────────────────────

DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_emails" ADD CONSTRAINT "quote_emails_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
