import { pgTable, uuid, text, boolean, timestamp, numeric, integer, index, jsonb } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { products } from './products'
import { services } from './services'

// ─── Facturas CFDI 4.0 ──────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Folio y serie
  series: text('series'),
  folio: integer('folio'),
  // Tipo: I=Ingreso, E=Egreso(NC), P=Pago, T=Traslado(CartaPorte)
  type: text('type').notNull().default('I'),
  // Status: draft, stamped, cancel_pending, cancelled, error
  status: text('status').notNull().default('draft'),

  // ─── Receptor ──────────────────────────────────────────────
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  receptorRfc: text('receptor_rfc'),
  receptorNombre: text('receptor_nombre'),
  receptorRegimen: text('receptor_regimen'),
  useCfdi: text('uso_cfdi'),
  receptorCp: text('receptor_cp'),
  receptorEmail: text('receptor_email'),

  // ─── Moneda y tipo de cambio ──────────────────────────────
  currency: text('currency').notNull().default('MXN'),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }),

  // ─── Método y forma de pago ───────────────────────────────
  paymentMethod: text('payment_method'),    // PUE | PPD
  paymentForm: text('payment_form'),        // 01, 03, 04, 28, 99...
  paymentConditions: text('payment_conditions'),

  // ─── Montos ───────────────────────────────────────────────
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  totalDiscounts: numeric('total_discounts', { precision: 12, scale: 2 }).notNull().default('0'),
  // Trasladados
  totalIva16: numeric('total_iva_16', { precision: 12, scale: 2 }).notNull().default('0'),
  totalIva8: numeric('total_iva_8', { precision: 12, scale: 2 }).notNull().default('0'),
  totalIva0: numeric('total_iva_0', { precision: 12, scale: 2 }).notNull().default('0'),
  totalIvaExempt: numeric('total_iva_exempt', { precision: 12, scale: 2 }).notNull().default('0'),
  totalIeps: numeric('total_ieps', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTransferred: numeric('total_transferred', { precision: 12, scale: 2 }).notNull().default('0'),
  // Retenidos
  totalIvaRetained: numeric('total_iva_retained', { precision: 12, scale: 2 }).notNull().default('0'),
  totalIsrRetained: numeric('total_isr_retained', { precision: 12, scale: 2 }).notNull().default('0'),
  totalRetained: numeric('total_retained', { precision: 12, scale: 2 }).notNull().default('0'),
  // Legacy compatibility
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),

  // ─── Relación con otro CFDI ───────────────────────────────
  relatedCfdiType: text('related_cfdi_type'),    // 01, 02, 03, 04, 05, 06, 07
  relatedInvoiceId: uuid('related_invoice_id').references((): any => invoices.id, { onDelete: 'set null' }),

  // ─── Origen ───────────────────────────────────────────────
  source: text('source').notNull().default('pos'),
  sourceType: text('source_type'),     // ticket | remission | quote | manual | global
  sourceId: uuid('source_id'),

  // ─── Timbrado / XML ───────────────────────────────────────
  uuidFiscal: text('uuid_fiscal'),
  xmlContent: text('xml_content'),
  xmlOriginalChain: text('xml_original_chain'),
  satCertificateNumber: text('sat_certificate_number'),
  satStampDate: text('sat_stamp_date'),
  satDigitalStamp: text('sat_digital_stamp'),
  issuerSeal: text('issuer_seal'),
  stampedAt: timestamp('stamped_at', { withTimezone: true }),

  // ─── Cancelación ──────────────────────────────────────────
  cancellationReason: text('cancellation_reason'),     // 01, 02, 03, 04
  cancellationUuid: text('cancellation_uuid'),         // UUID sustituto (motivo 01)
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationResponse: text('cancellation_response'),

  // ─── Factura Global ───────────────────────────────────────
  isGlobal: boolean('is_global').notNull().default(false),
  globalPeriodicity: text('global_periodicity'),       // 01=diario, 02=semanal, 03=quincenal, 04=mensual
  globalMonth: text('global_month'),                   // 01-12
  globalYear: text('global_year'),                     // YYYY

  // ─── Carta Porte ──────────────────────────────────────────
  hasCartaPorte: boolean('has_carta_porte').notNull().default(false),

  // ─── PDF ──────────────────────────────────────────────────
  pdfGenerated: boolean('pdf_generated').notNull().default(false),
  pdfUrl: text('pdf_url'),

  // ─── Ticket number (human-readable POS ID: YYYYMMDD-NNNN)
  ticketNumber: text('ticket_number'),

  // ─── Caja / Register ──────────────────────────────────────
  registerId: uuid('register_id'),

  // ─── Online / Marketplace ─────────────────────────────────
  cloudStatus: text('cloud_status'),
  deliveryTypeCloud: text('delivery_type_cloud'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  paymentMethodCloud: text('payment_method_cloud'),
  paymentStatusCloud: text('payment_status_cloud'),
  deliveryAddress: text('delivery_address'),
  orderNumber: text('order_number'),

  // ─── Auditoría ────────────────────────────────────────────
  observations: text('observations'),
  errorMessage: text('error_message'),
  createdBy: uuid('created_by'),
  emittedBy: uuid('emitted_by'),
  emittedAt: timestamp('emitted_at', { withTimezone: true }),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('invoices_type_idx').on(table.type),
  index('invoices_status_idx').on(table.status),
  index('invoices_uuid_fiscal_idx').on(table.uuidFiscal),
  index('invoices_customer_id_idx').on(table.customerId),
  index('invoices_source_type_idx').on(table.sourceType),
])

// ─── Conceptos / Items CFDI 4.0 ─────────────────────────────
export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),

  // Referencia a producto/servicio
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),

  // SAT keys
  satCode: text('sat_code'),                 // ClaveProdServ
  satUnit: text('sat_unit'),                 // ClaveUnidad
  unit: text('unit'),                        // Unidad (texto libre: "Pieza", "Servicio")
  objetoImp: text('objeto_imp'),             // ObjetoImp: 01=No, 02=Si, 03=Si y no obligado
  noIdentificacion: text('no_identificacion'), // SKU / número identificación

  // Datos del concepto
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 6 }).notNull().default('0'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),

  // IVA trasladado
  ivaBase: numeric('iva_base', { precision: 12, scale: 2 }),
  ivaRate: numeric('iva_rate', { precision: 8, scale: 6 }),
  ivaAmount: numeric('iva_amount', { precision: 12, scale: 2 }),

  // IEPS trasladado
  iepsBase: numeric('ieps_base', { precision: 12, scale: 2 }),
  iepsRate: numeric('ieps_rate', { precision: 8, scale: 6 }),
  iepsAmount: numeric('ieps_amount', { precision: 12, scale: 2 }),

  // IVA retenido
  ivaRetainedBase: numeric('iva_retained_base', { precision: 12, scale: 2 }),
  ivaRetainedRate: numeric('iva_retained_rate', { precision: 8, scale: 6 }),
  ivaRetainedAmount: numeric('iva_retained_amount', { precision: 12, scale: 2 }),

  // ISR retenido
  isrRetainedBase: numeric('isr_retained_base', { precision: 12, scale: 2 }),
  isrRetainedRate: numeric('isr_retained_rate', { precision: 8, scale: 6 }),
  isrRetainedAmount: numeric('isr_retained_amount', { precision: 12, scale: 2 }),

  // Legacy compatibility
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),

  sortOrder: integer('sort_order').notNull().default(0),

  // Online order item details
  specialInstructions: text('special_instructions'),
  modifierSelections: jsonb('modifier_selections'),
})

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type NewInvoiceItem = typeof invoiceItems.$inferInsert
