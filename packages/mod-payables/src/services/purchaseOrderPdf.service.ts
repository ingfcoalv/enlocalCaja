import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { settings } from '@enlocal/core-db'
import { eq, inArray } from 'drizzle-orm'

export interface POPDFData {
  folio: number
  series: string
  status: string
  createdAt: string
  expectedDate?: string
  supplier: {
    name: string
    rfc?: string
    phone?: string
    email?: string
    address?: string
  }
  items: {
    productName: string
    productSku?: string
    quantity: number
    unitCost: number
    discount: number
    taxRate: number
    taxAmount: number
    total: number
    notes?: string
  }[]
  subtotal: number
  taxAmount: number
  total: number
  paymentTerms: string
  creditDays?: number
  deliveryAddress?: string
  deliveryNotes?: string
  internalNotes?: string
  businessInfo?: {
    name?: string
    rfc?: string
    address?: string
    phone?: string
    email?: string
  }
  logoPath?: string | null
}

const COLOR_DARK = '#1f2937'
const COLOR_HEADER = '#374151'
const COLOR_LIGHT = '#f3f4f6'
const COLOR_PRIMARY = '#059669'

export async function getBusinessInfo(db: any): Promise<{ businessInfo: any; logoPath: string | null }> {
  const keys = ['business_name', 'business_rfc', 'business_address', 'business_phone', 'business_email', 'business_logo_path']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const r of rows) cfg[r.key] = r.value

  return {
    businessInfo: {
      name: cfg.business_name || '',
      rfc: cfg.business_rfc || '',
      address: cfg.business_address || '',
      phone: cfg.business_phone || '',
      email: cfg.business_email || '',
    },
    logoPath: cfg.business_logo_path || null,
  }
}

