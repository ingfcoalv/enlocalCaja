import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listPeriods,
  createPeriod,
  updatePeriod,
  calculatePayroll,
  approvePayroll,
  getPayrollEntries,
  stampPayrollReceipts,
} from '../services/payroll.service'

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                       */
/* ------------------------------------------------------------------ */

const createPeriodSchema = z.object({
  name: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  type: z.enum(['weekly', 'biweekly', 'monthly']).optional().default('biweekly'),
})

const updatePeriodSchema = z.object({
  name: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  type: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  status: z.string().optional(),
})

/* ------------------------------------------------------------------ */
/*  Router                                                            */
/* ------------------------------------------------------------------ */

const router = Router()

// GET /periods — list payroll periods (paginated)
router.get(
  '/periods',
  requirePermission('payroll.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        type: req.query.type as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listPeriods(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing periods' })
    }
  }
)

// POST /periods — create payroll period
router.post(
  '/periods',
  requirePermission('payroll.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createPeriodSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const period = await createPeriod(db, parsed.data, userId)

      res.status(201).json({ data: period })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating period' })
    }
  }
)

// PUT /periods/:id — update payroll period
router.put(
  '/periods/:id',
  requirePermission('payroll.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updatePeriodSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const period = await updatePeriod(db, req.params.id, parsed.data, userId)

      res.json({ data: period })
    } catch (err: any) {
      if (err.message === 'Period not found') {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error updating period' })
    }
  }
)

// POST /:periodId/calculate — calculate payroll for a period
router.post(
  '/:periodId/calculate',
  requirePermission('payroll.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'
      const entries = await calculatePayroll(db, req.params.periodId, userId)

      res.json({ data: entries, message: `Payroll calculated: ${entries.length} entries created` })
    } catch (err: any) {
      if (err.message === 'Period not found') {
        return res.status(404).json({ error: err.message })
      }
      if (err.message?.includes('draft status')) {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error calculating payroll' })
    }
  }
)

// POST /:periodId/approve — approve and mark payroll as paid
router.post(
  '/:periodId/approve',
  requirePermission('payroll.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'
      const period = await approvePayroll(db, req.params.periodId, userId)

      res.json({ data: period, message: 'Payroll approved and marked as paid' })
    } catch (err: any) {
      if (err.message === 'Period not found') {
        return res.status(404).json({ error: err.message })
      }
      if (err.message?.includes('calculated')) {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error approving payroll' })
    }
  }
)

// GET /:periodId/entries — list payroll entries for a period
router.get(
  '/:periodId/entries',
  requirePermission('payroll.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const entries = await getPayrollEntries(db, req.params.periodId)

      res.json({ data: entries })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching payroll entries' })
    }
  }
)

// POST /:periodId/stamp — stamp payroll receipts (CFDI placeholder)
router.post(
  '/:periodId/stamp',
  requirePermission('payroll.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'
      const period = await stampPayrollReceipts(db, req.params.periodId, userId)

      res.json({ data: period, message: 'Payroll receipts stamped (placeholder)' })
    } catch (err: any) {
      if (err.message === 'Period not found') {
        return res.status(404).json({ error: err.message })
      }
      if (err.message?.includes('paid')) {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error stamping payroll receipts' })
    }
  }
)

export default router
