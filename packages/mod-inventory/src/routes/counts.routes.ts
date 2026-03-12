import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { listCounts, createCount, getCountById } from '../services/counts.service'

const createCountSchema = z.object({
  notes: z.string().optional(),
  items: z.array(z.object({
    ingredient_id: z.string().uuid(),
    expected_qty: z.union([z.string(), z.number()]).transform(Number),
    counted_qty: z.union([z.string(), z.number()]).transform(Number),
    difference: z.union([z.string(), z.number()]).transform(Number),
    notes: z.string().optional(),
  })),
})

const router = Router()

// GET / — list counts
router.get(
  '/',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listCounts(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing counts' })
    }
  }
)

// POST / — create count
router.post(
  '/',
  requirePermission('inventory.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createCountSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const count = await createCount(db, parsed.data, userId)

      res.status(201).json({ data: count })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating count' })
    }
  }
)

// GET /:id — get count by ID
router.get(
  '/:id',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const count = await getCountById(db, id)

      if (!count) {
        return res.status(404).json({ error: 'Count not found' })
      }

      res.json({ data: count })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching count' })
    }
  }
)

export default router
