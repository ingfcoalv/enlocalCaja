import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core';
import { categories } from './products';
export const services = pgTable('services', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    durationMinutes: integer('duration_minutes'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    satCode: text('sat_code'),
    satUnit: text('sat_unit'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=services.js.map