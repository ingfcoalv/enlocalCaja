import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  getCurrentShift,
  openShift,
  closeShift,
  getShiftHistory,
  getShiftPreview,
} from '../services/cashShifts.service'
import {
  ensureRegistersTable,
  getRegisterById,
  getAccessibleRegisters,
} from '../services/registers.service'
import { sql } from 'drizzle-orm'
import { buildShiftClosePayload } from '@enlocal/core-sync'

const openShiftSchema = z.object({
  openingAmount: z.union([z.string(), z.number()]).transform(Number),
  registerId: z.string().uuid().optional(),
})

const closeShiftSchema = z.object({
  closingAmount: z.union([z.string(), z.number()]).transform(Number),
  notes: z.string().optional().default(''),
})

const router = Router()

// GET /current — get current open shift for authenticated user
router.get(
  '/current',
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'

      const shift = await getCurrentShift(db, userId)

      if (!shift) {
        return res.json({ data: null, message: 'No open shift found' })
      }

      res.json({ data: shift })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error getting current shift' })
    }
  }
)

// POST /open — open a new cash shift
router.post(
  '/open',
  requirePermission('pos.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = openShiftSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const { registerId } = parsed.data

      // Check if multicaja module is active — require register selection
      const enabledModules = (req.app.get('enabledModules') as string[]) ?? []
      const multicajaEnabled = enabledModules.includes('mod-multicaja')
      if (multicajaEnabled && !registerId) {
        return res.status(400).json({ error: 'Debes seleccionar una caja para abrir turno' })
      }

      // Validate register if provided
      if (registerId) {
        await ensureRegistersTable(db)

        // Check register exists and is active
        const register = await getRegisterById(db, registerId)
        if (!register) {
          return res.status(400).json({ error: 'Caja no encontrada' })
        }
        if (!register.isActive) {
          return res.status(400).json({ error: 'Esta caja esta desactivada' })
        }

        // Check user has access to this register
        const userPermissions = req.user?.permissions ?? []
        const accessible = await getAccessibleRegisters(db, userId, userPermissions)
        if (!accessible.find((r: any) => r.id === registerId)) {
          return res.status(403).json({ error: 'No tienes acceso a esta caja' })
        }

        // Validate max_terminals limit
        try {
          const licenseInfo = req.app.get('licenseInfo')
          const maxTerminals = licenseInfo?.maxTerminals ?? licenseInfo?.max_terminals
          if (maxTerminals && maxTerminals > 0) {
            const openShiftsResult = await db.execute(
              sql`SELECT count(*)::int as count FROM cash_shifts WHERE status = 'open'`
            )
            const openRows = openShiftsResult.rows ?? openShiftsResult
            const openCount = openRows[0]?.count ?? 0
            if (openCount >= maxTerminals) {
              return res.status(400).json({
                error: `Limite de terminales alcanzado (${maxTerminals}). Cierra un turno antes de abrir otro.`,
              })
            }
          }
        } catch { /* graceful degradation: if no license info, allow */ }
      }

      const shift = await openShift(db, userId, parsed.data.openingAmount, registerId)

      // Audit: change_journal
      try {
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('cash_shifts', ${shift.id}, 'open', ${JSON.stringify(shift)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      // Trigger backup on shift open (apertura)
      try {
        const backupScheduler = req.app.get('backupScheduler')
        if (backupScheduler?.onTurnoApertura) {
          backupScheduler.onTurnoApertura().catch(() => {})
        }
      } catch { /* non-critical */ }

      res.status(201).json({ data: shift })
    } catch (err: any) {
      if (err.message?.includes('already has an open shift') || err.message?.includes('ya tiene un turno abierto')) {
        return res.status(409).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error opening shift' })
    }
  }
)

// GET /current/preview — Corte X (shift preview without closing)
router.get(
  '/current/preview',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const userId = req.user?.id ?? 'system'

      const currentShift = await getCurrentShift(db, userId)
      if (!currentShift) {
        return res.status(404).json({ error: 'No open shift found for this user' })
      }

      const preview = await getShiftPreview(db, currentShift.id)
      res.json({ data: preview })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error getting shift preview' })
    }
  }
)

// GET /:id/preview — shift preview by ID (for register status page)
router.get(
  '/:id/preview',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const preview = await getShiftPreview(db, req.params.id)
      res.json({ data: preview })
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error getting shift preview' })
    }
  }
)

// POST /close — close the current cash shift
router.post(
  '/close',
  requirePermission('pos.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = closeShiftSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'

      // Find the current open shift for the user
      const currentShift = await getCurrentShift(db, userId)
      if (!currentShift) {
        return res.status(404).json({ error: 'No open shift found for this user' })
      }

      const shift = await closeShift(
        db,
        currentShift.id,
        parsed.data.closingAmount,
        parsed.data.notes || null
      )

      // Enqueue shift data for cloud sync (local IDs — cloud resolves references)
      try {
        const pool = req.app.get('pool')

        // Fetch cashier name for sync payload
        let cashierName: string | null = null
        try {
          const ur = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId])
          cashierName = ur.rows[0]?.name ?? null
        } catch { /* best-effort */ }

        const payload = buildShiftClosePayload({ ...shift, cashierName })
        await pool.query(
          `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
           VALUES (gen_random_uuid(), 'shift_close', $1, $2, 'pending')`,
          [shift.id, JSON.stringify(payload)]
        )

        // Trigger sync engine
        const syncEngine = req.app.get('syncEngine')
        if (syncEngine && typeof syncEngine.triggerSync === 'function') {
          syncEngine.triggerSync()
        }
      } catch {
        // Non-critical: sync will retry later
      }

      // Audit: change_journal
      try {
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('cash_shifts', ${shift.id}, 'close', ${JSON.stringify(shift)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      // Trigger backup on shift close (cierre)
      try {
        const backupScheduler = req.app.get('backupScheduler')
        if (backupScheduler?.onTurnoCierre) {
          backupScheduler.onTurnoCierre().catch(() => {})
        }
      } catch { /* non-critical */ }

      res.json({ data: shift })
    } catch (err: any) {
      if (err.message?.includes('not found or already closed')) {
        return res.status(404).json({ error: err.message })
      }
      res.status(500).json({ error: err.message || 'Error closing shift' })
    }
  }
)

// GET /history — paginated shift history
router.get(
  '/history',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        registerId: req.query.registerId as string | undefined,
        userId: req.query.userId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      }

      const result = await getShiftHistory(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error loading shift history' })
    }
  }
)

export default router
