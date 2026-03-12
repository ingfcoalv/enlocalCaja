import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export interface RemissionPDFData {
  folio: string
  series: string
  createdAt: string
  paymentType: string
  creditDays?: number
  dueDate?: string
  status: string
  customer: {
    name: string
    rfc?: string
    phone?: string
    email?: string
    address?: string
  }
  deliveryAddress?: string
  deliveryNotes?: string
  items: {
    productName: string
    productSku?: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    taxAmount: number
    total: number
  }[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  confirmedBy?: string
  confirmedAt?: string
  deliveredBy?: string
  deliveredAt?: string
  receivedBy?: string
  internalNotes?: string
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

export async function generateRemissionPDF(data: RemissionPDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
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
    const disclaimerText = 'Este documento es una nota de remision y no tiene validez fiscal. Los productos amparados en esta nota permanecen en consignacion hasta su pago total.'

    // Draw footer disclaimer on every page
    const drawPageFooter = () => {
      const savedY = doc.y
      const footerY = doc.page.height - doc.page.margins.bottom + 10
      doc.font('Helvetica').fontSize(6).fillColor('#9ca3af')
      doc.text(disclaimerText, doc.page.margins.left, footerY, { width: pageWidth, align: 'center' })
      doc.y = savedY
      doc.fillColor(COLOR_DARK)
    }

    // Footer on first page
    drawPageFooter()
    // Footer on every new page
    doc.on('pageAdded', drawPageFooter)

    // ─── Pre-process logo: convert webp to png if needed ──
    let logoBuffer: Buffer | null = null
    if (data.logoPath && fs.existsSync(data.logoPath)) {
      try {
        const raw = fs.readFileSync(data.logoPath)
        const ext = path.extname(data.logoPath).toLowerCase()
        if (ext === '.webp') {
          logoBuffer = await sharp(raw).png().toBuffer()
        } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
          logoBuffer = raw
        }
      } catch {
        // Skip logo on error
      }
    }

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

    // Folio box (right side)
    const folioBoxX = doc.page.width - doc.page.margins.right - 150
    doc.roundedRect(folioBoxX, headerY, 150, 55, 4).fill(COLOR_PRIMARY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
    doc.text('NOTA DE REMISION', folioBoxX, headerY + 8, { width: 150, align: 'center' })
    doc.fontSize(16)
    doc.text(formattedFolio, folioBoxX, headerY + 24, { width: 150, align: 'center' })
    doc.font('Helvetica').fontSize(8)
    doc.text(formatDate(data.createdAt), folioBoxX, headerY + 43, { width: 150, align: 'center' })

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

    doc.font('Helvetica').fillColor('#6b7280')
    doc.text('Tipo de pago:', doc.page.margins.left + 160, infoY)
    doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
    doc.text(data.paymentType === 'credit' ? `Credito ${data.creditDays || 0} dias` : 'Contado', doc.page.margins.left + 228, infoY)

    if (data.dueDate) {
      doc.font('Helvetica').fillColor('#6b7280')
      doc.text('Vencimiento:', doc.page.margins.left + 360, infoY)
      doc.font('Helvetica-Bold').fillColor(COLOR_DARK)
      doc.text(formatDate(data.dueDate), doc.page.margins.left + 425, infoY)
    }

    doc.y = infoY + 20

    // ─── Customer box ────────────────────────────────────
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 50, 3).fill(COLOR_LIGHT)
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

    doc.y += 58
    doc.fillColor(COLOR_DARK)

    // ─── Delivery address ────────────────────────────────
    if (data.deliveryAddress) {
      doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
      doc.text('DIRECCION DE ENTREGA', doc.page.margins.left)
      doc.font('Helvetica').fontSize(9).fillColor(COLOR_DARK)
      doc.text(data.deliveryAddress, doc.page.margins.left)
      doc.y += 6
    }

    // ─── Items table ─────────────────────────────────────
    const tableTop = doc.y
    const colWidths = [30, 180, 55, 70, 55, 55, 65]
    const colHeaders = ['#', 'Producto', 'Cant', 'P.Unit', 'Desc', 'IVA', 'Total']

    // Table header
    doc.roundedRect(doc.page.margins.left, tableTop, pageWidth, 22, 2).fill(COLOR_HEADER)
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff')
    let colX = doc.page.margins.left + 5
    for (let i = 0; i < colHeaders.length; i++) {
      const align = i >= 2 ? 'right' : 'left'
      doc.text(colHeaders[i], colX, tableTop + 7, { width: colWidths[i] - 6, align })
      colX += colWidths[i]
    }

    // Table rows
    let rowY = tableTop + 24
    doc.fillColor(COLOR_DARK)
    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx]
      const isAlt = idx % 2 === 1

      if (isAlt) {
        doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 20).fill('#f9fafb')
        doc.fillColor(COLOR_DARK)
      }

      doc.font('Helvetica').fontSize(8)
      colX = doc.page.margins.left + 5
      doc.text(String(idx + 1), colX, rowY, { width: colWidths[0] - 6 })
      colX += colWidths[0]

      doc.font('Helvetica').fontSize(8)
      doc.text(item.productName, colX, rowY, { width: colWidths[1] - 6 })
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

      rowY += 20

      // Page break check
      if (rowY > doc.page.height - 180) {
        doc.addPage()
        rowY = doc.page.margins.top
      }
    }

    // ─── Totals (separated 70pt from items) ─────────────
    rowY += 70
    // Check if totals box would overflow into footer area
    if (rowY + 65 > doc.page.height - 80) {
      doc.addPage()
      rowY = doc.page.margins.top
    }
    const totalsX = doc.page.margins.left + pageWidth - 200
    doc.roundedRect(totalsX, rowY, 200, 65, 3).fill(COLOR_HEADER)

    doc.font('Helvetica').fontSize(8).fillColor('#d1d5db')
    doc.text('Subtotal:', totalsX + 10, rowY + 8, { width: 100 })
    doc.text(fmtCurrency(data.subtotal), totalsX + 110, rowY + 8, { width: 80, align: 'right' })

    if (data.discountAmount > 0) {
      doc.text('Descuento:', totalsX + 10, rowY + 20, { width: 100 })
      doc.text(`-${fmtCurrency(data.discountAmount)}`, totalsX + 110, rowY + 20, { width: 80, align: 'right' })
    }

    doc.text('IVA:', totalsX + 10, rowY + 32, { width: 100 })
    doc.text(fmtCurrency(data.taxAmount), totalsX + 110, rowY + 32, { width: 80, align: 'right' })

    doc.moveTo(totalsX + 10, rowY + 44).lineTo(totalsX + 190, rowY + 44).stroke('#6b7280')
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    doc.text('Total:', totalsX + 10, rowY + 48, { width: 100 })
    doc.text(fmtCurrency(data.total), totalsX + 110, rowY + 48, { width: 80, align: 'right' })

    doc.fillColor(COLOR_DARK)
    doc.y = rowY + 75

    // ─── Delivery notes ──────────────────────────────────
    if (data.deliveryNotes) {
      doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
      doc.text('NOTAS DE ENTREGA', doc.page.margins.left)
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_DARK)
      doc.text(data.deliveryNotes, doc.page.margins.left, undefined, { width: pageWidth })
      doc.y += 10
    }

    // ─── Signatures ──────────────────────────────────────
    // Place signatures right after content, not pushed to bottom
    const sigY = doc.y + 20
    // If signatures would not fit, add a page
    if (sigY + 50 > doc.page.height - 40) {
      doc.addPage()
    }
    const finalSigY = sigY + 50 > doc.page.height - 40 ? doc.page.margins.top + 20 : sigY

    const sigWidth = (pageWidth - 40) / 2

    // Entrego
    doc.moveTo(doc.page.margins.left, finalSigY + 30)
      .lineTo(doc.page.margins.left + sigWidth, finalSigY + 30).stroke('#9ca3af')
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    doc.text('Entrego', doc.page.margins.left, finalSigY + 34, { width: sigWidth, align: 'center' })

    // Recibio
    const recibioX = doc.page.margins.left + sigWidth + 40
    doc.moveTo(recibioX, finalSigY + 30)
      .lineTo(recibioX + sigWidth, finalSigY + 30).stroke('#9ca3af')
    doc.text('Recibio', recibioX, finalSigY + 34, { width: sigWidth, align: 'center' })

    doc.end()
  })
}

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
}
