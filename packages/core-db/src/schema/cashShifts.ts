import { pgTable, uuid, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core'

export const cashShifts = pgTable('cash_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  openingAmount: numeric('opening_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  closingAmount: numeric('closing_amount', { precision: 12, scale: 2 }),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }),
  difference: numeric('difference', { precision: 12, scale: 2 }),
  status: text('status').notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  registerId: uuid('register_id'),
  // Summary columns (populated on shift close)
  totalSales: numeric('total_sales', { precision: 12, scale: 2 }).default('0'),
  totalCashSales: numeric('total_cash_sales', { precision: 12, scale: 2 }).default('0'),
  totalCardSales: numeric('total_card_sales', { precision: 12, scale: 2 }).default('0'),
  totalTransferSales: numeric('total_transfer_sales', { precision: 12, scale: 2 }).default('0'),
  totalDeposits: numeric('total_deposits', { precision: 12, scale: 2 }).default('0'),
  totalWithdrawals: numeric('total_withdrawals', { precision: 12, scale: 2 }).default('0'),
  transactionsCount: integer('transactions_count').default(0),
})

export type CashShift = typeof cashShifts.$inferSelect
export type NewCashShift = typeof cashShifts.$inferInsert
