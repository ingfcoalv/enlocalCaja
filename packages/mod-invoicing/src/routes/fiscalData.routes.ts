import { Router } from 'express'
import { requirePermission } from '@enlocal/core-server'
import { sql } from 'drizzle-orm'

const router = Router()

// Common SAT Regimen Fiscal codes
const REGIMENES_FISCALES = [
  { code: '601', name: 'General de Ley Personas Morales' },
  { code: '603', name: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', name: 'Arrendamiento' },
  { code: '607', name: 'Regimen de Enajenacion o Adquisicion de Bienes' },
  { code: '608', name: 'Demas ingresos' },
  { code: '610', name: 'Residentes en el Extranjero sin Establecimiento Permanente en Mexico' },
  { code: '611', name: 'Ingresos por Dividendos (socios y accionistas)' },
  { code: '612', name: 'Personas Fisicas con Actividades Empresariales y Profesionales' },
  { code: '614', name: 'Ingresos por intereses' },
  { code: '615', name: 'Regimen de los ingresos por obtencion de premios' },
  { code: '616', name: 'Sin obligaciones fiscales' },
  { code: '620', name: 'Sociedades Cooperativas de Produccion que optan por diferir sus ingresos' },
  { code: '621', name: 'Incorporacion Fiscal' },
  { code: '622', name: 'Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras' },
  { code: '623', name: 'Opcional para Grupos de Sociedades' },
  { code: '624', name: 'Coordinados' },
  { code: '625', name: 'Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas' },
  { code: '626', name: 'Regimen Simplificado de Confianza' },
]

// Common SAT Uso CFDI codes
const USOS_CFDI = [
  { code: 'G01', name: 'Adquisicion de mercancias' },
  { code: 'G02', name: 'Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', name: 'Gastos en general' },
  { code: 'I01', name: 'Construcciones' },
  { code: 'I02', name: 'Mobiliario y equipo de oficina por inversiones' },
  { code: 'I03', name: 'Equipo de transporte' },
  { code: 'I04', name: 'Equipo de computo y accesorios' },
  { code: 'I05', name: 'Dados, troqueles, moldes, matrices y herramental' },
  { code: 'I06', name: 'Comunicaciones telefonicas' },
  { code: 'I07', name: 'Comunicaciones satelitales' },
  { code: 'I08', name: 'Otra maquinaria y equipo' },
  { code: 'D01', name: 'Honorarios medicos, dentales y gastos hospitalarios' },
  { code: 'D02', name: 'Gastos medicos por incapacidad o discapacidad' },
  { code: 'D03', name: 'Gastos funerales' },
  { code: 'D04', name: 'Donativos' },
  { code: 'D05', name: 'Intereses reales efectivamente pagados por creditos hipotecarios (casa habitacion)' },
  { code: 'D06', name: 'Aportaciones voluntarias al SAR' },
  { code: 'D07', name: 'Primas por seguros de gastos medicos' },
  { code: 'D08', name: 'Gastos de transportacion escolar obligatoria' },
  { code: 'D09', name: 'Depositos en cuentas para el ahorro, primas que tengan como base planes de pensiones' },
  { code: 'D10', name: 'Pagos por servicios educativos (colegiaturas)' },
  { code: 'S01', name: 'Sin efectos fiscales' },
  { code: 'CP01', name: 'Pagos' },
  { code: 'CN01', name: 'Nomina' },
]

// SAT Formas de Pago
const FORMAS_PAGO = [
  { code: '01', name: 'Efectivo' },
  { code: '02', name: 'Cheque nominativo' },
  { code: '03', name: 'Transferencia electronica de fondos' },
  { code: '04', name: 'Tarjeta de credito' },
  { code: '05', name: 'Monedero electronico' },
  { code: '06', name: 'Dinero electronico' },
  { code: '08', name: 'Vales de despensa' },
  { code: '12', name: 'Dacion en pago' },
  { code: '13', name: 'Pago por subrogacion' },
  { code: '14', name: 'Pago por consignacion' },
  { code: '15', name: 'Condonacion' },
  { code: '17', name: 'Compensacion' },
  { code: '23', name: 'Novacion' },
  { code: '24', name: 'Confusion' },
  { code: '25', name: 'Remision de deuda' },
  { code: '26', name: 'Prescripcion o caducidad' },
  { code: '27', name: 'A satisfaccion del acreedor' },
  { code: '28', name: 'Tarjeta de debito' },
  { code: '29', name: 'Tarjeta de servicios' },
  { code: '30', name: 'Aplicacion de anticipos' },
  { code: '31', name: 'Intermediario pagos' },
  { code: '99', name: 'Por definir' },
]

// SAT Metodos de Pago
const METODOS_PAGO = [
  { code: 'PUE', name: 'Pago en una sola exhibicion' },
  { code: 'PPD', name: 'Pago en parcialidades o diferido' },
]

// GET /regimens -- list regimen fiscal codes
router.get(
  '/regimens',
  requirePermission('invoices.read') as any,
  (_req, res) => {
    res.json({ data: REGIMENES_FISCALES })
  }
)

// GET /cfdi-uses -- list uso CFDI codes
router.get(
  '/cfdi-uses',
  requirePermission('invoices.read') as any,
  (_req, res) => {
    res.json({ data: USOS_CFDI })
  }
)

// GET /payment-forms -- formas de pago
router.get(
  '/payment-forms',
  requirePermission('invoices.read') as any,
  (_req, res) => {
    res.json({ data: FORMAS_PAGO })
  }
)

// GET /payment-methods -- metodos de pago
router.get(
  '/payment-methods',
  requirePermission('invoices.read') as any,
  (_req, res) => {
    res.json({ data: METODOS_PAGO })
  }
)

// ── Fiscal Config CRUD ──────────────────────────────────

// GET /config -- get fiscal config
router.get(
  '/config',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT * FROM fiscal_config LIMIT 1`)
      const row = result.rows?.[0] || result[0]
      if (!row) {
        return res.json({ data: null })
      }
      res.json({
        data: {
          id: row.id,
          rfc: row.rfc,
          razonSocial: row.razon_social,
          nombreComercial: row.nombre_comercial,
          regimenFiscal: row.regimen_fiscal,
          codigoPostal: row.codigo_postal,
          lugarExpedicion: row.lugar_expedicion,
          curp: row.curp,
          certificateNumber: row.certificate_number,
          certificateValidTo: row.certificate_valid_to,
          seriesIngreso: row.series_ingreso,
          seriesEgreso: row.series_egreso,
          seriesPago: row.series_pago,
          seriesTraslado: row.series_traslado,
          folioIngreso: row.folio_ingreso,
          folioEgreso: row.folio_egreso,
          folioPago: row.folio_pago,
          folioTraslado: row.folio_traslado,
          globalPeriodicity: row.global_periodicity,
          globalGrouping: row.global_grouping_strategy,
          enableIvaRetained: row.enable_iva_retained,
          enableIsrRetained: row.enable_isr_retained,
          defaultEmailCfdi: row.default_email_cfdi,
          certStatus: row.certificate_valid_to ? (new Date(row.certificate_valid_to) > new Date() ? 'active' : 'expired') : null,
        },
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// PUT /config -- upsert fiscal config
router.put(
  '/config',
  requirePermission('invoices.create') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const b = req.body

      // Check if config exists
      const existing = await db.execute(sql`SELECT id FROM fiscal_config LIMIT 1`)
      const existingRow = existing.rows?.[0] || existing[0]

      if (existingRow) {
        await db.execute(sql`UPDATE fiscal_config SET
          rfc = COALESCE(${b.rfc}, rfc),
          razon_social = COALESCE(${b.razonSocial}, razon_social),
          nombre_comercial = COALESCE(${b.nombreComercial}, nombre_comercial),
          regimen_fiscal = COALESCE(${b.regimenFiscal}, regimen_fiscal),
          codigo_postal = COALESCE(${b.codigoPostal}, codigo_postal),
          lugar_expedicion = COALESCE(${b.lugarExpedicion}, lugar_expedicion),
          series_ingreso = COALESCE(${b.seriesIngreso}, series_ingreso),
          series_egreso = COALESCE(${b.seriesEgreso}, series_egreso),
          series_pago = COALESCE(${b.seriesPago}, series_pago),
          series_traslado = COALESCE(${b.seriesTraslado}, series_traslado),
          folio_ingreso = COALESCE(${b.folioIngreso ? Number(b.folioIngreso) : null}, folio_ingreso),
          folio_egreso = COALESCE(${b.folioEgreso ? Number(b.folioEgreso) : null}, folio_egreso),
          folio_pago = COALESCE(${b.folioPago ? Number(b.folioPago) : null}, folio_pago),
          folio_traslado = COALESCE(${b.folioTraslado ? Number(b.folioTraslado) : null}, folio_traslado),
          global_periodicity = COALESCE(${b.globalPeriodicity}, global_periodicity),
          global_grouping_strategy = COALESCE(${b.globalGrouping}, global_grouping_strategy),
          enable_iva_retained = COALESCE(${b.enableIvaRetained ?? null}, enable_iva_retained),
          enable_isr_retained = COALESCE(${b.enableIsrRetained ?? null}, enable_isr_retained),
          default_email_cfdi = COALESCE(${b.defaultEmailCfdi}, default_email_cfdi),
          updated_at = now()
          WHERE id = ${existingRow.id}`)
      } else {
        await db.execute(sql`INSERT INTO fiscal_config (
          rfc, razon_social, regimen_fiscal, codigo_postal, lugar_expedicion,
          series_ingreso, series_egreso, series_pago, series_traslado,
          global_periodicity, global_grouping_strategy
        ) VALUES (
          ${b.rfc || ''}, ${b.razonSocial || ''}, ${b.regimenFiscal || '601'},
          ${b.codigoPostal || ''}, ${b.lugarExpedicion || b.codigoPostal || ''},
          ${b.seriesIngreso || 'FA'}, ${b.seriesEgreso || 'NC'}, ${b.seriesPago || 'CP'}, ${b.seriesTraslado || 'CT'},
          ${b.globalPeriodicity || '04'}, ${b.globalGrouping || 'sat_code'}
        )`)
      }

      // Re-fetch to return updated data
      const result = await db.execute(sql`SELECT * FROM fiscal_config LIMIT 1`)
      const row = result.rows?.[0] || result[0]
      res.json({
        data: {
          id: row.id,
          rfc: row.rfc,
          razonSocial: row.razon_social,
          regimenFiscal: row.regimen_fiscal,
          codigoPostal: row.codigo_postal,
          lugarExpedicion: row.lugar_expedicion,
          seriesIngreso: row.series_ingreso,
          seriesEgreso: row.series_egreso,
          seriesPago: row.series_pago,
          seriesTraslado: row.series_traslado,
          folioIngreso: row.folio_ingreso,
          folioEgreso: row.folio_egreso,
          folioPago: row.folio_pago,
          folioTraslado: row.folio_traslado,
          globalPeriodicity: row.global_periodicity,
          globalGrouping: row.global_grouping_strategy,
          enableIvaRetained: row.enable_iva_retained,
          enableIsrRetained: row.enable_isr_retained,
        },
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /cert-status -- certificate status
router.get(
  '/cert-status',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT certificate_number, certificate_valid_to FROM fiscal_config LIMIT 1`)
      const row = result.rows?.[0] || result[0]
      if (!row || !row.certificate_valid_to) {
        return res.json({ data: { status: 'none', message: 'No hay certificado configurado' } })
      }
      const isValid = new Date(row.certificate_valid_to) > new Date()
      res.json({
        data: {
          status: isValid ? 'active' : 'expired',
          certificateNumber: row.certificate_number,
          validTo: row.certificate_valid_to,
        },
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

export default router
