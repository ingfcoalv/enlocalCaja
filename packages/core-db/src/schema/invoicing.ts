import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import { invoices } from './invoices'

// ─── Configuración Fiscal del Emisor ─────────────────────────
export const fiscalConfig = pgTable('fiscal_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfc: text('rfc').notNull(),
  razonSocial: text('razon_social').notNull(),
  nombreComercial: text('nombre_comercial'),
  regimenFiscal: text('regimen_fiscal').notNull(),
  codigoPostal: text('codigo_postal').notNull(),
  lugarExpedicion: text('lugar_expedicion').notNull(),
  curp: text('curp'),
  // Referencia a certificado (solo info, no almacena el cert)
  certificateNumber: text('certificate_number'),
  certificateValidTo: timestamp('certificate_valid_to', { withTimezone: true }),
  // Link al tenant cloud
  cloudTenantId: text('cloud_tenant_id'),
  // Series y folios por tipo
  seriesIngreso: text('series_ingreso').notNull().default('FA'),
  seriesEgreso: text('series_egreso').notNull().default('NC'),
  seriesPago: text('series_pago').notNull().default('CP'),
  seriesTraslado: text('series_traslado').notNull().default('CT'),
  folioIngreso: integer('folio_ingreso').notNull().default(1),
  folioEgreso: integer('folio_egreso').notNull().default(1),
  folioPago: integer('folio_pago').notNull().default(1),
  folioTraslado: integer('folio_traslado').notNull().default(1),
  // Preferencias
  globalPeriodicity: text('global_periodicity').notNull().default('04'),       // mensual
  globalGroupingStrategy: text('global_grouping_strategy').notNull().default('sat_code'), // sat_code | individual | general
  defaultEmailCfdi: text('default_email_cfdi'),
  enableIvaRetained: boolean('enable_iva_retained').notNull().default(false),
  enableIsrRetained: boolean('enable_isr_retained').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Relaciones entre CFDIs ──────────────────────────────────
export const invoiceRelations = pgTable('invoice_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  relatedUuid: text('related_uuid').notNull(),
  relationshipType: text('relationship_type').notNull(),   // 01=NC, 02=NC devolucion, 03=NC bonif, 04=sustitucion, 05=traslados, 06=multidestino, 07=app CFDI
})

// ─── Complemento de Pago — Detalle de Pago ──────────────────
export const invoicePaymentDetails = pgTable('invoice_payment_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
  paymentForm: text('payment_form').notNull(),              // 01, 03, 04, 28...
  currency: text('currency').notNull().default('MXN'),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  operationNumber: text('operation_number'),
  // Banco emisor
  bankRfcEmisor: text('bank_rfc_emisor'),
  bankNameEmisor: text('bank_name_emisor'),
  bankAccountEmisor: text('bank_account_emisor'),
  // Banco receptor
  bankRfcReceptor: text('bank_rfc_receptor'),
  bankAccountReceptor: text('bank_account_receptor'),
  // Impuestos del pago (totales P)
  taxBaseP: numeric('tax_base_p', { precision: 12, scale: 2 }),
  taxIvaP: numeric('tax_iva_p', { precision: 12, scale: 2 }),
  taxRetainedP: numeric('tax_retained_p', { precision: 12, scale: 2 }),
})

// ─── Complemento de Pago — Documentos Relacionados ──────────
export const invoicePaymentRelatedDocs = pgTable('invoice_payment_related_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentDetailId: uuid('payment_detail_id').notNull().references(() => invoicePaymentDetails.id, { onDelete: 'cascade' }),
  relatedUuid: text('related_uuid').notNull(),            // UUID de factura PPD
  series: text('series'),
  folio: text('folio'),
  currency: text('currency').notNull().default('MXN'),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }),
  partialNumber: integer('partial_number').notNull(),
  previousBalance: numeric('previous_balance', { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull(),
  remainingBalance: numeric('remaining_balance', { precision: 12, scale: 2 }).notNull(),
  // Impuestos del documento relacionado
  objetoImpDr: text('objeto_imp_dr'),
  taxBaseDr: numeric('tax_base_dr', { precision: 12, scale: 2 }),
  taxIvaDr: numeric('tax_iva_dr', { precision: 12, scale: 2 }),
  taxRetainedDr: numeric('tax_retained_dr', { precision: 12, scale: 2 }),
})

// ─── Carta Porte 3.1 ────────────────────────────────────────
export const invoiceCartaPorte = pgTable('invoice_carta_porte', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  transportInternational: boolean('transport_international').notNull().default(false),
  entryExit: text('entry_exit'),                        // Entrada | Salida (solo internacional)
  // Autotransporte
  permSct: text('perm_sct'),
  numPermisoSct: text('num_permiso_sct'),
  vehicleConfig: text('vehicle_config'),
  vehiclePlate: text('vehicle_plate'),
  vehicleYear: integer('vehicle_year'),
  // Seguro
  insuranceCompany: text('insurance_company'),
  insurancePolicy: text('insurance_policy'),
})

