import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export interface QuotePDFData {
  folio: string
  series: string
  version: number
  createdAt: string
  validUntil?: string
  status: string
  customer: {
    name: string
    rfc?: string
    phone?: string
    email?: string
    address?: string
  }
  items: {
    itemName: string
    itemDescription?: string
    itemSku?: string
    itemType: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    taxAmount: number
    total: number
    groupName?: string
    isOptional: boolean
  }[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  conditions?: string
  notes?: string
  termsAndConditions?: string
  salesPersonName?: string
  businessInfo?: {
    name?: string
    rfc?: string
    address?: string
    phone?: string
    email?: string
  }
  logoPath?: string
}

const COLOR_DARK = '#1f2937'
const COLOR_HEADER = '#374151'
const COLOR_LIGHT = '#f3f4f6'
const COLOR_PRIMARY = '#2563eb'
const COLOR_OPTIONAL = '#f59e0b'

export async function generateQuotePDF(data: QuotePDFData): Promise<Buffer> {
  // Pre-process logo: convert webp to png if needed
  let logoBuffer: Buffer | null = null
  if (data.logoPath && fs.existsSync(data.logoPath)) {
    try {
      const ext = path.extname(data.logoPath).toLowerCase()
      const raw = fs.readFileSync(data.logoPath)
      if (ext === '.webp') {
        logoBuffer = await sharp(raw).png().toBuffer()
      } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        logoBuffer = raw
      }
    } catch {
      // Skip logo on error
    }
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

    // Logo (left side)
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, doc.page.margins.left, headerY, { width: 80, height: 60 })
      } catch {
        // Skip logo on error
      }
    }

    // Business info (center-left)
    const bizX = doc.page.margins.left + 95
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_DARK)
    doc.text(data.businessInfo?.name || 'Mi Negocio', bizX, headerY, { width: 250 })
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    if (data.businessInfo?.rfc) doc.text(`RFC: ${data.businessInfo.rfc}`, bizX)
    if (data.businessInfo?.address) doc.text(data.businessInfo.address, bizX, undefined, { width: 250 })
    if (data.businessInfo?.phone) doc.text(`Tel: ${data.businessInfo.phone}`, bizX)
    if (data.businessInfo?.email) doc.text(data.businessInfo.email, bizX)

    // Folio box (right side)
    const folioBoxX = doc.page.width - doc.page.margins.right - 150
    doc.roundedRect(folioBoxX, headerY, 150, 55, 4).fill(COLOR_PRIMARY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
    doc.text('COTIZACION', folioBoxX, headerY + 6, { width: 150, align: 'center' })
    doc.fontSize(14)
    doc.text(formattedFolio, folioBoxX, headerY + 20, { width: 150, align: 'center' })
    doc.font('Helvetica').fontSize(8)
    doc.text(`Version ${data.version}`, folioBoxX, headerY + 38, { width: 150, align: 'center' })

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

    if (data.validUntil) {
      doc.font('Helvetica').fillColor('#6b7280')
      doc.text('Vigencia:', doc.page.margins.left + 180, infoY)
      doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
      doc.text(formatDate(data.validUntil), doc.page.margins.left + 230, infoY)
    }

    doc.y = infoY + 20

    // ─── Customer box ────────────────────────────────────
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 55, 3).fill(COLOR_LIGHT)
    const custY = doc.y + 8
    doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
    doc.text('CLIENTE', doc.page.margins.left + 10, custY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_DARK)
    doc.text(data.customer.name, doc.page.margins.left + 10, custY + 10, { width: 250 })
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    if (data.customer.rfc) {
      doc.text(`RFC: ${data.customer.rfc}`, doc.page.margins.left + 10, custY + 24)
    }
    if (data.customer.phone) {
      doc.text(`Tel: ${data.customer.phone}`, doc.page.margins.left + 280, custY + 10)
    }
    if (data.customer.email) {
      doc.text(data.customer.email, doc.page.margins.left + 280, custY + 24)
    }
    if (data.customer.address) {
      doc.text(data.customer.address, doc.page.margins.left + 10, custY + 36, { width: pageWidth - 20 })
    }

    doc.y += 63
    doc.fillColor(COLOR_DARK)

    // ─── Group and render items ──────────────────────────
    const regularItems = data.items.filter(i => !i.isOptional)
    const optionalItems = data.items.filter(i => i.isOptional)

    // Group regular items by groupName
    const groups = new Map<string, typeof regularItems>()
    for (const item of regularItems) {
      const key = item.groupName || '__default__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }

    // Render regular items (grouped)
    for (const [groupName, groupItems] of groups) {
      if (groupName !== '__default__') {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_PRIMARY)
        doc.text(groupName, doc.page.margins.left, doc.y + 4)
        doc.y += 14
      }

      renderItemsTable(doc, groupItems, pageWidth, false)
    }

    // Render optional items
    if (optionalItems.length > 0) {
      doc.y += 8
      doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 18, 2).fill(COLOR_OPTIONAL)
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
      doc.text('ITEMS OPCIONALES (no incluidos en el total)', doc.page.margins.left + 8, doc.y + 5, { width: pageWidth })
      doc.y += 22

      renderItemsTable(doc, optionalItems, pageWidth, true)
    }

    // ─── Totals ──────────────────────────────────────────
    doc.y += 50
    const totalsX = doc.page.margins.left + pageWidth - 200
    const hasDiscount = data.discountAmount > 0
    const totBoxH = hasDiscount ? 90 : 78
    doc.roundedRect(totalsX, doc.y, 200, totBoxH, 3).fill(COLOR_HEADER)

    let totRowY = doc.y + 10
    doc.font('Helvetica').fontSize(8).fillColor('#d1d5db')
    doc.text('Subtotal:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.subtotal), totalsX + 110, totRowY, { width: 80, align: 'right' })

    totRowY += 16
    if (hasDiscount) {
      doc.text('Descuento:', totalsX + 10, totRowY, { width: 100 })
      doc.text(`-${fmtCurrency(data.discountAmount)}`, totalsX + 110, totRowY, { width: 80, align: 'right' })
      totRowY += 16
    }

    doc.text('IVA:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.taxAmount), totalsX + 110, totRowY, { width: 80, align: 'right' })

    totRowY += 14
    doc.moveTo(totalsX + 10, totRowY).lineTo(totalsX + 190, totRowY).stroke('#6b7280')
    totRowY += 6
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    doc.text('Total:', totalsX + 10, totRowY, { width: 100 })
    doc.text(fmtCurrency(data.total), totalsX + 110, totRowY, { width: 80, align: 'right' })

    doc.fillColor(COLOR_DARK)
    doc.y = doc.y + totBoxH + 10

    // ─── Conditions ──────────────────────────────────────
    if (data.conditions) {
      checkPageBreak(doc, 60)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_PRIMARY)
      doc.text('CONDICIONES', doc.page.margins.left, doc.y)
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_DARK)
      doc.text(data.conditions, doc.page.margins.left, doc.y + 2, { width: pageWidth })
      doc.y += 12
    }

    // ─── Notes ───────────────────────────────────────────
    if (data.notes) {
      checkPageBreak(doc, 60)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_PRIMARY)
      doc.text('NOTAS', doc.page.margins.left, doc.y)
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_DARK)
      doc.text(data.notes, doc.page.margins.left, doc.y + 2, { width: pageWidth })
      doc.y += 12
    }

    // ─── Terms and Conditions ────────────────────────────
    if (data.termsAndConditions) {
      checkPageBreak(doc, 80)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_PRIMARY)
      doc.text('TERMINOS Y CONDICIONES', doc.page.margins.left, doc.y)
      doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
      doc.text(data.termsAndConditions, doc.page.margins.left, doc.y + 2, { width: pageWidth })
      doc.y += 12
    }

    // ─── Footer ──────────────────────────────────────────
    if (data.salesPersonName) {
      checkPageBreak(doc, 40)
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
      doc.text(`Atendido por: ${data.salesPersonName}`, doc.page.margins.left, doc.y)
      doc.y += 16
    }

    // Footer disclaimer — render inside the bottom margin without triggering a new page
    const footerY = doc.page.height - 30
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(6).fillColor('#9ca3af')
    doc.text(
      'Este documento es una cotizacion y no tiene validez fiscal. Los precios y condiciones estan sujetos a cambios sin previo aviso.',
      doc.page.margins.left, footerY, { width: pageWidth, align: 'center', lineBreak: false }
    )
    doc.page.margins.bottom = savedBottom

    doc.end()
  })
}

