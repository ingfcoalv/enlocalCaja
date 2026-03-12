import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listRegistersWithStatus,
  createRegister,
  updateRegister,
  deleteRegister,
  getAccessibleRegisters,
} from '../services/registers.service'
import { sql } from 'drizzle-orm'
import { buildRegisterPayload } from '@enlocal/core-sync'

const createRegisterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
})

const updateRegisterSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
})

const router = Router()

// GET / — list all registers with shift status
router.get(
  '/',
  requirePermission('registers.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const registers = await listRegistersWithStatus(db)
      res.json({ data: registers })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing registers' })
    }
  }
)

// GET /my — get registers accessible to current user
router.get(
  '/my',
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'
      const permissions = req.user?.permissions ?? []
      const registers = await getAccessibleRegisters(db, userId, permissions)
      res.json({ data: registers })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error getting accessible registers' })
    }
  }
)

// POST / — create a new register
router.post(
  '/',
  requirePermission('registers.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createRegisterSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const db = req.app.get('db')

      // Read max_registers from license settings
      let maxRegisters: number | undefined
      try {
        const pool = req.app.get('pool')
        const mrResult = await pool.query(`SELECT value FROM settings WHERE key = 'license_max_registers' LIMIT 1`)
        if (mrResult.rows[0]?.value) {
          maxRegisters = parseInt(mrResult.rows[0].value, 10)
        }
      } catch { /* graceful degradation */ }

      const register = await createRegister(db, parsed.data, maxRegisters)

      // Fetch series for sync payload
      let series: string | null = null
      try {
        const pool2 = req.app.get('pool')
        const sr = await pool2.query(`SELECT series FROM register_sequences WHERE register_id = $1`, [register.id])
        series = sr.rows[0]?.series ?? null
      } catch { /* non-critical */ }

      // Enqueue for sync
      try {
        const pool = req.app.get('pool')
        const payload = buildRegisterPayload({ ...register, series })
        await pool.query(
          `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
           VALUES (gen_random_uuid(), 'register', $1, $2, 'pending')`,
          [register.id, JSON.stringify(payload)]
        )
        const syncEngine = req.app.get('syncEngine')
        if (syncEngine?.triggerSync) syncEngine.triggerSync()
      } catch { /* non-critical */ }

      // Audit: change_journal
      try {
        const userId = req.user?.id ?? 'system'
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('pos_registers', ${register.id}, 'insert', ${JSON.stringify(register)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      res.status(201).json({ data: register })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating register' })
    }
  }
)

// PUT /:id — update a register
router.put(
  '/:id',
  requirePermission('registers.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = updateRegisterSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const db = req.app.get('db')
      const register = await updateRegister(db, req.params.id, parsed.data)

      // Fetch series for sync payload
      let updateSeries: string | null = null
      try {
        const pool2 = req.app.get('pool')
        const sr = await pool2.query(`SELECT series FROM register_sequences WHERE register_id = $1`, [register.id])
        updateSeries = sr.rows[0]?.series ?? null
      } catch { /* non-critical */ }

      // Enqueue for sync
      try {
        const pool = req.app.get('pool')
        const payload = buildRegisterPayload({ ...register, series: updateSeries })
        await pool.query(
          `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
           VALUES (gen_random_uuid(), 'register', $1, $2, 'pending')`,
          [register.id, JSON.stringify(payload)]
        )
        const syncEngine = req.app.get('syncEngine')
        if (syncEngine?.triggerSync) syncEngine.triggerSync()
      } catch { /* non-critical */ }

      // Audit: change_journal
      try {
        const userId = req.user?.id ?? 'system'
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('pos_registers', ${register.id}, 'update', ${JSON.stringify(register)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      res.json({ data: register })
    } catch (err: any) {
      if (err.message === 'Register not found') {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error updating register' })
    }
  }
)

// DELETE /:id — soft delete (set is_active=false)
router.delete(
  '/:id',
  requirePermission('registers.delete') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const register = await deleteRegister(db, req.params.id)

      // Audit: change_journal
      try {
        const userId = req.user?.id ?? 'system'
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('pos_registers', ${req.params.id}, 'delete', ${JSON.stringify(register)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      res.json({ data: register })
    } catch (err: any) {
      if (err.message === 'Register not found') {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error deleting register' })
    }
  }
)

export default router
