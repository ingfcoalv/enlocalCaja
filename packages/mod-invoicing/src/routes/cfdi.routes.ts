import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { invoices, invoiceItems, customers, changeJournal } from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'
import { buildCFDI40 } from '../services/cfdiBuilder'
import { generateInvoicePDF } from '../services/invoicePdf.service'
import { getInvoiceForPdf } from '../services/invoices.service'
import {
  getStampsBalance,
  updateLocalStampsAfterUse,
} from '@enlocal/core-license'

const router = Router()

// Helper to get emisor from fiscal_config
async function getEmisor(db: any) {
  const result = await db.execute(sql`SELECT rfc, razon_social, regimen_fiscal, lugar_expedicion, cloud_tenant_id FROM fiscal_config LIMIT 1`)
  const row = (result.rows || result)[0]
  if (!row) {
    return {
      rfc: 'XAXX010101000',
      nombre: 'MI EMPRESA SA DE CV',
      regimenFiscal: '601',
      codigoPostal: '00000',
      cloudTenantId: null,
    }
  }
  return {
    rfc: row.rfc,
    nombre: row.razon_social,
    regimenFiscal: row.regimen_fiscal,
    codigoPostal: row.lugar_expedicion,
    cloudTenantId: row.cloud_tenant_id,
  }
}

// Helper: create settings DB interface from pool
function getSettingsDb(req: any) {
  const pool = req.app.get('pool')
  return {
    query: (s: string, params?: unknown[]) => pool.query(s, params),
    execute: (s: string, params?: unknown[]) => pool.query(s, params),
  }
}

