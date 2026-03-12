-- 0009_add_users_cloud_id.sql
-- Add cloud_id column to users table for syncing cashiers from cloud
-- Add unique indexes on cloud_id for all sync-able entities

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cloud_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_cloud_id"
  ON "users" ("cloud_id") WHERE cloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_cloud_id"
  ON "categories" ("cloud_id") WHERE cloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_cloud_id"
  ON "products" ("cloud_id") WHERE cloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_customers_cloud_id"
  ON "customers" ("cloud_id") WHERE cloud_id IS NOT NULL;
