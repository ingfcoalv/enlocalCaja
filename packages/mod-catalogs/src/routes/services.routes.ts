import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listServices,
  createService,
  updateService,
  deleteService,
} from '../services/services.service'

const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  price: z.union([z.string(), z.number()]).transform(String),
  durationMinutes: z.number().int().positive().optional(),
  categoryId: z.string().uuid().optional(),
  satCode: z.string().optional().default(''),
  satUnit: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
})

const updateServiceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).transform(String).optional(),
  durationMinutes: z.number().int().positive().optional(),
  categoryId: z.string().uuid().optional(),
  satCode: z.string().optional(),
  satUnit: z.string().optional(),
  active: z.boolean().optional(),
})

const router = Router()

// GET / — list services with filters
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        categoryId: req.query.categoryId as string | undefined,
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listServices(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing services' })
    }
  }
)

// POST / — create service
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createServiceSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createService(db, parsed.data, userId)
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating service' })
    }
  }
)

// PUT /:id — update service
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateServiceSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateService(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Service not found' })
      }

      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating service' })
    }
  }
)

// DELETE /:id — soft delete service
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteService(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Service not found' })
      }

      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting service' })
    }
  }
)

export default router
