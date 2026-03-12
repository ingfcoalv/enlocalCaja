import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
export const suppliers = pgTable('suppliers', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    rfc: text('rfc'),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=suppliers.js.map