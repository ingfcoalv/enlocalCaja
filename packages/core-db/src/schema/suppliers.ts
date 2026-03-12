import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core'

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
  // Commercial profile (mod-payables)
  paymentTerms: text('payment_terms'),
  defaultCreditDays: integer('default_credit_days'),
  defaultPaymentMethod: text('default_payment_method'),
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),
  bankClabe: text('bank_clabe'),
  bankReference: text('bank_reference'),
  contactEmail: text('contact_email'),
  currency: text('currency').default('MXN'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Supplier = typeof suppliers.$inferSelect
export type NewSupplier = typeof suppliers.$inferInsert
