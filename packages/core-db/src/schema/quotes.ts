import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { products } from './products'
import { services } from './services'

// ─── Cotizaciones ──────────────────────────────────────────────
export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  folio: integer('folio').notNull(),
  series: text('series').notNull().default('COT'),
  version: integer('version').notNull().default(1),
  parentQuoteId: uuid('parent_quote_id'),

  // Cliente (snapshot)
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  customerRfc: text('customer_rfc'),
  customerAddress: text('customer_address'),

  // Totales
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),

  // Estado: draft, sent, accepted, rejected, expired, superseded, cancelled, converted
  status: text('status').notNull().default('draft'),

  // Vigencia
  validDays: integer('valid_days').notNull().default(30),
  validUntil: timestamp('valid_until', { withTimezone: true }),

  // Condiciones y notas
  conditions: text('conditions'),
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),

  // Vendedor
  salesPersonName: text('sales_person_name'),

  // Template
  isTemplate: boolean('is_template').notNull().default(false),
  templateName: text('template_name'),

  // Seguimiento
  followUpDate: timestamp('follow_up_date', { withTimezone: true }),
  followUpNotes: text('follow_up_notes'),

  // Conversion
  convertedToTicketId: uuid('converted_to_ticket_id'),
  convertedToRemissionId: uuid('converted_to_remission_id'),
  convertedAt: timestamp('converted_at', { withTimezone: true }),

  // Auditoria
  createdBy: uuid('created_by').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  cancelledBy: uuid('cancelled_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Items de Cotización ───────────────────────────────────────
export const quoteItems = pgTable('quote_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),

  // Tipo: product, service, custom
  itemType: text('item_type').notNull().default('product'),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),

  // Snapshot
  itemName: text('item_name').notNull(),
  itemDescription: text('item_description'),
  itemSku: text('item_sku'),

  // Valores
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),

  // Agrupacion
  groupName: text('group_name'),
  isOptional: boolean('is_optional').notNull().default(false),

  // SAT
  satCode: text('sat_code'),
  satUnit: text('sat_unit').notNull().default('E48'),

  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Historial de Emails ───────────────────────────────────────
export const quoteEmails = pgTable('quote_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  sentTo: text('sent_to').notNull(),
  sentCc: text('sent_cc'),
  subject: text('subject').notNull(),
  body: text('body'),
  attachedPdf: boolean('attached_pdf').notNull().default(true),
  status: text('status').notNull().default('sent'),
  errorMessage: text('error_message'),
  sentBy: uuid('sent_by').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Timeline de Actividad ─────────────────────────────────────
export const quoteActivities = pgTable('quote_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),

  // Tipo: created, updated, sent, resent, accepted, rejected, cancelled, expired,
  //       new_version, converted, follow_up, note, call, meeting
  activityType: text('activity_type').notNull(),
  description: text('description').notNull(),
  metadata: text('metadata'),

  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Types ─────────────────────────────────────────────────────
export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type QuoteItem = typeof quoteItems.$inferSelect
export type NewQuoteItem = typeof quoteItems.$inferInsert
export type QuoteEmail = typeof quoteEmails.$inferSelect
export type NewQuoteEmail = typeof quoteEmails.$inferInsert
export type QuoteActivity = typeof quoteActivities.$inferSelect
export type NewQuoteActivity = typeof quoteActivities.$inferInsert
