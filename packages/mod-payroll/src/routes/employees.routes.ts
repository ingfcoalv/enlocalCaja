import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../services/employees.service'

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                       */
/* ------------------------------------------------------------------ */

const createEmployeeSchema = z.object({
  user_id: z.string().uuid().optional(),
  curp: z.string().optional(),
  nss: z.string().optional(),
  rfc: z.string().optional(),
  salary_type: z.enum(['fixed', 'hourly', 'commission']).optional().default('fixed'),
  salary_amount: z.union([z.string(), z.number()]).transform(Number).optional(),
  bank: z.string().optional(),
  clabe: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().optional(),
})

const updateEmployeeSchema = z.object({
  user_id: z.string().uuid().optional(),
  curp: z.string().optional(),
  nss: z.string().optional(),
  rfc: z.string().optional(),
  salary_type: z.enum(['fixed', 'hourly', 'commission']).optional(),
  salary_amount: z.union([z.string(), z.number()]).transform(Number).optional(),
  bank: z.string().optional(),
  clabe: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().optional(),
  active: z.boolean().optional(),
})

/* ------------------------------------------------------------------ */
/*  Router                                                            */
/* ------------------------------------------------------------------ */

const router = Router()

// GET / — list employees with optional filters
router.get(
  '/',
  requirePermission('payroll.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        active: req.query.active !== undefined
          ? req.query.active === 'true'
          : undefined,
        department: req.query.department as string | undefined,
        q: req.query.q as string | undefined,
      }

      const employees = await listEmployees(db, filters)
      res.json({ data: employees })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing employees' })
    }
  }
)

// GET /:id — get single employee
router.get(
  '/:id',
  requirePermission('payroll.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const employee = await getEmployeeById(db, req.params.id)

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' })
      }

      res.json({ data: employee })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching employee' })
    }
  }
)

// POST / — create employee
router.post(
  '/',
  requirePermission('payroll.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createEmployeeSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const employee = await createEmployee(db, parsed.data, userId)

      res.status(201).json({ data: employee })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating employee' })
    }
  }
)

// PUT /:id — update employee
router.put(
  '/:id',
  requirePermission('payroll.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateEmployeeSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const employee = await updateEmployee(db, req.params.id, parsed.data, userId)

      res.json({ data: employee })
    } catch (err: any) {
      if (err.message === 'Employee not found') {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error updating employee' })
    }
  }
)

// DELETE /:id — soft delete employee
router.delete(
  '/:id',
  requirePermission('payroll.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'
      const employee = await deleteEmployee(db, req.params.id, userId)

      res.json({ data: employee, message: 'Employee deactivated' })
    } catch (err: any) {
      if (err.message === 'Employee not found') {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error deleting employee' })
    }
  }
)

export default router
