import { pgTable, uuid, text, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';
export const priceLists = pgTable('price_lists', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const productPrices = pgTable('product_prices', {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    priceListId: uuid('price_list_id').notNull().references(() => priceLists.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=priceLists.js.map