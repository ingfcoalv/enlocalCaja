import { pgTable, uuid, text, boolean, numeric, timestamp } from 'drizzle-orm/pg-core'
import { invoices } from './invoices'

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  method: text('method').notNull().default('cash'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  reference: text('reference'),
  tip: numeric('tip', { precision: 12, scale: 2 }).notNull().default('0'),
  shiftId: uuid('shift_id'),
  userId: uuid('user_id'),
  customerId: uuid('customer_id'),
  isAbono: boolean('is_abono').notNull().default(false),
  registerId: uuid('register_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
