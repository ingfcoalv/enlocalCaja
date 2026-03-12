import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
export const roles = pgTable('roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    permissions: jsonb('permissions').$type().notNull().default([]),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const userRoles = pgTable('user_roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
});
//# sourceMappingURL=roles.js.map