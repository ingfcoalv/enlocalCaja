import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import * as payableService from '../services/payable.service'
import { paySchema, batchPaySchema, updatePrioritySchema } from '../validators/payable.validator'

const router = Router()

// GET / — list payables
router.get(
  '/',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getAll(db, {
        supplier_id: req.query.supplier_id as string | undefined,
        status: req.query.status as string | undefined,
        overdue_only: req.query.overdue_only === 'true',
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing payables' })
    }
  }
)

// GET /aging-report — aging report
router.get(
  '/aging-report',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getAgingReport(db, req.query.as_of_date as string | undefined)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating aging report' })
    }
  }
)

// GET /payment-schedule — payment schedule
router.get(
  '/payment-schedule',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getPaymentSchedule(
        db, req.query.from as string | undefined, req.query.to as string | undefined
      )
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching payment schedule' })
    }
  }
)

// GET /cash-flow-projection — cash flow projection
router.get(
  '/cash-flow-projection',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const weeks = req.query.weeks ? parseInt(req.query.weeks as string, 10) : undefined
      const result = await payableService.getCashFlowProjection(db, weeks)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating cash flow projection' })
    }
  }
)

// GET /pending-by-method — pending by payment method
router.get(
  '/pending-by-method',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getPendingByMethod(db)
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pending by method' })
    }
  }
)

// GET /supplier/:id/statement — supplier statement
router.get(
  '/supplier/:id/statement',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getSupplierStatement(db, req.params.id)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error fetching supplier statement' })
    }
  }
)

// GET /:id — get payable detail
router.get(
  '/:id',
  requirePermission('payables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await payableService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Cuenta por pagar no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching payable' })
    }
  }
)

// POST /:id/pay — pay a payable
router.post(
  '/:id/pay',
  requirePermission('payables.pay') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = paySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await payableService.pay(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) {
        io.emit('payable:payment', result)
        if (result.payable && Number(result.payable.balance) <= 0) {
          io.emit('payable:paid', result.payable)
        }
      }
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error paying payable' })
    }
  }
)

// POST /batch-pay — batch pay multiple payables
router.post(
  '/batch-pay',
  requirePermission('payables.pay') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = batchPaySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await payableService.batchPay(db, parsed.data, req.user?.id ?? 'system')
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error in batch payment' })
    }
  }
)

// PUT /:id/priority — update priority
router.put(
  '/:id/priority',
  requirePermission('payables.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updatePrioritySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await payableService.updatePriority(db, req.params.id, parsed.data)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating priority' })
    }
  }
)

export default router
