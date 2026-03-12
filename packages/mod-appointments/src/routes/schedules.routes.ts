import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../services/schedules.service'

const createScheduleSchema = z.object({
  staffId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  active: z.boolean().optional(),
})

const updateScheduleSchema = z.object({
  staffId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  active: z.boolean().optional(),
})

const router = Router()

// GET / -- list schedules, optionally filtered by staff_id
router.get(
  '/',
  requirePermission('appointments.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const staffId = req.query.staff_id as string | undefined

      const result = await listSchedules(db, staffId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing schedules' })
    }
  }
)

// POST / -- create schedule
router.post(
  '/',
  requirePermission('appointments.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createScheduleSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const result = await createSchedule(db, parsed.data, userId)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating schedule' })
    }
  }
)

// PUT /:id -- update schedule
router.put(
  '/:id',
  requirePermission('appointments.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateScheduleSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const result = await updateSchedule(db, id, parsed.data, userId)

      if (!result) {
        return res.status(404).json({ error: 'Schedule not found' })
      }

      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating schedule' })
    }
  }
)

// DELETE /:id -- hard delete schedule
router.delete(
  '/:id',
  requirePermission('appointments.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const deleted = await deleteSchedule(db, id)

      if (!deleted) {
        return res.status(404).json({ error: 'Schedule not found' })
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting schedule' })
    }
  }
)

export default router
