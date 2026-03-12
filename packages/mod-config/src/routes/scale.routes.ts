import { Router } from 'express'
import type { Request, Response } from 'express'
import { requirePermission } from '@enlocal/core-server'
import { settings } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'
import { ScaleService } from '../services/scale.service'
import type { ScaleConfig } from '../services/scale.service'

const router = Router()
const SCALE_KEY = 'scale_config'

async function loadScales(db: any): Promise<ScaleConfig[]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SCALE_KEY))
  if (!row || !row.value) return []
  try { return JSON.parse(row.value as string) } catch { return [] }
}

async function saveScales(db: any, scales: ScaleConfig[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: SCALE_KEY, value: JSON.stringify(scales) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(scales), updatedAt: new Date() },
    })
}

/**
 * GET / — List all configured scales
 */
router.get('/', requirePermission('settings.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const scales = await loadScales(db)
    const scaleService: ScaleService | undefined = req.app.get('scaleService')
    res.json({
      scales,
      connected: scaleService?.isConnected() ?? false,
    })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al cargar basculas' })
  }
})

/**
 * POST / — Add or update a scale
 */
router.post('/', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const { id, name, port, baudRate, protocol, oldId } = req.body

    if (!id || !name || !port) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID, nombre y puerto son requeridos' })
      return
    }

    const scales = await loadScales(db)

    if (oldId) {
      const idx = scales.findIndex((s) => s.id === oldId)
      if (idx >= 0) {
        const wasDefault = scales[idx].isDefault
        scales[idx] = { id, name, port, baudRate: baudRate || 9600, protocol: protocol || 'generic', isDefault: wasDefault }
      } else {
        scales.push({ id, name, port, baudRate: baudRate || 9600, protocol: protocol || 'generic' })
      }
    } else {
      if (scales.some((s) => s.id === id)) {
        // Update existing
        const idx = scales.findIndex((s) => s.id === id)
        const wasDefault = scales[idx].isDefault
        scales[idx] = { id, name, port, baudRate: baudRate || 9600, protocol: protocol || 'generic', isDefault: wasDefault }
      } else {
        const isFirst = scales.length === 0
        scales.push({ id, name, port, baudRate: baudRate || 9600, protocol: protocol || 'generic', isDefault: isFirst })
      }
    }

    await saveScales(db, scales)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al guardar bascula' })
  }
})

/**
 * POST /default — Set default scale
 */
router.post('/default', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const { id } = req.body
    const scales = await loadScales(db)
    for (const s of scales) s.isDefault = s.id === id
    await saveScales(db, scales)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al establecer bascula predeterminada' })
  }
})

/**
 * DELETE /:id — Remove a scale
 */
router.delete('/:id', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const id = decodeURIComponent(req.params.id)
    let scales = await loadScales(db)
    scales = scales.filter((s) => s.id !== id)
    if (scales.length > 0 && !scales.some((s) => s.isDefault)) {
      scales[0].isDefault = true
    }
    await saveScales(db, scales)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al eliminar bascula' })
  }
})

/**
 * GET /ports — List available serial ports
 */
router.get('/ports', requirePermission('settings.read') as any, async (_req: Request, res: Response) => {
  try {
    const ports = await ScaleService.listPorts()
    res.json(ports)
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message || 'Error al listar puertos seriales' })
  }
})

/**
 * POST /test — Test: connect, read one weight, disconnect
 */
router.post('/test', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const { port, baudRate, protocol } = req.body

    if (!port) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Puerto es requerido' })
      return
    }

    const testConfig: ScaleConfig = {
      id: 'test',
      name: 'Test',
      port,
      baudRate: baudRate || 9600,
      protocol: protocol || 'generic',
    }

    const scaleService = new ScaleService()
    const result = await scaleService.testRead(testConfig)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al probar bascula' })
  }
})

/**
 * POST /connect — Open persistent connection with the default scale
 */
router.post('/connect', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const io = req.app.get('io')
    const scaleService: ScaleService | undefined = req.app.get('scaleService')

    if (!scaleService) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'ScaleService no inicializado' })
      return
    }

    const scales = await loadScales(db)
    const defaultScale = scales.find((s) => s.isDefault) || scales[0]

    if (!defaultScale) {
      res.status(400).json({ error: 'NO_SCALE', message: 'No hay bascula configurada' })
      return
    }

    await scaleService.connect(defaultScale, io)
    res.json({ success: true, scale: defaultScale.name })
  } catch (err: any) {
    res.status(500).json({ error: 'CONNECT_ERROR', message: err?.message || 'Error al conectar bascula' })
  }
})

/**
 * POST /disconnect — Close connection
 */
router.post('/disconnect', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const scaleService: ScaleService | undefined = req.app.get('scaleService')
    if (scaleService) {
      await scaleService.disconnect()
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: 'DISCONNECT_ERROR', message: err?.message || 'Error al desconectar bascula' })
  }
})

/**
 * GET /weight — Get current weight from buffer (fallback if not using Socket.io)
 */
router.get('/weight', requirePermission('settings.read') as any, async (req: Request, res: Response) => {
  try {
    const scaleService: ScaleService | undefined = req.app.get('scaleService')
    if (!scaleService || !scaleService.isConnected()) {
      res.json({ connected: false, weight: 0, unit: 'kg', stable: false })
      return
    }
    const reading = scaleService.getWeight()
    res.json({ connected: true, ...reading })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al leer peso' })
  }
})

export default router

// Re-export loadScales for use in server/index.ts startup
export { loadScales }
