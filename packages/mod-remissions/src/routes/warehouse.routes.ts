import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { remissionNotes } from '@enlocal/core-db'
import { inArray, asc } from 'drizzle-orm'
import * as deliveryService from '../services/delivery.service'
import { prepareRemissionSchema, deliverRemissionSchema } from '../validators/remission.validator'

const router = Router()

// GET /warehouse/pending — notes pending warehouse action
router.get(
  '/warehouse/pending',
  requirePermission('remissions.prepare') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const rows = await db.select().from(remissionNotes)
        .where(inArray(remissionNotes.status, ['confirmed', 'prepared']))
        .orderBy(asc(remissionNotes.createdAt))
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pending remissions' })
    }
  }
)

// POST /:id/prepare — warehouse picks items
router.post(
  '/:id/prepare',
  requirePermission('remissions.prepare') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = prepareRemissionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await deliveryService.prepare(
        db, req.params.id, parsed.data, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'warehouse'
      )
      const io = req.app.get('io')
      if (io) io.emit('remission:prepared', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error preparing remission' })
    }
  }
)

// POST /:id/deliver — warehouse delivers to customer
router.post(
  '/:id/deliver',
  requirePermission('remissions.deliver') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = deliverRemissionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await deliveryService.deliver(
        db, req.params.id, parsed.data, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema', req.user?.role ?? 'warehouse'
      )
      const io = req.app.get('io')
      if (io) io.emit('remission:delivered', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error delivering remission' })
    }
  }
)

export default router
