import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createInvoiceFromSales,
  createComplementoPago,
  listAvailableSalesForInvoicing,
} from '../services/invoices.service'

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.union([z.string(), z.number()]).transform((v) => String(v)),
  unitPrice: z.union([z.string(), z.number()]).transform((v) => String(v)),
  discount: z.union([z.string(), z.number()]).optional().default('0').transform((v) => String(v)),
  productId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  satCode: z.string().optional().nullable(),
  satUnit: z.string().optional().nullable(),
  taxRate: z.union([z.string(), z.number()]).optional().default('0.16').transform((v) => String(v)),
})

const createInvoiceSchema = z.object({
  series: z.string().optional().nullable(),
  folio: z.number().int().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  type: z.string().optional().default('I'),
  useCfdi: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentForm: z.string().optional().nullable(),
  currency: z.string().optional().default('MXN'),
  cloudId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1),
})

const updateInvoiceSchema = z.object({
  series: z.string().optional().nullable(),
  folio: z.number().int().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  type: z.string().optional(),
  useCfdi: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentForm: z.string().optional().nullable(),
  currency: z.string().optional(),
  cloudId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).optional(),
})

const router = Router()

// GET /sales-available — list uninvoiced POS tickets
router.get(
  '/sales-available',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const filters = {
        customerId: req.query.customerId as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listAvailableSalesForInvoicing(db, pool, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing available sales' })
    }
  }
)

// POST /from-sales — create CFDI from sale tickets
router.post(
  '/from-sales',
  requirePermission('invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { saleIds, salesIds, customerId, useCfdi, series } = req.body
      const ids = saleIds || salesIds

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un ticket de venta' })
      }
      if (!customerId) {
        return res.status(400).json({ error: 'Se requiere un cliente para facturar' })
      }

      const userId = req.user?.id ?? 'system'
      const result = await createInvoiceFromSales(db, pool, ids, { customerId, useCfdi, series }, userId)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating invoice from sales' })
    }
  }
)

// POST /complemento-pago — create complemento de pago
router.post(
  '/complemento-pago',
  requirePermission('invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { invoiceId, paymentIds, series } = req.body

      if (!invoiceId) {
        return res.status(400).json({ error: 'Se requiere el ID de la factura original' })
      }
      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un pago de abono' })
      }

      const userId = req.user?.id ?? 'system'
      const result = await createComplementoPago(db, pool, { invoiceId, paymentIds, series }, userId)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating complemento de pago' })
    }
  }
)

// GET / -- list invoices with filters
router.get(
  '/',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        status: req.query.status as string | undefined,
        customerId: req.query.customerId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        type: req.query.type as string | undefined,
        source: req.query.source as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listInvoices(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing invoices' })
    }
  }
)

// GET /:id -- get invoice with items
router.get(
  '/:id',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const invoice = await getInvoiceById(db, id)

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      res.json(invoice)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching invoice' })
    }
  }
)

// POST / -- create draft invoice
router.post(
  '/',
  requirePermission('invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createInvoiceSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const { items, ...invoiceData } = parsed.data
      const userId = req.user?.id ?? 'system'

      const result = await createInvoice(db, invoiceData, items, userId)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating invoice' })
    }
  }
)

// PUT /:id -- update draft invoice
router.put(
  '/:id',
  requirePermission('invoices.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateInvoiceSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const { items, ...invoiceData } = parsed.data
      const userId = req.user?.id ?? 'system'

      const result = await updateInvoice(db, id, invoiceData, items, userId)

      if (!result) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      res.json(result)
    } catch (err: any) {
      if (err.message === 'Only draft invoices can be updated') {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error updating invoice' })
    }
  }
)

// DELETE /:id -- delete draft invoice only
router.delete(
  '/:id',
  requirePermission('invoices.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'

      const result = await deleteInvoice(db, id, userId)

      if (!result) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      res.json({ success: true, data: result })
    } catch (err: any) {
      if (err.message === 'Only draft invoices can be deleted') {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error deleting invoice' })
    }
  }
)

export default router
