import { pgTable, uuid, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { products } from './products'

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
  stock: integer('stock').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ProductVariant = typeof productVariants.$inferSelect
export type NewProductVariant = typeof productVariants.$inferInsert
