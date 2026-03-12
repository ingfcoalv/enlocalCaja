import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import * as receivingService from '../services/receiving.service'
import { receiveItemsSchema } from '../validators/receiving.validator'

const router = Router()

// GET /warehouse/pending — pending orders for receiving
router.get(
  '/warehouse/pending',
  requirePermission('purchase_orders.receive') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivingService.getPendingForWarehouse(db)
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pending orders' })
    }
  }
)

// POST /:id/receive — receive items for a purchase order
router.post(
  '/:id/receive',
  requirePermission('purchase_orders.receive') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = receiveItemsSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await receivingService.receiveItems(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('purchaseOrder:received', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error receiving items' })
    }
  }
)

// GET /receipts — list receipts
router.get(
  '/receipts',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivingService.getReceipts(db, {
        purchase_order_id: req.query.purchase_order_id as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing receipts' })
    }
  }
)

// GET /receipts/:id — get receipt detail
router.get(
  '/receipts/:id',
  requirePermission('purchase_orders.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivingService.getReceiptById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Recepcion no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching receipt' })
    }
  }
)

export default router