// ─── Carta Porte — Ubicaciones ──────────────────────────────
export const invoiceCartaPorteLocations = pgTable('invoice_carta_porte_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartaPorteId: uuid('carta_porte_id').notNull().references(() => invoiceCartaPorte.id, { onDelete: 'cascade' }),
  locationType: text('location_type').notNull(),          // origin | destination
  idUbicacion: text('id_ubicacion'),
  rfcAddressee: text('rfc_addressee'),
  addresseeName: text('addressee_name'),
  // Dirección
  street: text('street'),
  extNumber: text('ext_number'),
  intNumber: text('int_number'),
  neighborhood: text('neighborhood'),
  municipality: text('municipality'),
  state: text('state'),
  country: text('country').notNull().default('MEX'),
  zipCode: text('zip_code'),
  // Coordenadas
  latitude: numeric('latitude', { precision: 10, scale: 6 }),
  longitude: numeric('longitude', { precision: 10, scale: 6 }),
  // Fechas y distancia
  departureDate: timestamp('departure_date', { withTimezone: true }),
  arrivalDate: timestamp('arrival_date', { withTimezone: true }),
  distanceKm: numeric('distance_km', { precision: 10, scale: 2 }),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Carta Porte — Mercancías ───────────────────────────────
export const invoiceCartaPorteGoods = pgTable('invoice_carta_porte_goods', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartaPorteId: uuid('carta_porte_id').notNull().references(() => invoiceCartaPorte.id, { onDelete: 'cascade' }),
  bienesTransp: text('bienes_transp').notNull(),          // Clave SAT mercancía
  descripcion: text('descripcion').notNull(),
  cantidad: numeric('cantidad', { precision: 12, scale: 4 }).notNull(),
  claveUnidad: text('clave_unidad').notNull(),
  pesoKg: numeric('peso_kg', { precision: 12, scale: 4 }).notNull(),
  valorMercancia: numeric('valor_mercancia', { precision: 12, scale: 2 }),
  materialPeligroso: boolean('material_peligroso').notNull().default(false),
  cveMaterialPeligroso: text('cve_material_peligroso'),
  fraccionArancelaria: text('fraccion_arancelaria'),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Carta Porte — Operadores / Figuras Transporte ──────────
export const invoiceCartaPorteOperators = pgTable('invoice_carta_porte_operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartaPorteId: uuid('carta_porte_id').notNull().references(() => invoiceCartaPorte.id, { onDelete: 'cascade' }),
  operatorType: text('operator_type').notNull(),           // 01=Operador, 02=Propietario, 03=Arrendador
  rfc: text('rfc'),
  nombre: text('nombre').notNull(),
  numLicencia: text('num_licencia'),
  // Dirección del operador
  street: text('street'),
  zipCode: text('zip_code'),
  state: text('state'),
  country: text('country').notNull().default('MEX'),
})

// ─── Factura Global — Tickets Incluidos ─────────────────────
export const globalInvoiceTickets = pgTable('global_invoice_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  ticketId: uuid('ticket_id').notNull(),
  ticketFolio: text('ticket_folio'),
  ticketDate: timestamp('ticket_date', { withTimezone: true }),
  ticketTotal: numeric('ticket_total', { precision: 12, scale: 2 }).notNull(),
})

// ─── Types ───────────────────────────────────────────────────
export type FiscalConfig = typeof fiscalConfig.$inferSelect
export type NewFiscalConfig = typeof fiscalConfig.$inferInsert
export type InvoiceRelation = typeof invoiceRelations.$inferSelect
export type NewInvoiceRelation = typeof invoiceRelations.$inferInsert
export type InvoicePaymentDetail = typeof invoicePaymentDetails.$inferSelect
export type NewInvoicePaymentDetail = typeof invoicePaymentDetails.$inferInsert
export type InvoicePaymentRelatedDoc = typeof invoicePaymentRelatedDocs.$inferSelect
export type NewInvoicePaymentRelatedDoc = typeof invoicePaymentRelatedDocs.$inferInsert
export type InvoiceCartaPorteRecord = typeof invoiceCartaPorte.$inferSelect
export type NewInvoiceCartaPorteRecord = typeof invoiceCartaPorte.$inferInsert
export type InvoiceCartaPorteLocation = typeof invoiceCartaPorteLocations.$inferSelect
export type NewInvoiceCartaPorteLocation = typeof invoiceCartaPorteLocations.$inferInsert
export type InvoiceCartaPorteGood = typeof invoiceCartaPorteGoods.$inferSelect
export type NewInvoiceCartaPorteGood = typeof invoiceCartaPorteGoods.$inferInsert
export type InvoiceCartaPorteOperator = typeof invoiceCartaPorteOperators.$inferSelect
export type NewInvoiceCartaPorteOperator = typeof invoiceCartaPorteOperators.$inferInsert
export type GlobalInvoiceTicket = typeof globalInvoiceTickets.$inferSelect
export type NewGlobalInvoiceTicket = typeof globalInvoiceTickets.$inferInsert
