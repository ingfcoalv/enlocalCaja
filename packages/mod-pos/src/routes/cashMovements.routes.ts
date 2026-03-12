import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  createMovement,
  createTransfer,
  getMovements,
  getMovementsByShift,
  getMovementsSummary,
} from '../services/cashMovements.service'
import { getCurrentShift } from '../services/cashShifts.service'
import { sql } from 'drizzle-orm'
import { buildCashMovementPayload } from '@enlocal/core-sync'

const createMovementSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.union([z.string(), z.number()]).transform(Number).refine(v => v > 0, 'El monto debe ser mayor a 0'),
  reason: z.enum(['change_fund', 'expense', 'transfer_out', 'transfer_in', 'correction', 'other']),
  notes: z.string().optional(),
  authorizedBy: z.string().uuid().optional(),
})

const transferSchema = z.object({
  toRegisterId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform(Number).refine(v => v > 0, 'El monto debe ser mayor a 0'),
  notes: z.string().optional(),
})

const router = Router()

// POST / — create a cash movement (deposit or withdrawal)
router.post(
  '/',
  requirePermission('pos.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createMovementSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const currentShift = await getCurrentShift(db, userId)

      if (!currentShift) {
        return res.status(400).json({ error: 'Debes tener un turno abierto para registrar movimientos' })
      }

      const registerId = currentShift.registerId
      if (!registerId) {
        return res.status(400).json({ error: 'El turno no tiene una caja asignada' })
      }

      const movement = await createMovement(db, {
        shiftId: currentShift.id,
        registerId,
        userId,
        type: parsed.data.type,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        authorizedBy: parsed.data.authorizedBy,
      })

      // Enqueue for sync (local IDs — cloud resolves references)
      try {
        const pool = req.app.get('pool')

        // Fetch cashier name for sync payload
        let cashierName: string | null = null
        try {
          const ur = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId])
          cashierName = ur.rows[0]?.name ?? null
        } catch { /* best-effort */ }

        const payload = buildCashMovementPayload({ ...movement, cashierName })
        await pool.query(
          `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
           VALUES (gen_random_uuid(), 'cash_movement', $1, $2, 'pending')`,
          [movement.id, JSON.stringify(payload)]
        )
        const syncEngine = req.app.get('syncEngine')
        if (syncEngine?.triggerSync) syncEngine.triggerSync()
      } catch { /* non-critical */ }

      // Audit: change_journal
      try {
        await db.execute(
          sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
              VALUES ('cash_movements', ${movement.id}, 'insert', ${JSON.stringify(movement)}::jsonb, ${userId}, false)`
        )
      } catch { /* non-critical */ }

      res.status(201).json({ data: movement })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating movement' })
    }
  }
)

// POST /transfer — transfer cash between registers
router.post(
  '/transfer',
  requirePermission('pos.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = transferSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const currentShift = await getCurrentShift(db, userId)

      if (!currentShift) {
        return res.status(400).json({ error: 'Debes tener un turno abierto para transferir efectivo' })
      }

      if (!currentShift.registerId) {
        return res.status(400).json({ error: 'El turno no tiene una caja asignada' })
      }

      if (currentShift.registerId === parsed.data.toRegisterId) {
        return res.status(400).json({ error: 'No puedes transferir a la misma caja' })
      }

      // Find the open shift on the destination register
      const destShiftResult = await db.execute(
        sql`SELECT id, register_id FROM cash_shifts
            WHERE register_id = ${parsed.data.toRegisterId} AND status = 'open'
            LIMIT 1`
      )
      const destRows = destShiftResult.rows ?? destShiftResult
      if (!destRows.length) {
        return res.status(400).json({ error: 'La caja destino no tiene un turno abierto' })
      }

      const result = await createTransfer(db, {
        fromShiftId: currentShift.id,
        fromRegisterId: currentShift.registerId,
        toShiftId: destRows[0].id,
        toRegisterId: parsed.data.toRegisterId,
        userId,
        amount: parsed.data.amount,
        notes: parsed.data.notes,
      })

      // Enqueue both movements for sync (local IDs — cloud resolves references)
      try {
        const pool = req.app.get('pool')

        // Fetch cashier name for sync payload
        let cashierName: string | null = null
        try {
          const ur = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId])
          cashierName = ur.rows[0]?.name ?? null
        } catch { /* best-effort */ }

        const wPayload = buildCashMovementPayload({ ...result.withdrawal, cashierName })
        const dPayload = buildCashMovementPayload({ ...result.deposit, cashierName })

        for (const [mov, payload] of [[result.withdrawal, wPayload], [result.deposit, dPayload]] as const) {
          await pool.query(
            `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
             VALUES (gen_random_uuid(), 'cash_movement', $1, $2, 'pending')`,
            [mov.id, JSON.stringify(payload)]
          )
        }
        const syncEngine = req.app.get('syncEngine')
        if (syncEngine?.triggerSync) syncEngine.triggerSync()
      } catch { /* non-critical */ }

      // Audit: change_journal for both movements
      try {
        for (const mov of [result.withdrawal, result.deposit]) {
          await db.execute(
            sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
                VALUES ('cash_movements', ${mov.id}, 'insert', ${JSON.stringify(mov)}::jsonb, ${userId}, false)`
          )
        }
      } catch { /* non-critical */ }

      res.status(201).json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating transfer' })
    }
  }
)

// GET / — list movements with filters
router.get(
  '/',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const pool = req.app.get('pool')
      const filters = {
        shiftId: req.query.shiftId as string | undefined,
        registerId: req.query.registerId as string | undefined,
        type: req.query.type as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await getMovements(pool, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing movements' })
    }
  }
)

// GET /summary — movement totals for a shift
router.get(
  '/summary',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const shiftId = req.query.shiftId as string

      if (!shiftId) {
        return res.status(400).json({ error: 'shiftId is required' })
      }

      const summary = await getMovementsSummary(db, shiftId)
      res.json({ data: summary })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error loading summary' })
    }
  }
)

export default router
