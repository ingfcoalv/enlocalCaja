import { pgTable, uuid, text, boolean, timestamp, date, numeric, integer } from 'drizzle-orm/pg-core';
import { priceLists } from './priceLists';
export const customers = pgTable('customers', {
    id: uuid('id').primaryKey().defaultRandom(),
    // Datos del cliente
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    cellphone: text('cellphone'),
    contactName: text('contact_name'),
    priceListId: uuid('price_list_id').references(() => priceLists.id, { onDelete: 'set null' }),
    defaultDiscount: numeric('default_discount', { precision: 5, scale: 2 }).notNull().default('0'),
    // Datos comerciales / crédito
    creditEnabled: boolean('credit_enabled').notNull().default(false),
    creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull().default('0'),
    creditDays: integer('credit_days').notNull().default(0),
    paymentTerms: text('payment_terms'),
    creditBalance: numeric('credit_balance', { precision: 12, scale: 2 }).notNull().default('0'),
    creditStatus: text('credit_status').notNull().default('good'),
    // Datos fiscales
    personType: text('person_type').notNull().default('fisica'),
    razonSocial: text('razon_social'),
    rfc: text('rfc'),
    regimenFiscal: text('regimen_fiscal'),
    usoCfdi: text('uso_cfdi').notNull().default('G03'),
    codigoPostalFiscal: text('codigo_postal_fiscal'),
    emailFacturas: text('email_facturas'),
    // Otros
    address: text('address'),
    birthday: date('birthday'),
    notes: text('notes'),
    cloudId: text('cloud_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=customers.js.map