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

interface RelatedInvoice {
  uuidFiscal: string
  series?: string
  folio?: number
  total: string
  currency: string
  paymentMethod: string
}

interface PagoEntry {
  formaPago: string
  amount: number
  date: string
  reference?: string
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

/**
 * Build CFDI 4.0 XML with TipoDeComprobante='P' and Pagos20 complement.
 */
export function buildComplementoPago(
  relatedInvoice: RelatedInvoice,
  pagos: PagoEntry[],
  emisor: Emisor,
  receptor: Receptor,
  fecha?: Date | string
): string {
  const fechaStr = formatDate(fecha || new Date())

  const pagoNodes = pagos.map((pago) => {
    const pagoFecha = formatDate(pago.date)
    const importePagado = pago.amount.toFixed(2)

    return `        <pago20:Pago FechaPago="${pagoFecha}" FormaDePagoP="${escapeXml(pago.formaPago)}" MonedaP="MXN" Monto="${importePagado}" NumOperacion="${escapeXml(pago.reference || '')}">
          <pago20:DoctoRelacionado IdDocumento="${escapeXml(relatedInvoice.uuidFiscal)}" Serie="${escapeXml(relatedInvoice.series || '')}" Folio="${relatedInvoice.folio || ''}" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="${parseFloat(relatedInvoice.total).toFixed(2)}" ImpPagado="${importePagado}" ImpSaldoInsoluto="${(parseFloat(relatedInvoice.total) - pago.amount).toFixed(2)}" ObjetoImpDR="02" EquivalenciaDR="1">
            <pago20:ImpuestosDR>
              <pago20:TrasladosDR>
                <pago20:TrasladoDR BaseDR="${(pago.amount / 1.16).toFixed(2)}" ImpuestoDR="002" TipoFactorDR="Tasa" TasaOCuotaDR="0.160000" ImporteDR="${(pago.amount - pago.amount / 1.16).toFixed(2)}"/>
              </pago20:TrasladosDR>
            </pago20:ImpuestosDR>
          </pago20:DoctoRelacionado>
          <pago20:ImpuestosP>
            <pago20:TrasladosP>
              <pago20:TrasladoP BaseP="${(pago.amount / 1.16).toFixed(2)}" ImpuestoP="002" TipoFactorP="Tasa" TasaOCuotaP="0.160000" ImporteP="${(pago.amount - pago.amount / 1.16).toFixed(2)}"/>
            </pago20:TrasladosP>
          </pago20:ImpuestosP>
        </pago20:Pago>`
  })

  const totalTrasladosBase = pagos.reduce((sum, p) => sum + p.amount / 1.16, 0)
  const totalTrasladosImp = pagos.reduce((sum, p) => sum + (p.amount - p.amount / 1.16), 0)
  const montoTotal = pagos.reduce((sum, p) => sum + p.amount, 0)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/Pagos20 http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd"
  Version="4.0"
  Fecha="${fechaStr}"
  SubTotal="0"
  Total="0"
  Moneda="XXX"
  TipoDeComprobante="P"
  LugarExpedicion="${escapeXml(emisor.codigoPostal)}"
  Exportacion="01"
  NoCertificado=""
  Certificado=""
  Sello="">
  <cfdi:Emisor Rfc="${escapeXml(emisor.rfc)}" Nombre="${escapeXml(emisor.nombre)}" RegimenFiscal="${escapeXml(emisor.regimenFiscal)}"/>
  <cfdi:Receptor Rfc="${escapeXml(receptor.rfc)}" Nombre="${escapeXml(receptor.nombre)}" RegimenFiscalReceptor="${escapeXml(receptor.regimenFiscal)}" UsoCFDI="CP01" DomicilioFiscalReceptor="${escapeXml(receptor.codigoPostal)}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="${totalTrasladosBase.toFixed(2)}" TotalTrasladosImpuestoIVA16="${totalTrasladosImp.toFixed(2)}" MontoTotalPagos="${montoTotal.toFixed(2)}"/>
${pagoNodes.join('\n')}
    </pago20:Pagos>
  </cfdi:Complemento>
</cfdi:Comprobante>`

  return xml
}
