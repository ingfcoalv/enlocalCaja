import { pgTable, uuid, text, timestamp, numeric, integer } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { products } from './products';
import { services } from './services';
export const invoices = pgTable('invoices', {
    id: uuid('id').primaryKey().defaultRandom(),
    series: text('series'),
    folio: integer('folio'),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    type: text('type').notNull().default('I'),
    status: text('status').notNull().default('draft'),
    useCfdi: text('uso_cfdi'),
    paymentMethod: text('payment_method'),
    paymentForm: text('payment_form'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('MXN'),
    uuidFiscal: text('uuid_fiscal'),
    xmlContent: text('xml_content'),
    pdfUrl: text('pdf_url'),
    stampedAt: timestamp('stamped_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    source: text('source').notNull().default('pos'),
    observations: text('observations'),
    relatedInvoiceId: uuid('related_invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    cloudId: text('cloud_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const invoiceItems = pgTable('invoice_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    satCode: text('sat_code'),
    satUnit: text('sat_unit'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
});
//# sourceMappingURL=invoices.js.map