// POST /:id/stamp -- stamp an invoice via cloud API V2
router.post(
  '/:id/stamp',
  requirePermission('invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const io = req.app.get('io')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const settingsDb = getSettingsDb(req)

      // ── Pre-stamp: check stamps balance ──
      const stamps = await getStampsBalance(settingsDb)
      if (stamps.available <= 0) {
        return res.status(402).json({
          error: 'NO_STAMPS',
          message: 'No hay timbres disponibles. Adquiere más en todoenlocal.com',
          stampsAvailable: 0,
        })
      }

      // Fetch invoice
      const invoiceRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)

      if (invoiceRows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      const invoice = invoiceRows[0]

      if (invoice.status !== 'draft' && invoice.status !== 'error') {
        return res.status(409).json({ error: 'Solo borradores o con error pueden timbrarse' })
      }

      // Fetch items
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))

      if (items.length === 0 && invoice.type !== 'P') {
        return res.status(400).json({ error: 'La factura debe tener al menos un concepto' })
      }

      // Fetch customer (receptor) info
      let receptor = {
        rfc: 'XAXX010101000',
        nombre: 'PUBLICO EN GENERAL',
        regimenFiscal: '616',
        usoCfdi: invoice.useCfdi || 'S01',
        codigoPostal: '00000',
      }

      if (invoice.customerId) {
        const customerRows = await db
          .select()
          .from(customers)
          .where(eq(customers.id, invoice.customerId))
          .limit(1)

        if (customerRows.length > 0) {
          const c = customerRows[0]
          receptor = {
            rfc: c.rfc || 'XAXX010101000',
            nombre: c.razonSocial || c.name || 'PUBLICO EN GENERAL',
            regimenFiscal: c.regimenFiscal || '616',
            usoCfdi: invoice.useCfdi || c.usoCfdi || 'S01',
            codigoPostal: c.codigoPostalFiscal || '00000',
          }
        }
      }

      // Use receptor fields from invoice if set (override)
      if (invoice.receptorRfc) receptor.rfc = invoice.receptorRfc
      if (invoice.receptorNombre) receptor.nombre = invoice.receptorNombre
      if (invoice.receptorRegimen) receptor.regimenFiscal = invoice.receptorRegimen
      if (invoice.receptorCp) receptor.codigoPostal = invoice.receptorCp

      // Get emisor from fiscal_config
      const emisor = await getEmisor(db)

      // Try cloud stamping first, fallback to mock
      let stampResult: any

      if (emisor.cloudTenantId) {
        try {
          const { stampCFDI } = await import('../services/cloudStamping.service')
          const cloudResult = await stampCFDI(emisor.cloudTenantId, {
            type: invoice.type,
            emisor: { rfc: emisor.rfc, nombre: emisor.nombre, regimenFiscal: emisor.regimenFiscal, codigoPostal: emisor.codigoPostal },
            receptor,
            serie: invoice.series,
            folio: invoice.folio,
            fecha: new Date().toISOString(),
            formaPago: invoice.paymentForm,
            metodoPago: invoice.paymentMethod,
            moneda: invoice.currency || 'MXN',
            subtotal: invoice.subtotal,
            total: invoice.total,
            conceptos: items.map((item: any) => ({
              claveProdServ: item.satCode || '01010101',
              claveUnidad: item.satUnit || 'E48',
              unidad: item.unit,
              noIdentificacion: item.noIdentificacion,
              descripcion: item.description,
              cantidad: item.quantity,
              valorUnitario: item.unitPrice,
              importe: item.amount,
              descuento: item.discount !== '0' ? item.discount : undefined,
              objetoImp: item.objetoImp || '02',
              impuestos: item.ivaAmount ? {
                traslados: [{
                  base: item.ivaBase,
                  impuesto: '002',
                  tipoFactor: 'Tasa',
                  tasaOCuota: item.ivaRate,
                  importe: item.ivaAmount,
                }],
              } : undefined,
            })),
          })

          if (cloudResult.success) {
            stampResult = {
              uuid: cloudResult.uuid!,
              stampedXml: cloudResult.xml!,
              stampDate: cloudResult.stampDate!,
              cadenaOriginal: cloudResult.cadenaOriginal,
              noCertificadoSAT: cloudResult.noCertificadoSAT,
              selloSAT: cloudResult.selloSAT,
              selloCFD: cloudResult.selloCFD,
              stampsRemaining: cloudResult.stamps_remaining,
            }
          } else {
            // Cloud error — save as error status
            await db.update(invoices).set({
              status: 'error',
              errorMessage: cloudResult.error || 'Error en timbrado cloud',
              updatedAt: sql`now()`,
            }).where(eq(invoices.id, id))

            return res.status(502).json({ error: cloudResult.error || 'Error en timbrado cloud' })
          }
        } catch (err: any) {
          // Cloud unreachable — fallback to mock for dev
          console.warn('[mod-invoicing] Cloud unreachable, using mock PAC:', err.message)
          const { createPACProvider } = await import('../services/pacService')
          const xml = buildCFDI40(invoice, items, emisor, receptor)
          const pac = createPACProvider()
          stampResult = await pac.stamp(xml)
        }
      } else {
        // No cloud config — use mock PAC
        const xml = buildCFDI40(invoice, items, emisor, receptor)
        const { createPACProvider } = await import('../services/pacService')
        const pac = createPACProvider()
        stampResult = await pac.stamp(xml)
      }

      // Update invoice with stamp data
      const [updated] = await db
        .update(invoices)
        .set({
          status: 'stamped',
          uuidFiscal: stampResult.uuid,
          xmlContent: stampResult.stampedXml,
          stampedAt: new Date(stampResult.stampDate),
          xmlOriginalChain: stampResult.cadenaOriginal || null,
          satCertificateNumber: stampResult.noCertificadoSAT || null,
          satDigitalStamp: stampResult.selloSAT || null,
          issuerSeal: stampResult.selloCFD || null,
          satStampDate: stampResult.stampDate,
          errorMessage: null,
          emittedBy: userId,
          emittedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(invoices.id, id))
        .returning()

      await db.insert(changeJournal).values({
        tableName: 'invoices',
        recordId: id,
        action: 'stamp',
        data: { uuidFiscal: stampResult.uuid, stampedAt: stampResult.stampDate },
        userId,
        synced: false,
      })

      // ── Post-stamp: update stamps balance ──
      if (stampResult.stampsRemaining !== undefined) {
        await updateLocalStampsAfterUse(settingsDb, stampResult.stampsRemaining)

        // Emit Socket.io events for low/depleted stamps
        if (io) {
          if (stampResult.stampsRemaining === 0) {
            io.emit('stamps:depleted', { available: 0 })
          } else if (stampResult.stampsRemaining <= 10) {
            io.emit('stamps:low', { available: stampResult.stampsRemaining })
          }
        }
      }

      res.json({
        success: true,
        data: updated,
        uuidFiscal: stampResult.uuid,
        stampedAt: stampResult.stampDate,
        stampsRemaining: stampResult.stampsRemaining,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error stamping invoice' })
    }
  }
)

