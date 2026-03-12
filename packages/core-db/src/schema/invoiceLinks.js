import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';
export const invoiceLinks = pgTable('invoice_links', {
    id: uuid('id').primaryKey().defaultRandom(),
    saleInvoiceId: uuid('sale_invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    cfdiInvoiceId: uuid('cfdi_invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=invoiceLinks.js.map