import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import * as purchaseReturnService from '../services/purchaseReturn.service'
import { createPurchaseReturnSchema, completePurchaseReturnSchema } from '../validators/purchaseReturn.validator'

const router = Router()

// GET / — list purchase returns
router.get(
  '/',
  requirePermission('purchase_returns.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseReturnService.getAll(db, {
        status: req.query.status as string | undefined,
        purchase_order_id: req.query.purchase_order_id as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing purchase returns' })
    }
  }
)

// POST / — create purchase return
router.post(
  '/',
  requirePermission('purchase_returns.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createPurchaseReturnSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await purchaseReturnService.create(db, parsed.data, req.user?.id ?? 'system')
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating purchase return' })
    }
  }
)

// GET /:id — get purchase return detail
router.get(
  '/:id',
  requirePermission('purchase_returns.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseReturnService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Devolucion a proveedor no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching purchase return' })
    }
  }
)

// POST /:id/send — send return to supplier
router.post(
  '/:id/send',
  requirePermission('purchase_returns.process') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await purchaseReturnService.send(db, req.params.id, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('purchaseReturn:sent', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error sending purchase return' })
    }
  }
)

// POST /:id/complete — complete return (supplier confirmed)
router.post(
  '/:id/complete',
  requirePermission('purchase_returns.process') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = completePurchaseReturnSchema.safeParse(req.body)
      const result = await purchaseReturnService.complete(
        db, req.params.id, req.user?.id ?? 'system', parsed.success ? parsed.data.notes : undefined
      )
      const io = req.app.get('io')
      if (io) io.emit('purchaseReturn:completed', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error completing purchase return' })
    }
  }
)

// POST /:id/reject — reject return (supplier rejected)
router.post(
  '/:id/reject',
  requirePermission('purchase_returns.process') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const reason = req.body.reason
      if (!reason) return res.status(400).json({ error: 'Se requiere razon de rechazo' })
      const result = await purchaseReturnService.reject(db, req.params.id, req.user?.id ?? 'system', reason)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error rejecting purchase return' })
    }
  }
)

export default router
