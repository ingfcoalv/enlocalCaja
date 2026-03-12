import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityLocalId: text('entity_local_id').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  attempts: integer('attempts').notNull().default(0),
  status: text('status', { enum: ['pending', 'synced', 'failed'] }).notNull().default('pending'),
  errorMessage: text('error_message'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sync_queue_status_retry').on(table.status, table.nextRetryAt),
])

export type SyncQueueEntry = typeof syncQueue.$inferSelect
export type NewSyncQueueEntry = typeof syncQueue.$inferInsert
