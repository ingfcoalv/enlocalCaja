import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull().default('area'),
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Section = typeof sections.$inferSelect
export type NewSection = typeof sections.$inferInsert
