import { pgTable, bigserial, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core'

export const changeJournal = pgTable('change_journal', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>(),
  userId: text('user_id'),
  synced: boolean('synced').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ChangeJournalEntry = typeof changeJournal.$inferSelect
export type NewChangeJournalEntry = typeof changeJournal.$inferInsert
