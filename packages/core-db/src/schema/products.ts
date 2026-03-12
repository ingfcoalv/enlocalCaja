import { pgTable, uuid, text, boolean, timestamp, numeric, integer, jsonb } from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  parentId: uuid('parent_id'),
  active: boolean('active').notNull().default(true),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
  sku: text('sku'),
  barcode: text('barcode'),
  satCode: text('sat_code').notNull().default('01010101'),
  satUnit: text('sat_unit').notNull().default('E48'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
  objetoImpuesto: text('objeto_impuesto').notNull().default('02'),
  iepsRate: numeric('ieps_rate', { precision: 5, scale: 4 }).notNull().default('0'),
  active: boolean('active').notNull().default(true),
  cloudId: text('cloud_id'),

  // Wholesale / retail
  wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }),
  wholesaleEnabled: boolean('wholesale_enabled').notNull().default(false),
  wholesaleTiers: jsonb('wholesale_tiers').$type<{ minQty: number; price: number }[]>(),

  // Sell by weight / bulk
  sellByWeight: boolean('sell_by_weight').notNull().default(false),

  // Units & conversion
  stockUnit: text('stock_unit'),
  saleUnit: text('sale_unit'),
  conversionFactor: numeric('conversion_factor', { precision: 10, scale: 4 }),

  // Stock
  currentStock: numeric('current_stock', { precision: 12, scale: 4 }).default('0'),
  minStock: numeric('min_stock', { precision: 12, scale: 4 }).default('0'),

  // Extra metadata
  brand: text('brand'),
  model: text('model'),
  hasVariants: boolean('has_variants').notNull().default(false),
  hiddenFromMarketplace: boolean('hidden_from_marketplace').notNull().default(false),
  source: text('source', { enum: ['local', 'cloud', 'import'] }).notNull().default('local'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
