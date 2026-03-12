import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { checkCredit, updateCreditProfile } from '../services/creditCheck.service'
import { updateCreditSchema } from '../validators/credit.validator'

const router = Router()

// GET /check/:customerId — check customer credit
router.get(
  '/check/:customerId',
  requirePermission('remissions.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const amount = req.query.amount ? parseFloat(req.query.amount as string) : 0
      const result = await checkCredit(db, req.params.customerId, amount)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error checking credit' })
    }
  }
)

// PUT /customer/:customerId — update credit profile
router.put(
  '/customer/:customerId',
  requirePermission('customers.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateCreditSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await updateCreditProfile(db, req.params.customerId, parsed.data)
      if (!result) return res.status(404).json({ error: 'Cliente no encontrado' })
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating credit profile' })
    }
  }
)

export default router
