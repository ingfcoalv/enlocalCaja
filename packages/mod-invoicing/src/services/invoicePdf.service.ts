// ---------------------------------------------------------------------------
// invoicePdf.service.ts — CFDI 4.0 printed representation PDF generator
// ---------------------------------------------------------------------------
// Follows the visual style from mod-remissions/mod-quotes PDF generators.
// Adds fiscal-specific elements: QR, digital seals, tax breakdown,
// watermarks, page numbers, and variant layouts for tipo P and T.
// ---------------------------------------------------------------------------

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { numberToWords } from './numberToWords.service'

// ── Types ───────────────────────────────────────────────────────

export interface InvoicePDFData {
  emisor: {
    rfc: string
    razon_social: string
    nombre_comercial?: string
    regimen_fiscal: string
    regimen_fiscal_desc: string
    codigo_postal: string
    logo_path?: string
  }
  invoice: {
    id: string
    type: 'I' | 'E' | 'P' | 'T'
    series: string
    folio: number
    uuid_fiscal: string
    status: string
    currency: string
    exchange_rate: number
    payment_method: string
    payment_form: string
    payment_form_desc: string
    payment_conditions?: string
    created_at: string
    emitted_at: string
    subtotal: number
    total_discounts: number
    total_iva_16: number
    total_iva_8: number
    total_iva_0: number
    total_iva_exempt: number
    total_ieps: number
    total_transferred: number
    total_iva_retained: number
    total_isr_retained: number
    total_retained: number
    total: number
    sat_certificate_number?: string
    sat_stamp_date?: string
    sat_digital_stamp?: string
    issuer_seal?: string
    xml_original_chain?: string
    is_global: boolean
    global_periodicity?: string
    global_month?: string
    global_year?: string
    cancellation_reason?: string
    cancelled_at?: string
    notes?: string
  }
  receptor: {
    rfc: string
    nombre: string
    regimen_fiscal: string
    regimen_fiscal_desc: string
    uso_cfdi: string
    uso_cfdi_desc: string
    domicilio_fiscal_cp: string
    email?: string
  }
  items: Array<{
    clave_prod_serv: string
    clave_unidad: string
    unidad?: string
    no_identificacion?: string
    description: string
    quantity: number
    unit_price: number
    amount: number
    discount: number
    objeto_imp: string
    iva_rate: number | null
    iva_amount: number
    ieps_rate: number | null
    ieps_amount: number
    iva_retained_rate: number | null
    iva_retained_amount: number
    isr_retained_rate: number | null
    isr_retained_amount: number
  }>
  relations: Array<{
    relationship_type: string
    relationship_type_desc: string
    related_uuid: string
  }>
  paymentDetails?: Array<{
    payment_date: string
    payment_form: string
    payment_form_desc: string
    currency: string
    exchange_rate: number
    amount: number
    operation_number?: string
    rfc_issuer_bank?: string
    issuer_bank_name?: string
    rfc_receiver_bank?: string
    receiver_bank_account?: string
    related_docs: Array<{
      related_uuid: string
      series?: string
      folio?: string
      currency: string
      partial_number: number
      previous_balance: number
      amount_paid: number
      remaining_balance: number
    }>
  }>
  cartaPorte?: {
    transport_international: boolean
    locations: Array<{
      location_type: string
      id_ubicacion: string
      rfc_addressee?: string
      addressee_name?: string
      street?: string
      ext_number?: string
      neighborhood?: string
      municipality?: string
      state?: string
      country: string
      zip_code: string
      departure_date?: string
      arrival_date?: string
      distance_km?: number
    }>
    goods: Array<{
      bienes_transp: string
      descripcion: string
      cantidad: number
      clave_unidad: string
      peso_kg: number
      valor_mercancia?: number
      material_peligroso: boolean
    }>
    vehicle: {
      perm_sct?: string
      num_permiso_sct?: string
      vehicle_config: string
      vehicle_plate: string
      vehicle_year?: number
      insurance_company?: string
      insurance_policy?: string
    }
    operators: Array<{
      operator_type: string
      rfc: string
      nombre: string
      num_licencia?: string
    }>
  }
}

// ── Design constants (matching mod-remissions / mod-quotes) ─────

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const ML = 50   // margin left
const MR = 50   // margin right
const MT = 40   // margin top
const MB = 50   // margin bottom
const CW = PAGE_WIDTH - ML - MR  // content width

const COLOR_DARK = '#1f2937'
const COLOR_HEADER = '#374151'
const COLOR_LIGHT = '#f3f4f6'
const COLOR_PRIMARY = '#2563eb'
const COLOR_TEXT = '#333333'
const COLOR_MUTED = '#6b7280'
const COLOR_FOOTER = '#9ca3af'
const COLOR_RED = '#dc2626'
const COLOR_GREEN = '#16a34a'

