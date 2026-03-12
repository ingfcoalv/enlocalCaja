interface Emisor {
  rfc: string
  nombre: string
  regimenFiscal: string
  codigoPostal: string
}

interface Receptor {
  rfc: string
  nombre: string
  regimenFiscal: string
  usoCfdi: string
  codigoPostal: string
}

interface InvoiceData {
  series?: string
  folio?: number
  type: string
  subtotal: string
  tax: string
  total: string
  currency: string
  paymentMethod?: string
  paymentForm?: string
  createdAt: Date | string
}

interface InvoiceItemData {
  description: string
  quantity: string
  unitPrice: string
  amount: string
  discount: string
  satCode?: string
  satUnit?: string
  taxRate: string
}

function escapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function buildCFDI40(
  invoice: InvoiceData,
  items: InvoiceItemData[],
  emisor: Emisor,
  receptor: Receptor
): string {
  const fecha = formatDate(invoice.createdAt)
  const subtotal = parseFloat(invoice.subtotal).toFixed(2)
  const total = parseFloat(invoice.total).toFixed(2)

  // Calculate total transferred taxes per item
  const conceptos = items.map((item) => {
    const amount = parseFloat(item.amount)
    const taxRate = parseFloat(item.taxRate) || 0.16
    const taxAmount = (amount * taxRate).toFixed(2)
    const satCode = item.satCode || '01010101'
    const satUnit = item.satUnit || 'E48'

    return `      <cfdi:Concepto ClaveProdServ="${escapeXml(satCode)}" NoIdentificacion="" Cantidad="${item.quantity}" ClaveUnidad="${escapeXml(satUnit)}" Descripcion="${escapeXml(item.description)}" ValorUnitario="${parseFloat(item.unitPrice).toFixed(2)}" Importe="${amount.toFixed(2)}" Descuento="${parseFloat(item.discount).toFixed(2)}" ObjetoImp="02">
        <cfdi:Impuestos>
          <cfdi:Traslados>
            <cfdi:Traslado Base="${amount.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${taxRate.toFixed(6)}" Importe="${taxAmount}"/>
          </cfdi:Traslados>
        </cfdi:Impuestos>
      </cfdi:Concepto>`
  })

  // Calculate total taxes
  const totalTax = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount)
    const taxRate = parseFloat(item.taxRate) || 0.16
    return sum + amount * taxRate
  }, 0)

  const totalBase = items.reduce((sum, item) => {
    return sum + parseFloat(item.amount)
  }, 0)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
  Version="4.0"
  Serie="${escapeXml(invoice.series || '')}"
  Folio="${invoice.folio || ''}"
  Fecha="${fecha}"
  FormaPago="${escapeXml(invoice.paymentForm || '99')}"
  MetodoPago="${escapeXml(invoice.paymentMethod || 'PUE')}"
  TipoDeComprobante="${escapeXml(invoice.type || 'I')}"
  LugarExpedicion="${escapeXml(emisor.codigoPostal)}"
  Moneda="${escapeXml(invoice.currency || 'MXN')}"
  SubTotal="${subtotal}"
  Total="${total}"
  Exportacion="01"
  NoCertificado=""
  Certificado=""
  Sello="">
  <cfdi:Emisor Rfc="${escapeXml(emisor.rfc)}" Nombre="${escapeXml(emisor.nombre)}" RegimenFiscal="${escapeXml(emisor.regimenFiscal)}"/>
  <cfdi:Receptor Rfc="${escapeXml(receptor.rfc)}" Nombre="${escapeXml(receptor.nombre)}" RegimenFiscalReceptor="${escapeXml(receptor.regimenFiscal)}" UsoCFDI="${escapeXml(receptor.usoCfdi)}" DomicilioFiscalReceptor="${escapeXml(receptor.codigoPostal)}"/>
  <cfdi:Conceptos>
${conceptos.join('\n')}
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${totalTax.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${totalBase.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${totalTax.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>`

  return xml
}
