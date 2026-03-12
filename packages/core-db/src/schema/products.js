import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core';
export const categories = pgTable('categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    parentId: uuid('parent_id'),
    active: boolean('active').notNull().default(true),
    cloudId: text('cloud_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
    sku: text('sku'),
    barcode: text('barcode'),
    satCode: text('sat_code').notNull().default('01010101'),
    satUnit: text('sat_unit').notNull().default('E48'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
    objetoImpuesto: text('objeto_impuesto').notNull().default('02'),
    iepsRate: numeric('ieps_rate', { precision: 5, scale: 4 }).notNull().default('0'),
    active: boolean('active').notNull().default(true),
    cloudId: text('cloud_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=products.js.map