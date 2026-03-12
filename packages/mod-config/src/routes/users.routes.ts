import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { listUsers, getUserById, createUser, updateUser, changePin, deleteUser, assignUserRole } from '../services/users.service'
import { createUserSchema, updateUserSchema, changePinSchema } from '../validators'
import { z } from 'zod'

const router = Router()

/**
 * GET /
 * List users with optional filters: ?active=true&role=admin&q=search
 */
router.get('/', requirePermission('users.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const filters: { active?: boolean; role?: string; q?: string } = {}

    if (req.query.active !== undefined) {
      filters.active = req.query.active === 'true'
    }
    if (req.query.role) {
      filters.role = req.query.role as string
    }
    if (req.query.q) {
      filters.q = req.query.q as string
    }

    const result = await listUsers(db, filters)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * POST /
 * Create a new user.
 */
router.post('/', requirePermission('users.create') as any, async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await createUser(db, parsed.data, authReq.user!.id)
    res.status(201).json(result)
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'El usuario ya existe' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * GET /:id
 * Get a single user by UUID id.
 */
router.get('/:id', requirePermission('users.read') as any, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID debe ser un UUID válido' })
      return
    }

    const db = req.app.get('db')
    const user = await getUserById(db, id)
    res.json(user)
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * PUT /me/pin
 * Any authenticated user can change their own PIN (no permission needed).
 * This route MUST be defined before /:id/pin to avoid conflict.
 */
router.put('/me/pin', async (req: Request, res: Response) => {
  try {
    const parsed = changePinSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    if (!authReq.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' })
      return
    }

    const db = req.app.get('db')
    const result = await changePin(db, authReq.user.id, parsed.data.pin, authReq.user.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * PUT /:id
 * Update user fields.
 */
router.put('/:id', requirePermission('users.update') as any, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID debe ser un UUID válido' })
      return
    }

    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await updateUser(db, id, parsed.data, authReq.user!.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })
      return
    }
    if (err.message === 'NO_FIELDS_TO_UPDATE') {
      res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE', message: 'No hay campos para actualizar' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * PUT /:id/pin
 * Change another user's PIN (requires users.update permission).
 */
router.put('/:id/pin', requirePermission('users.update') as any, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID debe ser un UUID válido' })
      return
    }

    const parsed = changePinSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await changePin(db, id, parsed.data.pin, authReq.user!.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * GET /:id/registers
 * Get registers assigned to a user.
 */
router.get('/:id/registers', requirePermission('users.read') as any, async (req: Request, res: Response) => {
  try {
    const pool = req.app.get('pool')
    const result = await pool.query(
      `SELECT r.* FROM pos_registers r
       INNER JOIN user_registers ur ON ur.register_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.name ASC`,
      [req.params.id]
    )
    res.json({ data: result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active,
    })) })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error obteniendo cajas del usuario' })
  }
})

const setUserRegistersSchema = z.object({
  registerIds: z.array(z.string().uuid()),
})

/**
 * PUT /:id/registers
 * Set registers assigned to a user (replaces all).
 */
router.put('/:id/registers', requirePermission('users.update') as any, async (req: Request, res: Response) => {
  try {
    const parsed = setUserRegistersSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
      return
    }

    const pool = req.app.get('pool')
    const userId = req.params.id

    // Ensure user_registers table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_registers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        register_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, register_id)
      )
    `)

    // Delete existing and insert new
    await pool.query('DELETE FROM user_registers WHERE user_id = $1', [userId])
    for (const registerId of parsed.data.registerIds) {
      await pool.query(
        'INSERT INTO user_registers (user_id, register_id) VALUES ($1, $2) ON CONFLICT (user_id, register_id) DO NOTHING',
        [userId, registerId]
      )
    }

    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error asignando cajas al usuario' })
  }
})

/**
 * DELETE /:id
 * Soft delete a user (set active=false).
 */
router.delete('/:id', requirePermission('users.delete') as any, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID debe ser un UUID válido' })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await deleteUser(db, id, authReq.user!.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

export default router
