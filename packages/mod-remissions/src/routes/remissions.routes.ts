import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { eq, inArray } from 'drizzle-orm'
import { settings } from '@enlocal/core-db'
import * as remissionService from '../services/remission.service'
import { generateRemissionPDF } from '../services/pdfGenerator'
import { createRemissionSchema, updateRemissionSchema, cancelRemissionSchema } from '../validators/remission.validator'

const router = Router()

// GET / — list remission notes
router.get(
  '/',
  requirePermission('remissions.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await remissionService.getAll(db, {
        status: req.query.status as string | undefined,
        customer_id: req.query.customer_id as string | undefined,
        payment_type: req.query.payment_type as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing remissions' })
    }
  }
)

// GET /:id — get remission note detail
router.get(
  '/:id',
  requirePermission('remissions.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await remissionService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Nota de remision no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching remission' })
    }
  }
)

// POST / — create remission note
router.post(
  '/',
  requirePermission('remissions.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createRemissionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await remissionService.create(
        db, parsed.data, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('remission:created', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating remission' })
    }
  }
)

// PUT /:id — update remission note (draft only)
router.put(
  '/:id',
  requirePermission('remissions.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateRemissionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await remissionService.update(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating remission' })
    }
  }
)

// POST /:id/confirm — confirm remission note
router.post(
  '/:id/confirm',
  requirePermission('remissions.confirm') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await remissionService.confirm(
        db, req.params.id, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('remission:confirmed', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error confirming remission' })
    }
  }
)

// POST /:id/cancel — cancel remission note
router.post(
  '/:id/cancel',
  requirePermission('remissions.cancel') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = cancelRemissionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await remissionService.cancel(
        db, req.params.id, req.user?.id ?? 'system', parsed.data.reason,
        req.user?.name ?? 'Sistema', req.user?.role ?? 'operator'
      )
      const io = req.app.get('io')
      if (io) io.emit('remission:cancelled', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error cancelling remission' })
    }
  }
)

// GET /:id/print — print data
router.get(
  '/:id/print',
  requirePermission('remissions.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await remissionService.getPrintData(db, req.params.id)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating print data' })
    }
  }
)

// GET /:id/pdf — generate PDF
router.get(
  '/:id/pdf',
  requirePermission('remissions.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const printData = await remissionService.getPrintData(db, req.params.id)

      // Get business settings
      const settingsRows = await db.select().from(settings)
        .where(inArray(settings.key, ['business_name', 'business_rfc', 'business_address', 'business_phone', 'business_email', 'business_logo_path']))
      const cfg: Record<string, string> = {}
      for (const row of settingsRows) cfg[row.key] = row.value

      const pdfData = {
        folio: printData.folio,
        series: printData.series,
        createdAt: printData.createdAt,
        paymentType: printData.paymentType,
        creditDays: printData.creditDays,
        dueDate: printData.dueDate,
        status: printData.status,
        customer: {
          name: printData.customer?.name || printData.customerName || '',
          rfc: printData.customer?.rfc || printData.customerRfc || '',
          phone: printData.customer?.phone || printData.customer?.cellphone || '',
          email: printData.customer?.email || '',
          address: printData.customer?.address || '',
        },
        deliveryAddress: printData.deliveryAddress,
        deliveryNotes: printData.deliveryNotes,
        items: (printData.items || []).map((it: any) => ({
          productName: it.productName,
          productSku: it.productSku,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          discount: parseFloat(it.discount || 0),
          taxRate: parseFloat(it.taxRate || 0),
          taxAmount: parseFloat(it.taxAmount || 0),
          total: parseFloat(it.total),
        })),
        subtotal: parseFloat(printData.subtotal),
        discountAmount: parseFloat(printData.discountAmount || 0),
        taxAmount: parseFloat(printData.taxAmount || 0),
        total: parseFloat(printData.total),
        confirmedBy: printData.confirmedBy,
        confirmedAt: printData.confirmedAt,
        deliveredBy: printData.deliveredBy,
        deliveredAt: printData.deliveredAt,
        receivedBy: printData.receivedBy,
        internalNotes: printData.internalNotes,
        businessInfo: {
          name: cfg.business_name,
          rfc: cfg.business_rfc,
          address: cfg.business_address,
          phone: cfg.business_phone,
          email: cfg.business_email,
        },
        logoPath: cfg.business_logo_path || undefined,
      }

      const buffer = await generateRemissionPDF(pdfData)
      const folio = `${printData.series}-${String(printData.folio).padStart(4, '0')}`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="Remision-${folio}.pdf"`)
      res.send(buffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating PDF' })
    }
  }
)

export default router
