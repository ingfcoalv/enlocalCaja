import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { listRoles, createRole, updateRole, deleteRole } from '../services/roles.service'
import { createRoleSchema, updateRoleSchema } from '../validators'

const router = Router()

/**
 * GET /
 * List all roles.
 */
router.get('/', requirePermission('roles.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const result = await listRoles(db)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * POST /
 * Create a new role.
 */
router.post('/', requirePermission('roles.create') as any, async (req: Request, res: Response) => {
  try {
    const parsed = createRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await createRole(db, parsed.data, authReq.user!.id)
    res.status(201).json(result)
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'El rol ya existe' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * PUT /:id
 * Update a role's name and/or permissions.
 */
router.put('/:id', requirePermission('roles.update') as any, async (req: Request, res: Response) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await updateRole(db, req.params.id, parsed.data, authReq.user!.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'ROLE_NOT_FOUND') {
      res.status(404).json({ error: 'ROLE_NOT_FOUND', message: 'Rol no encontrado' })
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
 * DELETE /:id
 * Delete a role (only non-system roles).
 */
router.delete('/:id', requirePermission('roles.delete') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const result = await deleteRole(db, req.params.id)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'ROLE_NOT_FOUND') {
      res.status(404).json({ error: 'ROLE_NOT_FOUND', message: 'Rol no encontrado' })
      return
    }
    if (err.message === 'CANNOT_DELETE_SYSTEM_ROLE') {
      res.status(403).json({ error: 'CANNOT_DELETE_SYSTEM_ROLE', message: 'No se puede eliminar un rol del sistema' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

export default router
