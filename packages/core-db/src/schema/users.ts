import { pgTable, uuid, text, boolean, timestamp, numeric } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  pinHash: text('pin_hash').notNull(),
  role: text('role').notNull().default('staff'),
  color: text('color'),
  photo: text('photo'),
  active: boolean('active').notNull().default(true),
  maxDiscountPercent: numeric('max_discount_percent', { precision: 5, scale: 2 }).notNull().default('100'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
