import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { validateRFC } from '../services/cloudStamping.service'

const router = Router()

// POST /api/invoices/validate-rfc — proxy to V2 validate-rfc
router.post(
  '/validate-rfc',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rfc } = req.body

      if (!rfc || typeof rfc !== 'string') {
        return res.status(400).json({ error: 'RFC es requerido' })
      }

      const result = await validateRFC(rfc.trim().toUpperCase())
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error validando RFC' })
    }
  }
)

export default router
