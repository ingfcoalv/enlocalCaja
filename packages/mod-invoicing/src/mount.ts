import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import { sql } from 'drizzle-orm'
import invoicesRoutes from './routes/invoices.routes'
import cfdiRoutes from './routes/cfdi.routes'
import fiscalRoutes from './routes/fiscalData.routes'
import satCatalogRoutes from './routes/satCatalog.routes'
import rfcValidationRoutes from './routes/rfcValidation.routes'
import cloudInvoicesRoutes from './routes/cloudInvoices.routes'
import { seedSatCatalogs } from './seeds/satCatalogSeed'

async function ensureInvoicingSchema(db: any): Promise<void> {
  // ── invoices table expansions ──────────────────────────────
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_rfc text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_nombre text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_regimen text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_cp text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receptor_email text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6)`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_conditions text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_discounts numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_16 numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_8 numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_0 numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_exempt numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_ieps numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_transferred numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_iva_retained numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_isr_retained numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_retained numeric(12,2) NOT NULL DEFAULT '0'`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_cfdi_type text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_type text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_id uuid`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xml_original_chain text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_certificate_number text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_stamp_date text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_digital_stamp text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issuer_seal text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_uuid text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_response text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_periodicity text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_month text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_year text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS has_carta_porte boolean NOT NULL DEFAULT false`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_generated boolean NOT NULL DEFAULT false`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS error_message text`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by uuid`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emitted_by uuid`)
  await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emitted_at timestamptz`)

  // ── invoice_items table expansions ─────────────────────────
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit text`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS objeto_imp text`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS no_identificacion text`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_base numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_rate numeric(8,6)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_amount numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_base numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_rate numeric(8,6)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ieps_amount numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_base numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_rate numeric(8,6)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS iva_retained_amount numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_base numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_rate numeric(8,6)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS isr_retained_amount numeric(12,2)`)
  await db.execute(sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`)

  // ── SAT catalog tables ─────────────────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_tax_regimes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    persona_moral boolean NOT NULL DEFAULT false,
    persona_fisica boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_cfdi_uses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    persona_moral boolean NOT NULL DEFAULT false,
    persona_fisica boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_payment_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_product_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    includes_iva boolean NOT NULL DEFAULT false,
    includes_ieps boolean NOT NULL DEFAULT false,
    stimulus_frontera boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_unit_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_currencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    decimals integer NOT NULL DEFAULT 2,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_relationship_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    active boolean NOT NULL DEFAULT true
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sat_countries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL,
    active boolean NOT NULL DEFAULT true
  )`)

  // ── fiscal_config table ────────────────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS fiscal_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rfc text NOT NULL,
    razon_social text NOT NULL,
    nombre_comercial text,
    regimen_fiscal text NOT NULL,
    codigo_postal text NOT NULL,
    lugar_expedicion text NOT NULL,
    curp text,
    certificate_number text,
    certificate_valid_to timestamptz,
    cloud_tenant_id text,
    series_ingreso text NOT NULL DEFAULT 'FA',
    series_egreso text NOT NULL DEFAULT 'NC',
    series_pago text NOT NULL DEFAULT 'CP',
    series_traslado text NOT NULL DEFAULT 'CT',
    folio_ingreso integer NOT NULL DEFAULT 1,
    folio_egreso integer NOT NULL DEFAULT 1,
    folio_pago integer NOT NULL DEFAULT 1,
    folio_traslado integer NOT NULL DEFAULT 1,
    global_periodicity text NOT NULL DEFAULT '04',
    global_grouping_strategy text NOT NULL DEFAULT 'sat_code',
    default_email_cfdi text,
    enable_iva_retained boolean NOT NULL DEFAULT false,
    enable_isr_retained boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  // ── invoice_relations table ────────────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    related_uuid text NOT NULL,
    relationship_type text NOT NULL
  )`)

  // ── invoice_payment_details table ──────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_payment_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date timestamptz NOT NULL,
    payment_form text NOT NULL,
    currency text NOT NULL DEFAULT 'MXN',
    exchange_rate numeric(12,6),
    amount numeric(12,2) NOT NULL,
    operation_number text,
    bank_rfc_emisor text,
    bank_name_emisor text,
    bank_account_emisor text,
    bank_rfc_receptor text,
    bank_account_receptor text,
    tax_base_p numeric(12,2),
    tax_iva_p numeric(12,2),
    tax_retained_p numeric(12,2)
  )`)

  // ── invoice_payment_related_docs table ─────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_payment_related_docs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_detail_id uuid NOT NULL REFERENCES invoice_payment_details(id) ON DELETE CASCADE,
    related_uuid text NOT NULL,
    series text,
    folio text,
    currency text NOT NULL DEFAULT 'MXN',
    exchange_rate numeric(12,6),
    partial_number integer NOT NULL,
    previous_balance numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    remaining_balance numeric(12,2) NOT NULL,
    objeto_imp_dr text,
    tax_base_dr numeric(12,2),
    tax_iva_dr numeric(12,2),
    tax_retained_dr numeric(12,2)
  )`)

  // ── invoice_carta_porte table ──────────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_carta_porte (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transport_international boolean NOT NULL DEFAULT false,
    entry_exit text,
    perm_sct text,
    num_permiso_sct text,
    vehicle_config text,
    vehicle_plate text,
    vehicle_year integer,
    insurance_company text,
    insurance_policy text
  )`)

  // ── invoice_carta_porte_locations table ────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_carta_porte_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carta_porte_id uuid NOT NULL REFERENCES invoice_carta_porte(id) ON DELETE CASCADE,
    location_type text NOT NULL,
    id_ubicacion text,
    rfc_addressee text,
    addressee_name text,
    street text,
    ext_number text,
    int_number text,
    neighborhood text,
    municipality text,
    state text,
    country text NOT NULL DEFAULT 'MEX',
    zip_code text,
    latitude numeric(10,6),
    longitude numeric(10,6),
    departure_date timestamptz,
    arrival_date timestamptz,
    distance_km numeric(10,2),
    sort_order integer NOT NULL DEFAULT 0
  )`)

  // ── invoice_carta_porte_goods table ────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_carta_porte_goods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carta_porte_id uuid NOT NULL REFERENCES invoice_carta_porte(id) ON DELETE CASCADE,
    bienes_transp text NOT NULL,
    descripcion text NOT NULL,
    cantidad numeric(12,4) NOT NULL,
    clave_unidad text NOT NULL,
    peso_kg numeric(12,4) NOT NULL,
    valor_mercancia numeric(12,2),
    material_peligroso boolean NOT NULL DEFAULT false,
    cve_material_peligroso text,
    fraccion_arancelaria text,
    sort_order integer NOT NULL DEFAULT 0
  )`)

  // ── invoice_carta_porte_operators table ────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS invoice_carta_porte_operators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carta_porte_id uuid NOT NULL REFERENCES invoice_carta_porte(id) ON DELETE CASCADE,
    operator_type text NOT NULL,
    rfc text,
    nombre text NOT NULL,
    num_licencia text,
    street text,
    zip_code text,
    state text,
    country text NOT NULL DEFAULT 'MEX'
  )`)

  // ── global_invoice_tickets table ───────────────────────────
  await db.execute(sql`CREATE TABLE IF NOT EXISTS global_invoice_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    ticket_id uuid NOT NULL,
    ticket_folio text,
    ticket_date timestamptz,
    ticket_total numeric(12,2) NOT NULL
  )`)

  // ── Indexes ────────────────────────────────────────────────
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invoices_type_idx ON invoices(type)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invoices_uuid_fiscal_idx ON invoices(uuid_fiscal)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invoices_source_type_idx ON invoices(source_type)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sat_product_codes_code_idx ON sat_product_codes(code)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sat_product_codes_description_idx ON sat_product_codes(description)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sat_unit_codes_code_idx ON sat_unit_codes(code)`)
}

export function mountInvoicingRoutes(app: Express, db: any): void {
  app.set('db', db)

  ensureInvoicingSchema(db)
    .then(() => seedSatCatalogs(db))
    .catch((err: any) =>
      console.error('[mod-invoicing] Schema/seed error:', err.message)
    )

  app.use('/api/invoices', authMiddleware as any, invoicesRoutes)
  app.use('/api/invoices', authMiddleware as any, cfdiRoutes)
  app.use('/api/invoices', authMiddleware as any, rfcValidationRoutes)
  app.use('/api/invoices', authMiddleware as any, cloudInvoicesRoutes)
  app.use('/api/fiscal', authMiddleware as any, fiscalRoutes)
  app.use('/api/sat', authMiddleware as any, satCatalogRoutes)
}
