import PDFDocument from 'pdfkit'

export interface AgingPDFData {
  rows: {
    customerName: string
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days90plus: number
    total: number
  }[]
  totals: {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days90plus: number
    total: number
  }
  asOfDate: string
  businessInfo?: {
    name?: string
  }
}

const COLOR_DARK = '#1f2937'
const COLOR_HEADER = '#374151'
const COLOR_LIGHT = '#f3f4f6'

export async function generateAgingPDF(data: AgingPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    // ─── Header ───────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR_DARK)
    doc.text('Antiguedad de Saldos', doc.page.margins.left, doc.y, { width: pageWidth, align: 'center' })
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    if (data.businessInfo?.name) {
      doc.text(data.businessInfo.name, { width: pageWidth, align: 'center' })
    }
    doc.text(`Al ${formatDate(data.asOfDate)}`, { width: pageWidth, align: 'center' })
    doc.y += 12

    // ─── Table ────────────────────────────────────────────
    const colWidths = [180, 90, 90, 90, 90, 90, 90]
    const colHeaders = ['Cliente', 'Vigente', '1-30 dias', '31-60 dias', '61-90 dias', '90+ dias', 'Total']
    const tableTop = doc.y

    // Header row
    doc.roundedRect(doc.page.margins.left, tableTop, pageWidth, 22, 2).fill(COLOR_HEADER)
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
    let colX = doc.page.margins.left + 5
    for (let i = 0; i < colHeaders.length; i++) {
      const align = i >= 1 ? 'right' : 'left'
      doc.text(colHeaders[i], colX, tableTop + 7, { width: colWidths[i] - 10, align })
      colX += colWidths[i]
    }

    let rowY = tableTop + 24
    doc.fillColor(COLOR_DARK)

    for (let idx = 0; idx < data.rows.length; idx++) {
      const row = data.rows[idx]

      if (idx % 2 === 1) {
        doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 18).fill('#f9fafb')
        doc.fillColor(COLOR_DARK)
      }

      doc.font('Helvetica').fontSize(8)
      colX = doc.page.margins.left + 5

      doc.font('Helvetica-Bold').text(row.customerName, colX, rowY, { width: colWidths[0] - 10 })
      colX += colWidths[0]

      doc.font('Helvetica')
      doc.text(row.current ? fmtCurrency(row.current) : '-', colX, rowY, { width: colWidths[1] - 10, align: 'right' })
      colX += colWidths[1]
      doc.text(row.days1to30 ? fmtCurrency(row.days1to30) : '-', colX, rowY, { width: colWidths[2] - 10, align: 'right' })
      colX += colWidths[2]

      doc.fillColor(row.days31to60 > 0 ? '#ca8a04' : COLOR_DARK)
      doc.text(row.days31to60 ? fmtCurrency(row.days31to60) : '-', colX, rowY, { width: colWidths[3] - 10, align: 'right' })
      colX += colWidths[3]

      doc.fillColor(row.days61to90 > 0 ? '#ea580c' : COLOR_DARK)
      doc.text(row.days61to90 ? fmtCurrency(row.days61to90) : '-', colX, rowY, { width: colWidths[4] - 10, align: 'right' })
      colX += colWidths[4]

      doc.fillColor(row.days90plus > 0 ? '#dc2626' : COLOR_DARK)
      doc.text(row.days90plus ? fmtCurrency(row.days90plus) : '-', colX, rowY, { width: colWidths[5] - 10, align: 'right' })
      colX += colWidths[5]

      doc.fillColor(COLOR_DARK)
      doc.font('Helvetica-Bold')
      doc.text(fmtCurrency(row.total), colX, rowY, { width: colWidths[6] - 10, align: 'right' })

      rowY += 18

      if (rowY > doc.page.height - 60) {
        doc.addPage()
        rowY = doc.page.margins.top
      }
    }

    // ─── Totals row ──────────────────────────────────────
    rowY += 4
    doc.roundedRect(doc.page.margins.left, rowY, pageWidth, 22, 2).fill(COLOR_HEADER)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')

    colX = doc.page.margins.left + 5
    doc.text('TOTALES', colX, rowY + 6, { width: colWidths[0] - 10 })
    colX += colWidths[0]

    const vals = [data.totals.current, data.totals.days1to30, data.totals.days31to60, data.totals.days61to90, data.totals.days90plus, data.totals.total]
    for (let i = 0; i < vals.length; i++) {
      doc.text(fmtCurrency(vals[i]), colX, rowY + 6, { width: colWidths[i + 1] - 10, align: 'right' })
      colX += colWidths[i + 1]
    }

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
