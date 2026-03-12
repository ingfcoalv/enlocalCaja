-- 0022: Create CFDI invoicing support tables
-- fiscal_config, invoice_relations, payment details, carta porte, global invoice tickets

-- ─── Configuración Fiscal del Emisor ─────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_config (
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
);
--> statement-breakpoint

-- ─── Relaciones entre CFDIs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  related_uuid text NOT NULL,
  relationship_type text NOT NULL
);
--> statement-breakpoint

-- ─── Complemento de Pago — Detalle de Pago ──────────────────
CREATE TABLE IF NOT EXISTS invoice_payment_details (
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
);
--> statement-breakpoint

-- ─── Complemento de Pago — Documentos Relacionados ──────────
CREATE TABLE IF NOT EXISTS invoice_payment_related_docs (
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
);
--> statement-breakpoint

-- ─── Carta Porte 3.1 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_carta_porte (
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
);
--> statement-breakpoint

-- ─── Carta Porte — Ubicaciones ──────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_carta_porte_locations (
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
);
--> statement-breakpoint

-- ─── Carta Porte — Mercancías ───────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_carta_porte_goods (
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
);
--> statement-breakpoint

-- ─── Carta Porte — Operadores / Figuras Transporte ──────────
CREATE TABLE IF NOT EXISTS invoice_carta_porte_operators (
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
);
--> statement-breakpoint

-- ─── Factura Global — Tickets Incluidos ─────────────────────
CREATE TABLE IF NOT EXISTS global_invoice_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL,
  ticket_folio text,
  ticket_date timestamptz,
  ticket_total numeric(12,2) NOT NULL
);
