import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getCalendar,
  getAvailability,
} from '../services/appointments.service'

const createAppointmentSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
})

const updateAppointmentSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
})

const router = Router()

// GET / -- list appointments with filters
router.get(
  '/',
  requirePermission('appointments.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        date: req.query.date as string | undefined,
        staffId: req.query.staff_id as string | undefined,
        customerId: req.query.customer_id as string | undefined,
        status: req.query.status as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listAppointments(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing appointments' })
    }
  }
)

// GET /calendar -- calendar view grouped by date
router.get(
  '/calendar',
  requirePermission('appointments.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const from = req.query.from as string
      const to = req.query.to as string

      if (!from || !to) {
        return res.status(400).json({ error: 'from and to query parameters are required' })
      }

      const staffId = req.query.staff_id as string | undefined

      const result = await getCalendar(db, from, to, staffId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching calendar' })
    }
  }
)

// GET /availability -- available time slots
router.get(
  '/availability',
  requirePermission('appointments.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const date = req.query.date as string
      const serviceId = req.query.service_id as string

      if (!date || !serviceId) {
        return res.status(400).json({ error: 'date and service_id query parameters are required' })
      }

      const result = await getAvailability(db, date, serviceId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching availability' })
    }
  }
)

// POST / -- create appointment
router.post(
  '/',
  requirePermission('appointments.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createAppointmentSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const result = await createAppointment(db, parsed.data, userId)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating appointment' })
    }
  }
)

// PUT /:id -- update appointment
router.put(
  '/:id',
  requirePermission('appointments.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateAppointmentSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const result = await updateAppointment(db, id, parsed.data, userId)

      if (!result) {
        return res.status(404).json({ error: 'Appointment not found' })
      }

      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating appointment' })
    }
  }
)

// DELETE /:id -- cancel appointment (soft delete)
router.delete(
  '/:id',
  requirePermission('appointments.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'

      const result = await deleteAppointment(db, id, userId)

      if (!result) {
        return res.status(404).json({ error: 'Appointment not found' })
      }

      res.json({ success: true, data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting appointment' })
    }
  }
)

export default router