export async function generatePurchaseOrderPDF(data: POPDFData): Promise<Buffer> {
  let logoBuffer: Buffer | null = null
  if (data.logoPath && fs.existsSync(data.logoPath)) {
    try {
      const ext = path.extname(data.logoPath).toLowerCase()
      const raw = fs.readFileSync(data.logoPath)
      if (ext === '.webp') {
        const sharp = (await import('sharp')).default
        logoBuffer = await sharp(raw).png().toBuffer()
      } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        logoBuffer = raw
      }
    } catch { /* skip logo */ }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 50, left: 50, right: 50 },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const formattedFolio = `${data.series}-${String(data.folio).padStart(4, '0')}`

    // ─── Header ───────────────────────────────────────────
    let headerY = doc.y

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, doc.page.margins.left, headerY, { width: 80, height: 60 })
      } catch { /* skip */ }
    }

    const bizX = doc.page.margins.left + 95
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_DARK)
    doc.text(data.businessInfo?.name || 'Mi Negocio', bizX, headerY, { width: 250 })
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    if (data.businessInfo?.rfc) doc.text(`RFC: ${data.businessInfo.rfc}`, bizX)
    if (data.businessInfo?.address) doc.text(data.businessInfo.address, bizX, undefined, { width: 250 })
    if (data.businessInfo?.phone) doc.text(`Tel: ${data.businessInfo.phone}`, bizX)
    if (data.businessInfo?.email) doc.text(data.businessInfo.email, bizX)

    // Folio box
    const folioBoxX = doc.page.width - doc.page.margins.right - 150
    doc.roundedRect(folioBoxX, headerY, 150, 55, 4).fill(COLOR_PRIMARY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
    doc.text('ORDEN DE COMPRA', folioBoxX, headerY + 6, { width: 150, align: 'center' })
    doc.fontSize(14)
    doc.text(formattedFolio, folioBoxX, headerY + 22, { width: 150, align: 'center' })
    doc.font('Helvetica').fontSize(8)
    doc.text(data.status.toUpperCase(), folioBoxX, headerY + 40, { width: 150, align: 'center' })

    doc.fillColor(COLOR_DARK)

    // ─── Info row ─────────────────────────────────────────
    doc.y = headerY + 70
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke('#e5e7eb')
    doc.y += 8

    const infoY = doc.y
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    doc.text('Fecha:', doc.page.margins.left, infoY)
    doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
    doc.text(formatDate(data.createdAt), doc.page.margins.left + 40, infoY)

    if (data.expectedDate) {
      doc.font('Helvetica').fillColor('#6b7280')
      doc.text('Entrega:', doc.page.margins.left + 180, infoY)
      doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
      doc.text(formatDate(data.expectedDate), doc.page.margins.left + 225, infoY)
    }

    const paymentLabel = data.paymentTerms === 'credit'
      ? `Credito ${data.creditDays || 30} dias`
      : data.paymentTerms === 'cash' ? 'Contado' : data.paymentTerms
    doc.font('Helvetica').fillColor('#6b7280')
    doc.text('Pago:', doc.page.margins.left + 370, infoY)
    doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
    doc.text(paymentLabel, doc.page.margins.left + 400, infoY)

    doc.y = infoY + 20

    // ─── Supplier box ─────────────────────────────────────
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 55, 3).fill(COLOR_LIGHT)
    const custY = doc.y + 8
    doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
    doc.text('PROVEEDOR', doc.page.margins.left + 10, custY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_DARK)
    doc.text(data.supplier.name, doc.page.margins.left + 10, custY + 10, { width: 250 })
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    if (data.supplier.rfc) doc.text(`RFC: ${data.supplier.rfc}`, doc.page.margins.left + 10, custY + 24)
    if (data.supplier.phone) doc.text(`Tel: ${data.supplier.phone}`, doc.page.margins.left + 280, custY + 10)
    if (data.supplier.email) doc.text(data.supplier.email, doc.page.margins.left + 280, custY + 24)

    doc.y += 63
    doc.fillColor(COLOR_DARK)

    // ─── Items table ──────────────────────────────────────
    const tableTop = doc.y
    const colWidths = [30, 200, 55, 75, 60, 90]
    const colHeaders = ['#', 'Producto', 'Cant', 'P.Unit', 'IVA', 'Total']

    doc.roundedRect(doc.page.margins.left, tableTop, pageWidth, 20, 2).fill(COLOR_HEADER)
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff')
    let colX = doc.page.margins.left + 5
    for (let i = 0; i < colHeaders.length; i++) {
      const align = i >= 2 ? 'right' : 'left'
      doc.text(colHeaders[i], colX, tableTop + 6, { width: colWidths[i] - 6, align })
      colX += colWidths[i]
    }

    let rowY = tableTop + 22
    doc.fillColor(COLOR_DARK)
    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx]
      if (idx % 2 === 1) {
        doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 20).fill('#f9fafb')
        doc.fillColor(COLOR_DARK)
      }

      doc.font('Helvetica').fontSize(8)
      colX = doc.page.margins.left + 5
      doc.text(String(idx + 1), colX, rowY, { width: colWidths[0] - 6 })
      colX += colWidths[0]

      let nameText = item.productName
      if (item.productSku) nameText += ` (${item.productSku})`
      doc.text(nameText, colX, rowY, { width: colWidths[1] - 6 })
      colX += colWidths[1]

      doc.text(String(item.quantity), colX, rowY, { width: colWidths[2] - 6, align: 'right' })
      colX += colWidths[2]

      doc.text(fmtCurrency(item.unitCost), colX, rowY, { width: colWidths[3] - 6, align: 'right' })
      colX += colWidths[3]

      doc.text(fmtCurrency(item.taxAmount), colX, rowY, { width: colWidths[4] - 6, align: 'right' })
      colX += colWidths[4]

      doc.font('Helvetica-Bold').fontSize(8)
      doc.text(fmtCurrency(item.total), colX, rowY, { width: colWidths[5] - 6, align: 'right' })

      rowY += 20
      if (rowY > doc.page.height - 180) {
        doc.addPage()
        rowY = doc.page.margins.top
      }
    }

    doc.y = rowY

    // ─── Totals ──────────────────────────────────────────
    doc.y += 80
    const totalsX = doc.page.margins.left + pageWidth - 200
    doc.roundedRect(totalsX, doc.y, 200, 78, 3).fill(COLOR_HEADER)

    let totRowY = doc.y + 10
    doc.font('Helvetica').fontSize(8).fillColor('#d1d5db')
    doc.text('Subtotal:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.subtotal), totalsX + 110, totRowY, { width: 80, align: 'right' })
    totRowY += 16
    doc.text('IVA:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.taxAmount), totalsX + 110, totRowY, { width: 80, align: 'right' })
    totRowY += 14
    doc.moveTo(totalsX + 10, totRowY).lineTo(totalsX + 190, totRowY).stroke('#6b7280')
    totRowY += 6
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    doc.text('Total:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.total), totalsX + 110, totRowY, { width: 80, align: 'right' })

    doc.fillColor(COLOR_DARK)
    doc.y = doc.y + 88

    // ─── Delivery info ───────────────────────────────────
    if (data.deliveryAddress) {
      checkPageBreak(doc, 40)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_PRIMARY)
      doc.text('DIRECCION DE ENTREGA', doc.page.margins.left, doc.y)
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_DARK)
      doc.text(data.deliveryAddress, doc.page.margins.left, doc.y + 2, { width: pageWidth })
      doc.y += 16
    }

    if (data.deliveryNotes) {
      checkPageBreak(doc, 40)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_PRIMARY)
      doc.text('NOTAS DE ENTREGA', doc.page.margins.left, doc.y)
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_DARK)
      doc.text(data.deliveryNotes, doc.page.margins.left, doc.y + 2, { width: pageWidth })
      doc.y += 16
    }

    // ─── Footer disclaimer ───────────────────────────────
    const footerY = doc.page.height - 30
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(6).fillColor('#9ca3af')
    doc.text(
      'Este documento es una orden de compra y esta sujeto a los terminos acordados con el proveedor.',
      doc.page.margins.left, footerY, { width: pageWidth, align: 'center', lineBreak: false }
    )
    doc.page.margins.bottom = savedBottom

    doc.end()
  })
}

function checkPageBreak(doc: any, neededHeight: number) {
  if (doc.y + neededHeight > doc.page.height - 60) {
    doc.addPage()
  }
}

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
}
