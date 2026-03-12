import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email'),
    pinHash: text('pin_hash').notNull(),
    role: text('role').notNull().default('staff'),
    color: text('color'),
    photo: text('photo'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=users.js.map