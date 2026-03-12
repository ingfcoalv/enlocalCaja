import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../services/suppliers.service'

const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  rfc: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
  paymentTerms: z.string().optional(),
  defaultCreditDays: z.number().int().min(0).optional(),
  defaultPaymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankClabe: z.string().optional(),
  bankReference: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.union([z.string(), z.number()]).optional(),
})

const updateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  rfc: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  paymentTerms: z.string().optional(),
  defaultCreditDays: z.number().int().min(0).optional(),
  defaultPaymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankClabe: z.string().optional(),
  bankReference: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.union([z.string(), z.number()]).optional(),
})

const router = Router()

// GET / — list suppliers with filters
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listSuppliers(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing suppliers' })
    }
  }
)

// POST / — create supplier
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createSupplierSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createSupplier(db, parsed.data, userId)
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating supplier' })
    }
  }
)

// PUT /:id — update supplier
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateSupplierSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateSupplier(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Supplier not found' })
      }

      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating supplier' })
    }
  }
)

// DELETE /:id — soft delete supplier
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteSupplier(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Supplier not found' })
      }

      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting supplier' })
    }
  }
)

export default router
