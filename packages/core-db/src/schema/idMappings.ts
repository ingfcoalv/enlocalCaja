import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const idMappings = pgTable('id_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: text('local_id').notNull(),
  cloudId: text('cloud_id').notNull(),
  entityType: text('entity_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_id_mappings_entity_local').on(table.entityType, table.localId),
  index('idx_id_mappings_entity_cloud').on(table.entityType, table.cloudId),
])

export type IdMapping = typeof idMappings.$inferSelect
export type NewIdMapping = typeof idMappings.$inferInsert
