import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/categories.service'
import { buildCategoryPayload } from '@enlocal/core-sync'

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().optional().default(0),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional().default(true),
  cloudId: z.string().optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  cloudId: z.string().optional(),
})

async function enqueueCategorySync(req: AuthenticatedRequest, row: any, entityType: string) {
  try {
    const pool = req.app.get('pool')
    const parentCloudId = row.parentId
      ? (await pool.query('SELECT cloud_id FROM categories WHERE id = $1', [row.parentId])).rows[0]?.cloud_id
      : null
    const payload = buildCategoryPayload(row, parentCloudId)
    await pool.query(
      `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
       VALUES (gen_random_uuid(), $1, $2, $3, 'pending')`,
      [entityType, row.id, JSON.stringify(payload)]
    )
    const syncEngine = req.app.get('syncEngine')
    if (syncEngine?.triggerSync) syncEngine.triggerSync()
  } catch { /* non-critical */ }
}

const router = Router()

// GET / — list categories
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        parentId: req.query.parentId === 'null'
          ? null
          : (req.query.parentId as string | undefined),
      }

      const rows = await listCategories(db, filters)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing categories' })
    }
  }
)

// POST / — create category
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createCategorySchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createCategory(db, parsed.data, userId)
      await enqueueCategorySync(req, row, 'category')
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating category' })
    }
  }
)

// GET /:id — get category by ID
router.get(
  '/:id',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const rows = await listCategories(db, {})
      const row = rows.find((c: any) => c.id === id)

      if (!row) {
        return res.status(404).json({ error: 'Category not found' })
      }

      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching category' })
    }
  }
)

// PUT /:id — update category
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateCategorySchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateCategory(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Category not found' })
      }

      await enqueueCategorySync(req, row, 'category')
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating category' })
    }
  }
)

// DELETE /:id — soft delete category
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteCategory(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Category not found' })
      }

      await enqueueCategorySync(req, row, 'category')
      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting category' })
    }
  }
)

export default router
