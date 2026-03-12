-- 0005_cloud_sync_integration.sql
-- Adds sync_queue, id_mappings, product_variants tables
-- Extends products with wholesale/retail columns

-- ============================================================
-- sync_queue: Cola de sincronización con backoff exponencial
-- ============================================================
CREATE TABLE IF NOT EXISTS "sync_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" text NOT NULL,
  "entity_local_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "error_message" text,
  "next_retry_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sync_queue_status_retry"
  ON "sync_queue" ("status", "next_retry_at");

-- ============================================================
-- id_mappings: Mapeo local_id ↔ cloud_id por entity_type
-- ============================================================
CREATE TABLE IF NOT EXISTS "id_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "local_id" text NOT NULL,
  "cloud_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_id_mappings_entity_local"
  ON "id_mappings" ("entity_type", "local_id");

CREATE INDEX IF NOT EXISTS "idx_id_mappings_entity_cloud"
  ON "id_mappings" ("entity_type", "cloud_id");

-- ============================================================
-- product_variants: Variantes de producto (talla, color, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sku" text,
  "barcode" text,
  "price" numeric(12, 2) NOT NULL DEFAULT '0',
  "cost" numeric(12, 2) NOT NULL DEFAULT '0',
  "stock" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================
-- ALTER products: Agregar columnas para wholesale/retail/cloud
-- ============================================================
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_price" numeric(12, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_tiers" jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_unit" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_unit" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "conversion_factor" numeric(10, 4);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "has_variants" boolean NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hidden_from_marketplace" boolean NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'local';
