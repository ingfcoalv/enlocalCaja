import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { generateReceipt, getReceiptPreview } from '../services/receipts.service'

const router = Router()

// POST /:orderId/print — generate receipt text for printing
router.post(
  '/:orderId/print',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { orderId } = req.params

      const receiptText = await generateReceipt(db, orderId)

      res.type('text/plain').send(receiptText)
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error generating receipt' })
    }
  }
)

// POST /:orderId/reprint — reprint receipt (same as print)
router.post(
  '/:orderId/reprint',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { orderId } = req.params

      const receiptText = await generateReceipt(db, orderId)

      res.type('text/plain').send(receiptText)
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error reprinting receipt' })
    }
  }
)

// GET /:orderId/preview — JSON preview of receipt data
router.get(
  '/:orderId/preview',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { orderId } = req.params

      const preview = await getReceiptPreview(db, orderId)

      res.json({ data: preview })
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error loading receipt preview' })
    }
  }
)

export default router
