import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getAlerts,
  getValuation,
} from '../services/ingredients.service'

const safeNumeric = z.union([z.string(), z.number()])
  .refine((val) => !isNaN(Number(val)), { message: 'Debe ser un numero valido' })
  .transform(Number)

const createIngredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().optional(),
  current_stock: safeNumeric.optional(),
  min_stock: safeNumeric.optional(),
  cost: safeNumeric.optional(),
  supplier_id: z.string().uuid().nullable().optional(),
})

const updateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().optional(),
  current_stock: safeNumeric.optional(),
  min_stock: safeNumeric.optional(),
  cost: safeNumeric.optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
})

const router = Router()

// GET /alerts — low stock alerts (must be before /:id)
router.get(
  '/alerts',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const alerts = await getAlerts(db)
      res.json({ data: alerts })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching alerts' })
    }
  }
)

// GET /valuation — total inventory value
router.get(
  '/valuation',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const valuation = await getValuation(db)
      res.json({ data: valuation })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching valuation' })
    }
  }
)

// GET / — list ingredients with filters
router.get(
  '/',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        active: req.query.active !== undefined
          ? req.query.active === 'true'
          : undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listIngredients(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing ingredients' })
    }
  }
)

// POST / — create ingredient
router.post(
  '/',
  requirePermission('inventory.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createIngredientSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createIngredient(db, parsed.data, userId)

      res.status(201).json({ data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating ingredient' })
    }
  }
)

// PUT /:id — update ingredient
router.put(
  '/:id',
  requirePermission('inventory.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateIngredientSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateIngredient(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Ingredient not found' })
      }

      res.json({ data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating ingredient' })
    }
  }
)

// DELETE /:id — soft delete ingredient
router.delete(
  '/:id',
  requirePermission('inventory.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteIngredient(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Ingredient not found' })
      }

      res.json({ data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting ingredient' })
    }
  }
)

export default router