const FONT = 'Helvetica'
const FONT_B = 'Helvetica-Bold'
const FONT_I = 'Helvetica-Oblique'

const TYPE_TITLES: Record<string, string> = {
  I: 'FACTURA',
  E: 'NOTA DE CRÉDITO',
  P: 'COMPLEMENTO DE PAGO',
  T: 'CARTA PORTE',
}

const PERIODICITY_LABELS: Record<string, string> = {
  '01': 'Diario', '02': 'Semanal', '03': 'Quincenal', '04': 'Mensual', '05': 'Bimestral',
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

// ── Helpers ─────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toLocaleString('es-MX', { maximumFractionDigits: 6 })
}

function fmtDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const day = d.getDate().toString().padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  const secs = d.getSeconds().toString().padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`
}

function truncSeal(seal: string | undefined, max: number): string {
  if (!seal) return '—'
  if (seal.length <= max) return seal
  return seal.substring(0, max) + '...'
}

function hline(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(0.5).strokeColor('#e5e7eb').stroke()
}

function checkPage(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > PAGE_HEIGHT - MB - 30) {
    doc.addPage()
  }
}

// ── Main generator ──────────────────────────────────────────────

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  // Pre-process logo
  let logoBuffer: Buffer | null = null
  if (data.emisor.logo_path && fs.existsSync(data.emisor.logo_path)) {
    try {
      const raw = fs.readFileSync(data.emisor.logo_path)
      const ext = path.extname(data.emisor.logo_path).toLowerCase()
      if (ext === '.webp') {
        logoBuffer = await sharp(raw).png().toBuffer()
      } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        logoBuffer = raw
      }
    } catch { /* skip logo */ }
  }

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        bufferPages: true,
        info: {
          Title: `${data.invoice.series}-${data.invoice.folio} ${TYPE_TITLES[data.invoice.type] || 'CFDI'}`,
          Author: data.emisor.razon_social,
          Subject: `CFDI ${data.invoice.uuid_fiscal || 'Borrador'}`,
        },
      })

      const buffers: Buffer[] = []
      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // ─── 1. Header ────────────────────────────────────────
      const headerY = doc.y

      // Logo
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, ML, headerY, { width: 80, height: 60 })
        } catch { /* skip */ }
      }

      // Business info
      const bizX = ML + 95
      doc.font(FONT_B).fontSize(14).fillColor(COLOR_DARK)
      doc.text(data.emisor.razon_social, bizX, headerY, { width: 250 })

      if (data.emisor.nombre_comercial && data.emisor.nombre_comercial !== data.emisor.razon_social) {
        doc.font(FONT_I).fontSize(7.5).fillColor(COLOR_MUTED)
        doc.text(data.emisor.nombre_comercial, bizX, doc.y, { width: 250 })
      }

      doc.font(FONT).fontSize(8).fillColor(COLOR_MUTED)
      doc.text(`RFC: ${data.emisor.rfc}`, bizX, doc.y + 2, { width: 250 })
      doc.text(`Régimen: ${data.emisor.regimen_fiscal} — ${data.emisor.regimen_fiscal_desc}`, bizX, doc.y, { width: 250 })
      doc.text(`C.P.: ${data.emisor.codigo_postal}`, bizX, doc.y, { width: 250 })

      // Folio box (right)
      const folioBoxX = PAGE_WIDTH - MR - 150
      doc.roundedRect(folioBoxX, headerY, 150, 55, 4).fill(COLOR_PRIMARY)
      doc.font(FONT_B).fontSize(10).fillColor('#ffffff')
      doc.text(TYPE_TITLES[data.invoice.type] || 'COMPROBANTE', folioBoxX, headerY + 6, { width: 150, align: 'center' })
      doc.fontSize(16)
      doc.text(`${data.invoice.series}-${data.invoice.folio}`, folioBoxX, headerY + 22, { width: 150, align: 'center' })
      doc.font(FONT).fontSize(7).fillColor('#ffffff')
      doc.text(fmtDate(data.invoice.emitted_at || data.invoice.created_at), folioBoxX, headerY + 42, { width: 150, align: 'center' })

      doc.y = Math.max(doc.y, headerY + 65)
      hline(doc, doc.y)
      doc.y += 8

      // ─── 2. UUID section ──────────────────────────────────
      if (data.invoice.uuid_fiscal) {
        const uy = doc.y
        doc.roundedRect(ML, uy, CW, 20, 3).fill('#eff6ff')
        doc.font(FONT_B).fontSize(7).fillColor(COLOR_PRIMARY)
        doc.text('Folio Fiscal (UUID):', ML + 6, uy + 5)
        doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_DARK)
        doc.text(data.invoice.uuid_fiscal, ML + 115, uy + 4, { width: CW - 120 })
        doc.y = uy + 24
      } else {
        doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_MUTED)
        doc.text('BORRADOR — Sin timbrar', ML, doc.y)
        doc.y += 6
      }

      // Certificate number & stamp date
      if (data.invoice.sat_certificate_number || data.invoice.sat_stamp_date) {
        doc.font(FONT).fontSize(7).fillColor(COLOR_MUTED)
        const certParts: string[] = []
        if (data.invoice.sat_certificate_number) certParts.push(`No. Certificado: ${data.invoice.sat_certificate_number}`)
        if (data.invoice.sat_stamp_date) certParts.push(`Fecha Timbrado: ${fmtDate(data.invoice.sat_stamp_date)}`)
        doc.text(certParts.join('   |   '), ML, doc.y, { width: CW })
      }

      doc.y += 4
      hline(doc, doc.y)
      doc.y += 6

      // ─── 3. Receptor ──────────────────────────────────────
      doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_PRIMARY)
      doc.text('RECEPTOR', ML, doc.y)
      doc.y += 3

      // Info box
      const ry = doc.y
      doc.roundedRect(ML, ry, CW, 42, 3).fill(COLOR_LIGHT)

      doc.font(FONT).fontSize(8).fillColor(COLOR_TEXT)
      const col2X = ML + CW / 2

      doc.text(`RFC: ${data.receptor.rfc}`, ML + 8, ry + 5, { width: CW / 2 - 12 })
      doc.text(`Nombre: ${data.receptor.nombre}`, ML + 8, ry + 16, { width: CW / 2 - 12 })
      doc.text(`Régimen: ${data.receptor.regimen_fiscal} — ${data.receptor.regimen_fiscal_desc}`, ML + 8, ry + 27, { width: CW / 2 - 12 })

      doc.text(`Uso CFDI: ${data.receptor.uso_cfdi} — ${data.receptor.uso_cfdi_desc}`, col2X + 4, ry + 5, { width: CW / 2 - 12 })
      doc.text(`Domicilio Fiscal: ${data.receptor.domicilio_fiscal_cp}`, col2X + 4, ry + 16, { width: CW / 2 - 12 })
      if (data.receptor.email) {
        doc.text(`Email: ${data.receptor.email}`, col2X + 4, ry + 27, { width: CW / 2 - 12 })
      }

      doc.y = ry + 48

      // ─── 4. Payment method row ────────────────────────────
      if (data.invoice.type !== 'P' && data.invoice.type !== 'T') {
        const paymentParts: string[] = []
        paymentParts.push(`Método: ${data.invoice.payment_method === 'PUE' ? 'PUE — Pago en una sola exhibición' : 'PPD — Pago en parcialidades o diferido'}`)
        if (data.invoice.payment_form) {
          paymentParts.push(`Forma: ${data.invoice.payment_form} — ${data.invoice.payment_form_desc}`)
        }
        paymentParts.push(`Moneda: ${data.invoice.currency}`)
        if (data.invoice.currency !== 'MXN' && data.invoice.exchange_rate) {
          paymentParts.push(`T.C.: ${data.invoice.exchange_rate}`)
        }
        if (data.invoice.payment_conditions) {
          paymentParts.push(`Condiciones: ${data.invoice.payment_conditions}`)
        }

        doc.font(FONT).fontSize(7).fillColor(COLOR_MUTED)
        doc.text(paymentParts.join('   |   '), ML, doc.y, { width: CW })
        doc.y += 6
      }

      // ─── 5. Relations ─────────────────────────────────────
      if (data.relations.length > 0) {
        doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
        doc.text('CFDI RELACIONADOS', ML, doc.y)
        doc.y += 2

        for (const rel of data.relations) {
          doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
          doc.text(`Tipo: ${rel.relationship_type} — ${rel.relationship_type_desc}  |  UUID: ${rel.related_uuid}`, ML + 10, doc.y, { width: CW - 10 })
        }
        doc.y += 4
      }

      // ─── 6. Global invoice info ───────────────────────────
      if (data.invoice.is_global) {
        doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
        doc.text('INFORMACIÓN GLOBAL', ML, doc.y)
        doc.y += 2
        doc.font(FONT).fontSize(7.5).fillColor(COLOR_TEXT)
        doc.text(
          `Periodicidad: ${PERIODICITY_LABELS[data.invoice.global_periodicity || '04'] || data.invoice.global_periodicity || ''}  |  ` +
          `Mes: ${MONTH_LABELS[data.invoice.global_month || ''] || data.invoice.global_month || ''}  |  ` +
          `Año: ${data.invoice.global_year || ''}`,
          ML + 10, doc.y, { width: CW - 10 }
        )
        doc.y += 6
      }

      hline(doc, doc.y)
      doc.y += 6

      // ─── 7. Items table ───────────────────────────────────
      if (data.invoice.type !== 'P') {
        drawItemsTable(doc, data)
      }

      // ─── 8. Totals ────────────────────────────────────────
      if (data.invoice.type !== 'P') {
        drawTotals(doc, data)
      }

      // ─── 9. Total en letra ────────────────────────────────
      if (data.invoice.type !== 'P') {
        checkPage(doc, 20)
        const wordsText = numberToWords(data.invoice.total, data.invoice.currency)
        doc.font(FONT_B).fontSize(7).fillColor(COLOR_DARK)
        doc.text(wordsText, ML, doc.y, { width: CW })
        doc.y += 6
        hline(doc, doc.y)
        doc.y += 6
      }

      // ─── 10. Notes ────────────────────────────────────────
      if (data.invoice.notes) {
        checkPage(doc, 25)
        doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_MUTED)
        doc.text('Observaciones:', ML, doc.y)
        doc.font(FONT).fontSize(7.5).fillColor(COLOR_TEXT)
        doc.text(data.invoice.notes, ML, doc.y, { width: CW })
        doc.y += 6
      }

      // ─── 11. Payment complement (tipo P) ──────────────────
      if (data.invoice.type === 'P' && data.paymentDetails && data.paymentDetails.length > 0) {
        drawPaymentComplement(doc, data)
      }

      // ─── 12. Carta porte (tipo T) ─────────────────────────
      if (data.invoice.type === 'T' && data.cartaPorte) {
        drawCartaPorte(doc, data)
      }

      // ─── 13. Stamps and QR ────────────────────────────────
      if (data.invoice.uuid_fiscal) {
        await drawStampsAndQR(doc, data)
      }

      // ─── 14. Legal footer ─────────────────────────────────
      checkPage(doc, 25)
      hline(doc, doc.y)
      doc.y += 4
      doc.font(FONT_I).fontSize(6).fillColor(COLOR_FOOTER)
      doc.text(
        'Este documento es una representación impresa de un CFDI',
        ML, doc.y, { width: CW, align: 'center' }
      )
      doc.text(
        'Verificación: https://verificacfdi.facturaelectronica.sat.gob.mx',
        ML, doc.y, { width: CW, align: 'center' }
      )

      // ─── 15. Watermarks ───────────────────────────────────
      if (data.invoice.status === 'cancelled') {
        drawWatermark(doc, 'CANCELADA', COLOR_RED)
      } else if (data.invoice.status === 'draft') {
        drawWatermark(doc, 'BORRADOR', COLOR_MUTED)
      }

      // ─── 16. Page numbers ─────────────────────────────────
      addPageNumbers(doc)

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// ── Items Table ─────────────────────────────────────────────────

function drawItemsTable(doc: PDFKit.PDFDocument, data: InvoicePDFData) {
  checkPage(doc, 80)

  doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_PRIMARY)
  doc.text('CONCEPTOS', ML, doc.y)
  doc.y += 4

  // Column layout
  const cols = [
    { label: 'ClaveSAT',    x: ML,        w: 58 },
    { label: 'NoID',         x: ML + 58,   w: 38 },
    { label: 'Descripción',  x: ML + 96,   w: 155 },
    { label: 'Cant',         x: ML + 251,  w: 40,  align: 'right' as const },
    { label: 'Unidad',       x: ML + 291,  w: 35 },
    { label: 'V. Unit.',     x: ML + 326,  w: 60,  align: 'right' as const },
    { label: 'Desc.',        x: ML + 386,  w: 50,  align: 'right' as const },
    { label: 'Importe',      x: ML + 436,  w: 76,  align: 'right' as const },
  ]

  // Table header
  const hy = doc.y
  doc.rect(ML, hy, CW, 14).fill(COLOR_HEADER)
  doc.font(FONT_B).fontSize(6.5).fillColor('#ffffff')
  for (const col of cols) {
    doc.text(col.label, col.x + 2, hy + 3, { width: col.w - 4, align: col.align || 'left' })
  }
  doc.y = hy + 16

  // Rows
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    checkPage(doc, 36)

    const rowY = doc.y

    // Alternating bg
    if (i % 2 === 1) {
      doc.rect(ML, rowY, CW, 14).fill('#f9fafb')
    }

    doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
    doc.text(item.clave_prod_serv, cols[0].x + 2, rowY + 3, { width: cols[0].w - 4 })
    doc.text(item.no_identificacion || '', cols[1].x + 2, rowY + 3, { width: cols[1].w - 4 })
    doc.text(item.description, cols[2].x + 2, rowY + 3, { width: cols[2].w - 4 })
    doc.text(fmtNumber(item.quantity), cols[3].x + 2, rowY + 3, { width: cols[3].w - 4, align: 'right' })
    doc.text(item.clave_unidad, cols[4].x + 2, rowY + 3, { width: cols[4].w - 4 })
    doc.text(fmtCurrency(item.unit_price), cols[5].x + 2, rowY + 3, { width: cols[5].w - 4, align: 'right' })
    doc.text(item.discount > 0 ? fmtCurrency(item.discount) : '', cols[6].x + 2, rowY + 3, { width: cols[6].w - 4, align: 'right' })
    doc.text(fmtCurrency(item.amount), cols[7].x + 2, rowY + 3, { width: cols[7].w - 4, align: 'right' })

    doc.y = rowY + 14

    // Tax detail per concept
    if (item.objeto_imp === '02' || item.objeto_imp === '03') {
      const taxLines: string[] = []
      const base = item.amount - item.discount

      if (item.iva_rate !== null && item.iva_rate !== undefined) {
        if (item.iva_rate === 0) {
          taxLines.push(`IVA Tasa 0%  Base: ${fmtCurrency(base)}  Importe: $0.00`)
        } else if (item.iva_rate > 0) {
          taxLines.push(`IVA Tasa ${(item.iva_rate * 100).toFixed(4)}%  Base: ${fmtCurrency(base)}  Importe: ${fmtCurrency(item.iva_amount)}`)
        }
      } else {
        taxLines.push('IVA Exento')
      }

      if (item.ieps_rate !== null && item.ieps_amount > 0) {
        taxLines.push(`IEPS Tasa ${(item.ieps_rate * 100).toFixed(4)}%  Base: ${fmtCurrency(base)}  Importe: ${fmtCurrency(item.ieps_amount)}`)
      }
      if (item.iva_retained_rate !== null && item.iva_retained_amount > 0) {
        taxLines.push(`Ret. IVA ${(item.iva_retained_rate * 100).toFixed(4)}%  Importe: ${fmtCurrency(item.iva_retained_amount)}`)
      }
      if (item.isr_retained_rate !== null && item.isr_retained_amount > 0) {
        taxLines.push(`Ret. ISR ${(item.isr_retained_rate * 100).toFixed(4)}%  Importe: ${fmtCurrency(item.isr_retained_amount)}`)
      }

      if (taxLines.length > 0) {
        doc.font(FONT_I).fontSize(6).fillColor(COLOR_MUTED)
        for (const line of taxLines) {
          doc.text(`  ${line}`, cols[2].x + 2, doc.y, { width: CW - (cols[2].x - ML) })
        }
      }
    }

    doc.y += 2
  }

  // Bottom border
  hline(doc, doc.y)
  doc.y += 5
}

// ── Totals ──────────────────────────────────────────────────────

function drawTotals(doc: PDFKit.PDFDocument, data: InvoicePDFData) {
  const inv = data.invoice
  checkPage(doc, 90)

  const totalsX = ML + CW - 210
  const labelW = 125
  const valueX = totalsX + labelW
  const valueW = 85

  const drawLine = (label: string, value: number, bold = false, color = COLOR_TEXT) => {
    doc.font(bold ? FONT_B : FONT).fontSize(bold ? 8.5 : 7.5).fillColor(color)
    doc.text(label, totalsX, doc.y, { width: labelW, align: 'right' })
    doc.font(bold ? FONT_B : FONT).fontSize(bold ? 8.5 : 7.5).fillColor(color)
    doc.text(fmtCurrency(value), valueX, doc.y - doc.currentLineHeight(), { width: valueW, align: 'right' })
    doc.y += 1
  }

  drawLine('Subtotal:', inv.subtotal)
  if (inv.total_discounts > 0) drawLine('Descuento:', inv.total_discounts)

  // Separator
  doc.moveTo(totalsX, doc.y + 1).lineTo(totalsX + labelW + valueW, doc.y + 1).lineWidth(0.5).strokeColor(COLOR_MUTED).stroke()
  doc.y += 4

  // Transferred taxes
  if (inv.total_iva_16 > 0) drawLine('IVA 16%:', inv.total_iva_16)
  if (inv.total_iva_8 > 0) drawLine('IVA 8%:', inv.total_iva_8)
  if (inv.total_iva_0 > 0) drawLine('IVA 0%:', inv.total_iva_0)
  if (inv.total_ieps > 0) drawLine('IEPS:', inv.total_ieps)

  // Retained taxes
  if (inv.total_iva_retained > 0) drawLine('IVA Retenido:', -inv.total_iva_retained, false, COLOR_RED)
  if (inv.total_isr_retained > 0) drawLine('ISR Retenido:', -inv.total_isr_retained, false, COLOR_RED)

  // Double line before total
  doc.y += 2
  doc.moveTo(totalsX, doc.y).lineTo(totalsX + labelW + valueW, doc.y).lineWidth(1.5).strokeColor(COLOR_PRIMARY).stroke()
  doc.y += 5

  // Total
  const totalY = doc.y
  doc.roundedRect(totalsX, totalY, labelW + valueW, 20, 3).fill(COLOR_HEADER)
  doc.font(FONT_B).fontSize(10).fillColor('#ffffff')
  doc.text('TOTAL:', totalsX + 8, totalY + 4, { width: labelW - 12, align: 'right' })
  doc.text(`${fmtCurrency(inv.total)} ${inv.currency}`, valueX, totalY + 4, { width: valueW, align: 'right' })

  doc.y = totalY + 26
}

// ── Payment Complement (tipo P) ─────────────────────────────────

function drawPaymentComplement(doc: PDFKit.PDFDocument, data: InvoicePDFData) {
  if (!data.paymentDetails) return

  checkPage(doc, 100)
  doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_PRIMARY)
  doc.text('INFORMACIÓN DEL PAGO', ML, doc.y)
  doc.y += 5

  for (const payment of data.paymentDetails) {
    checkPage(doc, 80)

    doc.font(FONT).fontSize(7.5).fillColor(COLOR_TEXT)
    doc.text(`Fecha: ${fmtDate(payment.payment_date)}  |  Forma: ${payment.payment_form} — ${payment.payment_form_desc}  |  Moneda: ${payment.currency}  |  Monto: ${fmtCurrency(payment.amount)}`, ML + 10, doc.y, { width: CW - 10 })
    if (payment.operation_number) {
      doc.text(`No. Operación: ${payment.operation_number}`, ML + 10, doc.y, { width: CW - 10 })
    }
    if (payment.rfc_issuer_bank) {
      doc.text(`Banco: ${payment.issuer_bank_name || ''} (${payment.rfc_issuer_bank})`, ML + 10, doc.y, { width: CW - 10 })
    }
    doc.y += 4

    // Related docs table
    if (payment.related_docs.length > 0) {
      doc.font(FONT_B).fontSize(7).fillColor(COLOR_PRIMARY)
      doc.text('Documentos Relacionados:', ML + 10, doc.y)
      doc.y += 3

      const drCols = [
        { label: 'UUID Documento',  x: ML + 10,  w: 155 },
        { label: 'Serie/Folio',     x: ML + 165, w: 55 },
        { label: 'Parcialidad',     x: ML + 220, w: 50,  align: 'center' as const },
        { label: 'Saldo Anterior',  x: ML + 270, w: 70,  align: 'right' as const },
        { label: 'Pagado',          x: ML + 340, w: 65,  align: 'right' as const },
        { label: 'Saldo Insoluto',  x: ML + 405, w: 70,  align: 'right' as const },
      ]

      const drHy = doc.y
      doc.rect(ML + 10, drHy, CW - 10, 12).fill(COLOR_HEADER)
      doc.font(FONT_B).fontSize(6).fillColor('#ffffff')
      for (const col of drCols) {
        doc.text(col.label, col.x + 2, drHy + 2, { width: col.w - 4, align: col.align || 'left' })
      }
      doc.y = drHy + 14

      for (const rd of payment.related_docs) {
        doc.font(FONT).fontSize(6.5).fillColor(COLOR_TEXT)
        const rdY = doc.y
        doc.text(rd.related_uuid, drCols[0].x + 2, rdY, { width: drCols[0].w - 4 })
        doc.text(`${rd.series || ''}${rd.folio || ''}`, drCols[1].x + 2, rdY, { width: drCols[1].w - 4 })
        doc.text(rd.partial_number.toString(), drCols[2].x + 2, rdY, { width: drCols[2].w - 4, align: 'center' })
        doc.text(fmtCurrency(rd.previous_balance), drCols[3].x + 2, rdY, { width: drCols[3].w - 4, align: 'right' })
        doc.text(fmtCurrency(rd.amount_paid), drCols[4].x + 2, rdY, { width: drCols[4].w - 4, align: 'right' })
        doc.text(fmtCurrency(rd.remaining_balance), drCols[5].x + 2, rdY, { width: drCols[5].w - 4, align: 'right' })
        doc.y = rdY + 10
      }
    }

    doc.y += 5
  }

  hline(doc, doc.y)
  doc.y += 6
}

// ── Carta Porte (tipo T) ────────────────────────────────────────

function drawCartaPorte(doc: PDFKit.PDFDocument, data: InvoicePDFData) {
  const cp = data.cartaPorte!

  checkPage(doc, 120)
  doc.font(FONT_B).fontSize(8.5).fillColor(COLOR_PRIMARY)
  doc.text('COMPLEMENTO CARTA PORTE 3.1', ML, doc.y)
  doc.y += 4

  if (cp.transport_international) {
    doc.font(FONT).fontSize(7.5).fillColor(COLOR_TEXT)
    doc.text('Transporte Internacional: Sí', ML + 10, doc.y)
    doc.y += 3
  }

  // Locations
  doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
  doc.text('UBICACIONES', ML + 10, doc.y)
  doc.y += 3

  for (const loc of cp.locations) {
    checkPage(doc, 30)
    const label = loc.location_type === 'origin' ? 'Origen' : 'Destino'
    doc.font(FONT_B).fontSize(7).fillColor(COLOR_TEXT)
    doc.text(`${label}: ${loc.id_ubicacion}`, ML + 15, doc.y)

    doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
    const addr = [loc.street, loc.ext_number, loc.neighborhood, loc.municipality, loc.state, `CP ${loc.zip_code}`].filter(Boolean).join(', ')
    doc.text(addr, ML + 25, doc.y, { width: CW - 35 })

    if (loc.rfc_addressee) {
      doc.text(`RFC: ${loc.rfc_addressee} — ${loc.addressee_name || ''}`, ML + 25, doc.y)
    }

    const dateParts: string[] = []
    if (loc.departure_date) dateParts.push(`Salida: ${fmtDate(loc.departure_date)}`)
    if (loc.arrival_date) dateParts.push(`Llegada: ${fmtDate(loc.arrival_date)}`)
    if (loc.distance_km) dateParts.push(`Distancia: ${loc.distance_km} km`)
    if (dateParts.length > 0) {
      doc.text(dateParts.join('  |  '), ML + 25, doc.y)
    }
    doc.y += 4
  }

  // Goods
  checkPage(doc, 40)
  doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
  doc.text('MERCANCÍA', ML + 10, doc.y)
  doc.y += 3

  for (const good of cp.goods) {
    doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
    const line = `${good.bienes_transp} | ${good.descripcion} | ${good.cantidad} ${good.clave_unidad} | ${good.peso_kg} kg`
    const valuePart = good.valor_mercancia ? ` | Valor: ${fmtCurrency(good.valor_mercancia)}` : ''
    doc.text(line + valuePart, ML + 15, doc.y, { width: CW - 25 })
    if (good.material_peligroso) {
      doc.font(FONT_B).fontSize(6.5).fillColor(COLOR_RED)
      doc.text('MATERIAL PELIGROSO', ML + 15, doc.y)
    }
  }

  const totalWeight = cp.goods.reduce((sum, g) => sum + g.peso_kg, 0)
  doc.font(FONT_B).fontSize(7).fillColor(COLOR_TEXT)
  doc.text(`Peso Bruto Total: ${totalWeight} kg  |  Total Mercancías: ${cp.goods.length}`, ML + 15, doc.y + 2)
  doc.y += 8

  // Vehicle
  checkPage(doc, 30)
  doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
  doc.text('AUTOTRANSPORTE', ML + 10, doc.y)
  doc.y += 3

  doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
  const veh = cp.vehicle
  if (veh.perm_sct) doc.text(`Permiso SCT: ${veh.perm_sct}  |  No.: ${veh.num_permiso_sct || ''}`, ML + 15, doc.y)
  doc.text(`Config: ${veh.vehicle_config}  |  Placas: ${veh.vehicle_plate}${veh.vehicle_year ? `  |  Año: ${veh.vehicle_year}` : ''}`, ML + 15, doc.y)
  if (veh.insurance_company) {
    doc.text(`Seguro: ${veh.insurance_company}  |  Póliza: ${veh.insurance_policy || ''}`, ML + 15, doc.y)
  }
  doc.y += 4

  // Operators
  doc.font(FONT_B).fontSize(7.5).fillColor(COLOR_PRIMARY)
  doc.text('FIGURA TRANSPORTE', ML + 10, doc.y)
  doc.y += 3

  for (const op of cp.operators) {
    doc.font(FONT).fontSize(7).fillColor(COLOR_TEXT)
    const typeLabel = op.operator_type === 'driver' ? 'Operador' : 'Propietario'
    doc.text(`${typeLabel}: ${op.nombre}  |  RFC: ${op.rfc}${op.num_licencia ? `  |  Licencia: ${op.num_licencia}` : ''}`, ML + 15, doc.y)
  }

  doc.y += 4
  hline(doc, doc.y)
  doc.y += 6
}

// ── Stamps and QR ───────────────────────────────────────────────

async function drawStampsAndQR(doc: PDFKit.PDFDocument, data: InvoicePDFData) {
  const inv = data.invoice

  checkPage(doc, 140)
  hline(doc, doc.y)
  doc.y += 6

  // Build SAT verification URL
  const totalForQR = inv.total.toFixed(6)
  const lastSeal = (inv.issuer_seal || '').slice(-8)
  const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${inv.uuid_fiscal}&re=${data.emisor.rfc}&rr=${data.receptor.rfc}&tt=${totalForQR}&fe=${lastSeal}`

  const qrStartY = doc.y

  // QR Code (left)
  try {
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 130,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
    doc.image(qrBuffer, ML, qrStartY, { width: 100 })
  } catch {
    doc.roundedRect(ML, qrStartY, 100, 100, 3).lineWidth(0.5).strokeColor(COLOR_MUTED).stroke()
    doc.font(FONT).fontSize(7).fillColor(COLOR_RED)
    doc.text('QR no disponible', ML + 15, qrStartY + 42)
  }

  // Seals (right of QR)
  const sx = ML + 115
  const sw = CW - 115

  // Issuer seal
  doc.font(FONT_B).fontSize(6.5).fillColor(COLOR_PRIMARY)
  doc.text('SELLO DIGITAL DEL EMISOR:', sx, qrStartY, { width: sw })
  doc.font(FONT).fontSize(5.5).fillColor(COLOR_MUTED)
  doc.text(truncSeal(inv.issuer_seal, 220), sx, doc.y, { width: sw })
  doc.y += 4

  // SAT seal
  doc.font(FONT_B).fontSize(6.5).fillColor(COLOR_PRIMARY)
  doc.text('SELLO DEL SAT:', sx, doc.y, { width: sw })
  doc.font(FONT).fontSize(5.5).fillColor(COLOR_MUTED)
  doc.text(truncSeal(inv.sat_digital_stamp, 220), sx, doc.y, { width: sw })
  doc.y += 4

  // Original chain
  doc.font(FONT_B).fontSize(6.5).fillColor(COLOR_PRIMARY)
  doc.text('CADENA ORIGINAL DEL COMPLEMENTO DE CERTIFICACIÓN DIGITAL DEL SAT:', sx, doc.y, { width: sw })
  doc.font(FONT).fontSize(5).fillColor(COLOR_MUTED)
  doc.text(truncSeal(inv.xml_original_chain, 300), sx, doc.y, { width: sw })
  doc.y += 4

  // Certificate numbers
  if (inv.sat_certificate_number) {
    doc.font(FONT_B).fontSize(6).fillColor(COLOR_PRIMARY)
    doc.text('No. Certificado SAT: ', sx, doc.y, { continued: true, width: sw })
    doc.font(FONT).fillColor(COLOR_TEXT)
    doc.text(inv.sat_certificate_number)
  }

  if (inv.sat_stamp_date) {
    doc.font(FONT_B).fontSize(6).fillColor(COLOR_PRIMARY)
    doc.text('Fecha Timbrado: ', sx, doc.y, { continued: true, width: sw })
    doc.font(FONT).fillColor(COLOR_TEXT)
    doc.text(fmtDate(inv.sat_stamp_date))
  }

  // Ensure Y is past the QR
  doc.y = Math.max(doc.y, qrStartY + 105) + 6
}

// ── Watermarks ──────────────────────────────────────────────────

function drawWatermark(doc: PDFKit.PDFDocument, text: string, color: string) {
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    doc.save()
    doc.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    doc.rotate(-45)
    doc.font(FONT_B).fontSize(72).fillColor(color).opacity(0.12)
    doc.text(text, -200, -30, { width: 400, align: 'center' })
    doc.restore()
  }
}

// ── Page Numbers ────────────────────────────────────────────────

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    doc.font(FONT).fontSize(6).fillColor(COLOR_FOOTER)
    doc.text(
      `Página ${i + 1} de ${pages.count}`,
      ML, PAGE_HEIGHT - 30,
      { width: CW, align: 'center' }
    )
  }
}
