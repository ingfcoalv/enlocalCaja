import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from '../services/sections.service'

const createSectionSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['area', 'zone', 'department']).optional().default('area'),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  active: z.boolean().optional().default(true),
})

const updateSectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['area', 'zone', 'department']).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})

const router = Router()

// GET / — list sections with filters
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters: any = {
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        type: req.query.type as string | undefined,
      }

      if (req.query.parentId !== undefined) {
        filters.parentId = req.query.parentId === 'null'
          ? null
          : (req.query.parentId as string)
      }

      const rows = await listSections(db, filters)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing sections' })
    }
  }
)

// POST / — create section
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createSectionSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createSection(db, parsed.data, userId)
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating section' })
    }
  }
)

// PUT /:id — update section
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateSectionSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateSection(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Section not found' })
      }

      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating section' })
    }
  }
)

// DELETE /:id — soft delete section
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteSection(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Section not found' })
      }

      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting section' })
    }
  }
)

export default router
