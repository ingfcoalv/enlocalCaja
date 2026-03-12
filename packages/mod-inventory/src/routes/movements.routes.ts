import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { createMovement, listMovements, getKardex } from '../services/movements.service'

const createMovementSchema = z.object({
  ingredient_id: z.string().uuid(),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.union([z.string(), z.number()]).transform(Number),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

const router = Router()

// POST / — create a stock movement
router.post(
  '/',
  requirePermission('inventory.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createMovementSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const movement = await createMovement(
        db,
        {
          ingredientId: parsed.data.ingredient_id,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
        },
        userId
      )

      res.status(201).json({ data: movement })
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error creating movement' })
    }
  }
)

// POST /bulk — create multiple movements at once
router.post(
  '/bulk',
  requirePermission('inventory.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const schema = z.object({
        movements: z.array(createMovementSchema),
      })
      const parsed = schema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const results = []
      for (const m of parsed.data.movements) {
        const movement = await createMovement(
          db,
          {
            ingredientId: m.ingredient_id,
            type: m.type,
            quantity: m.quantity,
            reference: m.reference,
            notes: m.notes,
          },
          userId
        )
        results.push(movement)
      }

      res.status(201).json({ data: results })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating bulk movements' })
    }
  }
)

// GET /kardex — per-ingredient movement history with running balance
router.get(
  '/kardex',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const ingredientId = req.query.ingredient_id as string | undefined
      if (!ingredientId) {
        return res.status(400).json({ error: 'ingredient_id is required' })
      }
      const from = req.query.from as string | undefined
      const to = req.query.to as string | undefined
      const result = await getKardex(db, ingredientId, from, to)
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching kardex' })
    }
  }
)

// GET / — list movements with filters
router.get(
  '/',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        ingredientId: req.query.ingredient_id as string | undefined,
        type: req.query.type as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listMovements(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing movements' })
    }
  }
)

export default router
