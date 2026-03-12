import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
export const syncState = pgTable('sync_state', {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=syncState.js.map