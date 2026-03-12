import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import * as purchaseOrderService from '../services/purchaseOrder.service'
import { generatePurchaseOrderPDF, getBusinessInfo } from '../services/purchaseOrderPdf.service'
import { sendPurchaseOrderEmail } from '../services/mailer.service'
import { createPurchaseOrderSchema, updatePurchaseOrderSchema, cancelPurchaseOrderSchema, closePurchaseOrderSchema } from '../validators/purchaseOrder.validator'
import { suppliers } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'

const router = Router()

// GET / — list purchase orders
router.get(
  '/',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseOrderService.getAll(db, {
        status: req.query.status as string | undefined,
        supplier_id: req.query.supplier_id as string | undefined,
        payment_terms: req.query.payment_terms as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing purchase orders' })
    }
  }
)

// GET /:id — get purchase order detail
router.get(
  '/:id',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseOrderService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Orden de compra no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching purchase order' })
    }
  }
)

// POST / — create purchase order
router.post(
  '/',
  requirePermission('purchase_orders.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createPurchaseOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await purchaseOrderService.create(
        db, parsed.data, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('purchaseOrder:created', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating purchase order' })
    }
  }
)

// PUT /:id — update purchase order (draft only)
router.put(
  '/:id',
  requirePermission('purchase_orders.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updatePurchaseOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await purchaseOrderService.update(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating purchase order' })
    }
  }
)

// POST /:id/approve — approve purchase order
router.post(
  '/:id/approve',
  requirePermission('purchase_orders.approve') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseOrderService.approve(
        db, req.params.id, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'manager'
      )
      const io = req.app.get('io')
      if (io) io.emit('purchaseOrder:approved', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error approving purchase order' })
    }
  }
)

// POST /:id/cancel — cancel purchase order
router.post(
  '/:id/cancel',
  requirePermission('purchase_orders.cancel') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = cancelPurchaseOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await purchaseOrderService.cancel(
        db, req.params.id, req.user?.id ?? 'system', parsed.data.reason,
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('purchaseOrder:cancelled', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error cancelling purchase order' })
    }
  }
)

// POST /:id/close — close purchase order (partial received)
router.post(
  '/:id/close',
  requirePermission('purchase_orders.cancel') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = closePurchaseOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await purchaseOrderService.closeOrder(
        db, req.params.id, req.user?.id ?? 'system', parsed.data.reason,
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('purchaseOrder:closed', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error closing purchase order' })
    }
  }
)

// GET /:id/print — print data
router.get(
  '/:id/print',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseOrderService.getPrintData(db, req.params.id)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating print data' })
    }
  }
)

// GET /:id/pdf — download purchase order as PDF
router.get(
  '/:id/pdf',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const order = await purchaseOrderService.getById(db, req.params.id)
      if (!order) return res.status(404).json({ error: 'Orden de compra no encontrada' })

      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId))
      const { businessInfo, logoPath } = await getBusinessInfo(db)

      const pdfData = {
        folio: order.folio,
        series: order.series || 'OC',
        status: order.status,
        createdAt: order.createdAt,
        expectedDate: order.expectedDate,
        supplier: {
          name: order.supplierName || supplier?.name || '',
          rfc: order.supplierRfc || supplier?.rfc || '',
          phone: supplier?.phone || '',
          email: supplier?.email || '',
        },
        items: (order.items || []).map((it: any) => ({
          productName: it.productName,
          productSku: it.productSku,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate),
          taxAmount: Number(it.taxAmount),
          total: Number(it.total),
          notes: it.notes,
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        total: Number(order.total),
        paymentTerms: order.paymentTerms,
        creditDays: order.creditDays,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        internalNotes: order.internalNotes,
        businessInfo,
        logoPath,
      }

      const pdfBuffer = await generatePurchaseOrderPDF(pdfData)
      const filename = `OC-${String(order.folio).padStart(4, '0')}.pdf`

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdfBuffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating PDF' })
    }
  }
)

// POST /:id/send-email — send purchase order by email to supplier
router.post(
  '/:id/send-email',
  requirePermission('purchase_orders.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const order = await purchaseOrderService.getById(db, req.params.id)
      if (!order) return res.status(404).json({ error: 'Orden de compra no encontrada' })

      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId))
      const toEmail = req.body.to || supplier?.email || supplier?.contactEmail
      if (!toEmail) return res.status(400).json({ error: 'No se encontro email del proveedor. Proporcionalo en el campo "to".' })

      const { businessInfo, logoPath } = await getBusinessInfo(db)
      const folio = `OC-${String(order.folio).padStart(4, '0')}`

      const pdfData = {
        folio: order.folio,
        series: order.series || 'OC',
        status: order.status,
        createdAt: order.createdAt,
        expectedDate: order.expectedDate,
        supplier: {
          name: order.supplierName || supplier?.name || '',
          rfc: order.supplierRfc || supplier?.rfc || '',
          phone: supplier?.phone || '',
          email: supplier?.email || '',
        },
        items: (order.items || []).map((it: any) => ({
          productName: it.productName,
          productSku: it.productSku,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate),
          taxAmount: Number(it.taxAmount),
          total: Number(it.total),
          notes: it.notes,
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        total: Number(order.total),
        paymentTerms: order.paymentTerms,
        creditDays: order.creditDays,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        internalNotes: order.internalNotes,
        businessInfo,
        logoPath,
      }

      const pdfBuffer = await generatePurchaseOrderPDF(pdfData)
      const businessName = businessInfo?.name || 'Mi Negocio'
      const subject = req.body.subject || `Orden de Compra ${folio} — ${businessName}`
      const body = req.body.body || `
        <h2>Orden de Compra ${folio}</h2>
        <p>Estimado proveedor,</p>
        <p>Adjuntamos la orden de compra <strong>${folio}</strong> por un total de <strong>$${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>.</p>
        <p>Favor de confirmar recepcion y disponibilidad.</p>
        <p>Saludos,<br/>${businessName}</p>
      `

      await sendPurchaseOrderEmail(db, {
        to: toEmail,
        cc: req.body.cc,
        subject,
        body,
        pdfBuffer,
        pdfFilename: `${folio}.pdf`,
      })

      res.json({ success: true, sentTo: toEmail })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al enviar email' })
    }
  }
)

export default router
