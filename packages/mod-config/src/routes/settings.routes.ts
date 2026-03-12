import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { getAllSettings, getSetting, updateSetting, bulkUpdateSettings } from '../services/settings.service'
import { updateSettingSchema, bulkUpdateSettingsSchema } from '../validators'

const router = Router()

/**
 * GET /
 * List all settings, with optional ?module= filter.
 */
router.get('/', requirePermission('settings.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const module = req.query.module as string | undefined
    const result = await getAllSettings(db, module)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * GET /:key
 * Get a single setting by key.
 */
router.get('/:key', requirePermission('settings.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const result = await getSetting(db, req.params.key)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'SETTING_NOT_FOUND') {
      res.status(404).json({ error: 'SETTING_NOT_FOUND', message: 'Configuración no encontrada' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * PUT /:key
 * Upsert a single setting.
 */
router.put('/:key', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const parsed = updateSettingSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await updateSetting(db, req.params.key, parsed.data.value, authReq.user!.id, parsed.data.module)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * POST /bulk
 * Bulk upsert multiple settings.
 */
router.post('/bulk', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const parsed = bulkUpdateSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const db = req.app.get('db')
    const result = await bulkUpdateSettings(db, parsed.data.items, authReq.user!.id)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

export default router