// POST /:id/cancel -- cancel a stamped invoice
router.post(
  '/:id/cancel',
  requirePermission('invoices.cancel') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const { motivo, folioSustitucion } = req.body

      const invoiceRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)

      if (invoiceRows.length === 0) {
        return res.status(404).json({ error: 'Factura no encontrada' })
      }

      const invoice = invoiceRows[0]

      if (invoice.status !== 'stamped') {
        return res.status(409).json({ error: 'Solo facturas timbradas pueden cancelarse' })
      }

      if (!invoice.uuidFiscal) {
        return res.status(400).json({ error: 'La factura no tiene UUID fiscal' })
      }

      const cancelMotivo = motivo || '02'

      // Try cloud cancellation
      const emisor = await getEmisor(db)
      let cancelResult: any

      if (emisor.cloudTenantId) {
        try {
          const { cancelCFDI } = await import('../services/cloudStamping.service')
          cancelResult = await cancelCFDI(emisor.cloudTenantId, {
            uuid: invoice.uuidFiscal,
            motivo: cancelMotivo,
            folioSustitucion,
          })
        } catch {
          // Fallback to mock
          const { createPACProvider } = await import('../services/pacService')
          const pac = createPACProvider()
          const mockResult = await pac.cancel(invoice.uuidFiscal)
          cancelResult = { success: mockResult.success, status: 'cancelled', cancelDate: mockResult.cancelDate }
        }
      } else {
        const { createPACProvider } = await import('../services/pacService')
        const pac = createPACProvider()
        const mockResult = await pac.cancel(invoice.uuidFiscal)
        cancelResult = { success: mockResult.success, status: 'cancelled', cancelDate: mockResult.cancelDate }
      }

      if (!cancelResult.success) {
        return res.status(502).json({ error: cancelResult.error || 'Error en cancelación' })
      }

      const newStatus = cancelResult.status === 'cancel_pending' ? 'cancel_pending' : 'cancelled'

      const [updated] = await db
        .update(invoices)
        .set({
          status: newStatus,
          cancellationReason: cancelMotivo,
          cancellationUuid: folioSustitucion || null,
          cancelledAt: cancelResult.cancelDate ? new Date(cancelResult.cancelDate) : sql`now()`,
          cancellationResponse: cancelResult.acuse || null,
          updatedAt: sql`now()`,
        })
        .where(eq(invoices.id, id))
        .returning()

      await db.insert(changeJournal).values({
        tableName: 'invoices',
        recordId: id,
        action: 'cancel',
        data: { uuidFiscal: invoice.uuidFiscal, motivo: cancelMotivo, status: newStatus },
        userId,
        synced: false,
      })

      res.json({ success: true, data: updated, status: newStatus })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error cancelling invoice' })
    }
  }
)

// GET /:id/cancel-status -- check cancellation status
router.get(
  '/:id/cancel-status',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const invoiceRows = await db
        .select({ status: invoices.status, uuidFiscal: invoices.uuidFiscal })
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)

      if (!invoiceRows.length) {
        return res.status(404).json({ error: 'Factura no encontrada' })
      }

      res.json({ status: invoiceRows[0].status, uuidFiscal: invoiceRows[0].uuidFiscal })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /:id/xml -- download XML content
router.get(
  '/:id/xml',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const invoiceRows = await db
        .select({
          id: invoices.id,
          series: invoices.series,
          folio: invoices.folio,
          xmlContent: invoices.xmlContent,
        })
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)

      if (invoiceRows.length === 0) {
        return res.status(404).json({ error: 'Factura no encontrada' })
      }

      const invoice = invoiceRows[0]

      if (!invoice.xmlContent) {
        return res.status(404).json({ error: 'La factura no tiene XML. Debe timbrarse primero.' })
      }

      const filename = `${invoice.series || 'INV'}${invoice.folio || invoice.id}.xml`

      res.setHeader('Content-Type', 'application/xml')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(invoice.xmlContent)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching XML' })
    }
  }
)

// GET /:id/pdf -- generate and download PDF
router.get(
  '/:id/pdf',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const data = await getInvoiceForPdf(db, id)
      const pdfBuffer = await generateInvoicePDF(data)

      const filename = `${data.invoice.series || 'CFDI'}-${data.invoice.folio}.pdf`

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      res.setHeader('Content-Length', pdfBuffer.length)
      res.send(pdfBuffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generando PDF' })
    }
  }
)

export default router
