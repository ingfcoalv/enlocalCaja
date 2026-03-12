import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listCreditCustomers,
  getCustomerCreditDetail,
  createAbono,
} from '../services/credit.service'
import { generateAbonoReceipt } from '../services/receipts.service'

const router = Router()

// GET /customers — list customers with credit balances
router.get(
  '/customers',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const filters = {
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listCreditCustomers(db, pool, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing credit customers' })
    }
  }
)

// GET /customers/:customerId — customer credit detail
router.get(
  '/customers/:customerId',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { customerId } = req.params

      const result = await getCustomerCreditDetail(db, pool, customerId)
      if (!result) {
        return res.status(404).json({ error: 'Cliente no encontrado' })
      }

      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching credit detail' })
    }
  }
)

// POST /abonos — create abono payment
router.post(
  '/abonos',
  requirePermission('pos.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { customerId, invoiceId, payments, shiftId } = req.body

      if (!customerId || !invoiceId || !payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'Se requiere customerId, invoiceId y al menos un pago' })
      }

      // Validate no credit in abono payments
      if (payments.some((p: any) => p.method === 'credit')) {
        return res.status(400).json({ error: 'No se puede abonar con credito' })
      }

      const result = await createAbono(db, pool, {
        customerId,
        invoiceId,
        payments,
        shiftId,
        userId: req.user?.id ?? 'system',
      })

      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating abono' })
    }
  }
)

// GET /abonos/:id/receipt — generate abono receipt
router.get(
  '/abonos/:id/receipt',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { id } = req.params

      const receipt = await generateAbonoReceipt(db, pool, id)
      res.json({ receipt })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating abono receipt' })
    }
  }
)

export default router