function renderItemsTable(doc: any, items: any[], pageWidth: number, isOptional: boolean) {
  const tableTop = doc.y
  const colWidths = [30, 185, 50, 70, 55, 55, 65]
  const colHeaders = ['#', 'Descripcion', 'Cant', 'P.Unit', 'Desc', 'IVA', 'Total']

  // Table header
  doc.roundedRect(doc.page.margins.left, tableTop, pageWidth, 20, 2).fill(isOptional ? '#92400e' : COLOR_HEADER)
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff')
  let colX = doc.page.margins.left + 5
  for (let i = 0; i < colHeaders.length; i++) {
    const align = i >= 2 ? 'right' : 'left'
    doc.text(colHeaders[i], colX, tableTop + 6, { width: colWidths[i] - 6, align })
    colX += colWidths[i]
  }

  // Table rows
  let rowY = tableTop + 22
  doc.fillColor(COLOR_DARK)
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const isAlt = idx % 2 === 1

    if (isAlt) {
      doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 20).fill('#f9fafb')
      doc.fillColor(COLOR_DARK)
    }

    doc.font('Helvetica').fontSize(8)
    colX = doc.page.margins.left + 5
    doc.text(String(idx + 1), colX, rowY, { width: colWidths[0] - 6 })
    colX += colWidths[0]

    // Name + description
    doc.font('Helvetica').fontSize(8)
    let nameText = item.itemName
    if (item.itemDescription) nameText += `\n${item.itemDescription}`
    doc.text(nameText, colX, rowY, { width: colWidths[1] - 6 })
    colX += colWidths[1]

    doc.text(String(item.quantity), colX, rowY, { width: colWidths[2] - 6, align: 'right' })
    colX += colWidths[2]

    doc.text(fmtCurrency(item.unitPrice), colX, rowY, { width: colWidths[3] - 6, align: 'right' })
    colX += colWidths[3]

    doc.text(item.discount > 0 ? fmtCurrency(item.discount) : '-', colX, rowY, { width: colWidths[4] - 6, align: 'right' })
    colX += colWidths[4]

    doc.text(fmtCurrency(item.taxAmount), colX, rowY, { width: colWidths[5] - 6, align: 'right' })
    colX += colWidths[5]

    doc.font('Helvetica-Bold').fontSize(8)
    doc.text(fmtCurrency(item.total), colX, rowY, { width: colWidths[6] - 6, align: 'right' })

    rowY += item.itemDescription ? 28 : 20

    // Page break check
    if (rowY > doc.page.height - 180) {
      doc.addPage()
      rowY = doc.page.margins.top
    }
  }

  doc.y = rowY
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
