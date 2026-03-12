import { pgTable, uuid, text, boolean, numeric, timestamp } from 'drizzle-orm/pg-core'
import { invoices } from './invoices'

export const posReturns = pgTable('pos_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  ticketNumber: text('ticket_number'),
  reason: text('reason').notNull(),
  totalRefunded: numeric('total_refunded', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('completed'),
  userId: uuid('user_id'),
  notes: text('notes'),
  registerId: uuid('register_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const posReturnItems = pgTable('pos_return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnId: uuid('return_id').notNull().references(() => posReturns.id, { onDelete: 'cascade' }),
  invoiceItemId: uuid('invoice_item_id'),
  productId: uuid('product_id'),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  totalRefund: numeric('total_refund', { precision: 12, scale: 2 }).notNull().default('0'),
  restocked: boolean('restocked').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PosReturn = typeof posReturns.$inferSelect
export type NewPosReturn = typeof posReturns.$inferInsert
export type PosReturnItem = typeof posReturnItems.$inferSelect
export type NewPosReturnItem = typeof posReturnItems.$inferInsert
