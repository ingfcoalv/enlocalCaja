import PDFDocument from 'pdfkit'

export interface StatementPDFData {
  customer: {
    name: string
    rfc?: string
    phone?: string
    email?: string
  }
  entries: {
    date: string
    concept: string
    charge: number
    credit: number
    balance: number
  }[]
  currentBalance: number
  generatedAt: string
  businessInfo?: {
    name?: string
    rfc?: string
    phone?: string
  }
}

const COLOR_DARK = '#1f2937'
const COLOR_HEADER = '#374151'
const COLOR_LIGHT = '#f3f4f6'

export async function generateStatementPDF(data: StatementPDFData): Promise<Buffer> {
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

    // ─── Header ───────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR_DARK)
    doc.text('Estado de Cuenta', doc.page.margins.left, doc.y, { width: pageWidth, align: 'center' })
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    if (data.businessInfo?.name) {
      doc.text(data.businessInfo.name, { width: pageWidth, align: 'center' })
    }
    doc.text(`Generado: ${formatDate(data.generatedAt)}`, { width: pageWidth, align: 'center' })
    doc.y += 10

    // ─── Customer info ────────────────────────────────────
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 40, 3).fill(COLOR_LIGHT)
    const custY = doc.y + 8
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_DARK)
    doc.text(data.customer.name, doc.page.margins.left + 10, custY)
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    const details: string[] = []
    if (data.customer.rfc) details.push(`RFC: ${data.customer.rfc}`)
    if (data.customer.phone) details.push(`Tel: ${data.customer.phone}`)
    if (details.length) doc.text(details.join('  |  '), doc.page.margins.left + 10, custY + 14)

    doc.font('Helvetica-Bold').fontSize(11)
    doc.fillColor(data.currentBalance > 0 ? '#dc2626' : '#16a34a')
    doc.text(`Saldo: ${fmtCurrency(data.currentBalance)}`, doc.page.margins.left + pageWidth - 200, custY + 4, { width: 190, align: 'right' })

    doc.y += 48
    doc.fillColor(COLOR_DARK)

    // ─── Table ────────────────────────────────────────────
    const colWidths = [80, 200, 75, 75, 80]
    const colHeaders = ['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo']
    const tableTop = doc.y

    // Header row
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

    for (let idx = 0; idx < data.entries.length; idx++) {
      const entry = data.entries[idx]

      if (idx % 2 === 1) {
        doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 16).fill('#f9fafb')
        doc.fillColor(COLOR_DARK)
      }

      doc.font('Helvetica').fontSize(8)
      colX = doc.page.margins.left + 5
      doc.text(formatDate(entry.date), colX, rowY, { width: colWidths[0] - 6 })
      colX += colWidths[0]
      doc.text(entry.concept, colX, rowY, { width: colWidths[1] - 6 })
      colX += colWidths[1]

      doc.fillColor(entry.charge > 0 ? '#dc2626' : COLOR_DARK)
      doc.text(entry.charge > 0 ? fmtCurrency(entry.charge) : '', colX, rowY, { width: colWidths[2] - 6, align: 'right' })
      colX += colWidths[2]

      doc.fillColor(entry.credit > 0 ? '#16a34a' : COLOR_DARK)
      doc.text(entry.credit > 0 ? fmtCurrency(entry.credit) : '', colX, rowY, { width: colWidths[3] - 6, align: 'right' })
      colX += colWidths[3]

      doc.fillColor(COLOR_DARK)
      doc.font('Helvetica-Bold').fontSize(8)
      doc.text(fmtCurrency(entry.balance), colX, rowY, { width: colWidths[4] - 6, align: 'right' })

      rowY += 16

      if (rowY > doc.page.height - 80) {
        doc.addPage()
        rowY = doc.page.margins.top
      }
    }

    // Totals row
    rowY += 4
    doc.roundedRect(doc.page.margins.left, rowY, pageWidth, 20, 2).fill(COLOR_LIGHT)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_DARK)
    doc.text('Saldo Final', doc.page.margins.left + 10, rowY + 5, { width: 270 })

    const totalCharge = data.entries.reduce((s, e) => s + e.charge, 0)
    const totalCredit = data.entries.reduce((s, e) => s + e.credit, 0)

    colX = doc.page.margins.left + 5 + colWidths[0] + colWidths[1]
    doc.fillColor('#dc2626')
    doc.text(fmtCurrency(totalCharge), colX, rowY + 5, { width: colWidths[2] - 6, align: 'right' })
    colX += colWidths[2]
    doc.fillColor('#16a34a')
    doc.text(fmtCurrency(totalCredit), colX, rowY + 5, { width: colWidths[3] - 6, align: 'right' })
    colX += colWidths[3]
    doc.fillColor(COLOR_DARK)
    doc.text(fmtCurrency(data.currentBalance), colX, rowY + 5, { width: colWidths[4] - 6, align: 'right' })

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
